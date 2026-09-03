# 05 — Migración de plantillas e invitaciones existentes

Autor: fase 1, rol `1-migracion`. **Revisado y profundizado en la ronda 1R por `1R-calidad` (2026-09-03)** — ver §13.
Estado: propuesto para aceptación (ADR-022, ADR-023, y las ADR nuevas `ADR-1R-C-01…07`).
Evidencia: `handoffs/0-resumen-auditoria-migracion.md`, `fases/A-modelo-datos.md`, `fases/J-inventario-json.md`, `fases/H-hipotesis.md` (hipótesis 5 y 7), `ANALISIS-GENERACION-PLANTILLAS.md` §4.6 y §9, `01-dominio-y-esquema.md`, `02-persistencia-y-catalogo.md`, `03-api.md`.

> **Convención de este documento.** Cada afirmación lleva marca de confianza: **[V]** verificado en esta sesión contra el repositorio o ejecutando algo; **[I]** inferido de evidencia indirecta; **[ND]** no determinable desde este repositorio. Toda cita es `archivo:línea`.

---

## 1. Alcance real: cuatro cohortes, no dos

La versión previa de este documento afirmaba "8 plantillas sembradas (ids 4–10 y 13)" y "ids 11, 12, 14, 16, 17 solo existen en producción, NO reproducibles desde este repositorio". **Las dos afirmaciones son falsas tal como estaban escritas** y se corrigen aquí (objeción M-01, §13).

Verificación ejecutada en esta ronda:

```
$ jq -r '.templateId' src/main/resources/data/mongo/default_visual_*.json
7  4  5  11  8  9  10  13  6          # 9 ficheros, 9 templateId distintos
$ jq -r '.templateId // "NULL"' src/main/resources/data/mongo/default_content_*.json
NULL NULL NULL NULL NULL NULL NULL NULL NULL   # NINGÚN content declara templateId
```

| Cohorte | `templateId` | Fila en Postgres (Flyway) | JSON visual en el repo | JSON de contenido | Sembrado hoy | Tratamiento |
|---|---|---|---|---|---|---|
| **A — completa** | 4, 5 | `V1__initial_schema.sql:1133-1136` **[V]** | `default_visual_boda_basico/premium.json` | `(1,1)` / `(1,2)` | sí (`MongoDataInitializer.kt:35,37`) | §3 sin restricciones |
| **A — completa** | 6 | `V24__add_new_event_types_and_xv_template.sql:10-13` **[V]** | `default_visual_xv_premium.json` | `(2,2)` | sí (`:38`) | §3 sin restricciones |
| **A — completa** | 7, 8, 9, 10 | `V25__add_remaining_templates.sql:2-8` **[V]** | bautizo/comunion/confirmacion/cumpleanos | `(3,2)`,`(4,2)`,`(5,2)`,`(6,2)` | sí (`:39-42`) | §3 sin restricciones |
| **B — arte sin fila** | 13 | **ninguna migración lo inserta** **[V]**: `V25:10` deja la secuencia en 10 y no hay `INSERT` con id 13 en ningún `.sql` | `default_visual_evento.json` | `(7,2)` — y `event_type` 7 **tampoco existe** en Flyway **[V]** | sí (`:43`) | §3 + §10.2: el paquete se construye igual; su `eventKind` y su plan salen de Postgres de **producción**, no del repo |
| **B — arte apagado** | 11 | ninguna migración; solo `scripts/apply_template_11_12_local.sh:29-38`, que hace `UPDATE`, no `INSERT` **[V]** | `default_visual_boda_premium_2.json` (**existe**, `templateId=11`) | `default_content_boda_premium_2.json` (**existe**, choca en `(1,2)` con la 5) | **no** — comentado en `MongoDataInitializer.kt:36` y `:50` **[V]** | §3, con la salvedad de §10.1: lo que hay en el repo puede no ser lo que producción sirve |
| **C — reconstruible por payload** | 12 | ninguna; solo `apply_template_11_12_local.sh:40-48` **[V]** | ninguno; `payload-template-xv-2.json` con `templateId` **inyectado en tiempo de ejecución** por `scripts/upsert_template_11_12.js:28-32` **[V]** | mismo fichero, campo `contentConfig` | no | §10.1 |
| **C — reconstruible por payload** | 14 ("Graduación") | ninguna; solo el literal `templateId == 14L` en `DefaultConfigGeneratorService.kt:420` **[V]** | ninguno; existe `payload-template-graduacion.json` (`eventId=7`, `planId=2`) no cableado a ningún script **[V]** | mismo fichero | no | §10.1 |
| **D — sin arte** | 16, 17 | ninguna; solo `apply_template_11_12_local.sh:50-53` (`SET is_enabled=false WHERE id IN (16,17)`) **[V]** | ninguno | ninguno | no | §10.2 — solo migrables leyendo producción |

Consecuencias del corregido:

1. **Se construyen 9 paquetes desde el repositorio**, no 8: los `templateId` 4, 5, 6, 7, 8, 9, 10, 11 y 13. `boda-clasica@1.0.0` (`diseno/ejemplos/boda-clasica-1.0.0/`) es el equivalente del **5**; quedan **8** por construir en fase 4, no 6 ni 7 (la versión previa decía "6" y luego enumeraba 7 — error aritmético, objeción M-07).
2. **Cohorte C es reconstruible con esfuerzo acotado**: `payload-template-xv-2.json` (171 KB) y `payload-template-graduacion.json` (173 KB) contienen `visualConfig` + `contentConfig` completos. El único paso extra frente a la cohorte A es que el `templateId` no vive en el fichero, sino que lo inyecta el script (12) o el código (14). **No** es cierto que "no existan en el repositorio". H-59 ("payloads sin ninguna referencia en código ni scripts") es correcto solo para `payload-template-boda-3.json`; los otros dos sí tienen referencia (`apply_template_11_12_local.sh:18-19`, `upsert_template_11_12.js:19-20`) **[V]**.
3. **Solo la cohorte D (16, 17) es genuinamente no reproducible** desde este repositorio.

Nada de esto bloquea el arranque: cohortes A y B se migran primero, C después, D cuando exista acceso a producción.

## 2. Las tres fuentes de verdad y por qué el extractor lee el JSON **crudo** (H-12)

Este es el punto que la versión previa no cerraba y que puede producir pérdida de contenido silenciosa. Hay **tres** artefactos distintos que en la conversación se llaman todos "la plantilla", y **no contienen lo mismo**:

| Fuente | Qué es | Qué le falta respecto a la anterior |
|---|---|---|
| **F1 — JSON del repositorio** `src/main/resources/data/mongo/default_visual_*.json` | El fichero tal cual está versionado en Git | nada — es el superconjunto |
| **F2 — documento en `default_visual_configs` (Mongo)** | Lo que `MongoDataInitializer` escribió tras deserializar F1 al modelo Kotlin | **pierde 4 rutas de campo** por Jackson (H-12, `H-hipotesis.md` §5, control causal): `config.sectionEvent.itemsSinglePlace` (`EditorModels.kt:234-235`, `@get:JsonIgnore`), `sectionSuggestions.items[].type`, `itinerary[].locationButton`/`.locationDatetime`, `story[].image`. Además fija `config.templateId/eventId/planId = null` **[V]** |
| **F3 — documento en `invitation_configs`** | El resultado de `generateInitialConfig` para **una** invitación, congelado el día que se generó (`InvitationConfigService.kt:138`) | lo mismo que F2 (deriva de F2) **más** lo que el merge no propagó |

Medición ejecutada en esta ronda sobre F1 **[V]**:

```
tid=4  default_visual_boda_basico.json  -> 2 tarjetas itemsSinglePlace
tid=5  default_visual_boda_premium.json -> 3 tarjetas itemsSinglePlace
(los otros 7 ficheros: 0)
```

Esas 5 tarjetas contienen `title.content`, `date.content`, `time.content`, `locationText.content` y `locationText.url` — **contenido visible**, no presentación — y **no están en F2 ni en F3**.

**Regla dura (ADR-1R-C-01).** El proceso de migración usa dos lecturas distintas y nunca las confunde:

- **Construcción del paquete de plantilla (§3)** → lee **F1, el JSON crudo del repositorio**, con `JSON.parse`, sin pasar por ningún modelo tipado del módulo antiguo. Cualquier lectura que use `EditorModels.kt`/`DefaultContentConfig.kt` está prohibida: reproduce H-12 por construcción. El `EditorModels.kt` se consulta **solo** como documentación de qué significa cada campo, nunca como parser.
- **Golden `before` de una invitación (§5)** → lee **F3, el documento ya guardado en `invitation_configs`**, sin re-ejecutar el generador (ADR-022, motivo H-09: `MongoDataInitializer.kt:83-90` pisa lo visual en cada arranque, así que re-generar hoy puede no reproducir lo que esa invitación mostró **[V]**).

Corolario incómodo y aceptado: **`itemsSinglePlace` y las otras 3 rutas nunca llegaron a ninguna invitación**, así que su ausencia en el `after` no es una regresión — pero sí deben existir en el **paquete** (capacidad `singlePlace`, `esquema/manifest.ts:53`) para que la funcionalidad quede reparada en el módulo nuevo. Se migran como **defaults de la plantilla**, no como contenido de ninguna invitación.

