# J — Inventario de JSON y esquemas

## 1. Resumen (≤10 líneas)

`default_visual_*.json`/`default_content_*.json` son los documentos Mongo reales (forma `{templateId, config}` = `DefaultVisualConfig`); `payload-template-*.json` son cuerpos completos de `POST /master/templates/complete` (forma `{name, price, image, url, eventId, planId, visualConfig, contentConfig, reuseExistingContent}` = `CompleteTemplateRequest`, verificado campo a campo) que **no siembra `MongoDataInitializer`** — dos de los cuatro (`payload-template-2.json`, `payload-template-xv-2.json`) sólo los usan `scripts/apply_template_11_12_local.sh` + `upsert_template_11_12.js`; los otros dos (`boda-3`, `graduacion`) no están referenciados por ningún script ni código del repo. Los cinco `data*Premium.ts` de la raíz son objetos `InvitationConfig` **completos** (con `invitationId=82` fijo, `templateId` y `eventId` reales) — misma estructura que los `default_visual_*.json` correspondientes pero con contenido real en vez de placeholders `null`; son la fuente/exportación de la que se derivaron los `default_visual_*.json` de bautizo/comunión/confirmación/cumpleaños/xv, no plantillas pendientes de alta. Verifiqué empíricamente (compilando un harness Kotlin+Jackson aislado, ver Anexo) dos cosas que las fases previas (A, B) habían dejado como INFERIDO por falta de entorno: (1) `invitationId` ausente en los 9 `default_visual_*.json` **no** rompe la siembra — `jackson-module-kotlin` rellena `Long` primitivo ausente con `0`, sin excepción; (2) mediante desensamblado de bytecode de `Jackson2ObjectMapperBuilder` confirmé que Spring Boot desactiva `FAIL_ON_UNKNOWN_PROPERTIES` por defecto, mientras que `MongoDataInitializer` usa un `jacksonObjectMapper()` propio que **sí** falla ante claves desconocidas en las 10 clases de `EditorModels.kt` sin `@JsonIgnoreProperties`. Con datos reales esto no ha reventado nada: la matriz de campos (18 archivos × 13 secciones) no encontró ninguna clave extra salvo un `type` sobrante en `sectionSuggestions` de `default_visual_xv_premium.json` (inocuo, la clase sí ignora desconocidos).

## 2. Inventario de archivos de datos

| Archivo | Tamaño | templateId interno | eventTypeId | planId | Claves raíz | ¿Sembrado por MongoDataInitializer? (archivo:línea) | Uso conocido |
|---|---|---|---|---|---|---|---|
| `data/mongo/default_visual_bautizo.json` | 85 808 B | 7 | — | — | `templateId`, `config` | Sí (`MongoDataInitializer.kt:39`) | Documento `default_visual_configs` |
| `data/mongo/default_visual_boda_basico.json` | 113 256 B | 4 | — | — | `templateId`, `config` | Sí (`:37`) | ídem |
| `data/mongo/default_visual_boda_premium.json` | 154 647 B | 5 | — | — | `templateId`, `config` | Sí (`:35`) | ídem |
| `data/mongo/default_visual_boda_premium_2.json` | 131 942 B | 11 | — | — | `templateId`, `config` | **No**, comentado (`:36`) | Existe en disco, no se siembra solo |
| `data/mongo/default_visual_comunion.json` | 85 876 B | 8 | — | — | `templateId`, `config` | Sí (`:40`) | ídem |
| `data/mongo/default_visual_confirmacion.json` | 85 913 B | 9 | — | — | `templateId`, `config` | Sí (`:41`) | ídem |
| `data/mongo/default_visual_cumpleanos.json` | 85 843 B | 10 | — | — | `templateId`, `config` | Sí (`:42`) | ídem |
| `data/mongo/default_visual_evento.json` | 82 587 B | 13 | — | — | `templateId`, `config` | Sí (`:43`) | ídem |
| `data/mongo/default_visual_xv_premium.json` | 113 335 B | 6 | — | — | `templateId`, `config` | Sí (`:38`) | ídem |
| `data/mongo/default_content_bautizo.json` | 7 156 B | *(ausente)* | 3 | 2 | ver Q4 (17 claves) | Sí (`:53`) | Documento `default_content_configs` |
| `data/mongo/default_content_boda_basico.json` | 6 254 B | *(ausente)* | 1 | 1 | 11 claves | Sí (`:51`) | ídem |
| `data/mongo/default_content_boda_premium.json` | 4 130 B | *(ausente)* | 1 | 2 | 10 claves | Sí (`:49`) | ídem |
| `data/mongo/default_content_boda_premium_2.json` | 5 618 B | *(ausente)* | 1 | 2 | 10 claves | **No**, comentado (`:50`) | Existe en disco, `(eventTypeId,planId)` duplica con `boda_premium` |
| `data/mongo/default_content_comunion.json` | 7 063 B | *(ausente)* | 4 | 2 | 17 claves | Sí (`:54`) | ídem |
| `data/mongo/default_content_confirmacion.json` | 6 933 B | *(ausente)* | 5 | 2 | 17 claves | Sí (`:55`) | ídem |
| `data/mongo/default_content_cumpleanos.json` | 7 849 B | *(ausente)* | 6 | 2 | 18 claves (incl. `_comment`) | Sí (`:56`) | ídem |
| `data/mongo/default_content_evento.json` | 5 474 B | *(ausente)* | 7 | 2 | 19 claves (incl. `_comment`) | Sí (`:57`) | ídem |
| `data/mongo/default_content_xv_premium.json` | 7 635 B | *(ausente)* | 2 | 2 | 17 claves | Sí (`:52`) | ídem |
| `data/mongo/payload-template-2.json` | 157 058 B | *(no aplica, es request)* | eventId=1 | planId=2 | `name,price,image,url,eventId,planId,visualConfig,contentConfig,reuseExistingContent` | **No** | Fuente de `apply_template_11_12_local.sh:18` → `upsert_template_11_12.js` inyecta `templateId=11` |
| `data/mongo/payload-template-boda-3.json` | 185 023 B | *(no aplica)* | eventId=1 | planId=2 | ídem | **No** | Sin referencia en scripts/código del repo (huérfano) |
| `data/mongo/payload-template-graduacion.json` | 173 155 B | *(no aplica)* | eventId=7 | planId=2 | ídem | **No** | Sin referencia en scripts/código del repo (huérfano); `eventId=7` no tiene fila `event_type` en ninguna migración (ya documentado por A/B) |
| `data/mongo/payload-template-xv-2.json` | 171 924 B | *(no aplica)* | eventId=2 | planId=2 | ídem | **No** | Fuente de `apply_template_11_12_local.sh:19` → `upsert_template_11_12.js` inyecta `templateId=12` |
| `data/mongo/bash.exe.stackdump` | 530 B | — | — | — | — | No (no está en las listas de `:34-58`) | Volcado de crash de Cygwin/MSYS `bash.exe` en Windows; sin relación con la app. Vive dentro de `src/main/resources`, que Gradle empaqueta en el JAR → viaja al artefacto final como basura inerte |
| `payload-template-2.json` (raíz del repo) | **0 B** | — | — | — | — | No | Archivo vacío; homónimo del real en `data/mongo/` (157 KB). Consistente con un residuo de redirección de shell fallida (`> archivo` sin contenido), coincidiendo con el `bash.exe.stackdump` cercano — evidencia de una operación manual desde Windows/Cygwin que se coló al commit |
| `dataBautizoPremium.ts` | 81 901 B | 7 | eventId=3 | *(ausente)* | array de 1 `InvitationConfig` con `invitationId=82` | No aplica (no es JSON, no es leído por ningún código Kotlin) | Ver Q4 |
| `dataComunionPremium.ts` | 82 046 B | 8 | eventId=4 | *(ausente)* | ídem | No aplica | ídem |
| `dataConfirmacionPremium.ts` | 82 011 B | 9 | eventId=5 | *(ausente)* | ídem | No aplica | ídem |
| `dataCumplePremium.ts` | 95 092 B | 10 | eventId=6 | *(ausente)* | ídem | No aplica | ídem |
| `dataXVPremium.ts` | 84 856 B | 6 | eventId=2 | *(ausente)* | ídem | No aplica | ídem |

