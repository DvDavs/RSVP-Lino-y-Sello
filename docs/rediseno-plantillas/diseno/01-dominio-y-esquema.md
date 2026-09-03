# 01 — Dominio y esquema de plantilla y documento

Autor: fase 1, rol `1-dominio` (redactado por una sesión anterior de este mismo rol de orquestación que se interrumpió antes de firmar memoria; revisado, completado y firmado por el orquestador de esta sesión — ver `memoria/bitacora/1-dominio.md`). Estado: aceptado por el orquestador (ADR-001…ADR-008, ADR-020, ADR-021 en `memoria/decisiones.md`).
Evidencia: `handoffs/0-resumen-auditoria-dominio.md`, `fases/J-inventario-json.md` §5–§6, `fases/C1-generacion-parte1.md`, `fases/C2-generacion-parte2.md`, `EditorModels.kt:12-494` (referencia de *lo que se sustituye*, no base).

---

## 1. Las cuatro capas

| Capa | Quién la escribe | Dónde vive | Mutabilidad |
|---|---|---|---|
| **1. Paquete de plantilla** (`slug@semver`) | Autor de plantillas (kit, fase 4) | Git + `tpl_template_version.manifest` (JSONB) | **Inmutable** una vez publicada |
| **2. `theme`** | Cliente (elige de presets) | `tpl_document.doc.theme` | Solo `paletteId` + `fontSetId`; **jamás** color, fuente ni CSS (P3) |
| **3. `structure`** | Cliente (ocultar/reordenar) | `tpl_document.doc.structure` | Lista de `{key, variant, visible, order}` |
| **4. `content`** | Cliente (textos, fotos) | `tpl_document.doc.content` | **Mapa plano por id de bloque** |

**Datos de negocio** (invitación, invitados, RSVP, fecha, hashtag, `coverPhotoUrl`) viven en las tablas relacionales existentes y **nunca** se copian dentro de `doc`. Entran en la composición por *rol*, no por posición (mata H-01/H-02).

### Por qué `content` es un mapa plano y no un árbol

El defecto raíz de la auditoría es el emparejamiento por posición (`items[0]`=novio, H-02) y por texto de título (`"Padre"/"Padrino"`, H-01), que hace perder los datos del usuario en 5 de 6 plantillas no-boda. Un mapa `{"<blockId>": <valor>}` hace el merge por id estable **estructuralmente imposible de equivocar** (P2): no hay índice al que recurrir. Los grupos repetibles llevan `itemId` generado por el servidor (ULID), estable a través de reordenamientos y de cambios de versión de plantilla.

---

## 2. Esquema formal del paquete de plantilla

### 2.1 Disposición en disco (kit de autor, fase 4)

```
templates/<slug>/<version>/
  template.json          # manifiesto (el contrato; ver 2.2)
  defaults.json          # contenido de demostración por id de bloque
  theme.json             # paletas y juegos tipográficos (presets con id)
  assets/                # imágenes propias del paquete (fondos, iconos, texturas)
  migrations/<from>-to-<to>.json   # operaciones declarativas de migración
```