## 3. Construcción de los 9 paquetes de plantilla

Por cada `templateId` de las cohortes A y B, un sub-agente de fase 4 (con revisor, sección 5 del prompt maestro) ejecuta:

1. **Leer F1 crudo** (`JSON.parse` del `default_visual_<slug>.json` y del `default_content_<slug>.json`). Prohibido el modelo Kotlin (§2).
2. **Enumerar todas las hojas** del JSON como punteros RFC 6901 y clasificarlas con la tabla de §4. El paso falla si queda **un solo patrón de hoja sin clasificar** (P1). Herramienta y su salida real: §4.1.
3. **Separar presentación** (colores RGBA, `fontFamily`, `icon`, subárboles `md`/`sm`/`xs`, `backgroundColor`) hacia `theme.json`: una paleta y un `fontSet` por plantilla, nombrados a mano por quien construye el paquete. No hay forma automática de derivar un preset razonable de hexadecimales sueltos; el criterio es humano y queda documentado en el `_comentario` del `theme.json`.
4. **Aplicar roles** (`esquema/blocks.ts` `BlockRole`) según §4, cohorte por cohorte: el mapa de `sectionCouple` de las plantillas de boda (`groomName`/`brideName`/`groomPhoto`/`bridePhoto`/`groomText`/`brideText`/`subheading`) **no es el mismo** que el de las no-boda (`namePersonEvent`/`photoPersonEvent`/`message`) — verificado en esta ronda: el mapa único falla en 6 patrones de hoja de las 3 plantillas de boda **[V]**.
5. **Poblar `defaults.json`** con los textos e imágenes de demo (§4 columna "origen del default"), incluidos los que hoy están inalcanzables (`itemsSinglePlace`, `story[].image`).
6. **Registrar** el paquete por el único camino de alta (`02 §4`, `POST /master/templates2/versions`), que ya valida el manifiesto contra `Invariants.kt` y hace el diff estructural de ADR-028.
7. **Golden file de plantilla** (`06 §3`): componer el paquete contra `content: {}` y comprobar por **texto visible** (§6, mismo algoritmo) que reproduce lo que hoy produce F1+F2 combinados. No se compara JSON crudo: la forma cambia a propósito (ADR-001).

Los **nombres visibles** de cada `templateId` sí están en el repositorio y ya no hace falta leerlos de producción (corrección al §8 de la versión previa) **[V]**: `V24:12` → 6 = "XV Años Elegance Premium"; `V25:4-7` → 7 "Bautizo Premium Elegance", 8 "Comunión Premium Elegance", 9 "Confirmación Premium Elegance", 10 "Cumpleaños Premium Elegance"; `apply_template_11_12_local.sh:31,41` → 11 "Boda Premium 2", 12 "XV Premium 2". Los ids **4 y 5 tienen `name` vacío en el dump** (`V1:1133-1136`) **[V]** — sus slugs (`boda-basica`, `boda-clasica`) son decisión de quien construye el paquete, registrada como supuesto en `preguntas-abiertas.md`.

### 3.1 Los ids del JSON legado **no** son ids estables

`ADR-002`/P2 exigen merge por id estable. La tentación evidente —reutilizar el `id` que ya traen los ítems legados (`b-f1`, `f1`, `s1`, `msj1`, `event-1`…)— **no funciona**. Medición de esta ronda sobre F1 **[V]**:

```
default_visual_bautizo.json          ids=33   únicos=23  duplicados: f1,f2,msg-1,s1,s2
default_visual_boda_basico.json      ids=32   únicos=22  duplicados: event-1,event-2,msg-1,s1,s2
default_visual_boda_premium.json     ids=78   únicos=35  duplicados: null,event-1..3,f0,f1,msg-1,msj1,msj2,s1..s3
default_visual_boda_premium_2.json   ids=134  únicos=31  duplicados: null,msg-1,s1,s2,s3
default_visual_xv_premium.json       ids=62   únicos=31  duplicados: null,f1,f2,msg-1,msj1,msj2,s1..s3
(comunion, confirmacion, cumpleanos, evento: mismo perfil que bautizo)
```

Hay `id: null` en 3 de los 9 ficheros, y el mismo literal se repite en secciones distintas y **dentro de la misma sección en niveles distintos** (`sectionEvent` de la 5 tiene `event-1..3` dos veces: en `items` y en `itemsSinglePlace`). Confirma H-28 y lo amplía a las 9 plantillas.

**Regla (ADR-1R-C-02):** la clave de correlación legado→nuevo es el **puntero RFC 6901 de la hoja**, no el `id`. El `id` legado se conserva únicamente como *dato de trazabilidad* en el informe de migración (`legacyPointer`, `legacyId`), nunca como `blockId` ni como `itemId`. Los `itemId` de grupo son ULID nuevos generados por el servidor en el orden del array legado (ADR-002).

## 4. Tabla de mapeo campo a campo, con clasificación de pérdida

Clasificación (obligatoria en cada fila):

- **`sin pérdida`** — el valor llega íntegro a un bloque del paquete nuevo o a un campo de negocio en Postgres.
- **`pérdida de presentación aceptable`** — el valor desaparece del documento y su intención se recupera en `theme.json`/`variant`/`capabilities` (P3: el backend no guarda presentación).
- **`pérdida de contenido — BLOQUEA`** — no hay destino en el catálogo cerrado; el paquete no se puede registrar hasta que se amplíe el catálogo por ADR o se decida descartar explícitamente.
- **`descartado con motivo`** — se descarta a propósito, con la razón escrita.

Referencia de `blockId`: los del manifiesto de ejemplo `diseno/ejemplos/boda-clasica-1.0.0/template.json` **[V]**. Un paquete no-boda usa los mismos `role`s con `blockId`s propios.

### 4.1 Cómo se produce la tabla completa (y por qué no cabe a mano)

La tabla completa tiene ~250 filas por plantilla, no 20. Se produce **mecánicamente** con el enumerador de §3 paso 2 y se revisa a mano. Prototipo ejecutado en esta ronda (`scratchpad/1R-calidad/extract-proto.mjs`, Node 22.22), con un mapa hecho a mano de **100 reglas**:

```
default_visual_bautizo.json          hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_boda_basico.json      hojas=  5003  mapeadas=  112  presentacion=  4788  descartadas=  3  SIN MAPEAR=  100
default_visual_boda_premium.json     hojas=  6623  mapeadas=  185  presentacion=  6305  descartadas=  3  SIN MAPEAR=  130
default_visual_boda_premium_2.json   hojas=  5500  mapeadas=  156  presentacion=  5087  descartadas=  3  SIN MAPEAR=  254
default_visual_comunion.json         hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_confirmacion.json     hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_cumpleanos.json       hojas=  3830  mapeadas=  132  presentacion=  3629  descartadas=  3  SIN MAPEAR=   66
default_visual_evento.json           hojas=  3671  mapeadas=  123  presentacion=  3479  descartadas=  3  SIN MAPEAR=   66
default_visual_xv_premium.json       hojas=  4793  mapeadas=  182  presentacion=  4522  descartadas=  3  SIN MAPEAR=   86
total de patrones de hoja sin mapear: 146
```

Lectura **[V]**: ~95 % de las hojas son presentación (`md`/`sm`/`xs`, colores, fuentes, iconos) — coherente con ADR-001; y **146 patrones distintos siguen sin mapear** tras 100 reglas escritas a conciencia. Ese número es la medida honesta del trabajo de fase 4, y es la razón por la que el paso 2 de §3 debe ser un **gate mecánico** ("cero patrones sin mapear") y no una revisión visual.

### 4.2 Tabla de mapeo (extracto normativo — el resto se genera con el mismo criterio)