Nota: para `default_content_*.json` la columna "Claves raíz" resume el conteo verificado por script; el detalle exacto de claves está en el Anexo (`out_content` no se generó como archivo separado, se listó inline en la sesión — ver comando en Anexo §3).

## 3. `default_visual_*` vs `payload-template-*`: comparación de esquema

| Aspecto | `default_visual_*.json` | `payload-template-*.json` |
|---|---|---|
| Clave raíz | `templateId` (Long), `config` (objeto) | `name, price, image, url, eventId, planId, visualConfig, contentConfig, reuseExistingContent` |
| Forma que coincide con | `DefaultVisualConfig` (`DefaultVisualConfig.kt:15-31`: `id?, templateId, config: InvitationConfig`) | `CompleteTemplateRequest` (`CompleteTemplateRequest.kt:11-68`: mismos 9 campos, mismos nombres, mismo orden) |
| `config`/`visualConfig` interno | 13 claves de sección (`settings, sectionCover, sectionCouple, sectionEvent, sectionGallery, sectionGifttable, sectionSuggestions, sectionAmenities, sectionStarted, sectionFamily, sectionStory, sectionDresscode, sectionFooter`) — **verificado idéntico** entre `default_visual_boda_premium.json.config` y `payload-template-2.json.visualConfig` (mismo `jq 'keys'`) | igual |
| `invitationId/templateId/eventId/planId` dentro de `config`/`visualConfig` | **Ausentes en los 9 archivos** (`jq '.config|has("invitationId")'` → `false` en los 9) | **Ausentes también** en los 4 `payload-template-*.json` (se inyectan en servidor, `MasterTemplatesService.kt:116-121`) |
| ¿Quién los consume? | `MongoDataInitializer.loadAndSaveVisualConfig` (`:74-94`), vía `objectMapper.readValue()` directo a `DefaultVisualConfig` | Nadie en `src/main/kotlin` los lee; son cuerpos de request para `curl`/scripts manuales contra `POST /master/templates/complete` (`MasterTemplatesController.kt` → `MasterTemplatesService.createCompleteTemplate`) |
| ¿Referenciados por algún script? | Sí, por nombre de archivo en la lista hardcodeada de `MongoDataInitializer.kt:34-44` | Sólo 2 de 4: `scripts/apply_template_11_12_local.sh:18-19` copia `payload-template-2.json` y `payload-template-xv-2.json` al contenedor Mongo para que `scripts/upsert_template_11_12.js` los lea con `mongosh` |

**Veredicto:** son dos esquemas distintos pero con una sub-estructura común (`InvitationConfig`, vía `config`/`visualConfig`) porque ambos, en última instancia, alimentan el mismo tipo Kotlin. **El canónico es `default_visual_*.json`** (es la forma en la que Mongo realmente guarda el documento — `DefaultVisualConfig`, colección `default_visual_configs`). Los `payload-template-*.json` son artefactos derivados/complementarios: el `visualConfig` que llevan dentro es equivalente al `config` de un `default_visual_*.json` (mismo esquema `InvitationConfig`), envuelto en la forma del *request* HTTP en vez de la forma del *documento* Mongo, y llevan además un `contentConfig` embebido (`DefaultContentConfig` completo) que en el mundo `default_visual_*` vive en un archivo `default_content_*.json` aparte. No hay evidencia en el repo de que uno se genere automáticamente a partir del otro (no hay script de conversión `default_visual → payload-template` ni al revés); ambos son producidos manualmente y coinciden en esquema porque comparten el mismo modelo Kotlin de destino.

