# 01 — Dominio y esquema de plantilla y documento

Autor: fase 1, rol `1-dominio` (redactado por una sesión anterior de este mismo rol de orquestación que se interrumpió antes de firmar memoria; revisado, completado y firmado por el orquestador de esta sesión — ver `memoria/bitacora/1-dominio.md`). Estado: aceptado por el orquestador (ADR-001…ADR-008, ADR-020, ADR-021 en `memoria/decisiones.md`).

**Revisado y profundizado en la ronda 1R** (2026-09-03, revisor independiente `1R-dominio`): 25 objeciones
altas y medias, todas corregidas en sitio; verificación **ejecutable** del esquema (`tsc --strict`, emisión
de JSON Schema, validación de los 10 archivos de ejemplo contra Zod y contra ajv 2020-12, implementación de
referencia de `compose` que reproduce los golden files). Ver **§11** y `memoria/bitacora/1R-dominio.md`.
Las ADR nuevas están propuestas como `ADR-1R-D-01`…`ADR-1R-D-08`.
Evidencia: `handoffs/0-resumen-auditoria-dominio.md`, `fases/J-inventario-json.md` §5–§6, `fases/C1-generacion-parte1.md`, `fases/C2-generacion-parte2.md`, `EditorModels.kt:12-494` (referencia de *lo que se sustituye*, no base).

---

## 1. Las cuatro capas

| Capa | Quién la escribe | Dónde vive | Mutabilidad |
|---|---|---|---|
| **1. Paquete de plantilla** (`slug@semver`) | Autor de plantillas (kit, fase 4) | Git + `tpl_template_version.manifest` (JSONB) | **Inmutable** una vez publicada |
| **2. `theme`** | Cliente (elige de presets) | `tpl_document.doc.theme` | Solo `paletteId` + `fontSetId`; **jamás** color, fuente ni CSS (P3) |
| **3. `structure`** | Cliente (ocultar/reordenar) | `tpl_document.doc.structure` | Lista ordenada de `{key, variant, visible}` |
| **4. `content`** | Cliente (textos, fotos) | `tpl_document.doc.content` | **Mapa plano por id de bloque** |

**Datos de negocio** (invitación, invitados, RSVP, fecha, hashtag, `coverPhotoUrl`) viven en las tablas relacionales existentes y **nunca** se copian dentro de `doc`. Entran en la composición por *rol*, no por posición (mata H-01/H-02).

### Por qué `content` es un mapa plano y no un árbol

El defecto raíz de la auditoría es el emparejamiento por posición (`items[0]`=novio, H-02) y por texto de título (`"Padre"/"Padrino"`, H-01), que hace perder los datos del usuario en 5 de 6 plantillas no-boda. Un mapa `{"<blockId>": <valor>}` hace el merge por id estable **estructuralmente imposible de equivocar** (P2): no hay índice al que recurrir. Los grupos repetibles llevan `itemId` generado por el servidor (ULID), estable a través de reordenamientos y de cambios de versión de plantilla.

---

## 2. Esquema formal del paquete de plantilla

### 2.1 Disposición en disco (kit de autor, fase 4)

Árbol **exacto**. Cualquier archivo o directorio no listado aquí hace fallar el registro con `TPL_PACKAGE_UNEXPECTED_FILE` (P1: nada se ignora en silencio).

```
templates/<slug>/<version>/
  template.json                      # manifiesto        → TemplateManifest  (obligatorio)
  theme.json                         # paletas y fuentes → ThemeSpec         (obligatorio)
  defaults.json                      # demo por blockId  → DefaultsFile      (obligatorio)
  assets/                            # 0..200 archivos, sin subdirectorios
    <nombre>.<ext>                   # ^assets/[a-z0-9][a-z0-9._-]{0,99}$
  migrations/                        # opcional; una entrada por cada `migrationsFrom`
    <from>-to-<version>.json         # → MigrationPlan
```

- Los tres `.json` obligatorios son UTF-8 sin BOM y **deben** validar contra su esquema antes de mirar nada más.
- `migrations/` contiene **exactamente** un archivo por cada versión listada en `manifest.migrationsFrom`, ni uno más
  (`TPL_MIGRATION_PLAN_ORPHAN`) ni uno menos (`TPL_MIGRATION_PLAN_MISSING`). El nombre se deriva: `${from}-to-${manifest.version}.json`.
- `assets/` contiene **exactamente** las rutas listadas en `manifest.assets[]`, con su `sha256` y `bytes` coincidentes.

#### Algoritmo exacto de `package_hash`

`package_hash` es la clave de idempotencia del registro (ADR-008) y de `tpl_template_version` (`02 §2.2`).
Un cambio en **cualquier** byte del paquete tiene que cambiarlo — la fórmula anterior de este documento
(`sha256(canonicalJson(manifest) || sha256 de cada asset)`) **no incluía `theme.json`, `defaults.json` ni las
migraciones**: dos paquetes con el mismo manifiesto y distintos textos de demostración colisionaban y el
segundo registro se descartaba como no-op silencioso (objeción 1R **O-06**).

```
package_hash = "sha256:" + hex( SHA-256( LF.join( lineas ) ) )

lineas = [ f"{ruta}\t{sha256hex(bytes_del_archivo)}"  para cada archivo del paquete ]
         ordenadas por `ruta` con comparación byte a byte de su codificación UTF-8 (no por locale)
```