| Campo del JSON antiguo (puntero) | Destino en el paquete/documento nuevo | Clasificación | Nota |
|---|---|---|---|
| `/config/settings/primaryColor`, `/secondaryColor` | `theme.json` → `palettes[0].tokens.accent` / `.ink` | pérdida de presentación aceptable | RGBA → hex; alfa se descarta (P3) |
| `/config/settings/music` | `footer.music` (`audio`, rol `backgroundMusic`) | sin pérdida | URL → `assetId` (ADR-021), el fichero se re-sube a S3 |
| `/config/settings/child_friendly`, `/young_friendly` | **Postgres** `invitation.childrenAllowed` / `.youngAllowed` | sin pérdida | Dato de negocio, nunca en el documento (ADR-001, `BusinessField`) |
| `/config/settings/name` | **Postgres** `invitation` | sin pérdida | idem |
| `/config/sectionCover/visibility` | `structure.sections[key=cover].visible` | sin pérdida | ⚠ ver §4.3 (H-24) |
| `/config/sectionCover/title/content` | `cover.title` (`text`, `coverTitle`) | sin pérdida | |
| `/config/sectionCover/subtitle/content` | `cover.subtitle` (`text`, `coverSubtitle`) | sin pérdida | |
| `/config/sectionCover/subtitle/icon` | — | pérdida de presentación aceptable | `fa-solid fa-church` → `variant` de la sección `cover` |
| `/config/sectionCover/date/day`, `/date/hours` | `cover.date` (`date`, `coverDate`) — normalmente `source:business` | sin pérdida | Dos campos legados → un `IsoDate`; H-27 (fechas inconsistentes) se cierra al haber un solo origen |
| `/config/sectionCover/button/content` | `cover.buttonLabel` (`text`) | sin pérdida | |
| `/config/sectionCover/button/url` | — | descartado con motivo | Siempre `"#"` en las 9 plantillas **[V]**; el botón ancla al RSVP, no hay `coverButtonHref` en el catálogo cerrado (`01 §3.3`) |
| `/config/sectionCover/coverImage/content` | `cover.image` (`image`, `coverImage`) | sin pérdida | URL → `assetId` |
| `/config/sectionCouple/heading/content` | `couple.heading` (`celebrantsHeading`) | sin pérdida | |
| `/config/sectionCouple/datetime/content` | `couple.date` (`celebrantsDate`) | sin pérdida | |
| `/config/sectionCouple/namePersonEvent/content` *(no-boda)* | `couple.honoree` (`person`, `honoree`) | sin pérdida | |
| `/config/sectionCouple/photoPersonEvent/content` *(no-boda)* | `couple.honoreePhoto` (`image`, `honoreePhoto`) | sin pérdida | |
| `/config/sectionCouple/message/content` *(no-boda)* | `couple.honoreeMessage` (`richText`) | sin pérdida | |
| `/config/sectionCouple/groomName/content`, `/brideName/content` *(boda)* | `couple.groom` / `couple.bride` (`person`, `celebrantA`/`celebrantB`) | sin pérdida | Mapa **distinto** al de no-boda; ver §3 paso 4 |
| `/config/sectionCouple/groomPhoto/content`, `/bridePhoto/content` *(boda)* | `couple.groomPhoto` / `couple.bridePhoto` | sin pérdida | |
| `/config/sectionCouple/groomText/content`, `/brideText/content` *(boda)* | `couple.groomText` / `couple.brideText` (`richText`) | sin pérdida | |
| `/config/sectionCouple/subheading/content`, `/icon/content` *(boda)* | — | pérdida de presentación aceptable | Decorativo; se absorbe en el `variant` `side-by-side`/`stacked` |
| `/config/sectionCouple/imageTopBg/content`, `/imageBottomBg/content` | `assets/` del paquete | pérdida de presentación aceptable | Fondo decorativo de la plantilla, nunca del cliente |
| `/config/section*/backgroundColor/content` | `theme.json` `tokens.surface`/`bg` | pérdida de presentación aceptable | Array RGBA de 4 elementos (H-31) |
| `/config/sectionFamily/intro/content` **o** `/intro/*/content` | `family.intro` (`listText`, `familyIntro`) | sin pérdida | ⚠ **La forma difiere por plantilla** (objeto en unas, array `{id,content}` en otras) **[V]**; el mapa es por cohorte |
| `/config/sectionFamily/items/*/title/content` | `family.groupTitle` (`familyGroupTitle`) | sin pérdida | Es el título que hoy se usa para **emparejar por texto** (H-01); en el nuevo esquema es un valor más, no una clave |
| `/config/sectionFamily/items/*/items/*/text/content` | `family.parentA1` … `family.godparents[*].person` según el rol **decidido a mano** | sin pérdida | El emparejamiento por texto/posición (H-01/H-02) se resuelve **una sola vez**, por inspección humana, al construir el paquete |
| `/config/sectionFamily/items/*/items/*/label/content` | `family.godparents[*].label` (`personLabel`) | sin pérdida | |
| `/config/sectionFamily/items/*/items/*/image/content` | `family.godparents[*].photo` (`personPhoto`) | sin pérdida | |
| `/config/sectionEvent/title/content` | `event.title` (`sectionTitle`) | sin pérdida | |
| `/config/sectionEvent/locationText/content` / `/url` | `event.cards[*].place.name` / `.mapHref` (`location`) | sin pérdida | |
| `/config/sectionEvent/singleplace` | `manifest.capabilities += "singlePlace"` | pérdida de presentación aceptable | Deja de ser un booleano del documento: es una capacidad de la plantilla (`manifest.ts:53`) |
| `/config/sectionEvent/itemsSinglePlace/*/**` | `defaults.json` de la variante `singlePlace` | sin pérdida | **Solo alcanzable leyendo F1** (§2, H-12). Desde F2/F3 es `null` |
| `/config/sectionEvent/items/*/title/content` | `event.cards[*].title` (`eventTitle`) | sin pérdida | |
| `/config/sectionEvent/items/*/date/timeStart/content`, `/timeEnd/content` | `event.cards[*].when` (`dateTimeRange`, `eventWhen`) → `start`/`end` | sin pérdida | Dos campos de texto libre (`"4:30 PM"`) → un rango tipado; **exige parseo con locale es-MX y validación I-01** |
| `/config/sectionEvent/items/*/time/dateDay/content`, `/dateMonthYear/content` | `event.cards[*].when.start` (parte de fecha) | sin pérdida | `"Miércoles 31"` + `"Diciembre"` → fecha ISO; ambigüedad de año, ver §4.3 |
| `/config/sectionEvent/items/*/locationText/content` / `/url` | `event.cards[*].place` (`location`) | sin pérdida | |
| `/config/sectionEvent/items/*/date/icon/content`, `/time/icon/content` | — | pérdida de presentación aceptable | Literales FontAwesome (H-34) |
| `/config/sectionGallery/title/content`, `/intro/content` | `gallery.title`, `gallery.intro` | sin pérdida | |
| `/config/sectionGallery/hashtags/*/content` / `/url` | `gallery.hashtag` (`text`) / `gallery.hashtagLink` | sin pérdida | Hoy es un **array de 2** (iconos facebook/instagram) y el catálogo declara un solo `hashtag`. Verificado **[V]**: en las 9 plantillas las dos entradas llevan **el mismo `content`** (`#rebecaYsantiago`, `#antonioYcamila`, `#Sarah&Alan`, o `null`), difieren solo en el `icon` → hoy no bloquea. La regla de §4.3 se mantiene por si una invitación real los tiene distintos |
| `/config/sectionGallery/items/*/content` | `gallery.photos[*].image` | sin pérdida | Grupo `galleryPhoto`; **ids nuevos** (H-25: hoy la galería reescribe ids) |
| `/config/sectionGifttable/items/*/type` | `gifts.options[*].kind` (`choice`, `giftOptionKind`) | sin pérdida | `cash`/`digital`/`store` → `options[]` del `ChoiceSpec`; `null` en 7 de 9 ficheros **[V]** → se resuelve con la heurística textual actual (`inferTemplateType`, `DefaultConfigGeneratorService.kt:1000-1023`) **y se registra la decisión** |
| `/config/sectionGifttable/items/*/title/content` | `gifts.options[*].title` | sin pérdida | |
| `/config/sectionGifttable/items/*/body/*/content` | `gifts.options[*].detail` (`listText`, ≤12 ítems, ≤200 chars) | sin pérdida **o BLOQUEA** | Máximo verificado en el repo: **9 elementos** (plantillas 5 y 6, datos bancarios) **[V]** — cabe en `maxItems: 12`. Si una invitación real supera 12 elementos o 200 chars por elemento, **BLOQUEA** hasta ampliar `ListTextSpec` |
| `/config/sectionGifttable/items/*/body/*/url` | `gifts.options[*].link` (`link`) | sin pérdida | Un `body` puede traer **varias** urls (`msj2`… en la 5) y el catálogo declara **un** `link` por opción **[V]** → si hay >1 url distinta, **BLOQUEA** |
| `/config/sectionSuggestions|Amenities/items/*/title/content` | `suggestions|amenities.items[*].name` | sin pérdida | |
| `/config/sectionSuggestions|Amenities/items/*/body/*/content` | `.items[*].detail` (`listText`) | sin pérdida | |
| `/config/sectionSuggestions|Amenities/items/*/linkHref`, `/body/*/url` | `.items[*].link` | sin pérdida | Misma regla de "una sola url" que la mesa de regalos |
| `/config/sectionSuggestions/items/*/type` | `.items[*].name` (prefijo) | pérdida de presentación aceptable | `"Hotel"`, `"Sitio de Taxis"`… rotulan la tarjeta; se concatenan al nombre. **Este campo se pierde hoy al deserializar** en `xv_premium` (H-12 caso 2) **[V]** |
| `/config/sectionStory/items/*/title|date|body|image/content` | `story.milestones[*].title|date|body|image` | sin pérdida | `story[].image` **solo existe en F1** (H-12 caso 4) |
| `/config/sectionDresscode/items/*/title/content` | `dressCode.rules[*].title` | sin pérdida | |
| `/config/sectionDresscode/items/*/body/content` **o** `/body/*/content` | `dressCode.rules[*].detail` (`text`) | sin pérdida **o BLOQUEA** | Forma heterogénea **[V]**; si `body` es un array de >1 elemento con contenido, `detail` (texto simple) no los admite → BLOQUEA (relacionado con H-51, "dress code solo primera fila") |
| `/config/sectionDresscode/items/*/bullet/content` | — | pérdida de contenido — **BLOQUEA** | 18 apariciones **[V]**; no hay destino en el catálogo. Decidir por ADR: concatenar a `detail` o ampliar el spec |
| `/config/sectionDresscode/items/*/body/*/url` | — | descartado con motivo | `dressCodeDetail` es `text`, no admite enlace (`01 §3.2`) |
| `/config/sectionStarted/title/content` | `rsvp.title` | sin pérdida | |
| `/config/sectionStarted/limit_confirm/content` | `rsvp.deadline` (`date`, `rsvpDeadline`) | sin pérdida | Texto libre `"Fecha límite … 26 de Julio, 2023."` → `IsoDate`; **si no parsea, BLOQUEA** y va a cola |
| `/config/sectionStarted/note/content` | `rsvp.note` (`text`, `rsvpNote`) | sin pérdida | |
| `/config/sectionStarted/background/content` | `rsvp.background` (`image`, `rsvpBackground`) | sin pérdida | |
| `/config/sectionFooter/smallText/content` | `footer.note` (`text`, `footerNote`) | sin pérdida | |
| `/config/sectionFooter/logoUrl`, `/linkHref` | — | descartado con motivo | Logo y enlace **del proveedor** ("Invitaciones Digitales Agape"), no del cliente; pasa al chrome del render público (`03 §7`), no al documento |
| `/config/id` | — | descartado con motivo | `_id` de Mongo; es el vector de H-13 |
| `/config/invitationId`, `/templateId`, `/eventId`, `/planId` | clave de correlación del informe | sin pérdida | No entran al documento (ADR-001) |
| `/config/section*/**/md|sm|xs/**` | — | pérdida de presentación aceptable | ~95 % de las hojas **[V]**. `fontSize`, `lineHeight`, `margin`, `color`, `background`, `width`, `height`, `align*`, `imageBack*` |
| `/config/section*/**/fontFamily` | `theme.json` `fontSets[].heading|body.family` | pérdida de presentación aceptable | `"Great Vibes"`, `"Poppins"`, `"Work Sans"` **[V]** |
| `/config/section*/**/icon` | `variant` de la sección | pérdida de presentación aceptable | 14 literales FontAwesome (H-34) |
| `/config/sectionFamily/items/*/items/*/showImage` | `variant` `cards`/`list` de `family` | pérdida de presentación aceptable | |