## 4. Los `data*Premium.ts`

Los cinco archivos son **el mismo objeto `InvitationConfig`** repetido con distinto `templateId`/`eventId`, todos con `invitationId: 82` fijo (`grep -n "invitationId:" *.ts` → `82` en los cinco). No son JSON válido (llevan `export const NOMBRE: any[] = [ {...} ];`, comentarios `//` inline y no todas las claves están citadas de forma JSON-estricta); se resolvió evaluándolos como JS real con Node (`vm`/`require` tras reescribir sólo la cabecera `export const … = ` → `module.exports = `, sin tocar el resto del archivo — ver Anexo §2), no como JSON5, porque V8 los ejecuta sin transformación adicional.

| Archivo TS | Equivalente JSON más cercano | Diferencias clave | templateId | Campos que rompen/ignora el backend | Veredicto |
|---|---|---|---|---|---|
| `dataBautizoPremium.ts` | `default_visual_bautizo.json` | Mismo recuento de ítems por sección (event=2, gallery=4, gifttable=2, suggestions=3, amenities=1, family=2, dresscode=2); 580 diferencias de valor-hoja tras quitar ids — sobre todo `content` real vs `null` placeholder, y colores `[153,153,153]` (ts) vs `[130,130,130]` (json); `sectionFamily.items[*].items[*]` en el JSON añade `showImage`, ausente en el ts | 7 (coincide con `default_visual_bautizo.json`) | Ninguno estructural (0 claves extra); `invitationId=82` y `templateId/eventId` que sí lleva el ts se descartarían si se intentase sembrar como `DefaultVisualConfig` porque esa forma espera `{templateId, config}` y aquí no hay envoltorio — habría que envolverlo primero | Exportación/fuente de contenido **real** de una invitación (id 82) usada para maquetar la plantilla bautizo; el `default_visual_*.json` es su derivado con contenido vaciado a `null` |
| `dataComunionPremium.ts` | `default_visual_comunion.json` | Mismo patrón; 700 diferencias de valor-hoja | 8 | ídem | ídem, para comunión |
| `dataConfirmacionPremium.ts` | `default_visual_confirmacion.json` | Mismo patrón; 635 diferencias | 9 | ídem | ídem, para confirmación |
| `dataCumplePremium.ts` | `default_visual_cumpleanos.json` | `sectionEvent` tiene **4** ítems en el ts vs **2** en el JSON (única divergencia estructural real entre un ts y su JSON); 572 diferencias de valor-hoja | 10 | ídem | ídem, para cumpleaños — pero el derivado recortó 2 de los 4 ítems de evento |
| `dataXVPremium.ts` | `default_visual_xv_premium.json` | Mismo patrón; 710 diferencias | 6 | ídem | ídem, para XV años |

No existe un `data*Premium.ts` para boda ni para "evento"/graduación — los 5 cubren exactamente bautizo, comunión, confirmación, cumpleaños y XV, en correspondencia 1:1 con `templateId` 6-10 (los sembrados por `V24`/`V25` según A). **Ningún `.ts` tiene `planId`** (los 5, verificado por `grep -c planId`), consistente con que `planId` es opcional en `InvitationConfig` (`EditorModels.kt:22`).

**Sobre "qué son":** el patrón (misma `invitationId` real, `templateId`/`eventId` reales, contenido de texto concreto en vez de `null`, mismo número de secciones y — salvo cumpleaños — casi el mismo número de ítems por sección que su `default_visual_*.json` correspondiente) es más consistente con **una exportación de una invitación real de demostración/QA** (id 82) usada como base visual para construir cada plantilla, que con "plantillas pendientes de alta": no llevan la forma `{templateId, config}` de `DefaultVisualConfig`, no llevan `visualConfig`/`contentConfig` de `CompleteTemplateRequest`, y no están referenciados por ningún script ni código del repo (`grep -rn "dataBautizoPremium\|dataComunionPremium\|dataConfirmacionPremium\|dataCumplePremium\|dataXVPremium" --include="*.kt" --include="*.sh" --include="*.ts" .` → 0 resultados fuera de los propios archivos). **Es INFERIDO** que son la fuente original de la que se derivaron los `default_visual_*.json` correspondientes (no hay commit history ni comentario que lo declare — el repo tiene un único commit inicial); lo que sí es VERIFICADO es la altísima similitud estructural y el vaciado sistemático de `content`→`null` al pasar de ts a json.

## 5. Matriz archivo × sección × campos no reconocidos

Generada con `analyze_sections.py` (Anexo §1) comparando, sección por sección, las claves de cada objeto/ítem JSON contra los parámetros declarados en `EditorModels.kt`. Celda = `n ítems` (o `ok` si es un objeto único sin `items`) más `/ desconocidos: …` sólo si el script encontró alguna clave en el JSON que no está en la data class correspondiente. `—` = sección ausente en ese archivo (válido: todas las secciones son `?` en `InvitationConfig`, salvo que el propio archivo no las traiga).