El registro (ADR-008) empaqueta el directorio, calcula `packageHash = sha256(canonicalJson(manifest) || sha256 de cada asset ordenado por ruta)` y lo persiste. `packageHash` es la clave de idempotencia real: registrar dos veces el mismo contenido es un no-op.

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
  "theme": { "$ref": "theme.json" },
  "sections": [ /* SectionSpec[] — ver 2.3 */ ],
  "assets": [ { "path": "assets/fondo.webp", "sha256": "…", "contentType": "image/webp" } ],
  "migrationsFrom": ["0.9.0"]
}
```

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
  "variants": ["full", "split"],
  "defaultVariant": "full",
  "required": true,                  // si true, `visible` no puede ponerse en false
  "hideable": false,
  "defaultVisible": true,
  "defaultOrder": 0,
  "blocks": [ /* BlockSpec[] */ ]
}
```

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
  "source": "user",                  // "user" | "business:<campo>" | "fixed"
  "constraints": { "maxLength": 60, "minLength": 1 },
  "defaultRef": "couple.brideName"   // clave en defaults.json (por convención, la misma)
}
```

- `source: "business:invitation.date"` marca los bloques que **lee** la composición de Postgres (fecha, hora, hashtag, `coverPhotoUrl`, `childrenAllowed`, `youngAllowed`). El editor los pinta como solo lectura con un enlace a "editar datos del evento". Esto elimina H-04 de raíz: no hay copia que desincronizar; la fecha se resuelve en cada composición.
- `source: "fixed"` es contenido de la plantilla no editable (p. ej. el rótulo legal del pie).

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

`settings` (música, colores, `child_friendly`) **no es una sección**: música pasa a bloque `audio` de una sección, los colores pasan a `theme`, y `child_friendly`/`young_friendly` son datos de negocio (`invitation.children_allowed`/`young_allowed`), leídos por `source: "business:*"`.

### 3.2 Tipos de bloque (14) — catálogo cerrado

| `type` | Valor en `content` | Restricciones | Cubre |
|---|---|---|---|
| `text` | `{kind:"text", value:string}` | `maxLength` ≤ 2000, `minLength`, `pattern` | títulos, nombres, etiquetas |
| `richText` | `{kind:"richText", doc:PortableDoc}` | ≤ 8000 chars, marcas: `bold,italic,link,paragraph` | historia, mensaje |
| `listText` | `{kind:"listText", items:string[]}` | ≤ 12 ítems, ≤ 200 chars c/u | `body` de gifttable/amenities (mata H-30, H-33) |
| `image` | `{kind:"image", assetId, alt, focal:{x,y}}` | `assetId` es opaco; nunca URL (ADR-021) | fotos, fondos |
| `audio` | `{kind:"audio", assetId}` | mp3/aac ≤ 8 MiB | música de fondo |
| `date` | `{kind:"date", value:"YYYY-MM-DD"}` | ISO-8601 local | fechas |
| `time` | `{kind:"time", value:"HH:mm"}` | 24h | horas |
| `dateTimeRange` | `{kind:"dateTimeRange", start, end?}` | `end >= start` **validado en Kotlin y TS, no con `.refine`** (§5.2) | tarjetas de evento |
| `link` | `{kind:"link", href, label?}` | `https?:` únicamente; sin `javascript:`/`data:` | botón de mapa, mesa de regalos |
| `location` | `{kind:"location", name, address?, mapHref?}` | `mapHref` con la misma regla que `link` | lugares |
| `choice` | `{kind:"choice", optionId}` | `optionId ∈ spec.options` | tipo de dress code, tipo de regalo |
| `boolean` | `{kind:"boolean", value:bool}` | | `showImage` |
| `person` | `{kind:"person", name, note?}` | `role` del BlockSpec identifica quién es | padres, padrinos, novios |
| `group` | `{kind:"group", items:[{itemId, values:{…}}]}` | `min`/`max` del spec; `itemId` = ULID del servidor | todas las listas |

Un `content` con un `kind` que no corresponde al `type` del BlockSpec es **rechazado** (`TPL_BLOCK_TYPE_MISMATCH`), nunca coaccionado.

### 3.3 Roles (catálogo cerrado, extensible por versión mayor del manifiesto)

`celebrantA`, `celebrantB`, `honoree`, `parentA1`, `parentA2`, `parentB1`, `parentB2`, `godparentA`, `godparentB`, `witness`, `eventTitle`, `eventWhen`, `eventPlace`, `eventMapLink`, `coverTitle`, `coverSubtitle`, `coverDate`, `coverImage`, `storyMilestone`, `galleryPhoto`, `giftOption`, `bankAccount`, `dressCodeRule`, `amenity`, `suggestion`, `hashtag`, `rsvpDeadline`, `rsvpNote`, `footerNote`, `backgroundMusic`, `decorative`.

**`role` es lo que sustituye al emparejamiento por texto de H-01.** `parentA1` ("madre del novio") es un rol, no la cadena `"Padre"`. Un `role` no reconocido falla el registro de la plantilla.

---

## 4. Esquema del documento de invitación

```jsonc
{
  "schemaVersion": 1,
  "template": { "slug": "boda-clasica", "version": "1.2.0" },
  "theme":    { "paletteId": "blush", "fontSetId": "serif-elegante" },
  "structure": {
    "sections": [
      { "key": "cover",  "variant": "full",  "visible": true,  "order": 0 },
      { "key": "story",  "variant": "line",  "visible": false, "order": 5 }
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
3. Todo `structure.sections[].key` existe en el manifiesto; el orden es una permutación sin repeticiones.
4. `theme.paletteId`/`fontSetId` existen en `theme.json` de esa versión.
5. `attic` es de solo escritura para el sistema: el editor no puede escribirlo (P8).
6. El documento **no contiene** URLs, colores, tamaños, fuentes, iconos ni ids de Mongo. Auditable con una búsqueda (definición de terminado global §3).

---

## 5. Reglas de composición (P2, P5)

### 5.1 Firma

```kotlin
// mx.evolutiondev.invitaciones.modules.templates2.composition
fun interface Composer {
    fun compose(
        pkg: TemplatePackage,          // manifiesto + theme + defaults de una versión concreta
        doc: InvitationDocument,       // las capas 2-4 del cliente
        business: BusinessSnapshot,    // proyección inmutable de Postgres (fecha, hora, hashtag, cover, flags)
        locale: Locale
    ): CompositionResult
}

data class CompositionResult(
    val composed: ComposedDocument,        // lo que consume el frontend
    val report: CompositionReport          // incidencias; NUNCA excepciones silenciosas
)

data class CompositionReport(
    val missingRequired: List<BlockId>,    // bloque obligatorio sin valor de usuario ni default
    val orphanContent:  List<BlockId>,     // clave de content que la versión ya no declara
    val orphanSections: List<SectionKey>,
    val fallbacks:      List<Fallback>,    // qué se resolvió por default y por qué
    val themeFallback:  ThemeFallback?
)
```

```typescript
// frontend/packages/schema/src/compose.ts — MISMA función, mismos golden files
export function compose(pkg: TemplatePackage, doc: InvitationDocument,
                        business: BusinessSnapshot, locale: string): CompositionResult;
```

### 5.2 Las nueve reglas

- **R1 — Estructura.** Se parte de `manifest.sections` en su `defaultOrder`. Cada entrada de `doc.structure` con `key` conocida sobrescribe `variant`/`visible`/`order`. Las claves desconocidas van a `report.orphanSections` y **no** se renderizan. Las secciones del manifiesto que faltan en `doc.structure` se añaden con sus valores por defecto.
- **R2 — Contenido, fallback en tres escalones.** `doc.content[blockId]` válido → `defaults[blockId]` → `null` con `provenance = "empty"`. Es el patrón `bodyFromTemplate` que la auditoría pide preservar (§9.1), ahora explícito y probado.
- **R3 — Procedencia.** Cada valor resuelto lleva `provenance ∈ {user, default, business}`. **Esta es la respuesta a H-03**: hoy el placeholder de demo y el dato real del cliente son indistinguibles en el almacén, y por eso se publican los nombres de una pareja ficticia. Con `provenance`, la publicación puede bloquearse o advertir cuando un bloque `required` sigue en `default` (ver `03-api.md` §6, `preflight`).
- **R4 — Negocio por rol.** Los bloques con `source: "business:X"` toman su valor de `business`, ignorando `doc.content` (que ni siquiera puede escribirlos: la API los rechaza). Nunca por posición.
- **R5 — Nada se fabrica.** Si el manifiesto no declara un bloque para un dato de negocio, ese dato no se renderiza. Se preserva el contrato "plantilla nula → sección nula" (§9.1).
- **R6 — Determinismo.** `compose` es pura: sin reloj, sin `Locale.getDefault()`, sin aleatoriedad, sin E/S. El formateo de fechas usa `formatDate(instant, patternId, locale)` con el patrón declarado en el BlockSpec — resuelve H-27 (fechas inconsistentes entre `couple` y `cover`) al haber un solo formateador con patrón declarado.
- **R7 — Grupos.** Los ítems se ordenan por su posición en `doc.content[groupId].items`; `itemId` es la identidad. Un ítem con `itemId` duplicado se rechaza en la escritura, no en la composición.
- **R8 — Tema.** `theme` del documento → `defaultPaletteId`/`defaultFontSetId` de la plantilla, registrando `themeFallback`.
- **R9 — Idempotencia.** `compose(compose_inputs)` dos veces produce **bytes idénticos** en JSON canónico (claves ordenadas, sin espacios). Es la base de los golden files y de `contentHash` del release.

### 5.3 Regeneración

No existe "regenerar": la composición ocurre en cada lectura del editor y **una sola vez** al publicar (se congela en `tpl_release.composed`). Cambiar la fecha en Postgres cambia el preview del editor de inmediato y marca el release activo como `stale` (`03-api.md` §6). Así muere H-04/H-05: no hay dos copias que puedan divergir en silencio.

---

## 6. Migración de versión de plantilla

```kotlin
fun migrate(doc: InvitationDocument, from: TemplateVersion, to: TemplateVersion,
            plan: MigrationPlan): MigrationResult   // MigrationResult(doc, report, lossless: Boolean)
```

`migrations/1.0.0-to-2.0.0.json` es una lista de operaciones declarativas, catálogo cerrado:

| Operación | Efecto |
|---|---|
| `renameBlock {from, to}` | mueve el valor conservando `itemId` de grupos |
| `removeBlock {id}` | **mueve el valor a `attic["<from>"]`**, nunca lo borra |
| `addBlock {id}` | queda vacío; toma el default |
| `renameSection {from, to}` / `removeSection {key}` | análogo, con `attic` |
| `renamePalette {from,to}` / `renameFontSet {from,to}` | remapea `theme` |
| `changeBlockType {id, to, converterId}` | `converterId` de un catálogo cerrado (`textToRichText`, `textToListText`, `listTextToText`) |
| `moveIntoGroup {blockId, groupId}` / `flattenGroup {groupId, blockIdPrefix}` | reestructuración de listas |

Reglas: una migración es **pura**, **reversible en el informe** (registra el estado previo) y se ejecuta con `dryRun` obligatorio antes de aplicarse (`03-api.md` §5). Un cambio **mayor** de semver exige plan de migración; un `minor`/`patch` solo puede **añadir** bloques/secciones opcionales — si añade uno `required` sin default, el registro falla.

---

## 7. Ejemplos completos

- Boda: `diseno/ejemplos/boda-clasica-1.0.0/{template,defaults,theme,documento,compuesto}.json`. `compuesto.json` es la salida esperada de `compose()` sobre `documento.json` con un `BusinessSnapshot` documentado en su propio comentario `_comentario`, y ejercita las nueve reglas de §5.2 explícitamente (ver comentario del archivo).
- XV: `diseno/ejemplos/xv-jardin-1.0.0/{template,defaults,theme,documento}.json`. Manifiesto deliberadamente más pequeño (9 secciones vs. 12 de boda-clasica, sin `story`/`suggestions`/`amenities`) para ejercitar R1 con plantillas de distinto tamaño de catálogo, y un celebrante único (`honoree`) en vez de pareja.

Ambos pares son a la vez el primer golden file de la fase 2 (`06-pruebas-y-calidad.md` §4). `compuesto.json` no incluye el `CompositionReport`; para este par de entradas es `{missingRequired:[], stillDefault:[], orphanContent:[], orphanSections:[], invalidValues:[], themeFallback:null}` (ningún bloque `required` quedó en `default`, cero claves huérfanas) — la prueba de golden file en `06-pruebas-y-calidad.md` §4 verifica ambos, `composed` y `report`, por igualdad estructural.

---

## 8. Zod 4 como fuente única — verificación empírica

Ejecutado en esta sesión con `zod@4.5.4` (Node 22):

| Comprobación | Resultado | Consecuencia de diseño |
|---|---|---|
| `z.toJSONSchema` existe de forma nativa | **Sí** (`typeof === "function"`) | `zod-to-json-schema@3.25.2` **no se usa**; se elimina una dependencia (ADR-004) |
| Salida `target: "draft-2020-12"` | correcta, con `additionalProperties: false` en objetos | El validador Kotlin puede rechazar claves desconocidas (P1) |
| `z.discriminatedUnion` | emite `oneOf` con `const` | El catálogo de bloques por `kind` se traduce sin pérdida |
| `z.registry()` + `metadata` | emite `$defs` + `$ref` reutilizables | Un solo JSON Schema para todo el módulo, sin duplicar definiciones |
| Recursión con `get` | emite `$ref: "#"` | Grupos anidados representables |
| **`.refine()` / `.superRefine()`** | **se descartan EN SILENCIO, incluso con `unrepresentable: "throw"`** | **Regla dura: prohibido `.refine()` en cualquier esquema exportado.** Toda invariante entre campos (`end >= start`, `min ≤ items ≤ max`, unicidad de `itemId`) se implementa **dos veces y se prueba dos veces**: `packages/schema/src/invariants.ts` y `templates2/schema/Invariants.kt`, con una tabla de casos compartida en JSON (`06-pruebas-y-calidad.md` §5) |

Validador en Kotlin: `com.networknt:json-schema-validator` (draft 2020-12). El JSON Schema generado se versiona en el repositorio (`frontend/packages/schema/dist/*.schema.json`) y una prueba de CI falla si el archivo generado difiere del commiteado — el esquema no puede desincronizarse entre TS y Kotlin (mata H-35 por construcción).

---

## 9. Lo que no pude determinar

- El contenido real de las plantillas 11, 12, 14, 16 y 17 (solo en producción, `fases/A-modelo-datos.md`, §6.5 del informe). El diseño no depende de ellas; la migración las trata como cohorte aparte (`05-migracion.md` §7).
- Si algún consumidor externo depende hoy de la forma exacta de `InvitationConfig`: no hay frontend en el repositorio (resumen de rol frontend). Se asume que **no** hay compatibilidad que preservar en el documento nuevo; la compatibilidad se preserva en el *render* (mismos textos e imágenes), no en el JSON.