Del lado del **contenido** (`default_content_<slug>.json`), el mapeo es análogo y más corto; las filas que exigen atención:

| Campo | Destino | Clasificación | Nota |
|---|---|---|---|
| `texts.*` (16 claves en bautizo **[V]**) | títulos de sección y `rsvp.*`/`gallery.*` | sin pérdida | Es el "contrato implícito" de claves reconocidas (§6.2 del informe) |
| `phrases.celebrated[]`, `phrases.intro[]` | `couple.honoreeMessage`, `family.intro` | sin pérdida **o BLOQUEA** | Son **arrays**; hoy el generador colapsa a un elemento (H-33). Si hay >1 con contenido distinto → BLOQUEA |
| `images.people[]`, `images.gallery[]`, `images.parents.{mother,father}`, `images.godparents[]` | `image` de los bloques correspondientes | sin pérdida | URLs externas → `assetId`; §7.3 |
| `images.backgrounds.{topBg,bottomBg,rsvpBg}` | `assets/` del paquete y `rsvp.background` | mixta | `rsvpBg` es contenido de sección, los otros dos son decoración |
| `itinerary[].{eventName,eventLocation,eventMapsUrl,startTime,endTime,date}` | `event.cards[*]` | sin pérdida | |
| `itinerary[].icon` | `variant` | pérdida de presentación aceptable | |
| `itinerary[].locationButton`, `.locationDatetime` | `event.cards[*].note` | sin pérdida | **Solo existen en los `payload-template-*.json`** y hoy se descartan al deserializar (H-49/H-12 caso 3) **[V]** |
| `giftRegistry[].{type,name,photo,url,message[]}` | `gifts.options[*]` | sin pérdida | `message[]` de 4 elementos en bautizo **[V]** → `listText` |
| `giftRegistry[].icon` | — | pérdida de presentación aceptable | |
| `recommendations[]`, `amenities[]` `{type,name,url,image}` | `suggestions.items[*]`, `amenities.items[*]` | sin pérdida | |
| `music.{type,enabled,url}` | `footer.music` + `structure.footer.visible` | sin pérdida | `type:"custom"` no tiene destino → descartado con motivo |
| `hashtags[].{content,url}` | `gallery.hashtag`, `gallery.hashtagLink` | sin pérdida | |
| `dressCode.{women,men}.{title,description,image}` | `dressCode.rules[*]` | sin pérdida | Objeto de 2 claves fijas → grupo de 2 ítems |
| `rsvp.{message,note}` | `rsvp.deadline` (parseado) + `rsvp.note` | sin pérdida | |
| `footer.{logoUrl,linkHref,text}` | `footer.note` + chrome | mixta | Igual que el visual |
| `date`, `celebrantName`, `eventTypeId`, `planId` | **Postgres** | sin pérdida | Dato de negocio |
| `_comment` | — | descartado con motivo | Metadato del fichero |
| `story[].image` | `story.milestones[*].image` | sin pérdida | **Solo en F1** (H-12 caso 4) |

### 4.3 Las cuatro decisiones de producto que la tabla destapa

No son técnicas y **no las toma un sub-agente**: van a `preguntas-abiertas.md` y se resuelven antes de fase 4.

1. **`visibility: false` de `boda_basico`** (H-24): 5 secciones marcadas ocultas por la plantilla y pisadas a `true` por `mergeConfiguration` **[V]**. ¿El paquete nuevo respeta el `false` del JSON (fiel a la intención de la plantilla) o el `true` del render actual (fiel a lo que el cliente ha estado viendo)? **Supuesto conservador tomado: respetar lo que el cliente vio** (`true`), porque migrar no es el momento de cambiar el producto.
2. **Sección de mesa de regalos vacía y visible** (H-06). Migrar tal cual la deja visible y vacía. **Supuesto: se migra `visible: true` y `report.stillDefault` lo señala en el editor**, sin ocultarla automáticamente.
3. **Año ausente en las fechas legadas** (`"Miércoles 31, Diciembre"`). **Supuesto: el año se toma de `invitation.date` de Postgres**; si no hay `invitation.date`, la invitación va a cola de revisión.
4. **`bullet`, segundo hashtag, `body` con varias urls** — los tres `BLOQUEA` de §4.2. **Supuesto: BLOQUEAN el registro del paquete** hasta ADR; nunca se descartan en silencio (P1).

## 5. Migración de invitaciones: algoritmo y firmas

### 5.1 Lenguaje: TypeScript, reutilizando el mismo Zod y el mismo `compose` (ADR-1R-C-03)

**Recomendación mantenida y ahora justificada.** La herramienta se escribe en TypeScript, en `frontend/packages/migration-legacy/`, y depende de `@invitaciones/schema` (el mismo paquete que exporta `document.ts`, `blocks.ts`, `invariants.ts` y `compose`).

Argumentos a favor **[V]** salvo donde se indique:
- El `after` que hay que verificar es la salida de `compose()`. `compose()` se implementa **dos veces** (TS y Kotlin) y su equivalencia se prueba con golden files (`06 §3`). Si el extractor corre en TS, la migración usa exactamente el mismo `compose` que el editor y el render — cero riesgo de que la verificación pase contra una implementación y el producto sirva la otra.
- La validación del documento producido (`validateDocument`, `validateValueAgainstSpec`, `invariants.ts`) ya existe en TS; en Kotlin sería la segunda implementación, cuya equivalencia es precisamente lo que se está probando. Verificar con la implementación bajo prueba es circular.
- El extractor es un proceso **fuera de línea, de una sola pasada**, sin requisitos de latencia ni de transacción con Spring: la única escritura transaccional (§7) es un `INSERT`+`UPDATE` de 2 sentencias que cualquier cliente `pg` ejecuta.
- Node 22.22 y pnpm 10.33 están disponibles y verificados en este entorno (`contratos.md` §7) **[V]**; el prototipo de §4.1 corrió en él.

Argumento en contra, honesto: la lectura de `invitation_configs` es MongoDB y la escritura es Postgres, y el backend Spring ya tiene ambos drivers configurados. En TS hay que añadir `mongodb` y `pg` como dependencias del paquete de migración. **Es un coste real pero menor** (dos dependencias en un paquete que se borra al terminar la migración) frente al riesgo de verificar con el motor equivocado.

**Contra-condición explícita:** si en fase 5 se decide que la migración debe correr *dentro* del backend (por acceso a red o credenciales), entonces `compose()` de Kotlin **debe** haber pasado los golden files compartidos de `06 §3` antes de que se escriba una sola línea del extractor. Sin esa condición, la recomendación de TS es firme.

### 5.2 Firmas