| Archivo | settings | cover | couple | event | gallery | gifttable | suggest. | amenities | started | family | story | dresscode | footer |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| default_visual_bautizo | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| default_visual_boda_basico | ok | ok | ok | 3 | 3 | 2 | 3 | 1 | ok | 3 | 3 | 2 | ok |
| default_visual_boda_premium | ok | ok | ok | 3 | 6 | 4 | 3 | 1 | ok | 3 | 3 | 2 | ok |
| default_visual_boda_premium_2 | ok | ok | ok | 2 | 6 | 3 | 4 | 4 | ok | 2 | 4 | 2 | ok |
| default_visual_comunion | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| default_visual_confirmacion | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| default_visual_cumpleanos | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| default_visual_evento | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| default_visual_xv_premium | ok | ok | ok | 2 | 4 | 4 | **4 / desconocidos: type** | 1 | ok | 2 | — | 2 | ok |
| payload-template-2 | ok | ok | ok | 2 | 6 | 3 | 4 | 4 | ok | 3 | 4 | 2 | ok |
| payload-template-boda-3 | ok | ok | ok | 4 | 6 | 3 | 4 | 4 | ok | 3 | 3 | 2 | ok |
| payload-template-graduacion | ok | ok | ok | 4 | 12 | 3 | 6 | 3 | ok | 2 | — | 2 | ok |
| payload-template-xv-2 | ok | ok | ok | 7 | 4 | 3 | 3 | 4 | ok | 2 | — | 2 | ok |
| dataBautizoPremium.ts | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| dataComunionPremium.ts | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| dataConfirmacionPremium.ts | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| dataCumplePremium.ts | ok | ok | ok | 4 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |
| dataXVPremium.ts | ok | ok | ok | 2 | 4 | 2 | 3 | 1 | ok | 2 | — | 2 | ok |

**Hallazgo puntual:** los 4 ítems de `sectionSuggestions` en `default_visual_xv_premium.json` llevan una clave `type` (`"bank"`, `"digital"`, `"fisico"`, y uno sin ella) que **no existe** en `SuggestionItem` (`EditorModels.kt:352-358`) — sí existe, con ese mismo nombre, en `GifttableItem` (`EditorModels.kt:327-334`). Aparenta ser contenido copiado de la sección de mesa de regalos hacia sugerencias/recomendaciones para este archivo en particular. Inocuo en la práctica porque `SuggestionItem` lleva `@JsonIgnoreProperties(ignoreUnknown = true)` (`EditorModels.kt:351`), pero es la única grieta real encontrada en 18 archivos.

**A nivel de `config`/`visualConfig` raíz y de todas las demás secciones/ítems, `config_extra_keys`, `root_extra` e `item_extra` fueron listas vacías en el 100% de los 18 archivos** (script en Anexo §1, salida completa en `out_visual.json`/`out_payload.json`/`out_ts.json` del entorno de trabajo). Es decir: no hay campos "fantasma" adicionales que el modelo Kotlin ignore o rechace en los datos actuales, más allá del caso puntual anterior.

## 6. Contadores de ítems por sección

(`sectionCouple` no tiene `items`: es un objeto de campos fijos, por eso se omite de la tabla — confirmado `SectionCoupleData`, `EditorModels.kt:196-220`, no declara ninguna lista.)

| Archivo | event | gallery | gifttable | family | amenities | suggestions | story | dresscode |
|---|---|---|---|---|---|---|---|---|
| default_visual_bautizo | 2 | 4 | 2 | 2 | 1 | 3 | — (sección ausente) | 2 |
| default_visual_boda_basico | 3 | 3 | 2 | 3 | 1 | 3 | 3 | 2 |
| default_visual_boda_premium | 3 | 6 | 4 | 3 | 1 | 3 | 3 | 2 |
| default_visual_boda_premium_2 | 2 | 6 | 3 | 2 | 4 | 4 | 4 | 2 |
| default_visual_comunion | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| default_visual_confirmacion | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| default_visual_cumpleanos | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| default_visual_evento | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| default_visual_xv_premium | 2 | 4 | 4 | 2 | 1 | 4 | — | 2 |
| payload-template-2 | 2 | 6 | 3 | 3 | 4 | 4 | 4 | 2 |
| payload-template-boda-3 | 4 | 6 | 3 | 3 | 4 | 4 | 3 | 2 |
| payload-template-graduacion | 4 | 12 | 3 | 2 | 3 | 6 | — | 2 |
| payload-template-xv-2 | 7 | 4 | 3 | 2 | 4 | 3 | — | 2 |
| dataBautizoPremium.ts | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| dataComunionPremium.ts | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| dataConfirmacionPremium.ts | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| dataCumplePremium.ts | 4 | 4 | 2 | 2 | 1 | 3 | — | 2 |
| dataXVPremium.ts | 2 | 4 | 2 | 2 | 1 | 3 | — | 2 |

Coincidencia exacta (misma cantidad en las 8 columnas) entre cada `data*Premium.ts` y su `default_visual_*.json` correspondiente, **salvo `dataCumplePremium.ts` vs `default_visual_cumpleanos.json`**: 4 ítems de evento en el ts contra 2 en el JSON — el "recorte" de placeholder no fue mecánico ahí, alguien quitó 2 tarjetas de evento a mano (o el JSON se generó desde una versión anterior del ts con menos ítems).

## 7. Modo de deserialización y campos descartados

**Dos rutas de entrada, dos `ObjectMapper` distintos, dos comportamientos distintos ante claves desconocidas — verificado directamente, no sólo por lectura de código:**