- `ruta` es relativa a `templates/<slug>/<version>/`, con `/` como separador (nunca `\`).
- Para los tres `.json` obligatorios y para los planes de migración, `bytes_del_archivo` **no** es el archivo en
  disco: es `canonicalJson(JSON.parse(archivo))` codificado en UTF-8 (ver §5.5), para que un reformateo,
  un reordenamiento de claves o un cambio de sangría **no** produzca un paquete distinto.
- Para los archivos de `assets/`, `bytes_del_archivo` son los bytes literales.
- Se excluye todo lo que no esté en el árbol de arriba (no puede haber nada más: el registro ya falló).
- `LF` es `"\n"`. No hay `\n` final.

El resultado es determinista entre sistemas operativos y entre Kotlin y Node, y es el mismo valor que
`02 §2.2` almacena como `tpl_template_version.package_hash` (`VARCHAR(71)` con `CHECK (package_hash ~ '^sha256:[0-9a-f]{64}$')`, único por `(template_id, package_hash)`; decisión X-01 — el prefijo de algoritmo se guarda, no se recorta).

### 2.2 Manifiesto (`template.json`)

```jsonc
{
  "manifestVersion": 1,              // versión del esquema DEL manifiesto (no de la plantilla)
  "slug": "boda-clasica",            // ^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$
  "version": "1.0.0",                // semver estricto
  "name": "Boda clásica",
  "eventKinds": ["wedding"],         // catálogo cerrado; sustituye a `eventTypeId == 1L` (H-20)
  "minPlanTier": 1,
  "locales": ["es-MX"],
  "capabilities": ["singlePlace", "story", "hashtags"],  // capacidades DECLARADAS, no `templateId` mágico (H-11)
  "previewImage": "assets/preview.webp",                 // opcional; debe estar en `assets`
  "sections": [ /* SectionSpec[] — ver 2.3 */ ],
  "assets": [ { "path": "assets/fondo.webp", "sha256": "…64 hex…",
                "contentType": "image/webp", "bytes": 110000 } ],
  "migrationsFrom": ["0.9.0"]
}
```

Correcciones de la ronda 1R sobre el borrador anterior de este bloque (objeción **O-07**): `name` y
`description` son `LocalizedText` (`{"es-MX": "…"}`), **no** cadenas sueltas; `AssetEntry` exige `bytes`;
y el manifiesto **no** tiene campo `theme` — `theme.json` es un archivo hermano del paquete, no un `$ref`
embebido (`z.strictObject` rechazaría la clave). La forma normativa es `esquema/manifest.ts`, no este bloque.

Reglas duras del manifiesto (todas validadas en el registro, ninguna implícita — el pecado de §6 del informe es que estas 12+ reglas eran comportamiento observado, no esquema):

- `slug` + `version` únicos; `version` semver estricto; **una versión publicada nunca se sobrescribe** (mata H-09: el seed pisaba plantillas en cada arranque).
- Los `key` de sección son únicos dentro del manifiesto.
- Los `id` de bloque son únicos **en todo el manifiesto**, no solo dentro de su sección (mata H-28: ids duplicados en mesa de regalos).
- Todo `blockId` cumple `^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$`, ≤ 80 caracteres, ≤ 4 segmentos. Sin `..`, sin `/`, sin `$`, sin espacios (ver `09-verificacion-adversarial-seguridad.md` §2, objeción S-04).
- Todo `role` pertenece al catálogo cerrado de roles (§3.3).
- Toda `variant` referenciada por `defaultVariant` existe en `variants`.
- Todo asset listado existe y su `sha256` coincide.
- `defaults.json` solo puede tener claves que sean `blockId` del manifiesto; una clave desconocida **falla el registro** (P1: nada se descarta en silencio, mata H-12).

### 2.3 `SectionSpec`

```jsonc
{
  "key": "cover",                    // estable, único
  "type": "cover",                   // del catálogo cerrado de 12 tipos (§3.1)
  "title": { "es-MX": "Portada" },   // etiqueta para el editor; NUNCA hardcodeada en Kotlin (mata H-31/H-32)
  "variants": ["full", "split"],     // 1..6 identificadores kebab-case
  "defaultVariant": "full",          // ∈ variants (I-08)
  "required": true,                  // si true, `visible` no puede ponerse en false (I-17)
  "defaultVisible": true,
  "blocks": [ /* BlockSpec[], 1..40 */ ]
}
```

**No existen `hideable` ni `defaultOrder`** (los traía un borrador anterior; objeción 1R **O-08**).
`hideable` es redundante con `required`. El **orden por defecto es el orden del array `manifest.sections`**:
un índice explícito abre la puerta a dos ordenaciones que se contradicen. El orden efectivo de la página lo
fija el array `doc.structure.sections` (§4), y R1 (§5.2) define exactamente dónde entra una sección que el
documento todavía no menciona.

`visibility` deja de ser un campo ignorado (H-25/§6.1 regla 5: hoy se fuerza `true`): `structure[].visible` es autoridad, y `required: true` es la única forma de impedir ocultar una sección.

### 2.4 `BlockSpec`

```jsonc
{
  "id": "couple.brideName",
  "type": "text",                    // del catálogo cerrado de 14 tipos (§3.2)
  "role": "celebrantB",              // rol explícito; el merge y la IA operan por rol+id
  "label": { "es-MX": "Nombre de la novia" },
  "help":  { "es-MX": "Como quieres que aparezca en la portada" },
  "required": true,
  "editable": true,                  // false ⇒ el editor lo muestra en solo lectura
  "aiEditable": true,                // false ⇒ ninguna Operation producida por IA puede tocarlo
  "source": "user",                  // "user" | "business" | "fixed"  (enum de 3, NO "business:<campo>")
  "businessField": null,             // obligatorio si source = "business" (I-05); tipado por I-06
  "constraints": { "minLength": 1, "maxLength": 60, "multiline": false }
}
```

- **No existe `defaultRef`** (objeción 1R **O-09**): la clave de `defaults.json` **es** el `blockId`, sin excepción,
  y una clave de `defaults.json` que no sea un `blockId` declarado falla el registro (I-10). Un segundo nivel de
  indirección solo añadiría una forma más de perder contenido en silencio.
- `source` es un enum de tres valores; el campo de negocio va aparte en `businessField`
  (`"invitation.date" | "invitation.time" | "invitation.hashtag" | "invitation.coverPhotoUrl" |
  "invitation.childrenAllowed" | "invitation.youngAllowed"`). Un `source: "business:invitation.date"` **no valida**.
- Los bloques `business` los **lee** la composición de Postgres. El editor los pinta como solo lectura con un
  enlace a "editar datos del evento". Esto elimina H-04 de raíz: no hay copia que desincronizar.
  Un `defaults.json` que traiga valor para un bloque `business` falla el registro (I-28): sería contenido muerto.
- `source: "fixed"` es contenido de la plantilla no editable (p. ej. el rótulo legal del pie). Su valor sale
  **siempre** de `defaults.json` y `doc.content` no puede escribirlo (I-21).

### 2.5 Grupos repetibles (`type: "group"`)

```jsonc
{
  "id": "event.cards",
  "type": "group",
  "role": "eventCards",
  "min": 1, "max": 8,
  "reorderable": true,
  "itemLabel": { "es-MX": "Evento" },
  "itemBlocks": [
    { "id": "title",    "type": "text",     "role": "eventTitle",   "required": true, "constraints": {"maxLength": 60} },
    { "id": "when",     "type": "dateTimeRange", "role": "eventWhen", "required": true },
    { "id": "place",    "type": "location", "role": "eventPlace",   "required": true },
    { "id": "mapLink",  "type": "link",     "role": "eventMapLink", "required": false }
  ]
}
```

Los `itemBlocks` llevan ids **cortos, relativos al grupo** (nunca prefijados con el id del grupo — corregido en esta revisión: un borrador previo de este snippet usaba `"event.cards.title"`, inconsistente con los ejemplos reales de `diseno/ejemplos/*/template.json`, que siempre usan la forma corta; hallazgo adversarial E-03). En el documento se direccionan como la terna `("event.cards", itemId, "title")` — el `blockId` corto solo es único **dentro de su grupo**, nunca globalmente (a diferencia de los `blockId` de nivel de sección, que sí son únicos en todo el manifiesto, `I-13`). Esto resuelve H-49 (`itinerary[]` no admitía `locationButton`/`locationDatetime`: aquí el grupo declara sus propios bloques) y H-33 (listas heterogéneas: `body` es un bloque `listText` dentro del ítem, no un colapso a un elemento).

### 2.6 `theme.json`

```jsonc
{
  "palettes": [
    { "id": "blush", "name": {"es-MX": "Rosa empolvado"},
      "tokens": { "bg": "#FDF7F5", "surface": "#FFFFFF", "ink": "#3A2E2B",
                  "accent": "#C98B8B", "accentInk": "#FFFFFF", "muted": "#9A8A86" } }
  ],
  "fontSets": [
    { "id": "serif-elegante", "name": {"es-MX": "Serif elegante"},
      "heading": { "family": "Cormorant Garamond", "weights": [400,600], "source": "google" },
      "body":    { "family": "Inter", "weights": [400,500], "source": "google" } }
  ],
  "defaultPaletteId": "blush",
  "defaultFontSetId": "serif-elegante"
}
```

Los tokens son **de la plantilla**, no del backend (P3, revierte los 14 literales de FontAwesome, los arrays RGBA y `fontFamily = "Poppins"` hardcodeados). El documento del cliente solo guarda `{paletteId, fontSetId}`; si el id no existe en la versión de plantilla, la composición **falla ruidosamente** con `TPL_THEME_ID_UNKNOWN` y cae al default declarado, registrando el incidente en el informe de composición (nunca en silencio).

---

## 3. Catálogos cerrados

### 3.1 Tipos de sección (12) — cobertura de las 8 plantillas sembradas

Derivados de las 13 claves de sección verificadas idénticas en los 9 `default_visual_*.json` (`fases/J-inventario-json.md` §3 y §5).

| `type` | Sección actual equivalente | Notas |
|---|---|---|
| `cover` | `sectionCover` | portada |
| `celebrant` | `sectionCouple` | **unifica** boda (2 personas) y XV/bautizo (1) por rol, no por campos `groom*`/`bride*` nullables |
| `event` | `sectionEvent` | soporta `singlePlace` como *capability*, no como campo muerto (mata H-12) |
| `gallery` | `sectionGallery` | ids de la plantilla preservados (mata H-25) |
| `giftTable` | `sectionGifttable` | |
| `suggestions` | `sectionSuggestions` | |
| `amenities` | `sectionAmenities` | |
| `rsvp` | `sectionStarted` | solo presentación; el RSVP real es del módulo existente |
| `family` | `sectionFamily` | por rol explícito (mata H-01/H-02) |
| `story` | `sectionStory` | ausente en 6 de 9 plantillas: es opcional |
| `dressCode` | `sectionDresscode` | **lista completa**, no solo la primera fila (mata H-51) |
| `footer` | `sectionFooter` | |

`settings` (música, colores, `child_friendly`) **no es una sección**: música pasa a bloque `audio` de una sección, los colores pasan a `theme`, y `child_friendly`/`young_friendly` son datos de negocio (`invitation.children_allowed`/`young_allowed`), leídos por `source: "business"` + `businessField`.

#### Variantes y bloques admitidos por tipo de sección

`variants` es una lista **libre por plantilla** (1..6 identificadores kebab-case): el catálogo cerrado es el
de **tipos de sección**, no el de variantes — una variante es una decisión de maquetación del autor y el
backend no la interpreta jamás (P3). La columna "variantes de referencia" es lo que implementan
`boda-clasica@1.0.0` y `xv-jardin@1.0.0`, y lo que `packages/sections` debe traer de fábrica (fase 3).

La columna "bloques admitidos" **sí** es normativa: es el conjunto de roles que un `SectionSpec` de ese
`type` puede declarar. Un rol fuera de la lista falla el registro.

| `type` | Variantes de referencia | Bloques admitidos (por rol) | Card. |
|---|---|---|---|
| `cover` | `full`, `framed`, `split` | `coverTitle`, `coverSubtitle`, `coverDate`, `coverImage`, `coverBackground`, `coverButtonLabel`, `coverButtonLink` | 1 sección por plantilla |
| `celebrant` | `side-by-side`, `stacked`, `centered` | `celebrantsHeading`, `celebrantsDate`, `celebrantsMessage`, `celebrantA`, `celebrantB`, `honoree`, `celebrantAPhoto`, `celebrantBPhoto`, `honoreePhoto`, `celebrantAText`, `celebrantBText`, `honoreeMessage`, `sectionIntro`, `sectionBackground` | 1 |
| `family` | `cards`, `list` | `sectionTitle`, `familyIntro`, `familyGroupTitle`, `parentA1`, `parentA2`, `parentB1`, `parentB2`, `godparentA`, `godparentB`, `witness`, **`familyGroup`**/**`personList`** (grupo: `personName`, `personLabel`, `personPhoto`, `personPhotoVisible`), `sectionBackground` | 0..n |
| `event` | `timeline`, `cards`, `single-place` | `sectionTitle`, `sectionIntro`, `eventLocationNote`, `eventPlace`, **`eventCards`** (grupo: `eventTitle`, `eventWhen`, `eventDate`, `eventTime`, `eventPlace`, `eventMapLink`, `eventNote`), `sectionBackground` | 1..n |
| `gallery` | `grid-6`, `grid-9`, `carousel` | `sectionTitle`, `galleryIntro`, **`galleryPhotos`** (grupo: `galleryPhoto`), `hashtag`, **`hashtagList`** (grupo: `hashtag`, `hashtagLink`, `hashtagPlatform`), `sectionBackground` | 0..n |
| `giftTable` | `cards`, `list` | `sectionTitle`, `sectionIntro`, **`giftOptions`** (grupo: `giftOptionKind`, `giftOptionTitle`, `giftOptionDetail`, `giftOptionImage`, `giftOptionLink`), `sectionBackground` | 0..n |
| `suggestions` | `cards`, `list` | `sectionTitle`, `sectionIntro`, **`suggestionList`** (grupo: `suggestionName`, `suggestionDetail`, `suggestionImage`, `suggestionLink`), `sectionBackground` | 0..n |
| `amenities` | `cards`, `list` | `sectionTitle`, `sectionIntro`, **`amenityList`** (grupo: `amenityName`, `amenityDetail`, `amenityImage`, `amenityLink`), `sectionBackground` | 0..n |
| `rsvp` | `banner`, `form-inline` | `sectionTitle`, `rsvpNote`, `rsvpKidsNote`, `rsvpDeadline`, `rsvpChildrenAllowed`, `rsvpYoungAllowed`, `rsvpBackground` | 1 |
| `story` | `line`, `alternating` | `sectionTitle`, `sectionIntro`, **`storyMilestones`** (grupo: `storyTitle`, `storyDate`, `storyBody`, `storyImage`), `sectionBackground` | 0..n |
| `dressCode` | `two-columns`, `cards` | `sectionTitle`, `sectionIntro`, **`dressCodeRules`** (grupo: `dressCodeTitle`, `dressCodeDetail`, `dressCodeImage`), `sectionBackground` | 0..n |
| `footer` | `simple` | `footerNote`, `footerLogo`, `footerLink`, `backgroundMusic`, `backgroundMusicEnabled`, `decorative` | 1 |

Los roles genéricos `sectionTitle`, `sectionIntro`, `sectionBackground` y `decorative` son admisibles en
**cualquier** tipo de sección. El resto solo donde figura arriba.

### 3.2 Tipos de bloque (14) — catálogo cerrado

Forma normativa: `esquema/blocks.ts`. Esta tabla es su lectura, columna a columna, con **el valor que
`compose` produce cuando no hay ni contenido del cliente ni default** (siempre `null` con `provenance:"empty"`:
un bloque nunca se rellena con un valor inventado — R5) y **los roles válidos** de cada tipo.

| # | `type` | Valor en `content` (Zod) | Valor `ResolvedValue` (salida de `compose`) | Sin valor | Invariantes | Roles válidos |
|---|---|---|---|---|---|---|
| 1 | `text` | `{kind:"text", value: string ≤2000}` | `{kind:"text", value}` | `null` | I-15, I-16 (`minLength`/`maxLength`) | cualquiera **excepto** los de grupo (I-25) |
| 2 | `richText` | `{kind:"richText", doc: RichDoc}` — `doc`→`paragraph[≤40]`→`text[≤50]`, marcas `bold`/`italic`, `href` opcional `HttpUrl` | `{kind:"richText", doc}` (verbatim) | `null` | I-15, I-16 sobre la **suma de `text` en texto plano** (1R A-02) | `celebrantAText`, `celebrantBText`, `honoreeMessage`, `celebrantsMessage`, `storyBody`, `sectionIntro`, `footerNote` |
| 3 | `listText` | `{kind:"listText", items: string[≤12] ≤200 c/u}` | `{kind:"listText", items}` | `null` | I-15, I-04 (`minItems`/`maxItems`), I-16 (`maxItemLength`) | `familyIntro`, `giftOptionDetail`, `sectionIntro`, `amenityDetail`, `suggestionDetail`, `rsvpNote` |
| 4 | `image` | `{kind:"image", assetId, alt ≤200, focal:{x,y}∈[0,1]}` | `{kind:"image", url, alt, focal}` — la URL sale de `AssetIndex`, **jamás** del documento (ADR-021) | `null` | I-15; `aspect`/`maxBytes` los valida la **subida** (`03 §4`), no el documento | `coverImage`, `coverBackground`, `celebrantAPhoto`, `celebrantBPhoto`, `honoreePhoto`, `personPhoto`, `galleryPhoto`, `giftOptionImage`, `suggestionImage`, `amenityImage`, `storyImage`, `dressCodeImage`, `rsvpBackground`, `sectionBackground`, `footerLogo`, `decorative` |
| 5 | `audio` | `{kind:"audio", assetId}` | `{kind:"audio", url}` | `null` | I-15; `maxBytes` en la subida | `backgroundMusic` |
| 6 | `date` | `{kind:"date", value:"YYYY-MM-DD"}` | `{kind:"date", value, formatted}` | `null` | I-15 | `coverDate`, `celebrantsDate`, `eventDate`, `storyDate`, `rsvpDeadline` |
| 7 | `time` | `{kind:"time", value:"HH:mm"}` (24 h) | `{kind:"time", value, formatted}` | `null` | I-15 | `eventTime` |
| 8 | `dateTimeRange` | `{kind:"dateTimeRange", start, end?}` — `YYYY-MM-DDTHH:mm` local, sin zona | `{kind:"dateTimeRange", start, end?, formatted}` | `null` | I-15, **I-01 `end ≥ start`** (dos implementaciones; `.refine()` no se exporta) | `eventWhen` |
| 9 | `link` | `{kind:"link", href: HttpUrl, label? ≤80}` | `{kind:"link", href, label?}` | `null` | I-15; `HttpUrl` es una **regex `^https?://…`**, no `format:"uri"` (1R A-01) | `eventMapLink`, `giftOptionLink`, `suggestionLink`, `amenityLink`, `hashtagLink`, `footerLink`, `coverButtonLink` |
| 10 | `location` | `{kind:"location", name 1..120, address? ≤300, mapHref? HttpUrl}` | `{kind:"location", name, address?, mapHref?}` | `null` | I-15 | `eventPlace` |
| 11 | `choice` | `{kind:"choice", optionId: Ident}` | `{kind:"choice", optionId, label}` — `label` resuelta del `spec.options` en el locale | `null` | I-15, **I-02** `optionId ∈ spec.options` | `giftOptionKind`, `hashtagPlatform`, `dressCodeTitle` |
| 12 | `boolean` | `{kind:"boolean", value: bool}` | `{kind:"boolean", value}` | `null` | I-15 | `personPhotoVisible`, `backgroundMusicEnabled`, `rsvpChildrenAllowed`, `rsvpYoungAllowed` |
| 13 | `person` | `{kind:"person", name 1..120, note? ≤200}` | `{kind:"person", name, note?}` | `null` | I-15 | `celebrantA`, `celebrantB`, `honoree`, `parentA1`, `parentA2`, `parentB1`, `parentB2`, `godparentA`, `godparentB`, `witness`, `personName` |
| 14 | `group` | `{kind:"group", items:[{itemId: ULID, values: {…}}] ≤24}` | `{id, role, type:"group", label, provenance, items:[{itemId, blocks:[…]}]}` — **sin campo `value`** | `items: []` | I-15, **I-03** (`itemId` único), **I-04** (`min ≤ n ≤ max`), **I-07** (`min ≤ max`), **I-18** (itemBlock declarado), **I-22** (todo itemBlock es `source:"user"`), **I-25** (rol de grupo) | **solo** los 10 roles de grupo: `familyGroup`, `eventCards`, `galleryPhotos`, `storyMilestones`, `giftOptions`, `suggestionList`, `amenityList`, `dressCodeRules`, `hashtagList`, `personList` |

Reglas transversales:

- Un `content` cuyo `kind` no corresponde al `type` del `BlockSpec` se **rechaza** (`I-15` →
  `TPL_BLOCK_TYPE_MISMATCH`), nunca se coacciona.
- **Los grupos no anidan**: `GroupItem.values` solo admite `ScalarValue`. Una plantilla que necesite dos
  listas de familia (p. ej. "Mis Padres" y "Mis Padrinos", como `default_visual_xv_premium.json`
  `sectionFamily.items[]`, que sí anidaba) declara **dos bloques `group`** distintos, cada uno con su
  `familyGroupTitle`. Consecuencia aceptada: el cliente no puede **añadir** un tercer grupo de familia,
  solo ítems dentro de los que la plantilla declara.
- Los `itemBlocks` llevan ids **cortos** (`title`, `when`, `place`), únicos solo dentro de su grupo. Un
  `blockId` de nivel de sección y un `itemBlockId` pueden coincidir (`title`) sin ambigüedad: el
  direccionamiento de un ítem es siempre la terna `(groupId, itemId, itemBlockId)` (§5.4).
- Los valores por defecto **de una plantilla** viven en `defaults.json`. No hay "valor por defecto del tipo":
  un bloque sin contenido ni default sale como `null` con `provenance:"empty"` y el componente de sección
  decide si se omite (R5, "nada se fabrica").

### 3.3 Roles (catálogo cerrado, extensible por versión mayor del manifiesto)

**La forma normativa del catálogo es `esquema/blocks.ts` (`BlockRole`), no esta sección.** El listado que
traía este documento antes de la ronda 1R nombraba 7 roles que **no existían** en el esquema (`witness`,
`storyMilestone`, `giftOption`, `bankAccount`, `dressCodeRule`, `amenity`, `suggestion`) y omitía otros 46
que sí — un agente de fase 2 que hubiese implementado esta lista habría producido un enum incompatible
(objeción 1R **O-01**). Resolución: los que faltaban se **añadieron** al esquema o se mapearon a un rol
existente, y esta sección pasa a describir las tres familias, no a duplicar la lista.

| Familia | Para qué sirve | Unicidad |
|---|---|---|
| **Roles escalares** (~60) | Identifican *qué representa* un bloque no repetible: `coverTitle`, `celebrantA`, `parentA1`, `eventWhen`, `giftOptionDetail`, `footerNote`… | Se repiten libremente salvo los singleton |
| **Roles de grupo** (10) | Reservados a bloques `type:"group"`: `familyGroup`, `eventCards`, `galleryPhotos`, `storyMilestones`, `giftOptions`, `suggestionList`, `amenityList`, `dressCodeRules`, `hashtagList`, `personList` | Uno por sección, por convención |
| **Roles singleton** (17) | Identifican una persona o un dato **único** del evento: `celebrantA/B`, `honoree`, `celebrantAPhoto/BPhoto`, `honoreePhoto`, `parentA1/A2/B1/B2`, `coverTitle/Subtitle/Date/Image`, `rsvpDeadline`, `backgroundMusic`, `hashtag` | **Como mucho uno por manifiesto** (I-26) |

- **I-25** — un bloque `group` **debe** llevar un rol de grupo, y un bloque escalar **nunca** puede llevarlo.
  Antes de la ronda 1R los 8 grupos de `boda-clasica@1.0.0` reutilizaban el rol de uno de sus propios
  `itemBlocks` (`event.cards` → `eventTitle`, igual que `event.cards.title`), lo que hacía **ambiguo** el
  direccionamiento por rol que usan la IA (`07 §3`) y el mapeo al cambiar de plantilla (§6.3) — objeción **O-02**.
- **I-26** — un rol singleton no puede aparecer dos veces. Los demás sí: `boda-clasica@1.0.0` usa
  `sectionTitle` ocho veces de forma perfectamente legítima, así que una regla de "roles únicos" sin más
  habría sido falsa (medido en la ronda 1R, ataque A-10).
- **`role` es lo que sustituye al emparejamiento por texto de H-01.** `parentA1` ("madre del novio") es un
  rol, no la cadena `"Padre"`. Un `role` fuera del enum falla el registro de la plantilla.
- Ampliar el catálogo exige subir `manifestVersion`; quitar un rol, un cambio mayor de `manifestVersion`.

---

## 4. Esquema del documento de invitación

```jsonc
{
  "schemaVersion": 1,
  "template": { "slug": "boda-clasica", "version": "1.2.0" },
  "theme":    { "paletteId": "blush", "fontSetId": "serif-elegante" },
  "structure": {
    // El ORDEN DEL ARRAY es el orden de la página. No hay campo `order`: dos fuentes de
    // ordenación (índice del array + entero `order`) se contradicen en cuanto una se olvida
    // de actualizar (objeción 1R O-10). `StructureEntry` = {key, variant, visible}, nada más.
    "sections": [
      { "key": "cover",  "variant": "full",  "visible": true  },
      { "key": "story",  "variant": "line",  "visible": false }
    ]
  },
  "content": {
    "cover.title":     { "kind": "text",  "value": "Ana & Luis" },
    "gallery.photos":  { "kind": "group", "items": [
        { "itemId": "01JB…AZ", "values": { "gallery.photos.image": { "kind":"image", "assetId":"as_7f…", "alt":"", "focal":{"x":0.5,"y":0.4} } } }
    ]}
  },
  "attic": {                     // contenido huérfano tras una migración; nunca se borra (ADR-006)
    "1.0.0": { "couple.groomText": { "kind":"text", "value":"…" } }
  },
  "meta": { "locale": "es-MX", "updatedAt": "2026-09-03T12:00:00Z" }
}
```

Invariantes del documento (validadas en cada escritura):

1. `template.slug@version` debe existir y estar `published`.
2. Toda clave de `content` es un `blockId` **declarado en esa versión** del manifiesto, o la escritura se rechaza con `TPL_BLOCK_UNKNOWN` (P1). No se aceptan claves desconocidas ni se descartan en silencio.
3. Todo `structure.sections[].key` existe en el manifiesto (I-19) y no se repite (I-11). `reorderSections`
   exige una permutación exacta, no una lista cualquiera (I-24).
4. `theme.paletteId`/`fontSetId` existen en `theme.json` de esa versión.
5. `attic` es de solo escritura para el sistema: el editor no puede escribirlo (P8).
6. El documento **no contiene** URLs, colores, tamaños, fuentes, iconos ni ids de Mongo. Auditable con una búsqueda (definición de terminado global §3).

---

## 5. Reglas de composición (P2, P5)

### 5.1 Firma

La implementación de referencia ejecutable es **`esquema/compose.ts`** (añadida en la ronda 1R): reproduce
byte a byte los dos `compuesto.json` de `ejemplos/` y es la especificación que Kotlin debe igualar.

**Faltaba un parámetro.** La firma anterior no recibía nada con lo que convertir un `assetId` opaco en una
URL, y `ResolvedValue` sí exige `url` — `compose` era inimplementable tal como estaba escrita (objeción 1R
**O-03**). Se añade `assets: AssetIndex`, que el backend construye desde `tpl_asset` **antes** de llamar, de
modo que `compose` sigue siendo pura y sin E/S (R6).

```typescript
// frontend/packages/schema/src/compose.ts
export type TemplatePackage = { manifest: TemplateManifest; theme: ThemeSpec; defaults: DefaultsFile };

export function compose(
  pkg:      TemplatePackage,   // manifiesto + theme + defaults de UNA versión concreta (inmutable)
  doc:      InvitationDocument,// capas 2-4 del cliente
  business: BusinessSnapshot,  // proyección inmutable de Postgres
  assets:   AssetIndex,        // assetId → {url, width?, height?}; resuelto ANTES, nunca dentro
  locale:   Locale,            // "es-MX" | "es-ES" | "en-US"
): CompositionResult;          // { composed: ComposedDocument; report: CompositionReport }

export function formatDate(value: string, formatId: string, locale: Locale): string;
export function formatRange(start: string, end: string | undefined, formatId: string, locale: Locale): string;
export function canonicalJson(value: unknown): string;
```

```kotlin
// mx.evolutiondev.invitaciones.modules.templates2.composition
package mx.evolutiondev.invitaciones.modules.templates2.composition

@JvmInline value class BlockId(val value: String)
@JvmInline value class SectionKey(val value: String)
@JvmInline value class AssetId(val value: String)

data class TemplatePackage(
    val manifest: TemplateManifest,
    val theme:    ThemeSpec,
    val defaults: DefaultsFile,
)

fun interface Composer {
    fun compose(
        pkg:      TemplatePackage,
        doc:      InvitationDocument,
        business: BusinessSnapshot,
        assets:   AssetIndex,                 // Map<AssetId, ResolvedAsset>
        locale:   Locale,
    ): CompositionResult
}

/**
 * `compose` NO lanza. Un documento inválido llega aquí ya rechazado por `validateInvariants`
 * (03 §3.3); todo lo que pueda salir mal en composición es una entrada del informe.
 */
data class CompositionResult(
    val composed: ComposedDocument,
    val report:   CompositionReport,
)

data class CompositionReport(
    val missingRequired: List<BlockId>,                 // required sin valor de usuario NI default
    val stillDefault:    List<BlockId>,                 // required que sigue en contenido de demo (H-03)
    val orphanContent:   List<BlockId>,                 // clave de content que esta versión ya no declara
    val orphanSections:  List<SectionKey>,
    val invalidValues:   List<InvalidValue>,            // valor presente pero inválido contra el spec
    val themeFallback:   ThemeFallback?,                // null si no hubo fallback
) { init { require(esOrdenado()) } }                    // R9: las cinco listas van ordenadas

data class InvalidValue(val blockId: BlockId, val code: String)
data class ThemeFallback(val paletteId: String?, val fontSetId: String?)
```

**El `CompositionReport` de este documento y el de `esquema/composed.ts` no coincidían**: el bloque Kotlin
anterior declaraba un campo `fallbacks: List<Fallback>` que el esquema no tiene, y omitía `stillDefault` e
`invalidValues`, que sí (objeción 1R **O-04**). La forma de arriba es la del esquema; `Fallback` no existe —
la procedencia por bloque (`provenance`) ya dice qué se resolvió por default, bloque a bloque.

### 5.2 Las nueve reglas

- **R1 — Estructura.** El orden efectivo es el del array `doc.structure.sections` (autoridad del cliente).
  Para cada entrada: si la `key` no está en el manifiesto → `report.orphanSections` y **no** se renderiza;
  si se repite, gana la primera (I-11 ya la habría rechazado al escribir); `variant` desconocida → cae a
  `defaultVariant` del manifiesto; `visible: false` sobre una sección `required: true` → se fuerza `true` (I-17).
  **R1c (precisión de la ronda 1R, objeción `O-05`):** una sección del manifiesto que el documento no
  menciona se **inserta en su posición relativa del manifiesto** — justo detrás del último predecesor del
  manifiesto que sí esté presente, y al principio si no hay ninguno. La redacción anterior ("se añaden con
  sus valores por defecto") no decía **dónde**, y la lectura natural (anexar al final) colocaba una sección
  nueva **después del pie de página**: con `xv-jardin@1.0.0`, cuyo `documento.json` omite `family`, la salida
  quedaba `… rsvp, footer, family`. Con R1c queda `cover, honoree, family, event, …` (verificado: es la
  diferencia entre las dos generaciones de `ejemplos/xv-jardin-1.0.0/compuesto.json` en la ronda 1R).
- **R2 — Contenido, fallback en tres escalones.** `doc.content[blockId]` válido → `defaults[blockId]` → `null` con `provenance = "empty"`. Es el patrón `bodyFromTemplate` que la auditoría pide preservar (§9.1), ahora explícito y probado.
- **R3 — Procedencia.** Cada valor resuelto lleva `provenance ∈ {user, default, business, fixed, empty}`
  (cinco, no tres: `Provenance` en `esquema/composed.ts`; `fixed` para el contenido no editable de la
  plantilla y `empty` para "no hay valor en ningún nivel"). **Esta es la respuesta a H-03**: hoy el placeholder de demo y el dato real del cliente son indistinguibles en el almacén, y por eso se publican los nombres de una pareja ficticia. Con `provenance`, la publicación puede bloquearse o advertir cuando un bloque `required` sigue en `default` (ver `03-api.md` §6, `preflight`).
- **R4 — Negocio por rol.** Los bloques con `source: "business:X"` toman su valor de `business`, ignorando `doc.content` (que ni siquiera puede escribirlos: la API los rechaza). Nunca por posición.
- **R5 — Nada se fabrica.** Si el manifiesto no declara un bloque para un dato de negocio, ese dato no se renderiza. Se preserva el contrato "plantilla nula → sección nula" (§9.1).
- **R6 — Determinismo.** `compose` es pura: sin reloj, sin `Locale.getDefault()`, sin aleatoriedad, sin E/S. El formateo de fechas usa `formatDate(instant, patternId, locale)` con el patrón declarado en el BlockSpec — resuelve H-27 (fechas inconsistentes entre `couple` y `cover`) al haber un solo formateador con patrón declarado.
- **R7 — Grupos.** Los ítems se ordenan por su posición en `doc.content[groupId].items`; `itemId` es la identidad. Un ítem con `itemId` duplicado se rechaza en la escritura, no en la composición.
- **R8 — Tema.** `theme` del documento → `defaultPaletteId`/`defaultFontSetId` de la plantilla, registrando `themeFallback`.
- **R9 — Idempotencia y determinismo.** `compose` con las mismas entradas produce **bytes idénticos** en JSON
  canónico (§5.5). Cinco fuentes concretas de no-determinismo, cerradas una por una:
  1. **Orden de claves de objeto.** `doc.content` viaja por `jsonb`, y Postgres **reordena** las claves de un
     `jsonb` (por longitud y luego byte a byte). Cualquier salida que dependa del orden de iteración de
     `doc.content` cambia entre "recién escrito" y "leído de vuelta". Por eso: el orden de los bloques de la
     salida lo fija **siempre el manifiesto**, nunca el documento; y las cinco listas del `CompositionReport`
     se **ordenan explícitamente** antes de devolverlas (objeción 1R **O-11**, ataque A-08).
  2. **Formateo de fechas.** Prohibido `Intl.DateTimeFormat` / `java.time.format` con locale del sistema: ICU
     difiere entre la JVM y Node y entre versiones. `formatDate`/`formatRange` usan **tablas de meses
     literales** en el propio paquete de esquema (`compose.ts`), con cuatro `formatId` cerrados: `long`,
     `month-year`, `h12`, `iso`. Un `formatId` desconocido cae a `long` y se registra.
  3. **Reloj y zona.** `compose` no llama a `now()` ni a `ZoneId.systemDefault()`. `BusinessSnapshot.timezone`
     existe para que quien construye el snapshot resuelva la fecha **antes**; dentro de `compose`, `IsoDate`
     e `IsoLocalDateTime` son cadenas locales sin zona que se formatean tal cual.
  4. **Identificadores.** `compose` **nunca** genera un ULID. Los `itemId` vienen del documento; los crea el
     servidor en `addItem` (§5.6), no la composición.
  5. **Números.** `focal.x`/`focal.y` se serializan con la representación **más corta que reproduce el doble**
     (`JSON.stringify` en JS; `BigDecimal.stripTrailingZeros().toPlainString()` en Kotlin) para que `0.5` no
     salga `0.50` en un lado y `0.5` en el otro.

### 5.3 Pseudocódigo del merge por id (P2)

Es el corazón del rediseño: el punto donde H-01 (emparejar por texto) y H-02 (emparejar por posición) se
vuelven imposibles. **En ningún paso aparece un índice de array ni una comparación de cadenas de contenido.**

```
FUNCIÓN compose(pkg, doc, business, assets, locale) → (composed, report)

  ── paso 0. tema ────────────────────────────────────────────────────────────────
  paletteId ← doc.theme.paletteId  si ∈ pkg.theme.palettes,  si no  pkg.theme.defaultPaletteId
                                                              y report.themeFallback.paletteId ← el pedido
  fontSetId ← ídem con pkg.theme.fontSets                                                  (R8)

  ── paso 1. orden de secciones ──────────────────────────────────────────────────
  orden ← []
  PARA CADA e EN doc.structure.sections            # el array manda; nunca un campo `order`
     spec ← pkg.manifest.sections[key = e.key]
     SI spec = ∅            → report.orphanSections += e.key ; CONTINUAR      (R1)
     SI e.key ya en orden   → CONTINUAR                                       (I-11)
     orden += { spec,
                variant : e.variant ∈ spec.variants ? e.variant : spec.defaultVariant,
                visible : spec.required ? verdadero : e.visible }             (I-17)
  PARA CADA spec EN pkg.manifest.sections EN SU ORDEN DE DECLARACIÓN
     SI spec.key ∉ orden
        ancla ← posición en `orden` del último spec del manifiesto ANTERIOR a éste que sí esté
        insertar en `ancla + 1` (o en 0 si no hay ancla)   { spec, spec.defaultVariant, spec.defaultVisible }   (R1c)

  ── paso 2. huérfanos de contenido ──────────────────────────────────────────────
  declarados ← { b.id  ∀ sección ∀ bloque del manifiesto }      # ids de NIVEL DE SECCIÓN
  report.orphanContent ← ordenar( claves de doc.content ∉ declarados )   # ordenar: R9 punto 1

  ── paso 3. bloques, sección por sección, EN EL ORDEN DEL MANIFIESTO ────────────
  PARA CADA { spec, variant, visible } EN orden
    bloques ← []
    PARA CADA b EN spec.blocks              # ← el orden lo fija el MANIFIESTO, no doc.content

      SI b.type = "group":                                                    (R7)
         fuente     ← doc.content[b.id]      si es un group   → procedencia "user"
                    ← pkg.defaults[b.id]     si es un group   → procedencia "default"
                    ← ∅                                       → procedencia "empty", items []
         ítems ← []
         PARA CADA it EN fuente.items         # el ORDEN de este array es el orden de la página
            hijos ← []
            PARA CADA ib EN b.itemBlocks      # ← orden del SPEC, no del JSON del ítem   (R9 punto 1)
               v ← it.values[ib.id]           # ← MERGE POR ID: (b.id, it.itemId, ib.id)
               hijos += { id: ib.id, role: ib.role, type: ib.type, label: L(ib.label),
                          provenance: v = ∅ ? "empty" : procedencia,
                          value:      v = ∅ ? nulo   : resolver(ib, v) }
            ítems += { itemId: it.itemId, blocks: hijos }     # itemId se conserva TAL CUAL
         SI b.required ∧ ítems = []        → report.missingRequired += b.id
         SI b.required ∧ procedencia="default" → report.stillDefault += b.id
         bloques += { id, role, type:"group", label, provenance: procedencia, items: ítems }
         CONTINUAR

      SI b.source = "business":                                               (R4)
         v ← proyectar(business, b.businessField, b.formatId, locale)
         bloques += v = nulo ? { …, provenance:"empty",    value: nulo }
                             : { …, provenance:"business", value: v }
         SI b.required ∧ v = nulo → report.missingRequired += b.id
         CONTINUAR                # doc.content NUNCA se consulta aquí; I-21 impide siquiera escribirlo

      # escalar de usuario o fijo — tres escalones                            (R2)
      delUsuario ← b.source = "fixed" ? ∅ : doc.content[b.id]
      elDefault  ← pkg.defaults[b.id]
      origen     ← delUsuario ?? elDefault
      procedencia ← delUsuario ≠ ∅ ? "user"
                  : elDefault  ≠ ∅ ? (b.source = "fixed" ? "fixed" : "default")
                  : "empty"
      value ← origen = ∅ ? nulo : resolver(b, origen)     # p.ej. assetId → assets[assetId].url
      SI value = nulo → procedencia ← "empty"             # asset borrado: no se inventa una URL   (R5)
      SI b.required ∧ value = nulo          → report.missingRequired += b.id
      SI b.required ∧ procedencia="default" → report.stillDefault  += b.id   # bloquea publicar (H-03)
      bloques += { id: b.id, role: b.role, type: b.type, label: L(b.label), provenance, value }

    composed.sections += { key: spec.key, type: spec.type, variant, visible,
                           title: L(spec.title), blocks: bloques }

  ── paso 4. determinismo ────────────────────────────────────────────────────────
  ordenar report.missingRequired, report.stillDefault, report.orphanContent,
          report.orphanSections, report.invalidValues (por blockId)                (R9)
  DEVOLVER (composed, report)
```

Notas que un implementador necesita y el texto anterior no daba:

- **`L(texto)`** = `texto[locale] ?? texto["es-MX"]`. `es-MX` está garantizado por `LocalizedText`, y I-27
  garantiza que si el manifiesto declara `locales: ["en-US"]` entonces **todas** sus etiquetas traen `en-US`,
  para que ese `??` no sea nunca un fallback silencioso a otro idioma.
- **Los ítems de grupo no caen a `defaults`.** Si el cliente escribió el grupo, sus ítems son suyos enteros;
  mezclar por ítem el default de la plantilla resucitaría H-02 por otra vía. El escalón de default opera a
  nivel de **bloque de grupo completo**, no de ítem ni de campo dentro del ítem.
- **`attic` no participa en la composición.** Es un archivo muerto que solo lee la migración (§6) y el editor
  para ofrecer "recuperar contenido".
- **Procedencia de un ítem.** Todos los bloques de un ítem heredan la procedencia del grupo, salvo los que
  no tienen valor, que son `empty`. No existe procedencia mixta dentro de un ítem.

### 5.4 Direccionamiento: las tres formas y ninguna más

| Qué | Dirección | Se usa en |
|---|---|---|
| Bloque de nivel de sección | `blockId` (único en TODO el manifiesto, I-13) | `content`, `setBlock`, `clearBlock`, `attic` |
| Ítem de un grupo | terna `(groupId, itemId)` — `itemId` es un ULID **del servidor** | `removeItem`, `moveItem` |
| Bloque dentro de un ítem | terna `(groupId, itemId, itemBlockId)` — `itemBlockId` es corto y único **solo dentro del grupo** | `setItemBlock`, `clearItemBlock` |

Un `itemBlockId` y un `blockId` de sección pueden coincidir (`title` existe como ambos en
`boda-clasica@1.0.0`): son espacios de nombres distintos y la operación dice en cuál está. Prefijar los
`itemBlockId` con el id del grupo sería redundante y rompería `renameBlock` de grupo.

### 5.5 `canonicalJson` y `contentHash`

`contentHash` es el `ETag` del render público (`03 §4`), la clave de deduplicación de `tpl_release`
(`02 §2.6`) y el criterio de igualdad de los golden files (`06 §4`). Antes de la ronda 1R no estaba definido
en ningún documento (objeción 1R **O-12**).

**`canonicalJson(v)`** — subconjunto de RFC 8785 suficiente para nuestros tipos:

1. Sin espacios en blanco entre tokens.
2. Claves de objeto ordenadas **ascendentemente por sus unidades de código UTF-16** (`String.compareTo` de
   Kotlin y el `<` de JavaScript coinciden en este orden). Las claves `undefined` se omiten; `null` se emite.
3. Cadenas: escape mínimo de JSON (`"` `\` y los de control `< U+0020`), **sin** escapar caracteres no ASCII
   (`á` va literal en UTF-8). Sin `\uXXXX` innecesarios.
4. Enteros sin punto decimal. Dobles con la representación decimal más corta que reproduce el valor.
5. Arrays: **nunca** se reordenan (el orden de un array es dato).

```
contentHash = "sha256:" + hex( SHA-256( utf8( canonicalJson({
    composed : <ComposedDocument tal cual lo devolvió compose>,
    report   : <CompositionReport tal cual lo devolvió compose>
}) ) ) )
```

- Se hashea **la salida de `compose`, no el documento de entrada**: dos documentos distintos que rinden
  idéntico (p. ej. uno con una clave huérfana que R1 descarta) deben dar el mismo `ETag`.
- El `report` entra en el hash porque `stillDefault` cambia lo que el editor muestra y lo que `preflight`
  bloquea; si no entrara, un cambio en las advertencias no invalidaría la caché.
- **Se almacena con el prefijo** (decisión X-02): `tpl_release.content_hash` es `VARCHAR(71)` con
  `CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$')`, y el `ETag` del render público lleva el valor completo
  (`ETag: "sha256:3f…"`). Recortar el prefijo en la base y reponerlo en la capa HTTP daría dos
  representaciones del mismo hash, que es la enfermedad que P1 ataca; el prefijo es además lo que permite
  cambiar de algoritmo algún día sin ambigüedad.
- **No entra ninguna URL con firma temporal.** `AssetIndex.url` debe ser estable (URL de CDN sin token); si
  la fase 2 necesita URLs firmadas, se firman **después** de calcular el hash, en la capa HTTP. Si no, el
  `ETag` cambiaría en cada petición y la caché del render público dejaría de servir para nada.

### 5.6 Regeneración

No existe "regenerar": la composición ocurre en cada lectura del editor y **una sola vez** al publicar (se congela en `tpl_release.composed`). Cambiar la fecha en Postgres cambia el preview del editor de inmediato y marca el release activo como `stale` (`03-api.md` §6). Así muere H-04/H-05: no hay dos copias que puedan divergir en silencio.

---

## 6. Migración de versión de plantilla y cambio de plantilla

### 6.1 Firmas exactas

```typescript
// frontend/packages/schema/src/migrate.ts
export function migrate(
  doc:  InvitationDocument,
  from: TemplatePackage,        // paquete de ORIGEN (hace falta para leer los specs viejos)
  to:   TemplatePackage,        // paquete de DESTINO
  plan: MigrationPlan,
): MigrationResult;

export type MigrationResult =
  | { ok: true;  doc: InvitationDocument; report: MigrationReport }
  | { ok: false; error: MigrationError };            // NUNCA se lanza una excepción

export type MigrationReport = {
  applied:   Array<{ op: MigrationOp["op"]; target: string }>;
  moved:     Array<{ from: string; to: string }>;
  toAttic:   Array<{ blockId: string; reason: "removeBlock" | "removeSection" | "shrinkGroup" | "typeChangeUnsupported" }>;
  converted: Array<{ blockId: string; converterId: string }>;
  lossless:  boolean;                                 // = toAttic.length === 0 && converted.length === 0
};
export type MigrationError =
  | { code: "MIG_PLAN_VERSION_MISMATCH"; expected: string; got: string }
  | { code: "MIG_TARGET_BLOCK_UNKNOWN";  op: string; blockId: string }
  | { code: "MIG_TARGET_BLOCK_EXISTS";   op: string; blockId: string }
  | { code: "MIG_CONVERTER_UNSUPPORTED"; from: string; to: string }
  | { code: "MIG_RESULT_INVALID";        violations: Violation[] };   // el doc migrado no pasa I-01…I-30
```

```kotlin
// mx.evolutiondev.invitaciones.modules.templates2.migration
fun interface Migrator {
    fun migrate(doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage,
                plan: MigrationPlan): MigrationResult
}

sealed interface MigrationResult {
    data class Ok(val doc: InvitationDocument, val report: MigrationReport) : MigrationResult
    data class Failed(val error: MigrationError) : MigrationResult          // sin excepciones sin tipar
}

sealed interface MigrationError {
    data class PlanVersionMismatch(val expected: String, val got: String) : MigrationError
    data class TargetBlockUnknown(val op: String, val blockId: BlockId)    : MigrationError
    data class TargetBlockExists(val op: String, val blockId: BlockId)     : MigrationError
    data class ConverterUnsupported(val from: String, val to: String)      : MigrationError
    data class ResultInvalid(val violations: List<Violation>)              : MigrationError
}
```

### 6.2 Catálogo cerrado de operaciones de migración (11)

Forma normativa: `esquema/manifest.ts` (`MigrationOp`). La tabla anterior de este documento **no coincidía**
con el esquema — omitía `shrinkGroup`, omitía el converter `richTextToText` y daba a `moveIntoGroup` y
`flattenGroup` campos que no existen (`blockIdPrefix`) o le faltaban (`itemBlockId`); objeción 1R **O-13**.

| Operación | Campos | Efecto | ¿`lossless`? |
|---|---|---|---|
| `renameBlock` | `from`, `to` | mueve `content[from] → content[to]`; conserva `items`/`itemId` intactos | sí |
| `removeBlock` | `id` | mueve el valor a `attic["<slugOrigen>@<versionOrigen>"][id]`; **nunca** borra | no |
| `addBlock` | `id` | no toca `content`; el bloque tomará su default en la próxima composición | sí |
| `renameSection` | `from`, `to` | reescribe la `key` en `doc.structure`; no toca `content` | sí |
| `removeSection` | `key` | quita la entrada de `structure` y manda al `attic` **todos** los `content[b.id]` de sus bloques | no |
| `renamePalette` | `from`, `to` | si `doc.theme.paletteId = from` → `to` | sí |
| `renameFontSet` | `from`, `to` | ídem con `fontSetId` | sí |
| `changeBlockType` | `id`, `converterId` | convierte el valor; `converterId ∈ {textToRichText, richTextToText, textToListText, listTextToText}` | no |
| `moveIntoGroup` | `blockId`, `groupId`, `itemBlockId` | crea **un** ítem nuevo en `groupId` (ULID nuevo del servidor) con `values[itemBlockId] = content[blockId]`, y borra `content[blockId]` | sí |
| `flattenGroup` | `groupId`, `itemBlockId`, `toBlockId` | toma `items[0].values[itemBlockId]` → `content[toBlockId]`; **los ítems 1..n van al `attic`** | no si n>1 |
| `shrinkGroup` | `groupId`, `max` | conserva los primeros `max` ítems; el excedente va al `attic` completo (con su `itemId`) | no si sobra alguno |

Semántica de los cuatro convertidores (única definición; el resto no existe):

| `converterId` | Entrada | Salida |
|---|---|---|
| `textToRichText` | `{kind:"text", value}` | `{kind:"richText", doc:{type:"doc", content:[{type:"paragraph", content: value === "" ? [] : [{type:"text", text: value}]}]}}` |
| `richTextToText` | `{kind:"richText", doc}` | `{kind:"text", value: <texto plano de los párrafos unidos con "\n\n">}` — si excede `maxLength` del spec destino, se **trunca por límite de palabra** y se registra en `converted` |
| `textToListText` | `{kind:"text", value}` | `{kind:"listText", items: value === "" ? [] : [value]}` |
| `listTextToText` | `{kind:"listText", items}` | `{kind:"text", value: items.join(", ")}` — con el mismo truncado |

### 6.3 Reglas duras de la migración

- Una migración es **pura** (mismo documento + mismo plan → mismo resultado), se ejecuta con `dryRun`
  obligatorio antes de aplicarse (`03 §5`) y **termina validando el documento resultante** contra I-01…I-30:
  si no pasa, devuelve `MIG_RESULT_INVALID` y **no** se escribe nada. Una migración no puede dejar el
  documento en un estado que la escritura normal rechazaría.
- **Nada se borra jamás**: todo lo que pierde destino va al `attic`, indexado por `"<slug>@<version>"` de
  **origen** (ADR-006). El `attic` no se poda nunca automáticamente.
- **Bloque eliminado sin operación en el plan**: si tras aplicar todas las operaciones queda una clave de
  `content` que la versión destino no declara, `migrate` la manda al `attic` **igual** y la anota en
  `report.toAttic` con `reason: "removeBlock"`. Un plan incompleto degrada la calidad del informe, no
  destruye contenido.
- **Cambio de cardinalidad** (`max` baja de 8 a 4): sin `shrinkGroup` en el plan, el documento migrado
  violaría I-04 y `migrate` devolvería `MIG_RESULT_INVALID`. Por eso el registro exige que el diff
  estructural esté cubierto por el plan (ADR-028).
- **Bump mayor sin plan**: `migrationsFrom` vacío y `version` mayor ⇒ **no hay migración automática**. La
  invitación se queda en su versión (las versiones son inmutables y coexisten, `02 §2.2`); cambiar de
  versión mayor sin plan es un **cambio de plantilla** (§6.4), no una migración.
- Un `minor`/`patch` solo puede **añadir** bloques/secciones opcionales; si añade uno `required` sin default,
  el registro falla.

### 6.4 Cambio de plantilla en una invitación ya editada

Ni este documento ni `03-api.md` definían qué le pasa al contenido cuando el cliente elige otra plantilla —
`blocks.ts` incluso citaba un "01 §6.3" que **no existía** (objeción 1R **O-14**). Definición:

```typescript
export function switchTemplate(
  doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage,
): { doc: InvitationDocument; report: SwitchReport };

export type SwitchReport = {
  matchedByRole: Array<{ fromBlockId: string; toBlockId: string; role: string }>;
  toAttic:       string[];        // blockId de origen que no encontró destino
  reset:         string[];        // blockId de destino que arranca en su default
};
```

Algoritmo (determinista, sin heurísticas de texto):

1. `structure` **se descarta entera** y se reconstruye desde `to.manifest` con `defaultVariant` /
   `defaultVisible`. Las variantes de una plantilla no significan nada en otra.
2. `theme` se descarta y se pone `to.theme.defaultPaletteId` / `defaultFontSetId` (los ids de paleta son de
   la plantilla; conservarlos sería casualidad).
3. `content` se transporta **solo por rol singleton** (§3.3): para cada uno de los 17 roles singleton, si
   existe un bloque con ese rol en `from` **y** uno en `to` **y** ambos son del **mismo `type`**, el valor se
   copia (`matchedByRole`). Nada más se transporta: los roles no singleton son ambiguos por definición
   (`sectionTitle` aparece 8 veces) y adivinar es exactamente el pecado de H-01.
4. **Los grupos nunca se transportan.** Un `eventCards` de otra plantilla tiene otros `itemBlocks`; copiar
   ítems produciría ítems medio vacíos que el cliente no sabe de dónde salen. Van al `attic` completos.
5. Todo lo que no se transportó va a `attic["<slugOrigen>@<versionOrigen>"]`, **incluidos los grupos**.
6. El documento resultante se valida contra I-01…I-30 antes de escribirse.

Consecuencia aceptada y que el editor **debe** decir en voz alta antes de confirmar: cambiar de plantilla
conserva los nombres, las fotos de portada y de los celebrantes, y la fecha límite de confirmación; **pierde
de la vista** (no del `attic`) el itinerario, la galería, la mesa de regalos y todo lo que viva en un grupo.

### 6.5 Firma de `applyOperation` y de `validateInvariants`

```typescript
// frontend/packages/schema/src/operations-reducer.ts — el ÚNICO reductor (humano, autoguardado e IA)
export function applyOperation(
  doc: InvitationDocument, op: Operation, ctx: ReducerContext,
): OperationResult;

export type ReducerContext = {
  pkg:     TemplatePackage;
  newUlid: () => string;                 // inyectada: compose es pura, el reductor NO (genera ULIDs)
  /**
   * Metadatos del asset, o `null` si no existe o no pertenece a esta invitación ni a la plantilla vigente.
   * Sustituye al `ownsAsset(assetId): boolean` anterior (decisión X-06): el reductor ya cargaba la fila de
   * `tpl_asset` para comprobar pertenencia (ADR-030) y necesita además `bytes`/`width`/`height` para hacer
   * cumplir `image.maxBytes`, `image.aspect` y `audio.maxBytes`, que NO son comprobables contra el valor
   * (`ImageValue`/`AudioValue` solo llevan `assetId`). Una función en vez de dos: misma consulta, misma
   * transacción de lectura, cero superficie nueva de E/S.
   */
  assetMeta: (assetId: string) => { bytes: number; width?: number; height?: number; contentType: string } | null;
};
export type OperationResult =
  | { ok: true;  doc: InvitationDocument; idMap?: Record<string, string> }   // tempId → ULID
  | { ok: false; error: OperationError };

export type OperationError =
  | { code: "TPL_BLOCK_UNKNOWN";          blockId: string }
  | { code: "TPL_BLOCK_NOT_EDITABLE";     blockId: string; source: "business" | "fixed" }
  | { code: "TPL_BLOCK_TYPE_MISMATCH";    blockId: string; expected: string; got: string }
  | { code: "TPL_ITEM_UNKNOWN";           groupId: string; itemId: string }
  | { code: "TPL_GROUP_LIMIT";            groupId: string; min: number; max: number }
  | { code: "TPL_SECTION_UNKNOWN";        sectionKey: string }
  | { code: "TPL_SECTION_REQUIRED";       sectionKey: string }
  | { code: "TPL_VARIANT_UNKNOWN";        sectionKey: string; variant: string }
  | { code: "TPL_THEME_ID_UNKNOWN";       field: "paletteId" | "fontSetId"; id: string }
  | { code: "TPL_ASSET_NOT_OWNED";        assetId: string }
  | { code: "TPL_ASSET_SPEC_MISMATCH";   assetId: string; constraint: "maxBytes" | "aspect" }
  | { code: "TPL_INVARIANT_VIOLATION";    violations: Violation[] };

/** Las 30 invariantes en una sola llamada. Devuelve la lista vacía si todo está bien; nunca lanza. */
export function validateInvariants(
  doc: InvitationDocument, pkg: TemplatePackage, raw?: unknown,
): Violation[];
```

```kotlin
// mx.evolutiondev.invitaciones.modules.templates2.domain
sealed interface OperationResult {
    data class Ok(val doc: InvitationDocument, val idMap: Map<String, String> = emptyMap()) : OperationResult
    data class Failed(val error: OperationError) : OperationResult
}
sealed interface OperationError { val code: String
    data class BlockUnknown(val blockId: BlockId)  : OperationError { override val code = "TPL_BLOCK_UNKNOWN" }
    data class BlockNotEditable(val blockId: BlockId, val source: String) : OperationError { override val code = "TPL_BLOCK_NOT_EDITABLE" }
    data class BlockTypeMismatch(val blockId: BlockId, val expected: String, val got: String) : OperationError { override val code = "TPL_BLOCK_TYPE_MISMATCH" }
    data class ItemUnknown(val groupId: BlockId, val itemId: String) : OperationError { override val code = "TPL_ITEM_UNKNOWN" }
    data class GroupLimit(val groupId: BlockId, val min: Int, val max: Int) : OperationError { override val code = "TPL_GROUP_LIMIT" }
    data class SectionUnknown(val key: SectionKey)  : OperationError { override val code = "TPL_SECTION_UNKNOWN" }
    data class SectionRequired(val key: SectionKey) : OperationError { override val code = "TPL_SECTION_REQUIRED" }
    data class VariantUnknown(val key: SectionKey, val variant: String) : OperationError { override val code = "TPL_VARIANT_UNKNOWN" }
    data class ThemeIdUnknown(val field: String, val id: String) : OperationError { override val code = "TPL_THEME_ID_UNKNOWN" }
    data class AssetNotOwned(val assetId: AssetId) : OperationError { override val code = "TPL_ASSET_NOT_OWNED" }
    data class InvariantViolation(val violations: List<Violation>) : OperationError { override val code = "TPL_INVARIANT_VIOLATION" }
}

fun interface OperationReducer {
    fun apply(doc: InvitationDocument, op: Operation, ctx: ReducerContext): OperationResult
}
fun validateInvariants(doc: InvitationDocument, pkg: TemplatePackage, raw: JsonNode? = null): List<Violation>
```

Reglas del reductor que el esquema **no** puede expresar y que un implementador necesita:

- **`tempId` se resuelve dentro del lote, en orden.** `addItem` produce un ULID nuevo y lo guarda en
  `idMap[tempId]`; una operación posterior del **mismo lote** que use ese `tempId` en `itemId` lo resuelve
  contra `idMap`. Un `tempId` sin resolver → `TPL_ITEM_UNKNOWN`. El cliente **nunca** aporta ULIDs
  (ADR-020, P8).
- `setBlock`/`clearBlock` sobre un bloque con `source ≠ "user"` → `TPL_BLOCK_NOT_EDITABLE` (I-21).
- `reorderSections.order` debe ser una **permutación exacta** de las claves actuales de `doc.structure`
  (I-24). El esquema solo comprueba longitud: acepta `["cover","cover","cover"]`.
- `setSectionVisible(key, false)` sobre `required: true` → `TPL_SECTION_REQUIRED` (I-17).
- Toda `ScalarValue` con `assetId` pasa por `ctx.assetMeta` antes de escribirse: `null` → `TPL_ASSET_NOT_OWNED`
  (ADR-030). Con los metadatos en la mano se comprueban además las tres restricciones de asset que el esquema
  declara y que ningún validador de valor puede ver (**X-06**), fallando con `TPL_ASSET_SPEC_MISMATCH`:
  - `image.maxBytes` / `audio.maxBytes`: `meta.bytes > spec.constraints.maxBytes`.
  - `image.aspect` sobre `r = meta.width / meta.height` (si faltan las dimensiones, no se comprueba y se
    registra; nunca se rechaza por falta de dato): `square` ⇒ `|r − 1| ≤ 0.02`; `portrait` ⇒ `r < 1`;
    `landscape` ⇒ `r > 1`; `wide` ⇒ `r ≥ 1.6`; `free` ⇒ sin comprobación. Las tolerancias exactas son un
    supuesto conservador registrado en `preguntas-abiertas.md`.
  El recorte del editor es destructivo (sube un asset nuevo, `04 §13`), así que comprobar en el momento de
  atar el asset al bloque es el único punto donde el dato existe y todavía se puede rechazar.
- Un lote humano es **todo o nada**; una `EditProposal` de IA descarta operación por operación
  (`07 §4`, lección 5 de `handoffs/1-aura-lecciones.md`).

---

## 7. Ejemplos completos

- Boda: `diseno/ejemplos/boda-clasica-1.0.0/{template,defaults,theme,documento,compuesto}.json`. `compuesto.json` es la salida esperada de `compose()` sobre `documento.json` con un `BusinessSnapshot` documentado en su propio comentario `_comentario`, y ejercita las nueve reglas de §5.2 explícitamente (ver comentario del archivo).
- XV: `diseno/ejemplos/xv-jardin-1.0.0/{template,defaults,theme,documento,compuesto}.json`. Manifiesto deliberadamente más pequeño (9 secciones vs. 12 de boda-clasica, sin `story`/`suggestions`/`amenities`) para ejercitar R1 con plantillas de distinto tamaño de catálogo, y un celebrante único (`honoree`) en vez de pareja. **`compuesto.json` faltaba y se creó en la ronda 1R**, generado por `esquema/compose.ts`, no a mano. Ejercita tres casos que el par de boda no cubre: R1c (la sección `family` no está en `documento.structure` y se inserta entre `honoree` y `event`, no al final), R2 con un grupo que el usuario dejó vacío a propósito (`family.godparents` → `provenance:"user"`, `items:[]`, distinto del default) y un `dateTimeRange` que **cruza la medianoche** (`2026-11-14T19:30` → `2026-11-15T01:00` ⇒ `"14 de noviembre de 2026, 7:30 pm – 15 de noviembre de 2026, 1:00 am"`).

- Las explicaciones que antes vivían en una clave `_comentario` **dentro** de los `.json` están ahora en un
  `NOTAS.md` por carpeta: todos los esquemas son `z.strictObject` y el JSON Schema emitido lleva
  `additionalProperties: false`, así que esa clave hacía que los golden files **no validaran contra su propio
  esquema** (objeción 1R **O-15**).

Ambos pares son a la vez el primer golden file de la fase 2 (`06-pruebas-y-calidad.md` §4). `compuesto.json` no incluye el `CompositionReport`; para ambos pares de entradas es `{missingRequired:[], stillDefault:[], orphanContent:[], orphanSections:[], invalidValues:[], themeFallback:null}` (verificado ejecutando `compose`) — la prueba de golden file verifica ambos, `composed` y `report`, por igualdad estructural.

**El `BusinessSnapshot` de cada par es parte del golden file** y está en su `NOTAS.md`:

| Par | `BusinessSnapshot` |
|---|---|
| `boda-clasica-1.0.0` | `{invitationId:4821, date:"2026-12-12", time:"16:30", hashtag:"#CamilaYAntonio2026", coverPhotoUrl:null, childrenAllowed:true, youngAllowed:true, eventKind:"wedding", planTier:2, timezone:"America/Mexico_City"}` |
| `xv-jardin-1.0.0` | `{invitationId:5307, date:"2026-11-14", time:"17:00", hashtag:"#ValentinaXV", coverPhotoUrl:null, childrenAllowed:true, youngAllowed:true, eventKind:"quince", planTier:1, timezone:"America/Mexico_City"}` |

El `AssetIndex` de ambos se deriva con una regla, no con una tabla a mano:
`url = "https://cdn.invitaciones.evolutiondev.mx/a/" + assetId.slice(3) + ".webp"`. Antes de la ronda 1R
`compuesto.json` mezclaba URLs derivadas del `assetId` con otras inventadas (`…/a/DEMONOV1.webp`), lo que
hacía la salida irreproducible.

**El `compuesto.json` que había no era la salida de `compose` sobre sus propias entradas** (objeción 1R
**O-16**): tenía ocho divergencias — cinco etiquetas acortadas a mano (`"Nombre"` donde el manifiesto dice
`"Nombre (Ceremonia, Recepción…)"`) y tres URLs de asset inventadas. Un golden file escrito a mano es una
prueba que valida la mano, no el código. Ambos archivos están ahora **generados** por `esquema/compose.ts`.

---

## 8. Zod 4 como fuente única — verificación empírica

Ejecutado en esta sesión con `zod@4.5.4` (Node 22):

| Comprobación | Resultado | Consecuencia de diseño |
|---|---|---|
| `z.toJSONSchema` existe de forma nativa | **Sí** (`typeof === "function"`) | `zod-to-json-schema@3.25.2` **no se usa**; se elimina una dependencia (ADR-004) |
| Salida `target: "draft-2020-12"` | correcta, con `additionalProperties: false` en objetos | El validador Kotlin puede rechazar claves desconocidas (P1) |
| `z.discriminatedUnion` | emite `oneOf` con `const` | El catálogo de bloques por `kind` se traduce sin pérdida |
| `z.registry()` + `id` | emite `$defs` + `$ref` — **pero solo si se registra explícitamente**; `z.toJSONSchema(schema)` a secas **nunca** produce un `$ref` | Ver la corrección de abajo: el emisor no registraba nada, así que los 10 archivos repetían el catálogo entero |
| Recursión con `get` | emite `$ref: "#"` | Grupos anidados representables |
| **`.refine()` / `.superRefine()`** | **se descartan EN SILENCIO, incluso con `unrepresentable: "throw"`** | **Regla dura: prohibido `.refine()` en cualquier esquema exportado.** Toda invariante entre campos (`end >= start`, `min ≤ items ≤ max`, unicidad de `itemId`) se implementa **dos veces y se prueba dos veces**: `packages/schema/src/invariants.ts` y `templates2/schema/Invariants.kt`, con una tabla de casos compartida en JSON (`06-pruebas-y-calidad.md` §5) |

### 8.1 Qué se pierde exactamente al emitir (medido en la ronda 1R, `zod@4.5.4` + `ajv@8.20.0`)

| Construcción | ¿Se exporta? | Qué hacemos |
|---|---|---|
| `.refine()` / `.superRefine()` | **No, y en silencio** — ni con `unrepresentable:"throw"` | Prohibida por lint (`06 §5.2`). Verificado: cero apariciones en `esquema/*.ts` |
| `.transform()` / `.pipe()` | No (cambia el tipo de salida) | Prohibida. Cero apariciones |
| `z.custom()` | No | Prohibida. Cero apariciones |
| `z.iso.date()` / `z.iso.datetime()` | Emiten `format`, pero sus refinamientos implícitos (rangos de mes/día) **no** viajan a un validador que no implemente `format` | **No se usan.** `IsoDate`, `IsoTime`, `IsoLocalDateTime` son **regex explícitas** (`common.ts`), que sí viajan como `pattern` |
| `z.string().url()` | Emite `format: "uri"` — y `format:"uri"` **acepta `javascript:alert(1)` y `data:text/html;…`** (comprobado con `ajv-formats@3.0.1`) | **Eliminado.** `composed.ts` usa `HttpUrl` (regex `^https?://…`) en las 9 posiciones donde estaba. Objeción 1R **O-17** |
| `z.any()` | Emite `{}` (acepta cualquier cosa), sin aviso | **Eliminado.** `ResolvedValue.richText.doc` usa `RichDoc`, no `z.any()` |
| `.default(v)` con `io:"input"` | El campo sale **opcional** | Correcto para validar cuerpos entrantes. **El manifiesto persistido en `tpl_template_version.manifest` es la SALIDA de `parse`** (con los defaults ya aplicados): Kotlin lo mapea a campos no nulos y no debe validarlo con el esquema de entrada esperando que falte nada |
| Claves de `z.record` que no casan con el esquema de clave | Emite `propertyNames.pattern`, y ajv **sí** rechaza | Pero `z.record` en TS **descarta `"__proto__"` en silencio** (`success:true`, objeto vacío) → TS y Kotlin discreparían. Cerrado con **I-29** sobre el JSON crudo. Objeción 1R **O-18** |

### 8.2 Un bundle con `$defs`, no diez archivos autocontenidos

`emit-json-schema.ts` llamaba a `z.toJSONSchema(schema)` una vez por esquema raíz, **sin registro**: cero
`$defs` y cero `$ref` en los diez archivos, con el catálogo de 14 tipos de bloque repetido en cinco de ellos.
Medido: **469 KB** (indentados) en total. Emitiendo desde un `z.registry()` con `uri: id => "#/$defs/" + id`:
**un solo `templates2.schema.json` de 217 KB con 15 definiciones y 42 `$ref`**, más diez archivos-puntero de
una línea (`{"$ref": "…#/$defs/InvitationDocument"}`) para que las rutas de carga de `03-api.md` no cambien.

Trampa que costó una iteración y que la fase 2 debe conocer: con la opción `uri`, Zod escribe además un
`$id: "#/$defs/<Id>"` **dentro de cada definición**, y eso es un `$id` inválido en draft 2020-12 (`^[^#]*#?$`);
ajv rechaza el bundle entero con `schema is invalid`. El emisor lo borra explícitamente.

Validador en Kotlin: `com.networknt:json-schema-validator` (draft 2020-12), que carga el **bundle** una vez y
resuelve cada raíz por su puntero JSON. El JSON Schema generado se versiona en el repositorio
(`frontend/packages/schema/json-schema/*.schema.json`) y una prueba de CI falla si el archivo generado
difiere del commiteado — el esquema no puede desincronizarse entre TS y Kotlin (mata H-35 por construcción).

---

## 9. Lo que no pude determinar

- El contenido real de las plantillas 11, 12, 14, 16 y 17 (solo en producción, `fases/A-modelo-datos.md`, §6.5 del informe). El diseño no depende de ellas; la migración las trata como cohorte aparte (`05-migracion.md` §7).
- Si algún consumidor externo depende hoy de la forma exacta de `InvitationConfig`: no hay frontend en el repositorio (resumen de rol frontend). Se asume que **no** hay compatibilidad que preservar en el documento nuevo; la compatibilidad se preserva en el *render* (mismos textos e imágenes), no en el JSON.

---

## 10. Cobertura del contenido antiguo (ronda 1R)

Construida enumerando con `jq` las claves **reales** de los 9 pares
`src/main/resources/data/mongo/default_visual_*.json` + `default_content_*.json`, no de memoria.

**Precisión sobre "8 plantillas sembradas":** en disco hay **9** pares; `MongoDataInitializer.kt:36` y `:50`
tienen `boda_premium_2` (`templateId` 11) **comentado**, así que solo **8** se siembran
(`fases/J-inventario-json.md` §2, y hallazgo 12 de ese informe: el motivo es el choque de
`(eventTypeId, planId) = (1,2)` con `boda_premium`). La tabla cubre los 9 archivos: el noveno no aporta
ninguna clave que los otros ocho no traigan.

Las 13 claves de sección de `config` son **idénticas en los 9** salvo `sectionStory`, presente solo en 3
(`fases/J-inventario-json.md` §3).

### 10.1 Documento visual (`default_visual_*.json` → `config.*`)

| Clave antigua | Destino nuevo | Nota |
|---|---|---|
| `sectionCover.visibility` | `structure[key="cover"].visible` | hoy se fuerza `true` (§6.1 regla 5 del informe); ahora es autoridad |
| `sectionCover.title.content` | bloque `text` rol `coverTitle` | |
| `sectionCover.title.fontFamily` / `.md`/`.sm`/`.xs` | **DESCARTADO** | presentación pura (P3): pasa a `theme.fontSets` y a la variante de sección |
| `sectionCover.subtitle` | `text` rol `coverSubtitle` | |
| `sectionCover.date.day` / `.hours` | `business:invitation.date` / `invitation.time` (rol `coverDate`) | mata H-04: no hay copia |
| `sectionCover.button.content` | `text` rol `coverButtonLabel`, `source:"fixed"` | |
| `sectionCover.button.url` | `link` rol `coverButtonLink` | en los 9 vale `"#"`; el rol existe para plantillas que sí lo usen |
| `sectionCover.coverImage.content` | `image` rol `coverImage` (`assetId`, nunca URL) | ADR-021 |
| `sectionCouple.visibility` | `structure[key=<celebrant>].visible` | |
| `sectionCouple.heading` / `.subheading` | `text` rol `celebrantsHeading` / `sectionIntro` | |
| `sectionCouple.groomName` / `.brideName` | `person` rol `celebrantA` / `celebrantB` | mata H-02 (posición 0/1) |
| `sectionCouple.groomPhoto` / `.bridePhoto` | `image` rol `celebrantAPhoto` / `celebrantBPhoto` | |
| `sectionCouple.groomText` / `.brideText` | `richText` rol `celebrantAText` / `celebrantBText` | |
| `sectionCouple.namePersonEvent` / `.photoPersonEvent` | `person` rol `honoree` / `image` rol `honoreePhoto` | unifica boda (2) y XV/bautizo (1) por rol, no por campos nullables |
| `sectionCouple.message` | `richText` rol `celebrantsMessage` | **rol nuevo 1R** |
| `sectionCouple.datetime` | `business:invitation.date` (rol `celebrantsDate`) | mata H-27: mismo `formatId` que `coverDate` |
| `sectionCouple.icon` | **DESCARTADO** | los 14 literales FontAwesome son presentación (P3) |
| `sectionCouple.imageTopBg` / `.imageBottomBg` / `*.background` | `image` rol `sectionBackground` | |
| `*.backgroundColor` (RGBA) | **DESCARTADO** | pasa a `theme.palettes[].tokens` |
| `sectionFamily.title` / `.intro` | `text` rol `sectionTitle` / `listText` rol `familyIntro` | |
| `sectionFamily.items[].title` | `text` rol `familyGroupTitle` | |
| `sectionFamily.items[].items[].label` | `text` rol `personLabel` | **mata H-01**: era la cadena `"Padre"`/`"Padrino"` la que emparejaba |
| `sectionFamily.items[].items[].text` | `person` rol `personName` | |
| `sectionFamily.items[].items[].image` | `image` rol `personPhoto` | |
| `sectionFamily.items[].items[].showImage` | `boolean` rol `personPhotoVisible` | **rol nuevo 1R** |
| `sectionFamily.items[].items[].id` (`f1`, `f2`) | `itemId` ULID del servidor | ids del servidor, P8/ADR-020 |
| `sectionEvent.title` | `text` rol `sectionTitle` | |
| `sectionEvent.items[].title` / `.date` / `.time` / `.locationText` | grupo `eventCards`: `eventTitle`, `eventWhen` (`dateTimeRange`), `eventPlace` | H-49: el grupo declara sus propios bloques |
| `sectionEvent.locationText` (nivel de sección) | `text` rol `eventLocationNote` | **rol nuevo 1R** |
| `sectionEvent.singleplace` | variante de sección `single-place` + `capability:"singlePlace"` | |
| `sectionEvent.itemsSinglePlace[]` | mismo grupo `eventCards` bajo la variante `single-place` | **resucita H-12**: hoy Jackson lo borra al deserializar y la funcionalidad está muerta |
| `sectionGallery.title` / `.intro` | `text` rol `sectionTitle` / `galleryIntro` | |
| `sectionGallery.items[].id` + `.content` | grupo `galleryPhotos`, `itemId` + `image` rol `galleryPhoto` | **mata H-25**: hoy los ids de la plantilla se descartan |
| `sectionGallery.items[].md`/`.sm`/`.xs` | **DESCARTADO** | tamaños = presentación; hoy solo se usaba el de `items[0]` |
| `sectionGallery.hashtags` | grupo `hashtagList`: `hashtag`, `hashtagLink`, `hashtagPlatform` | **`hashtagPlatform` es rol nuevo 1R** |
| `sectionGifttable.items[].type` | `choice` rol `giftOptionKind` (`bank`\|`store`) | |
| `sectionGifttable.items[].title` / `.body` / `.image` / `.linkHref` | grupo `giftOptions`: `giftOptionTitle`, `giftOptionDetail` (`listText`), `giftOptionImage`, `giftOptionLink` | **mata H-28** (ids duplicados) y **H-30/H-33** (`body` colapsado a un elemento) |
| `sectionSuggestions.items[].{type,title,body,image,linkHref}` | grupo `suggestionList`: `suggestionName`, `suggestionDetail`, `suggestionImage`, `suggestionLink` | |
| `sectionAmenities.items[].{title,body,image,linkHref}` | grupo `amenityList`: `amenityName`, `amenityDetail`, `amenityImage`, `amenityLink` | |
| `sectionStory.items[].{title,date,body,image}` | grupo `storyMilestones`: `storyTitle`, `storyDate`, `storyBody`, `storyImage` | sección opcional (solo en 3 de 9) |
| `sectionDresscode.items[].{title,bullet,image}` | grupo `dressCodeRules`: `dressCodeTitle`, `dressCodeDetail`, `dressCodeImage` | **mata H-51**: hoy solo se lee la primera fila |
| `sectionStarted.title` / `.note` / `.limit_confirm` | `text` rol `sectionTitle` / `rsvpNote` / `date` rol `rsvpDeadline` | |
| `sectionStarted.background` | `image` rol `rsvpBackground` | |
| `sectionFooter.smallText.content` | `text` rol `footerNote`, `source:"fixed"` | |
| `sectionFooter.logoUrl` / `.linkHref` | `image` rol `footerLogo` / `link` rol `footerLink` | |
| `settings.music` | `audio` rol `backgroundMusic` | |
| `settings.primaryColor` / `.secondaryColor` | **DESCARTADO del documento** | → `theme.palettes[].tokens.accent` / `.surface` (P3) |
| `settings.child_friendly` / `.young_friendly` | `business:invitation.childrenAllowed` / `.youngAllowed` (roles `rsvpChildrenAllowed` / `rsvpYoungAllowed`) | **roles nuevos 1R** |
| `settings.name` (`"invitacion1"`) | **DESCARTADO** | identificador interno del maquetador, sin significado de dominio |
| `templateId` (raíz) | `template.slug@version` | mata H-11/H-20: capacidades declaradas, no `templateId` mágico |

### 10.2 Documento de contenido (`default_content_*.json`)

| Clave antigua | Destino nuevo | Nota |
|---|---|---|
| `eventTypeId` / `planId` | `manifest.eventKinds` / `manifest.minPlanTier` | catálogo cerrado, no enteros mágicos (H-20) |
| `date` (`"2025-12-31T16:30:00"`) | `business:invitation.date` + `invitation.time` | |
| `celebrantName` | `person` rol `honoree` | |
| `parents.{groom,bride,parents,godparents}.label` | `text` rol `personLabel` dentro del grupo `familyGroup` | |
| `parents.*.names` (`"Raul Estrada y Teresa Lopez"`) | `person` rol `personName` (un ítem por persona **o** un ítem con los dos nombres) | hoy es **dato muerto** en `default_content` (§6.3 del informe): el generador no lo lee |
| `parents.*.image` | `image` rol `personPhoto` | |
| `family.{parents,godparents}.title` | `text` rol `familyGroupTitle` | |
| `family.*.members[].{label,name,photo}` | ítems del grupo `familyGroup` | dos grupos declarados, no anidamiento (§3.2) |
| `itinerary[].eventName` / `.eventLocation` / `.eventMapsUrl` | grupo `eventCards`: `eventTitle`, `eventPlace`, `eventMapLink` | **mata H-49** |
| `itinerary[].date` / `.startTime` / `.endTime` | un solo `dateTimeRange` rol `eventWhen` | hoy son cadenas libres (`"Miércoles 31, Diciembre, 2025"`, `"4:30 PM"`): la migración las normaliza (`05 §3`) |
| `itinerary[].icon` | **DESCARTADO** | FontAwesome = presentación |
| `giftRegistry[].type` / `.name` / `.message[]` / `.photo` / `.url` | grupo `giftOptions`: `giftOptionKind`, `giftOptionTitle`, `giftOptionDetail`, `giftOptionImage`, `giftOptionLink` | `message[]` (banco/titular/CLABE) es `listText` de hasta 6 líneas — **mata H-30** (truncado a ≥9 `body` sin criterio) |
| `giftRegistry[].icon` | **DESCARTADO** | presentación |
| `dressCode.{women,men}.{title,description,image}` | ítems del grupo `dressCodeRules` | **mata H-51** |
| `dressCode.*.icon` | **DESCARTADO** | presentación |
| `amenities[].{type,name,url,image}` | grupo `amenityList`: `amenityName` (← `type`, es el rótulo visible), `amenityDetail` (← `name`), `amenityLink`, `amenityImage` | |
| `recommendations[].{type,name,url,image}` | grupo `suggestionList`, mismo criterio | |
| `story[].{title,date,description,image}` | grupo `storyMilestones` | |
| `hashtags[].{tag,url,platform}` | grupo `hashtagList`: `hashtag`, `hashtagLink`, `hashtagPlatform` (`choice`) | |
| `music.{url,type,enabled}` | `audio` rol `backgroundMusic` + `boolean` rol `backgroundMusicEnabled` | **`backgroundMusicEnabled` es rol nuevo 1R**; `type` (`"custom"`) se descarta |
| `rsvp.confirmationDeadline` | `date` rol `rsvpDeadline` | hoy cadena libre (`"26 de Julio, 2025"`); se normaliza al migrar |
| `rsvp.message` | `text` rol `rsvpNote` | |
| `rsvp.note` (`"Boda sin niños…"`) | `text` rol `rsvpKidsNote` | **rol nuevo 1R**; antes colisionaba con `rsvp.message` |
| `rsvp.kidsAllowed` | `business:invitation.childrenAllowed` (rol `rsvpChildrenAllowed`) | |
| `footer.{logoUrl,text,link}` | `image` `footerLogo` / `text` `footerNote` / `link` `footerLink` | |
| `phrases.intro[]` | `listText` rol `sectionIntro` de la sección `celebrant` | |
| `phrases.celebrated[]` | `richText` rol `honoreeMessage` | |
| `phrases.hombre[]` / `.mujer[]` | `richText` rol `celebrantAText` / `celebrantBText` | |
| `phrases.pareja[]` | `richText` rol `celebrantsMessage` | **rol nuevo 1R** |
| `images.coverPhoto` | `image` rol `coverImage` | |
| `images.people[]` | `image` rol `honoreePhoto` / `celebrantAPhoto` / `celebrantBPhoto` según la plantilla | |
| `images.gallery[]` | ítems del grupo `galleryPhotos` | |
| `images.backgrounds.{topBg,bottomBg,rsvpBg}` | `image` rol `sectionBackground` / `rsvpBackground` | |
| `images.{parents,godparents,story,amenities,recommendations}` | `image` del ítem correspondiente de cada grupo | `amenities`/`recommendations` son `null` en los 9 |
| `texts.coverSubtitle` | `text` rol `coverSubtitle` | |
| `texts.coverButton` | `text` rol `coverButtonLabel` | |
| `texts.coupleHeading` | `text` rol `celebrantsHeading` | |
| `texts.coupleMessage` | `richText` rol `celebrantsMessage` | **rol nuevo 1R** |
| `texts.familyIntro` | `listText` rol `familyIntro` | |
| `texts.galleryIntro` | `text` rol `galleryIntro` | |
| `texts.{itineraryTitle,galleryTitle,recommendationsTitle,amenitiesTitle,giftTableTitle,rsvpTitle,dressCodeTitle}` | `text` rol `sectionTitle` de su sección | **mata H-31/H-32**: hoy están hardcodeados en Kotlin en español, ignorando la plantilla |
| `texts.rsvpNote` / `.rsvpLimit` | `text` rol `rsvpNote` / `date` rol `rsvpDeadline` | |
| `_comment` (en `cumpleanos`, `evento`) | **DESCARTADO** | comentario de autoría; su equivalente nuevo es `NOTAS.md` (§7) |

### 10.3 Resultado

- **Cero claves sin destino.** Todo lo que no aparece arriba como **DESCARTADO** tiene un bloque, un rol o
  un campo de negocio asignado. Todos los descartes son de una de tres clases y ninguno es contenido del
  cliente: presentación (`fontFamily`, `md`/`sm`/`xs`, `*Color`, `icon`), identificadores del maquetador
  (`settings.name`, ids `g1`/`b-f1`) o comentarios (`_comment`).
- **No hizo falta ningún tipo de sección nuevo** (los 12 bastan) **ni ningún tipo de bloque nuevo** (los 14
  bastan).
- **Sí hicieron falta 9 roles nuevos**, todos añadidos a `esquema/blocks.ts` en la ronda 1R:
  `celebrantsMessage`, `hashtagPlatform`, `backgroundMusicEnabled`, `rsvpKidsNote`, `rsvpChildrenAllowed`,
  `rsvpYoungAllowed`, `personPhotoVisible`, `eventLocationNote`, `coverButtonLink` — más `witness` (que el
  §3.3 anterior nombraba pero el esquema no tenía) y los 10 roles de grupo (§3.3).

---

## 11. Revisión independiente (1R-dominio)

Ronda **1R**, 2026-09-03. Revisor independiente del bloque de dominio. El contenido anterior de este
documento y de `esquema/*.ts` lo escribió un solo agente Sonnet en secuencia, sin revisión de un modelo
mayor y **sin ejecutar nada**: el `README.md` del esquema afirmaba haberse validado con
`node --experimental-strip-types`, y el paquete **no compilaba** (O-19).

Todo lo de abajo está **verificado ejecutando**, no razonado: `node 22.22.2`, `pnpm 10.33.0`,
`typescript 5.9.3`, `zod 4.5.4`, `ajv 8.20.0`, `ajv-formats 3.0.1`. Transcripción literal de la consola en
`memoria/bitacora/1R-dominio.md`.

### 11.1 Objeciones altas y medias

| id | Sev. | Evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|
| **O-19** | **alta** | `esquema/manifest.ts:3` importaba `BlockValue` de `./common.ts`, donde no existe (está en `blocks.ts`). `tsc --noEmit --strict` → `error TS2305`. El paquete **entero** no compilaba, luego `DefaultsFile` nunca se había ejecutado | Import corregido | cerrada |
| **O-20** | media | `esquema/invariants.ts:109` — `value as {start,end?}` sobre `{kind:string}&Record<string,unknown>` → `error TS2352` | Conversión vía `unknown` | cerrada |
| **O-17** | **alta** | `composed.ts` usaba `z.string().url()` en 9 posiciones (incl. `link.href`, `location.mapHref`, `image.url`). Emite `format:"uri"`, y `ajv-formats` **acepta** `javascript:alert(1)` y `data:text/html;…`. Es el esquema con el que se valida `tpl_release.composed`, lo que sirve el render público a invitados sin auth (P8) | Las 9 pasan a `HttpUrl` (regex `^https?://…`). Verificado: ajv y Zod ahora rechazan `javascript:` y `data:` y aceptan `https://maps.app.goo.gl/…` | cerrada |
| **O-01** | **alta** | §3.3 listaba 31 roles; `blocks.ts` define otros. **7 roles del documento no existían en el esquema** (`witness`, `storyMilestone`, `giftOption`, `bankAccount`, `dressCodeRule`, `amenity`, `suggestion`). Un agente de fase 2 que implementara el documento produciría un enum incompatible | §3.3 reescrita: la forma normativa es `blocks.ts`; los que faltaban se añadieron o se mapearon; el documento describe familias, no duplica la lista | cerrada |
| **O-02** | **alta** | Los 8 grupos de `boda-clasica@1.0.0` llevaban el rol de uno de sus propios `itemBlocks` (`event.cards` → `eventTitle`, idéntico a `event.cards.title`). El direccionamiento por rol de la IA (`07 §3`) y el mapeo al cambiar de plantilla (§6.4) quedaban ambiguos | 10 **roles de grupo** nuevos + **I-25** (grupo ⟺ rol de grupo). Los dos manifiestos de ejemplo actualizados | cerrada |
| **O-16** | **alta** | `ejemplos/boda-clasica-1.0.0/compuesto.json` **no era** la salida de `compose` sobre sus propias entradas: 5 etiquetas acortadas a mano y 3 URLs de asset inventadas (`…/a/DEMONOV1.webp`). Un golden file escrito a mano prueba la mano, no el código | Se escribió `esquema/compose.ts` (implementación de referencia) y **ambos** `compuesto.json` se regeneraron con él. Verificado: `compose` los reproduce byte a byte y es idempotente | cerrada |
| **O-21** | **alta** | Los 17 `assetId`/`itemId` de demostración de los ejemplos **no eran ULID válidos**: `01J8DEMO…` usa `O`, que no está en el alfabeto Crockford base32, y 12 de ellos tenían 27 caracteres en vez de 26. Los `defaults.json`, `documento.json` y `compuesto.json` **no validaban contra su propio esquema** | Reescritos a Crockford válido de 26 (`01J8DEM0…`). Los 10 archivos de ejemplo validan ahora contra Zod **y** contra ajv | cerrada |
| **O-15** | media | Tres ejemplos llevaban una clave `_comentario` en la raíz; todos los esquemas son `z.strictObject` y el JSON Schema emitido lleva `additionalProperties:false` → esos golden files no validaban | Los comentarios se movieron a `ejemplos/<par>/NOTAS.md` | cerrada |
| **O-03** | **alta** | La firma de `compose` no recibía nada con lo que convertir un `assetId` opaco en URL, pero `ResolvedValue.image` exige `url`. `compose` era **inimplementable** tal como estaba escrita | Se añade el parámetro `assets: AssetIndex`, resuelto por el backend antes de llamar (compose sigue pura) | cerrada |
| **O-04** | media | El `CompositionReport` en Kotlin (§5.1) y el de `esquema/composed.ts` no coincidían: el primero declaraba `fallbacks: List<Fallback>` (tipo inexistente) y omitía `stillDefault` e `invalidValues` | §5.1 reescrita con la forma del esquema, y con tipos de error/resultado explícitos | cerrada |
| **O-05** | **alta** | R1 decía que las secciones ausentes "se añaden con sus valores por defecto" pero no **dónde**. La lectura natural (anexar) colocaba `family` de `xv-jardin` **después del pie de página** — y lo mismo le pasaría a cualquier sección que una versión nueva añadiese en medio | **R1c**: inserción anclada en la posición relativa del manifiesto. Implementada y verificada: `xv-jardin` compone `cover, honoree, family, event, …` | cerrada |
| **O-11** | **alta** | R9 (determinismo) no mencionaba que `doc.content` viaja por `jsonb` y que **Postgres reordena las claves de un `jsonb`**. Las listas de `CompositionReport` se construían iterando `Object.entries(doc.content)`, luego `contentHash` y los golden files cambiarían entre "recién escrito" y "leído de vuelta" | R9 reescrita con las 5 fuentes de no-determinismo (orden de claves, `Intl`, reloj/zona, ULIDs, dobles). `compose.ts` ordena las 5 listas del informe; el formateo de fechas usa tablas de meses literales, nunca `Intl` | cerrada |
| **O-12** | **alta** | `contentHash` se usaba en `01 §5.2 R9`, `02 §2.6` y `03 §4` (como `ETag`) y **no estaba definido en ningún documento** | §5.5: `canonicalJson` (5 reglas) + fórmula de `contentHash`, hasheando la salida de `compose` (no la entrada) y prohibiendo URLs firmadas dentro del hash | cerrada |
| **O-06** | **alta** | `package_hash = sha256(canonicalJson(manifest) ‖ sha256 de cada asset)` **no incluía `theme.json`, `defaults.json` ni las migraciones**. Dos paquetes con el mismo manifiesto y distintos textos de demostración colisionan, y el registro idempotente por `package_hash` (ADR-008) **descarta el segundo en silencio** | §2.1: algoritmo exacto sobre **todos** los archivos del paquete, con canonicalización de los `.json` y orden byte a byte de las rutas | cerrada |
| **O-14** | **alta** | `blocks.ts:149` citaba "01 §6.3" para el mapeo al cambiar de plantilla, y **§6.3 no existía**. `03-api.md` expone `:choose-template` sin que nadie defina qué pasa con el contenido ya editado | Nueva §6.4 `switchTemplate`: firma, 6 pasos deterministas, transporte **solo por rol singleton**, grupos siempre al `attic`, y la consecuencia que el editor debe avisar | cerrada |
| **O-13** | media | La tabla de operaciones de migración de §6 no coincidía con `MigrationOp` de `manifest.ts`: omitía `shrinkGroup` y el converter `richTextToText`, y daba a `moveIntoGroup`/`flattenGroup` campos inexistentes (`blockIdPrefix`) o les faltaba `itemBlockId` | §6.2 rehecha desde el esquema, con las 11 operaciones, sus campos exactos, si son `lossless` y la semántica de los 4 convertidores | cerrada |
| **O-18** | media | `z.record(BlockId, BlockValue).safeParse(JSON.parse('{"__proto__":…}'))` devuelve `success:true` y un objeto **vacío**: Zod descarta la clave **en silencio** (P1 lo prohíbe). ajv sobre el mismo JSON Schema **sí** la rechaza (`propertyNames`) → TS y Kotlin discreparían sobre el mismo documento. `"constructor"` además **casa** con el patrón de `BlockId` y pasa entero | **I-29** (`assertNoReservedKeys`) sobre el JSON **crudo**, antes de `parse`, en TS y Kotlin. `attic` pasa además de `z.string().max(120)` a `BlockId`, y su clave externa de una regex laxa a slug+semver estrictos | cerrada |
| **O-22** | media | `spec.constraints.maxLength` de `richText` **no se validaba en ningún sitio**: un relato de 8000 caracteres pasaba contra un spec de 600 | I-16 extendida a `richText`, midiendo el texto plano (`richTextLength`) | cerrada |
| **O-23** | media | `reorderSections.order` solo tenía `min(1).max(16)`: `["cover","cover","cover"]` era una operación válida | **I-24** (`validateReorder`): permutación exacta de las claves actuales, comprobada por el reductor antes de aplicar el lote | cerrada |
| **O-07/O-08/O-09/O-10** | media | Cuatro bloques `jsonc` del documento describían campos que el esquema **no tiene** (`manifest.theme`, `SectionSpec.hideable`, `SectionSpec.defaultOrder`, `BlockSpec.defaultRef`, `StructureEntry.order`) o tipos equivocados (`name` como cadena, `source:"business:<campo>"`, `AssetEntry` sin `bytes`). Un agente de fase 2 implementa lo que lee | §2.2, §2.3, §2.4 y §4 corregidas, cada una diciendo explícitamente qué campo **no existe** y por qué | cerrada |
| **O-24** | media | `01 §8` afirmaba que `z.registry()` "emite `$defs` + `$ref` reutilizables" y que eso daba "un solo JSON Schema sin duplicar definiciones". El emisor **no registraba nada**: los 10 archivos salían sin un solo `$ref`, con el catálogo de 14 bloques repetido en 5 de ellos (469 KB) | `emit-json-schema.ts` reescrito: bundle único `templates2.schema.json` (15 `$defs`, 42 `$ref`, 217 KB) + 10 punteros. Incluye el borrado del `$id` inválido que Zod inserta y que hace que ajv rechace el bundle entero | cerrada |
| **O-25** | media | I-27/I-28 no existían: un manifiesto podía declarar `locales:["en-US"]` sin etiquetas en `en-US` (fallback silencioso a `es-MX` en cada composición), y `defaults.json` podía traer valor para un bloque `business` (contenido muerto que R4 ignora siempre) | **I-27** y **I-28** añadidas a `validateManifest`, con prueba negativa | cerrada |

**Objeciones bajas** (registradas, sin cambio de contrato): `setTheme` sin `paletteId` ni `fontSetId` es un
no-op válido (se acepta: el reductor lo ignora y no rompe nada); `"constructor"` es un `blockId`
sintácticamente legal (lo prohíbe I-29, pero un autor de plantillas puede confundirse — el kit debería
avisarlo); `esquema/README.md` decía "21 invariantes I-01…I-21" cuando eran 23 (ahora 29).

### 11.2 Ataques que **no** rompieron nada

- **Colisión de ids.** `blockId` duplicado (I-13), `sectionKey` duplicado (I-14), `itemId` duplicado (I-03)
  y `itemBlockId` duplicado dentro de un grupo (I-13) ya estaban cubiertos y se comportan bien.
- **Cardinalidad**: contenido del cliente más largo (`items.length > spec.max`) o más corto
  (`< spec.min`) que lo que la plantilla admite → I-04, en escritura y en composición.
- **`end < start`** en `dateTimeRange` → I-01, correctamente fuera del JSON Schema.
- **Sección `required` oculta** → I-17, y `compose` la fuerza visible además de rechazar la escritura.
- **Bloque de negocio escrito desde `content`** → I-21, y R4 lo ignoraría igualmente.
- **`itemBlock` con `source ≠ "user"`** → I-22.
- **Idempotencia de `compose`**: dos llamadas con las mismas entradas dan `canonicalJson` idéntico, en los
  dos pares de ejemplo (verificado, no razonado).

### 11.3 Lo que sigue sin poder determinarse

- **No hay implementación de `migrate`, `switchTemplate` ni `applyOperation`.** Esta ronda escribió
  `compose.ts` porque era la única forma de generar el golden file que faltaba y de comprobar R1–R9; las
  otras tres tienen firma exacta y pseudocódigo, pero su comportamiento **no está verificado ejecutándolo**.
  Es el primer trabajo de la fase 2.
- **Nada se ha probado contra Kotlin.** El contrato "misma tabla de casos en TS y Kotlin" (ADR-005) sigue
  siendo un diseño: no hay JDK 17 en este entorno (`contratos.md` §7) y no se compiló una sola línea de
  Kotlin. Que `com.networknt:json-schema-validator` acepte el bundle con `$defs` es **inferido** de que ajv
  lo acepta, no verificado.
- El contenido real de las plantillas 11, 12, 14, 16 y 17 sigue sin ser reproducible desde el repositorio
  (§9); la cobertura de §10 se construyó sobre los 9 pares que sí están.