```typescript
// frontend/packages/migration-legacy/src/index.ts
import type { InvitationDocument, TemplateManifest, ThemeSpec, DefaultsFile } from "@invitaciones/schema";

/** Puntero RFC 6901 dentro del documento legado. Clave de correlación (ADR-1R-C-02). */
export type LegacyPointer = string;

export type LossClass =
  | "no-loss" | "presentation-loss-ok" | "content-loss-blocking" | "discarded-with-reason";

export type FieldRule = {
  pointer: string;                    // patrón con /* para índices
  target: string | null;              // blockId destino, "business:<campo>", "theme:<token>", o null
  loss: LossClass;
  reason?: string;                    // obligatorio si loss ≠ "no-loss"
};

/** Mapa por cohorte (boda / no-boda / evento). Un fichero JSON por plantilla, revisado a mano. */
export type FieldMap = { templateId: number; slug: string; rules: FieldRule[] };

/** 1. Golden `before`: el documento YA GUARDADO (F3), nunca una regeneración (ADR-022). */
export function extractGolden(mongo: Db, invitationId: number): Promise<LegacyDoc | null>;

/** 2. Cobertura: ninguna hoja del legado queda sin clasificar (P1). Falla el proceso si `unmapped` no está vacío. */
export function checkCoverage(legacy: unknown, map: FieldMap): {
  mapped: number; presentation: number; discarded: number; unmapped: LegacyPointer[];
};

/** 3. Extracción de las 4 capas + procedencia por bloque. */
export type Provenance1R = "user" | "demo-candidate" | "business" | "empty";
export type ExtractedDocument = {
  invitationId: number;
  document: InvitationDocument;                        // valida contra document.ts + validateDocument()
  provenance: Record<string, Provenance1R>;            // por blockId
  reviewQueue: ReviewItem[];                           // §5.3
  blocking: BlockingItem[];                            // §4.2 clase "content-loss-blocking"
  assetsToCopy: { legacyUrl: string; blockId: string }[];  // §7.3
  legacyTrace: Record<string, { pointer: LegacyPointer; legacyId: string | null }>;
};
export function extractDocument(
  golden: LegacyDoc, map: FieldMap, pkg: { manifest: TemplateManifest; theme: ThemeSpec; defaults: DefaultsFile },
  demoBaseline: DemoBaseline,   // §5.3
  business: BusinessSnapshot,
): ExtractedDocument;

/** 4. Verificación por texto e imagen VISIBLES (§6). */
export function compareRendered(before: LegacyDoc, after: ComposedDocument): RegressionReport;

/** 5. Escritura transaccional + corte (§7). Idempotente por invitationId. */
export function cutOver(pg: Client, ex: ExtractedDocument, opts: { dryRun: boolean }): Promise<CutOverResult>;
```

### 5.3 Procedencia: por qué el umbral de 12 caracteres se retira (objeción M-04)

La versión previa clasificaba: *"coincide con el default y tiene ≥ 12 caracteres → candidato a demo, va a cola; difiere, o coincide pero tiene < 12 → dato real del cliente"*.

Medición ejecutada en esta ronda sobre los 9 `default_content_*.json` **[V]**:

```
default_content_bautizo.json:      strings=103  <12 chars=24
default_content_boda_basico.json:  strings= 72  <12 chars=15
default_content_boda_premium.json: strings= 55  <12 chars=15
default_content_cumpleanos.json:   strings=119  <12 chars=34
default_content_xv_premium.json:   strings=115  <12 chars=29
```

Y los valores concretos que el umbral clasificaría como "dato real del cliente":

```
Georgina · Mis Padres · Mi bautizo · Marck Luga · Ceremonia · Fiesta · Damas · Caballeros
Madre · Madrina · Hotel · Itinerario · Galería · Dress Code · Amenidades · 4:30 PM · #bautizo
```

`"Georgina"` (8 caracteres) es **el nombre de la niña ficticia del bautizo de demostración**. El umbral la marca `provenance: user` y la publica sin pasar por revisión: es exactamente H-03, reintroducido por la propia herramienta que debía cerrarlo. La dirección del error está invertida — el umbral protege contra falsos positivos (texto corto casual coincidente) a costa de garantizar falsos negativos en los campos más sensibles (nombres propios).

**Regla nueva (ADR-1R-C-04), sin umbral de longitud:**

```
demoBaseline = conjunto de valores (string normalizado, §6.2) presentes en el
               documento `default_content_configs` REAL de Mongo para el (eventTypeId, planId)
               de esa invitación, UNIÓN el `default_visual_configs` de su templateId,
               UNIÓN defaults.json del paquete nuevo.
para cada blockId con valor v:
  si v está vacío                          -> provenance = "empty"
  si el bloque es source:business          -> provenance = "business"   (no se copia al documento)
  si norm(v) ∈ demoBaseline                -> provenance = "demo-candidate"  -> COLA DE REVISIÓN
  si no                                    -> provenance = "user"
```

Cambios respecto a la regla previa, y por qué:
- **Se elimina el umbral de longitud.** Toda coincidencia con el baseline va a cola, sea `"Georgina"` o un párrafo. Es más lento y es la opción conservadora exigida por el brief.
- **El baseline es el documento de Mongo, no el fichero del repositorio.** Verificado **[V]** que la siembra de contenido es *skip-if-exists* (`MongoDataInitializer.kt:118-123`: si ya hay documento para ese `(eventTypeId, planId)` solo registra `"…ya existe. Omitiendo."`), a diferencia de la visual, que sí sobrescribe (`:83-90`). Es decir: **el `default_content_*.json` del repositorio puede llevar años sin coincidir con lo que producción sirve**. Comparar contra el fichero produciría falsos "es dato del cliente" masivos.
- **El baseline incluye el `(eventTypeId, planId)`, no el `templateId`.** Ver §5.4.
- **Ruido aceptado y medido:** hay textos que un cliente legítimamente escribe igual que el demo (`"Ceremonia"`, `"Damas"`, `"Fiesta"`). Van a cola y el dueño del producto los aprueba en bloque. La cola se ordena por `(plantilla, blockId)` precisamente para poder aprobar `"Ceremonia"` una vez para todas las invitaciones (`reviewQueue.groupKey`).

### 5.4 El `templateId` **no** determina el contenido por defecto (objeción M-03)

La versión previa decía que `extractDocument` compara contra *"el `default_content_<slug>.json` de la plantilla que esa invitación usa (resuelta por su `templateId`)"*. Esa resolución **no existe** en el sistema real. Verificado **[V]**:

- Ningún `default_content_*.json` declara `templateId` (`jq` arriba). Por tanto `defaultContentConfigRepository.findByTemplateId(templateId)` (`DefaultConfigGeneratorService.kt:70`) **siempre falla**.
- El fallback es `findFirstByEventTypeIdAndPlanId(eventTypeId, planId)` (`:72`), **sin `ORDER BY`** (`DefaultContentConfigRepository.kt:31-35`, cuyo propio comentario dice "retorna el primero sin explotar si hay múltiples"). Es H-21.
- Hay colisiones reales de clave: `(1,2)` la comparten `default_content_boda_premium.json` y `default_content_boda_premium_2.json`; `(7,2)` la comparten `default_content_evento.json` y `payload-template-graduacion.json` **[V]**.

**Regla (ADR-1R-C-05):** el baseline de demo de una invitación se construye con **todos** los documentos de `default_content_configs` que casen su `(eventTypeId, planId)`, no con uno. Si hay más de uno, la invitación se marca `demoBaselineAmbiguous: true` en el informe; sigue migrando (el baseline es una unión, y una unión más grande solo manda más valores a cola, nunca menos), pero el informe lo dice. **Cuál ganó realmente en producción es [ND]** desde este repositorio.

### 5.5 Invitaciones sin `invitation_configs`

Si no hay documento en `invitation_configs` (generación perezosa nunca disparada, H-10), esa invitación no tiene golden `before`. Se migra igual: documento nuevo con `content: {}` desde los defaults del paquete, marcada `noPriorRender: true`, sin comparación de regresión posible. Es la cohorte de **menor riesgo** y la primera del orden de corte (§7.4).

## 6. Verificación automática: texto e imagen **visibles**

### 6.1 Qué se compara (objeción M-05)

La versión previa comparaba el `before` contra los `ResolvedValue` de `after` con `provenance ∈ {user, business}`. Eso deja fuera precisamente el caso que más daña: un texto que el cliente veía porque venía del demo (H-03 + H-24, secciones forzadas a `visible: true`) y que desaparece en el `after` porque el paquete nuevo trae otro default. `passed` saldría `true` y el cliente vería una invitación distinta.

**Se compara el conjunto completo de texto visible del render, sin filtrar por procedencia**, y se clasifica la diferencia:

```
visibleBefore = extractVisibleText(beforeLegacyDoc)      // §6.2
visibleAfter  = extractVisibleText(compose(pkg, doc, business, locale).composed)
missing = visibleBefore \ visibleAfter                    // desapareció algo que se veía
extra   = visibleAfter  \ visibleBefore                   // apareció algo que no se veía
```
y cada elemento de `missing` se clasifica con la procedencia del bloque de origen:
- procedente de `user` o `business` → **`missingUserText`: BLOQUEA el corte de esa invitación.**
- procedente de un default de la plantilla vieja → **`missingDemoText`: NO bloquea**, se registra. Es contenido de demostración que el rediseño elimina a propósito (es el arreglo de H-03), pero el informe lo cuenta por invitación para que el dueño vea el volumen antes de cortar.
- imagen (`missingImages`) → **BLOQUEA siempre**, sea cual sea su procedencia: una foto que desaparece es visible al instante y no distingue demo de real sin mirarla.

`extra` nunca bloquea, pero se lista: `extraText > 0` con `provenance: default` indica que el paquete nuevo aporta demo donde antes no había, y eso vuelve a ser H-03 en la dirección contraria.

### 6.2 Algoritmo de extracción y normalización

**Extracción del `before` (legado)** — se recorre el documento con el `FieldMap` de esa plantilla y se toma el valor de toda hoja cuya regla tenga `loss ∈ {no-loss, content-loss-blocking}` y cuyo valor sea un `string` no vacío, **si y solo si** la sección que la contiene tiene `visibility: true` en el `before`. Las hojas `presentation-loss-ok` y `discarded-with-reason` **no** entran (por definición no son texto visible del cliente). Las URLs de imagen se recogen aparte, en `visibleImagesBefore`.

**Extracción del `after`** — se recorre `ComposedDocument.sections` con `visible === true` y, por cada `ComposedBlock`/`ComposedItem`, se toma según el `kind` de `ResolvedValue` (`esquema/composed.ts:30-44`):

| `kind` | Texto que aporta | Imagen que aporta |
|---|---|---|
| `text` | `value` | — |
| `richText` | concatenación de `doc.content[].content[].text` en orden | — |
| `listText` | cada `items[i]` como una entrada | — |
| `image` | `alt` | `url` |
| `audio` | — | `url` (a `visibleAudio`, comparado aparte) |
| `date`/`time`/`dateTimeRange` | **`formatted`**, nunca el valor ISO | — |
| `link` | `label` (si existe) | — (el `href` va a `visibleLinks`) |
| `location` | `name`, `address` | — (`mapHref` → `visibleLinks`) |
| `choice` | `label` | — |
| `boolean` | — | — (no aporta texto propio; lo aporta la sección) |
| `person` | `name`, `note` | — |
| — | `ComposedSection.title` | — |

**Normalización `norm(s)`**, aplicada a los dos lados antes de comparar, en este orden exacto:

1. Unicode `NFKC`.
2. Colapsar todo espacio en blanco (incluido ` `) a un solo `U+0020`; recortar extremos.
3. Minúsculas con `toLocaleLowerCase("es-MX")`.
4. Quitar diacríticos: `normalize("NFD").replace(/\p{Diacritic}/gu, "")` — necesario porque el legado mezcla `"Galería"` y `"Galeria"` **[V]**.
5. Quitar la puntuación de cierre y los separadores decorativos: `[.,;:!¡?¿·—–-]+$` y `^[·—–-]+`.
6. Descartar la cadena si tras lo anterior queda vacía o mide < 2 caracteres (evita comparar `"#"`, `"-"`).

**Normalización de URL de imagen `normUrl(u)`**: minúsculas en esquema y host, se descartan `query` y `fragment`, se conserva el `path` completo, y se compara además el **basename** por separado. Motivo: la migración re-sube los assets a S3 con `assetId` nuevo (ADR-021), así que la URL absoluta **cambia siempre**. La comparación de imágenes es por **`sha256` del byte-stream** cuando el asset se pudo descargar, y por basename cuando no (§7.3). Una imagen cuenta como presente si coincide el hash **o** el basename.

### 6.3 Umbral

**Igualdad exacta de conjuntos tras normalizar, sin tolerancia difusa.** No hay porcentaje de similitud: `missingUserText` debe estar **vacío**, `missingImages` debe estar **vacío**. Motivo: una comparación difusa (Levenshtein, Jaccard) obliga a fijar un umbral arbitrario y produce exactamente el tipo de fallo silencioso que este rediseño elimina; y el volumen (una invitación, decenas de cadenas) no justifica la complejidad. Cuando la normalización no basta —el caso conocido son las fechas, que el legado guarda como texto libre (`"Miércoles 31, Diciembre"`) y el nuevo formatea desde `IsoDate`— la comparación se hace sobre un **conjunto de equivalencia declarado por regla**, no sobre similitud: la regla `dateEquivalence(legacyText, isoDate, formatId, locale)` genera todas las representaciones que `formatDate` puede producir para ese `IsoDate` y considera presente la cadena si alguna coincide tras `norm`. Si no coincide ninguna, es un `missingUserText` real y bloquea.

### 6.4 Informe de diferencias

```typescript
export type RegressionReport = {
  invitationId: number;
  templateIdLegacy: number; slugNew: string; versionNew: string;
  noPriorRender: boolean;
  demoBaselineAmbiguous: boolean;
  missingUserText: { text: string; blockId: string; pointer: LegacyPointer }[];   // BLOQUEA
  missingDemoText: { text: string; pointer: LegacyPointer }[];                    // informativo
  missingImages:   { url: string; sha256?: string; pointer: LegacyPointer }[];    // BLOQUEA
  extraText:       { text: string; blockId: string; provenance: string }[];       // informativo
  blocking:        BlockingItem[];                                               // §4.2, BLOQUEA
  reviewPending:   number;                                                        // §5.3, BLOQUEA si > 0
  atticBlocks:     string[];                                                      // ADR-006
  passed: boolean;   // missingUserText=[] && missingImages=[] && blocking=[] && reviewPending===0
};
```
El informe se escribe **siempre**, pase o falle, en `tpl_migration_run` (§7.2) y como fichero JSON por invitación. Una invitación con `passed === false` bloquea **su propio** corte y ninguno más.

## 7. Corte, escritura y reversibilidad (ADR-023 + ADR-1R-C-06)

### 7.1 La transacción de corte, corregida

La versión previa proponía un `INSERT` plano. Eso falla en el segundo intento, porque `tpl_document` tiene `UNIQUE (invitation_id)` (`02 §2.4`) y porque tras un rollback (§7.5) la fila sigue ahí. Verificado por lectura del DDL **[V]**. Forma correcta, idempotente:

```sql
BEGIN;
-- 1. Documento: alta o reemplazo del intento anterior. Nunca borra: la revisión sube.
INSERT INTO tpl_document (invitation_id, template_version_id, doc, revision, public_token)
VALUES (:invitationId, :templateVersionId, :doc::jsonb, 0, :publicToken)
ON CONFLICT (invitation_id) DO UPDATE
   SET template_version_id = EXCLUDED.template_version_id,
       doc                 = EXCLUDED.doc,
       revision            = tpl_document.revision + 1,
       updated_at          = now();          -- public_token NO se toca: es estable de por vida (02 §2.4)
-- 2. Snapshot del resultado, en la MISMA transacción (02 §2.5) — el estado previo ya tiene el suyo.
INSERT INTO tpl_document_snapshot (document_id, revision, doc, client_batch_id)
SELECT id, revision, doc, 'migration:' || :runId FROM tpl_document WHERE invitation_id = :invitationId;
-- 3. Bandera de corte.
UPDATE invitation SET uses_templates2 = true WHERE id = :invitationId;
-- 4. Auditoría.
INSERT INTO tpl_migration_run (...) VALUES (...);
COMMIT;
```

Precondiciones, todas comprobadas dentro de la misma transacción: `RegressionReport.passed = true`, `reviewQueue` de esa invitación vacía, y `blocking` vacío.

`public_token` **no se regenera** en el `DO UPDATE`: si alguien ya compartió el enlace, re-migrar no debe romperlo (`02 §2.4`).

El **enrutamiento** por `uses_templates2` (qué módulo atiende cada petición) es diseño de fase 2 y sigue fuera de este documento; lo único que este documento fija es que la bandera es la fuente de esa decisión y que el módulo antiguo no la consulta.

### 7.2 Qué se guarda para poder volver atrás

| Artefacto | Dónde | Retención | Para qué |
|---|---|---|---|
| `invitation_configs` (Mongo) | intacto, sin tocar | **≥ 180 días** tras el corte de la última invitación, y en todo caso hasta que el paso 4 de §9 se ejecute con aprobación explícita del dueño | Es el `before` original. Sin él no hay rollback ni re-verificación posible |
| `default_visual_configs`, `default_content_configs` (Mongo) | intactos | igual | Baseline de demo (§5.3). Sin él la clasificación de procedencia no es reproducible |
| `RegressionReport` por invitación | `tpl_migration_run.report` (JSONB) + fichero JSON | permanente | Auditoría; es la única prueba de qué se comparó |
| `ExtractedDocument.legacyTrace` | `tpl_migration_run.trace` (JSONB) | permanente | Puntero legado ↔ `blockId`, para explicar cualquier reclamación posterior |
| `doc` migrado | `tpl_document_snapshot` (revisión de la migración) | ADR-011 (200 revisiones / 30 días + lo que respalde un release) | Deshacer una edición posterior sin perder el punto de partida |
| Assets copiados | S3, prefijo nuevo | permanente | Los originales legados **no se borran** (§7.3) |