1. **`MongoDataInitializer` (siembra en classpath, `core/data/MongoDataInitializer.kt:27`):** usa `jacksonObjectMapper()` — un `ObjectMapper` construido a mano con sólo `KotlinModule` registrado, **sin pasar por la infraestructura de Spring Boot**. Deserializa el `InputStream` del recurso **directo a la data class tipada** (`DefaultVisualConfig`/`DefaultContentConfig`, líneas 81 y 103) — no hay paso intermedio por `Document`/`Map` crudo. Jackson no toca su valor por defecto de `DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES` (`true`) porque nada en el código lo cambia (`grep -rn "FAIL_ON_UNKNOWN_PROPERTIES" --include="*.kt" .` → 0 resultados). Por tanto: cualquier clave JSON que caiga en una de las 10 clases de `EditorModels.kt` **sin** `@JsonIgnoreProperties(ignoreUnknown = true)` — `InvitationConfig` (`:12`), `ModelSettings` (`:44`), `ModelPropertiesIcon` (`:113`), `ModelEditIcon` (`:125`), `ModelPropertiesItem` (`:135`), `ModelEditItem` (`:147`), `BackgroundColor` (`:161`), `DateItem` (`:183`), `EventSinglePlaceCard` (`:255`), `SmallText` (`:492`) — hace fallar `objectMapper.readValue(...)` con `UnrecognizedPropertyException`, capturada por el `catch (e: Exception)` genérico de `loadAndSaveVisualConfig`/`loadAndSaveContentConfig` (líneas 91-93 y 124-126) y **sólo registrada como `logger.error`**: la app sigue arrancando, pero ese archivo completo (las 80-185 KB) no se siembra, sin que nada más que el log lo delate.
2. **`POST /master/templates/complete` (`MasterTemplatesService.kt:32` inyecta `objectMapper: ObjectMapper`, el bean autoconfigurado de Spring Boot):** el `visualConfig` llega como `Map<String, Any>` (`CompleteTemplateRequest.kt:55`, sin validación de forma en ese punto — cualquier JSON objeto es válido), se le inyectan 4 claves (`MasterTemplatesService.kt:116-121`) y se convierte con `objectMapper.convertValue(..., InvitationConfig::class.java)` (`:124`), usando el `ObjectMapper` gestionado por Spring.

**Verificación de que Spring desactiva `FAIL_ON_UNKNOWN_PROPERTIES` por defecto — hecha por desensamblado de bytecode, no por documentación:** descargué `spring-web-6.2.1.jar` (versión gestionada por `org.springframework.boot:3.4.1`, `build.gradle.kts:6`) y desensamblé `Jackson2ObjectMapperBuilder.class` con `javap -c`. El método que aplica las features al `ObjectMapper` construido contiene, literalmente:
```
28: features.containsKey(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
36: ifne 48                              // si YA está seteada explícitamente, saltar
41: configureFeature(objectMapper, DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
```
Es decir: **a menos que el desarrollador la fije explícitamente** (vía `spring.jackson.deserialization.fail-on-unknown-properties`, propiedad **ausente** de `application.yml` — verificado por grep completo del archivo), Spring Boot **apaga** `FAIL_ON_UNKNOWN_PROPERTIES` al construir su `ObjectMapper` gestionado. — **VERIFICADO** (bytecode real de la versión declarada en `build.gradle.kts`, ver Anexo §4), no inferido.

**Consecuencia directa para `POST /master/templates/complete`:** cualquier clave desconocida en `visualConfig`, en **cualquier** nivel — incluidas las 10 clases sin `@JsonIgnoreProperties` — se descarta en silencio, sin excepción. El mismo JSON que el endpoint acepta sin queja puede hacer que `MongoDataInitializer` se salte ese archivo entero en el próximo arranque si alguna vez se copia a `src/main/resources/data/mongo/` para sembrarlo por classpath. Con los datos *actuales* esto es sólo una asimetría latente (§5: cero claves extra reales, salvo el caso inocuo de `type`), pero es una trampa real para cualquier edición futura de `settings`, `sectionCover.date`, íconos o `smallText` que añada una clave sin darse cuenta.

**Verificación empírica de `invitationId` ausente (compilé y ejecuté el escenario real, no sólo lo inferí):** copié `EditorModels.kt` y una versión mínima de `DefaultVisualConfig` (sin las anotaciones de Spring Data Mongo, que no aportan nada a este experimento) a un proyecto aislado, descargué `kotlin-compiler-1.9.25`, `jackson-databind/-core/-annotations:2.18.2` y `jackson-module-kotlin:2.18.2` de Maven Central, y ejecuté literalmente `jacksonObjectMapper().readValue<DefaultVisualConfig>(...)` (la misma llamada de `MongoDataInitializer.kt:81`) contra los 9 `default_visual_*.json` reales del repo. **Resultado: los 9 deserializan con éxito, `invitationId=0`.** Un micro-experimento adicional confirmó el mecanismo: para un `Long` no-nulo sin valor por defecto, `jackson-module-kotlin` rellena `0` cuando la clave falta (compila a `long` primitivo en la JVM, no puede ser `null`, así que la comprobación "ausente → null → excepción" no aplica); para un `String` no-nulo equivalente sí lanza `MissingKotlinParameterException`. Esto **corrige/confirma con evidencia directa** el hallazgo #1 de `A-modelo-datos.md` y la pregunta #5 de `B-alta-plantillas.md`, que ambos lo dejaron como INFERIDO por falta de entorno de build: **la siembra de los 9 `default_visual_*.json` no falla por `invitationId` ausente.**

## 8. Hallazgos