Tabla de auditoría nueva, propuesta aquí (una sola tabla, fuera del ciclo de vida del producto):

```sql
-- V37 (fase 5, NO fase 2): auditoría de la migración legado→templates2.
CREATE TABLE tpl_migration_run (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              VARCHAR(40) NOT NULL,             -- ULID de la corrida completa
    invitation_id       BIGINT NOT NULL REFERENCES invitation(id),
    legacy_template_id  BIGINT NOT NULL,
    new_version_id      BIGINT NULL REFERENCES tpl_template_version(id),
    outcome             VARCHAR(20) NOT NULL
                          CHECK (outcome IN ('cut_over','blocked','dry_run','rolled_back')),
    report              JSONB NOT NULL,                    -- RegressionReport (§6.4)
    trace               JSONB NOT NULL,                    -- legacyTrace
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tpl_migration_run_invitation ON tpl_migration_run (invitation_id, created_at DESC);
CREATE INDEX ix_tpl_migration_run_outcome ON tpl_migration_run (outcome, created_at DESC);
```
Es append-only: un rollback **inserta** una fila `rolled_back`, no actualiza la anterior.

### 7.3 Assets

Las imágenes legadas son URLs absolutas a S3 y a `invitaciones-digitales.com.mx` **[V]**. El documento nuevo no admite URLs (ADR-021). Por cada URL:

1. Descargar; si falla, `missingImages` con `reason: "unreachable"` → **BLOQUEA** esa invitación.
2. `sha256` del contenido → si ya existe un `tpl_asset` con ese hash y el mismo dueño, se reutiliza (deduplicación).
3. Subir con `S3KeyService` al prefijo de la invitación, insertar `tpl_asset(invitation_id, public_id, sha256, ...)` (`02 §2.3`), escribir el `assetId` en el bloque.
4. **La URL original nunca se borra.** El objeto legado en S3 queda intacto durante toda la ventana de retención de §7.2 — es lo que hace el rollback posible.

### 7.4 Orden de corte

1. Invitaciones **sin** `invitation_configs` (§5.5): sin regresión que verificar.
2. Invitaciones con `passed = true`, `reviewPending = 0` y `demoBaselineAmbiguous = false`.
3. Invitaciones con `demoBaselineAmbiguous = true` (cohorte `(1,2)` y `(7,2)`), tras revisión.
4. El resto, una por una, tras resolver su cola y sus `blocking`.

No hay corte global. Cada paso se ejecuta primero con `dryRun: true` sobre el 100 % de la cohorte y solo se corta cuando el informe agregado está limpio.

### 7.5 Procedimiento de rollback por invitación

Es **una operación de un solo paso, reversible y sin pérdida**, mientras dure la ventana de §7.2:

```sql
BEGIN;
UPDATE invitation SET uses_templates2 = false WHERE id = :invitationId;
INSERT INTO tpl_migration_run (run_id, invitation_id, legacy_template_id, new_version_id,
                               outcome, report, trace)
VALUES (:runId, :invitationId, :legacyTemplateId, :versionId, 'rolled_back', :reason::jsonb, '{}'::jsonb);
COMMIT;
```

Qué pasa después, explícitamente:
- El módulo antiguo vuelve a atender esa invitación leyendo su `invitation_configs`, que **nunca se modificó** — el cliente ve exactamente lo que veía antes del corte.
- La fila `tpl_document` **no se borra**. Se queda con su `revision` y su `public_token`. Motivo: borrarla perdería el trabajo de extracción y, peor, liberaría el `public_token`; si más tarde se re-migra, `ON CONFLICT DO UPDATE` (§7.1) reutiliza la misma fila y el mismo token, y el enlace público que el cliente ya compartió sigue sirviendo.
- **Lo que el cliente editó en el editor nuevo entre el corte y el rollback se pierde de cara al render**, porque el módulo antiguo no lo conoce. Queda en `tpl_document`/`tpl_document_snapshot`, recuperable re-migrando, pero **no** se retro-propaga a `invitation_configs`. Escribir el documento nuevo de vuelta al formato legado exigiría un compositor inverso completo; se descarta por coste y por riesgo (P10 pide convivencia, no bidireccionalidad). **Consecuencia operativa: el rollback es seguro inmediatamente después del corte y cada vez más costoso cuanto más tiempo pase.** Recomendación: ventana de rollback "barato" de **7 días** tras el corte de cada invitación; pasada esa ventana, un rollback exige aviso al cliente. Registrado en `preguntas-abiertas.md`.
- Un `release` publicado desde `templates2` (`tpl_release`, `is_active`) queda huérfano: el enlace público debe volver a servirse por el camino antiguo. **El enrutador de fase 2 debe consultar `uses_templates2` también en la ruta pública**, no solo en las autenticadas. Punto a verificar en fase 2 (§13, objeción M-08).

## 8. Migración de versión de plantilla (nuevo→nuevo)

Sin cambios respecto a la versión previa, reproducido para que este documento sea autosuficiente. Cuando se registra una versión mayor con `MigrationPlan`, los `tpl_document` de la versión anterior **no migran automáticamente**: migran la próxima vez que su dueño entra al editor (`POST .../document:choose-template` con la misma plantilla y versión nueva, `03 §3.1`), con `dryRun` obligatorio primero. Es distinta de la migración legado→nuevo (§5, una sola vez, en bloque, por el equipo). El contenido que el plan no cubre va a `attic` (ADR-006), nunca se borra.

## 9. Plan de retiro del módulo antiguo (documentado, no ejecutado)

1. Todas las invitaciones con `invitation_configs` tienen `uses_templates2 = true` y `passed = true` (o revisión resuelta).
2. Ventana de estabilidad ≥ 30 días sin incidentes contra el render nuevo (criterio de negocio, a fijar con el dueño).
3. Ventana de retención de §7.2 (≥ 180 días) cumplida **y** aprobación explícita del dueño registrada.
4. Borrar código: `modules/user/invitations/**`, `modules/master/templates/**`, `core/data/MongoDataInitializer.kt`.
5. Borrar datos: colecciones `default_visual_configs`, `default_content_configs`, `invitation_configs`; los 23 ficheros de `src/main/resources/data/mongo/*.json` (1,7 MB); los 5 `data*Premium.ts` de la raíz; `scripts/upsert_template_11_12.js` y `apply_template_11_12_local.sh`. Antes de borrar, **confirmar** — H-59 marca parte de esto como basura sin referencia, pero esta ronda ha verificado que `payload-template-2.json` y `payload-template-xv-2.json` **sí** están referenciados (`apply_template_11_12_local.sh:18-19`) **[V]**; no asumir el hallazgo, comprobarlo fichero a fichero.
6. `bash.exe.stackdump` (530 B, volcado de Cygwin dentro del JAR, H-59) se puede borrar hoy, sin esperar a nada.

## 10. Cohortes C y D

### 10.1 Cohorte C (12, 14) y arte apagado (11)

Reconstruibles **desde el repositorio** con un paso extra: el `templateId` no está en el fichero.
- **11**: `default_visual_boda_premium_2.json` + `default_content_boda_premium_2.json` ya declaran/implican el id; basta descomentar mentalmente `MongoDataInitializer.kt:36,50`. **Riesgo [I]:** como no se siembra, lo que producción sirve para el 11 lo escribió `upsert_template_11_12.js` a partir de `payload-template-2.json`, que **no es el mismo fichero**. Antes de construir el paquete del 11 hay que decidir cuál de los dos es la verdad — **[ND]** desde aquí; se resuelve leyendo `default_visual_configs` de producción.
- **12**: `payload-template-xv-2.json`, campo `visualConfig` + `contentConfig`, con `templateId = 12` inyectado (`upsert_template_11_12.js:28-32`).
- **14**: `payload-template-graduacion.json` (`eventId=7`, `planId=2`). No está cableado a ningún script; el literal `templateId == 14L` vive en `DefaultConfigGeneratorService.kt:420` y gobierna si los ítems de galería llevan `label` (`:446-451`) **[V]**. Esa condición se traduce a una **variante de sección** del paquete nuevo, no a un `if`.
- El script `upsert_template_11_12.js` escribe con `updateOne`/`$set` desde `mongosh`, **sin pasar por Jackson**, así que sus documentos **sí conservan `itemsSinglePlace`** (H§6) **[V]**. Es la única vía del sistema que no pierde ese campo — otra razón para leer F1 y no F2 (§2).

### 10.2 Cohorte D (16, 17) y el id 13

- **16, 17**: sin fila, sin JSON, sin payload. Solo `apply_template_11_12_local.sh:50-53` los deshabilita. **[ND]**. El mismo `LegacyExtractor` de §5 funciona sin cambios **si** se puede leer su `invitation_configs` real: el proceso depende de que el documento generado exista en la base de origen, no de que la plantilla esté en este repositorio. Trabajo pendiente, sin fecha, no bloquea.
- **13**: tiene arte sembrado pero **ninguna fila `invitation_template`** y su `event_type` 7 tampoco existe en Flyway **[V]**. Su `eventKind` y `minPlanTier` para el manifiesto nuevo salen de la fila de producción; si en producción tampoco existe, el paquete se registra con `eventKinds: ["generic"]` y se documenta.

## 11. Riesgos incorporados explícitamente

| Riesgo | Origen | Cómo lo ataca este diseño |
|---|---|---|
| Contenido perdido por leer el modelo Kotlin en vez del JSON | **H-12** | §2 regla dura F1/F3; gate de cobertura de §3 paso 2; ADR-1R-C-01 |
| Publicar datos de demo como del cliente | **H-03** | §5.3 sin umbral de longitud, baseline desde Mongo, cola de revisión; `report.stillDefault` bloquea publicar (`03 §6`) |
| Ids duplicados / nulos usados como clave de merge | **H-28** | §3.1 puntero RFC 6901 como clave; ADR-1R-C-02 |
| Dos cohortes bajo el mismo `templateId` | **H-09** | §2 el golden es F3, nunca una regeneración (ADR-022) |
| Contenido por defecto elegido de forma no determinista | **H-21** | §5.4 baseline = unión de todos los candidatos + marca `demoBaselineAmbiguous` |
| Reglas de precedencia del código comentado | **H-54** | El `FieldMap` se deriva de los **datos** (F1) y del código **vivo**, nunca del comentado |
| Secciones ocultas que el merge fuerza a visibles | **H-24** | §4.3 decisión 1, explícita, con supuesto conservador |
| Listas heterogéneas colapsadas a un elemento | **H-33**, H-51 | §4.2 clase `content-loss-blocking` en `phrases[]`, `body[]`, `dressCode.body` |
| Payloads huérfanos tratados como fuente | **H-59/H-60** | §1 y §9 paso 5: verificado cuáles sí tienen referencia |
| `HOTFIX_ADD_TEMPLATES_CAMBIOS.md` como fuente de verdad | **H-47** | No se usa; solo `scripts/*` y los datos |

## 12. Lo que no pude determinar

- **[ND]** Volumen real de invitaciones con `invitation_configs` (sin acceso a producción). El diseño de §7.4 es intencionalmente insensible al volumen.
- **[ND]** Qué documento sirve producción para el `templateId` 11 (repo vs. `payload-template-2.json`, §10.1) y para el 13.
- **[ND]** Si existe un tercer conjunto de datos "de fábrica" distinto de `default_content_configs` — por eso §5.3 toma el baseline de Mongo y no del repositorio.
- **[ND]** El valor de `invitation_template_id_seq` en cada entorno, del que depende si la colisión del 13 (H-09) ya ocurrió.
- **[ND]** Si alguna invitación real usa los `templateId` 12, 14, 16 o 17.

---

## 13. Revisión independiente (1R-calidad)

Ronda 1R, 2026-09-03. Revisor: `1R-calidad` (independiente del autor original). Método: relectura adversarial del documento contra el repositorio, con verificación ejecutada (`jq`, prototipo Node en `scratchpad/1R-calidad/extract-proto.mjs`) de toda afirmación factual sobre los datos.

| id | Sev. | Objeción | Evidencia | Corrección aplicada | Estado |
|---|---|---|---|---|---|
| **M-01** | **Alta** | §1 afirmaba "8 plantillas (4-10 y 13)" y "11, 12, 14, 16, 17 solo en producción, no reproducibles". Ambas falsas: hay **9** pares de JSON en el repo (incluido `templateId=11`), el **13 no tiene fila Flyway** en ninguna migración, y **12 y 14** son reconstruibles desde `payload-template-{xv-2,graduacion}.json` | `jq .templateId` sobre los 9 `default_visual_*.json`; `V1:1133-1136`, `V24:10-13`, `V25:2-8`; `MongoDataInitializer.kt:36,50`; `scripts/upsert_template_11_12.js:19-32`; `scripts/apply_template_11_12_local.sh:18-19` | §1 reescrito con 4 cohortes y tabla de evidencia por id; §10 reescrito | corregido |
| **M-02** | **Alta** | El documento no decía si el extractor lee el JSON crudo o el modelo Kotlin. Leerlo por el modelo pierde 4 rutas de campo, entre ellas 5 tarjetas de contenido visible | H-12; `H-hipotesis.md` §5 (control causal); `EditorModels.kt:234-235`; medición propia: 3 y 2 tarjetas `itemsSinglePlace` | §2 nuevo: tres fuentes F1/F2/F3 y regla dura (ADR-1R-C-01) | corregido |
| **M-03** | **Alta** | §3.2 comparaba contra "el `default_content_<slug>.json` de la plantilla resuelta por `templateId`". Esa resolución no existe: ningún content declara `templateId`, el fallback es `(eventTypeId, planId)` sin orden, y hay colisiones reales | `jq .templateId` → 9× NULL; `DefaultConfigGeneratorService.kt:70,72`; `DefaultContentConfigRepository.kt:31-35`; H-21 | §5.4 nuevo: baseline = unión de candidatos por `(eventTypeId, planId)` + marca de ambigüedad (ADR-1R-C-05) | corregido |
| **M-04** | **Alta** | El umbral "≥ 12 caracteres" clasifica como dato real del cliente los nombres propios de demo. `"Georgina"` (8 chars, la niña ficticia del bautizo) se publicaría sin revisión: es H-03 reintroducido | Medición propia: 24 strings <12 chars en `default_content_bautizo.json`, entre ellos `Georgina`, `Mis Padres`, `Marck Luga`, `Madre`, `Madrina` | §5.3: umbral eliminado; toda coincidencia con el baseline va a cola; baseline desde Mongo, no del repo (ADR-1R-C-04) | corregido |
| **M-05** | **Alta** | `compareRendered` solo miraba `provenance ∈ {user,business}` del `after`, así que un texto de demo que el cliente veía (H-03 + H-24) podía desaparecer con `passed = true` | `esquema/composed.ts:27,51`; H-24 (`mergeConfiguration` fuerza `visibility=true`) | §6 reescrito: conjunto completo de texto visible, clasificado en `missingUserText` (bloquea) / `missingDemoText` (informa) / `missingImages` (siempre bloquea) | corregido |
| **M-06** | **Alta** | No existía tabla de mapeo campo a campo con clasificación de pérdida (entregable exigido), ni algoritmo de extracción de texto visible, ni normalización, ni umbral | brief 1R, bloque 1 | §4 (tabla + generación mecánica + salida real del prototipo) y §6.2/§6.3 nuevos | corregido |
| **M-07** | Media | §2 decía "los 6 slugs restantes (4, 6, 7, 8, 9, 10 y 13 → 7 paquetes)": inconsistencia aritmética, y la lista era incorrecta tras M-01 | texto original `05-migracion.md:22` | §1 punto 1: son **8** paquetes por construir además de `boda-clasica` | corregido |
| **M-08** | Media | La transacción de corte era un `INSERT` plano; falla en el segundo intento por `UNIQUE (invitation_id)` y tras un rollback. No había procedimiento de rollback ni política de retención | `02 §2.4` DDL `uq_tpl_document_invitation` | §7.1 `ON CONFLICT DO UPDATE` idempotente que preserva `public_token`; §7.2 retención; §7.5 rollback paso a paso con sus límites (ADR-1R-C-06) | corregido |
| **M-09** | Media | Riesgo latente de usar el `id` legado como `blockId`/`itemId`: no es único ni siempre existe | Medición propia: 33-134 ids por fichero con 20-103 duplicados y `null` en 3 de 9 | §3.1: la clave es el puntero RFC 6901 (ADR-1R-C-02) | corregido |
| **M-10** | Media | §2 decía que los nombres visibles de las plantillas "no fueron releídos" y hay que sacarlos de Postgres | `V24:12`, `V25:4-7`, `apply_template_11_12_local.sh:31,41` | §3: nombres incorporados; solo 4 y 5 siguen sin nombre (vacío en el dump) | corregido |
| **M-11** | Media | La recomendación de implementar en TS estaba enunciada sin justificación ni contra-condición | brief 1R | §5.1: argumento (evitar verificación circular con el `compose` bajo prueba), coste honesto (drivers mongo/pg en TS) y contra-condición si se decide Kotlin (ADR-1R-C-03) | corregido |
| **M-12** | Media | H-28 y H-03 no estaban incorporados como riesgos con contramedida trazable | brief 1R | §11: tabla de riesgos con H-xx → contramedida | corregido |
| **M-13** | Baja | El plan de retiro proponía borrar los `payload-template-*.json` citando H-59 ("sin ninguna referencia"), que es falso para dos de ellos | `apply_template_11_12_local.sh:18-19` | §9 paso 5: verificar fichero a fichero, no asumir el hallazgo | corregido |

**Contradicciones a dirimir (no resueltas aquí, ver `handoffs/1R-calidad.md`):** CD-1 (ruta pública y `uses_templates2`), CD-2 (`capabilities.singlePlace` sin datos de origen en F2/F3), CD-3 (`tpl_document` creado perezosamente en `02 §2.4` vs. creado por la migración en §7.1).