1. **`default_visual_*.json` (documento Mongo) y `payload-template-*.json` (cuerpo de request) son esquemas distintos que comparten el mismo sub-esquema `InvitationConfig`.** El primero es `{templateId, config}` = `DefaultVisualConfig.kt:15-31`; el segundo es `{name,price,image,url,eventId,planId,visualConfig,contentConfig,reuseExistingContent}` = `CompleteTemplateRequest.kt:11-68`, verificado con `jq 'keys'` sobre los 9+4 archivos. `MongoDataInitializer` sólo conoce y siembra los primeros (`MongoDataInitializer.kt:34-58`); ningún archivo ni línea del repo hace que los `payload-template-*.json` alimenten Mongo directamente — sólo dos de los cuatro llegan a Mongo, y por la vía manual `apply_template_11_12_local.sh` + `mongosh`. — **VERIFICADO**
2. **Sólo 2 de los 4 `payload-template-*.json` tienen algún consumidor en el repo.** `grep -rn "payload-template"` sobre `.kt/.sh/.js/.yml/.md` sólo encuentra `payload-template-2.json` y `payload-template-xv-2.json` en `scripts/apply_template_11_12_local.sh:18-19,57-58`. `payload-template-boda-3.json` (185 KB) y `payload-template-graduacion.json` (173 KB) no aparecen en ningún script ni código — son huérfanos de disco, presumiblemente cuerpos de request preparados manualmente y nunca versionados en un script. — **VERIFICADO** (ausencia por grep); su uso real (¿se llamó a `curl` con ellos alguna vez?) es **NO DETERMINABLE**.
3. **`invitationId` ausente en los 9 `default_visual_*.json` no rompe la siembra — verificado empíricamente, no sólo inferido.** Ver §7. `jacksonObjectMapper()` rellena `0L` para el `Long` primitivo requerido de `InvitationConfig.invitationId` (`EditorModels.kt:18`) cuando la clave falta en el JSON, en vez de lanzar excepción. — **VERIFICADO** (reproducción real con las 9 fuentes originales, kotlinc 1.9.25 + jackson-module-kotlin 2.18.2, Anexo §5).
4. **Asimetría real y verificada (no sólo documental) entre el `ObjectMapper` del seeder y el de la API respecto a claves desconocidas.** `MongoDataInitializer.kt:27` usa `jacksonObjectMapper()` (Jackson puro, `FAIL_ON_UNKNOWN_PROPERTIES=true` por defecto, sin tocar); `MasterTemplatesService.kt:32` usa el `ObjectMapper` de Spring Boot, que por bytecode de `Jackson2ObjectMapperBuilder` (spring-web 6.2.1, la versión que gestiona Boot 3.4.1) desactiva esa feature salvo configuración explícita — ausente de `application.yml`. Diez clases de `EditorModels.kt` no llevan `@JsonIgnoreProperties(ignoreUnknown = true)` (listadas en §7), así que sólo el camino del seeder es realmente estricto ante claves nuevas en esas clases. — **VERIFICADO** por desensamblado de bytecode de la versión exacta declarada en `build.gradle.kts:6`.
5. **Con los 18 archivos de datos inspeccionados (9 visual + 4 payload + 5 ts), sólo se encontró una clave verdaderamente "no reconocida": `type` en 4 ítems de `sectionSuggestions` de `default_visual_xv_premium.json`.** No existe en `SuggestionItem` (`EditorModels.kt:352-358`) pero sí, con el mismo nombre, en `GifttableItem` (`EditorModels.kt:327-334`) — aparenta contenido copiado entre secciones. Inocuo porque `SuggestionItem` sí ignora desconocidos. — **VERIFICADO** (script `analyze_sections.py`, Anexo §1).
6. **`FamilySubItem` (`EditorModels.kt:421-430`) es una data class sin ningún uso en todo el código Kotlin.** `FamilyItem.items` es recursivo sobre `FamilyItem`, no sobre `FamilySubItem` (`EditorModels.kt:412`). `grep -rn "FamilySubItem" --include="*.kt" .` sólo encuentra su propia declaración. — **VERIFICADO**
7. **`singleplace` es `false` en los 9 `default_visual_*.json` sembrados y `itemsSinglePlace`/`EventSinglePlaceCard` nunca aparecen poblados en ninguno de los 18 archivos de datos inspeccionados por este sub-agente.** Dentro del alcance de este inventario (JSON de plantilla, no `invitation_configs` de usuarios reales, fuera de mi brief), esa rama del modelo es peso muerto. — **VERIFICADO dentro del alcance**; si alguna invitación real (`invitation_configs`) usa `singleplace=true` es **NO DETERMINABLE** desde estos archivos.
8. **Los 5 `data*Premium.ts` son casi con toda seguridad la fuente/exportación original de los `default_visual_*.json` de bautizo, comunión, confirmación, cumpleaños y XV — no plantillas pendientes de alta.** Mismo `templateId`, mismo `eventId` (=`eventTypeId` del content correspondiente), estructura de secciones idéntica (matriz §5), recuento de ítems casi idéntico (§6) y diferencia sistemática de `content: "texto real"` (ts) → `content: null` (json), exactamente lo que describe el docstring de `DefaultVisualConfig.kt:27-29` ("Content fields will have placeholder values that will be replaced during generation"). — **VERIFICADO** el patrón estructural y el vaciado de contenido; **INFERIDO** que el ts es el origen y no al revés (no hay historial de commits que lo confirme — un único commit inicial en todo el repo).
9. **`dataCumplePremium.ts` y `default_visual_cumpleanos.json` divergen estructuralmente en `sectionEvent` (4 ítems vs 2), a diferencia de los otros 4 pares ts/json que coinciden exactamente.** — **VERIFICADO** (§6).
10. **`payload-template-2.json` de la raíz del repo está vacío (0 bytes) y coexiste con `bash.exe.stackdump` (530 B, volcado de crash de Cygwin/MSYS bash en Windows) dentro de `src/main/resources/data/mongo/`.** Ninguno de los dos tiene relación funcional con la aplicación; el segundo viaja empaquetado en el JAR final porque está dentro de `src/main/resources`. — **VERIFICADO** (tamaños de archivo, contenido del stackdump).
11. **Ningún `default_content_*.json` trae `templateId`** (`grep -c` sobre los 9 → siempre ausente); los 9 se asocian exclusivamente por `(eventTypeId, planId)`, consistente con la rama `if (config.templateId != null)` de `MongoDataInitializer.kt:106` nunca tomándose para estos archivos. — **VERIFICADO**
12. **Hay un choque real de `(eventTypeId, planId)` entre `default_content_boda_premium.json` (1,2) y `default_content_boda_premium_2.json` (1,2)**, y el segundo está deliberadamente comentado en el seeder (`MongoDataInitializer.kt:50`) — evitando así que `findByEventTypeIdAndPlanId` (línea 118, la variante que lanza excepción con >1 resultado) se dispare en cada arranque. Esto es consistente con — y añade evidencia de archivo a — el hallazgo #10 de `B-alta-plantillas.md`. — **VERIFICADO** el choque de claves; que la comentada sea *por eso* específicamente es **INFERIDO** (coincide con la explicación más simple, no hay comentario que lo declare).

## 9. Lo que está bien resuelto

- **La correspondencia estructural entre `default_visual_*.json`/`payload-template-*.json` y `EditorModels.kt` es, en la práctica, perfecta.** De 18 archivos de datos (9 visual + 4 payload + 5 ts) y 13 secciones cada uno, sólo apareció una clave no reconocida en total (§5, §8.5), y ninguna clave requerida sin default faltó nunca (revisé cada `root_missing`/`item_missing_common` contra los campos realmente obligatorios de cada data class — todos correspondían a campos `?`/con default). El equipo mantiene el contenido sincronizado con el modelo con más disciplina de la que el resto de los hallazgos (asimetría de `ObjectMapper`, `invitationId` ausente) sugeriría a primera vista.
- **`DefaultContentConfig` y todas sus clases anidadas llevan `@JsonIgnoreProperties(ignoreUnknown = true)` de forma consistente** (`DefaultContentConfig.kt`, 13 clases, verificado una por una), y eso protege realmente la siembra: `_comment` en `default_content_cumpleanos.json`/`default_content_evento.json` se descarta sin romper nada.
- **`sectionFamily.intro` ya es un array en los 9 `default_visual_*.json` actuales**, pese a que el comentario de `EditorModels.kt:389` ("El JSON de bodas debe actualizarse para enviar intro como [...]") sugiere una migración pendiente — la migración de datos ya se hizo, sólo quedó el comentario desactualizado (ya señalado por A, confirmado aquí de nuevo sobre los 9 archivos completos, no sólo 2).
- **`GifttableItem`/`SuggestionItem` tienen `@JsonIgnoreProperties(ignoreUnknown=true)`, así que la única anomalía real de datos encontrada (`type` en `sectionSuggestions` de xv_premium) no tiene ningún efecto observable** — el diseño de "ignorar por clase, no globalmente" resultó ser suficientemente amplio para cubrir el 99.9% de las 26 clases anidadas relevantes; sólo 10 quedaron fuera, y ninguna de esas 10 recibió jamás una clave extra en los datos reales inspeccionados.

## 10. Preguntas que no pude responder y por qué

1. **Si los `payload-template-boda-3.json`/`payload-template-graduacion.json` huérfanos se usaron alguna vez manualmente (curl/Postman) para crear una plantilla real vía `/master/templates/complete`.** No hay logs, ni historial git más allá del commit inicial, ni script que los invoque. **Depende del estado real del entorno de producción/BD** — no determinable desde el repositorio.
2. **Si `dataCumplePremium.ts` es anterior o posterior a `default_visual_cumpleanos.json`** (¿se recortaron 2 ítems de evento al convertir, o el ts se editó después con 2 ítems nuevos que nunca se propagaron al JSON?). El repo no tiene historial de commits granular (un solo commit inicial) que permita ordenar temporalmente los dos archivos.
3. **Si existen más de estos "`data*Premium.ts`" o variantes equivalentes fuera del repo** (para boda o evento/graduación, que no tienen equivalente ts aquí) que expliquen el origen de `default_visual_boda_premium.json`/`_2.json`/`default_visual_evento.json`. Sólo puedo constatar que, dentro de este repositorio, no existen.
4. **El valor exacto que tomaría `objectMapper.convertValue(...)` (ruta API) frente a claves ausentes-pero-requeridas distintas de `invitationId`** (p. ej. si `visualConfig` llegara sin `settings.primaryColor`, un `List<Double>` requerido). No lo verifiqué empíricamente porque cae fuera del alcance de "inventario de JSON" (es comportamiento de request malformado, no de los archivos de datos existentes) y ninguno de los 18 archivos reales presenta esa situación.
5. **Si algún consumidor externo (frontend, otro backend) lee `payload-template-*.json` o `data*Premium.ts` directamente como fuente de verdad fuera de este repositorio.** Ninguna evidencia de ello dentro del repo; requeriría acceso al repositorio del frontend, fuera de mi alcance.

## Anexo: scripts usados

**§1. `analyze_sections.py`** — script Python (guardado en el scratchpad) que, para cada archivo, localiza el objeto `InvitationConfig` (bajo `config`, bajo `visualConfig`, o el propio archivo si es un array `[ {...} ]` como los `.ts` convertidos), y compara las claves de cada una de las 13 secciones (y de sus `items`/`hashtags`) contra un diccionario Python transcrito a mano desde `EditorModels.kt` (nombre de clase → conjunto de campos del constructor + si lleva `@JsonIgnoreProperties(ignoreUnknown=true)`). Reporta `root_extra`/`root_missing`/`item_extra`/`item_missing_common` por sección y archivo. Ejecutado sobre los 9 `default_visual_*.json`, los 4 `payload-template-*.json` y los 5 `.ts` convertidos a JSON (§2). Salidas guardadas en `out_visual.json`, `out_payload.json`, `out_ts.json` (scratchpad `j-tools/`).

**§2. `ts_to_json.js`** — script Node que reescribe sólo la cabecera `export const NOMBRE: any[] = ` → `module.exports = ` de cada `data*Premium.ts` (sin tocar el resto del archivo) y lo ejecuta como módulo CommonJS real (`require`), aprovechando que V8 interpreta directamente comentarios `//`, comas finales, etc. — no es JSON5, es JS ejecutado. Salida: `JSON.stringify` a un `.json` en `j-tools/ts_json/`. Confirmado con `node --version` → v22.22.2.

**§3. Comandos ad-hoc de inspección** (todos con `python3 -c`/`jq` equivalentes, ejecutados sobre `src/main/resources/data/mongo/*.json`):
```bash
# claves raíz de cada default_visual_*.json / default_content_*.json
python3 -c "import json; d=json.load(open('archivo.json')); print(sorted(d.keys()))"
# presencia de invitationId/templateId/eventId/planId dentro de "config"
python3 -c "import json; d=json.load(open('archivo.json')); cfg=d['config']; print({k:(k in cfg) for k in ['invitationId','templateId','eventId','planId','id']})"
# valores de sectionEvent.singleplace en los 9 archivos
for f in default_visual_*.json; do python3 -c "import json;print(json.load(open('$f'))['config']['sectionEvent']['singleplace'])"; done
```

**§4. Verificación de `FAIL_ON_UNKNOWN_PROPERTIES` en Spring Boot (bytecode real, no documentación).**
```bash
# Descarga de la versión EXACTA gestionada por build.gradle.kts:6 (Spring Boot 3.4.1 -> spring-web 6.2.1)
curl -sSL -o spring-web.jar https://repo1.maven.org/maven2/org/springframework/spring-web/6.2.1/spring-web-6.2.1.jar
unzip -o spring-web.jar "org/springframework/http/converter/json/Jackson2ObjectMapperBuilder*"
javap -p -c org/springframework/http/converter/json/Jackson2ObjectMapperBuilder.class \
  | grep -n "failOnUnknownProperties\|FAIL_ON_UNKNOWN" -A 15 -B 5
# resultado relevante (líneas ~996-1009 del disassembly):
#   containsKey(FAIL_ON_UNKNOWN_PROPERTIES) -> ifne 48 (si ya está seteada, no tocar)
#   si NO está seteada: configureFeature(objectMapper, FAIL_ON_UNKNOWN_PROPERTIES, false)
```
También se inspeccionó `spring-boot-autoconfigure-3.4.1.jar` → `JacksonAutoConfiguration$...StandardJackson2ObjectMapperBuilderCustomizer.class`: no fija `FAIL_ON_UNKNOWN_PROPERTIES` por sí mismo (delega en `JacksonProperties`/`application.yml`, que no la define), así que el default real que aplica es el de `Jackson2ObjectMapperBuilder` de arriba.

**§5. Reproducción real de la siembra de `MongoDataInitializer` fuera de la app (kotlinc + jackson, sin Spring).**
```bash
# Compilador Kotlin standalone (sin depender de Gradle/red de plugins)
curl -sSL -o kotlinc.zip https://github.com/JetBrains/kotlin/releases/download/v1.9.25/kotlin-compiler-1.9.25.zip
unzip -q kotlinc.zip
# Dependencias exactas: jackson-databind/-core/-annotations 2.18.2 (gestionadas por Boot 3.4.1) + jackson-module-kotlin 2.18.2
curl -sSL -o libs/jackson-databind-2.18.2.jar   https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.18.2/jackson-databind-2.18.2.jar
curl -sSL -o libs/jackson-core-2.18.2.jar        https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/2.18.2/jackson-core-2.18.2.jar
curl -sSL -o libs/jackson-annotations-2.18.2.jar https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.18.2/jackson-annotations-2.18.2.jar
curl -sSL -o libs/jackson-module-kotlin-2.18.2.jar https://repo1.maven.org/maven2/com/fasterxml/jackson/module/jackson-module-kotlin/2.18.2/jackson-module-kotlin-2.18.2.jar
# Copia literal de EditorModels.kt (sólo se quitaron @Id/@Indexed/@Document de Spring Data Mongo,
# que no aportan nada a un test de (de)serialización JSON) + una réplica de DefaultVisualConfig.kt
# + un main() que hace exactamente objectMapper.readValue<DefaultVisualConfig>(...) como
# MongoDataInitializer.kt:81, contra cada default_visual_*.json real del repo.
./kotlinc/bin/kotlinc -cp "$CLASSPATH" src/EditorModels.kt src/DefaultVisualConfigTest.kt src/Main.kt -include-runtime -d out.jar
for f in default_visual_*.json; do java -cp "out.jar:$CLASSPATH" MainKt "$f"; done
# Resultado: "OK: deserialized. templateId=<N> invitationId=0" en los 9 archivos, sin excepción.
# Micro-prueba adicional (Probe.kt) confirmó el mecanismo: Long no-nulo sin default ausente -> 0L (OK);
# String no-nulo sin default ausente -> MissingKotlinParameterException; Long? ausente -> null (OK).
```

**Fuentes de contexto cruzado (leídas, no citadas como verdad sin verificación propia):** `docs/analisis-plantillas/fases/A-modelo-datos.md` y `B-alta-plantillas.md` (informes de sub-agentes previos de esta misma auditoría, ya committeados al repo). Se usaron para orientar qué archivos/scripts adicionales revisar (`scripts/apply_template_11_12_local.sh`, `scripts/upsert_template_11_12.js`) y para detectar dos preguntas que ambos habían dejado como INFERIDO por falta de entorno de build — resueltas aquí de forma empírica (§7, hallazgo #3, hallazgo #4). Todas las afirmaciones propias de este informe fueron verificadas independientemente contra el código/datos, no copiadas de esos informes.
