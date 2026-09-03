# H — Verificación adversarial de hipótesis

> Convención: todas las rutas son relativas a la raíz del repo. Toda cita fue **abierta y confirmada por mí** contra el código; cuando reutilizo una conclusión de la Ola 1 lo digo explícitamente y digo si la confirmé.
> Herramientas propias en `<scratchpad>/h-tools/` (script de profundidad de llaves, arnés Kotlin+Jackson de *round-trip*, comparadores Python). No se modificó nada del repositorio (`git status --short` → vacío).
> `X-dirimidor-seed.md` **sí existía** al cerrar este informe (creado 05:46); su veredicto se aplica en las hipótesis 5 y 7.

---

## 0. Resumen de veredictos

| # | Hipótesis (resumida) | Veredicto | Matiz en una línea |
|---|---|---|---|
| 1 | Un solo servicio de ~2700 líneas sin abstracción por sección ⇒ cada plantilla nueva obliga a tocar código | **PARCIAL** | Sí hay descomposición por sección (11 funciones con contrato uniforme); lo que no hay es abstracción **por plantilla** — y las plantillas 7-10 se dieron de alta **sin tocar** el generador, así que la consecuencia es falsa como absoluto y cierta sólo para la vía de siembra y para plantillas que se desvían de las convenciones. |
| 2 | Dos fuentes de verdad sin transacción común ni reconciliación; estado inconsistente alcanzable en producción | **CONFIRMADA (con matiz)** | La transacción común no existe ni podría (Mongo standalone), y hay **cuatro** caminos de inconsistencia alcanzables — pero "sin reconciliación" es falso: existen 4 reconciliaciones parciales; ninguna cubre el catálogo de plantillas. |
| 3 | El merge depende de la posición y no de un id estable ⇒ plantillas con distinta cantidad/orden se degradan | **PARCIAL** | 2 de 10 secciones **sí** emparejan por clave semántica (mesa de regalos por tipo, familia no-boda por texto del título) y la galería no empareja en absoluto; además el join plantilla↔dato de usuario **no tiene id compartido posible**, así que la alternativa que la hipótesis propone sólo aplica en un sitio (`syncGiftRegistryTitles`), donde efectivamente falta. |
| 4 | Código muerto/comentado significativo conviviendo con la versión viva; no es evidente cuál se ejecuta | **PARCIAL** | La premisa es cierta y la medí (607/2744 = 22,1 % de líneas `//`), pero *cuál se ejecuta* sí es evidente (el muerto empieza por `//`); lo genuinamente no evidente es otro código muerto **sin comentar**: ramas idénticas, código inalcanzable por early-return y 17 referencias muertas por una anotación Jackson. |
| 5 | JSON de plantilla y modelo Kotlin desalineados: hay campos del frontend que el backend descarta al deserializar | **CONFIRMADA** | Verificado empíricamente por *round-trip*: se descartan 4 rutas de campo distintas; la grave es `itemsSinglePlace` (`@get:JsonIgnore`), que borra 3 y 2 tarjetas de las plantillas de boda y deja muertas 17 referencias del generador — ningún informe de la Ola 1 lo detectó. |
| 6 | Múltiples caminos de alta (SQL, seed, API, scripts) que no producen el mismo resultado | **CONFIRMADA** | Matriz de divergencia verificada en 9 dimensiones; matiz: no es que *ninguna* pareja coincida (V24≡V25, y `create_complete_template.sh` es un envoltorio de la API), es que las que importan divergen — incluso en qué campos sobreviven a Jackson. |
| 7 | El seed de arranque puede pisar o desincronizar plantillas creadas por API | **CONFIRMADA (con matices fuertes)** | "Pisar" sólo alcanza a 8 `templateId` cableados y en la práctica sólo al 13; el contenido **no** se pisa (es *skip-if-exists*) y `invitation_configs` **nunca** se toca — pero desincroniza siempre por otra vía: el seed escribe `config.templateId/eventId/planId = null` y pierde `itemsSinglePlace`, cosa que la API no hace. |

---

## Hipótesis 1
> *La generación está concentrada en un solo servicio de ~2700 líneas sin abstracción por sección, y por eso cada plantilla nueva obliga a tocar código.*

### Qué la refutaría

Tres cosas, y sirven por separado:
1. Que la generación **no** esté concentrada (otro servicio/paquete participe del merge).
2. Que exista abstracción por sección: una interfaz, clase sellada, estrategia o registro que permita añadir/variar el tratamiento de una sección sin editar el cuerpo del servicio.
3. Que exista **al menos una plantilla real** dada de alta sin modificar código Kotlin — eso rompe la consecuencia, que es la mitad que importa.

### Evidencia a favor (archivo:línea, confirmada por mí)

- La generación es un único archivo: `src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/DefaultConfigGeneratorService.kt`, **2744 líneas** (`wc -l` da 2743 porque la última línea no lleva salto final). Verifiqué con un contador de llaves propio (`h-tools/depth.py`, ignora comentarios y literales) que **la profundidad vuelve a 0 una sola vez, en la línea 2744**: la clase abarca 17–2744 y **no hay ninguna función top-level**. Esto confirma la corrección de C2 y refuta la lectura ingenua de que `mergeGiftTableSection` (línea 979, en columna 0) esté fuera de la clase.
- Es el único punto de merge: `grep -rn "generateInitialConfig" src/main/kotlin` devuelve la definición (`DefaultConfigGeneratorService.kt:36`) y **un solo llamador** (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:154`). Confirmado por mí.
- **No hay abstracción polimórfica**: en todo `modules/user/invitations/` las únicas `interface`/`abstract class`/`sealed` son los tres repositorios de Mongo (`repository/mongo/DefaultVisualConfigRepository.kt:12`, `InvitationConfigRepository.kt:9`, `DefaultContentConfigRepository.kt:12`). Cero interfaces de sección, cero registro de estrategias. Verificado por grep propio.
- El servicio inyecta **15 repositorios** en el constructor (`DefaultConfigGeneratorService.kt:18-32`) — la señal más clara de que todo el conocimiento del dominio vive ahí.
- Números mágicos de plantilla en código vivo (grep propio sobre el archivo):
  - `DefaultConfigGeneratorService.kt:255` y `:1680` — `val isWedding = eventTypeId == 1L`.
  - `DefaultConfigGeneratorService.kt:420` — `val isGraduacion = templateId == 14L && eventTypeId == 7L && planId == 2L`, que gobierna si los ítems de galería llevan `label` (`:446-451`).
  - `DefaultConfigGeneratorService.kt:2129`, `:2156`, `:2177` — `if (templateId == 12L)` decide si se añade un segundo *body* a las recomendaciones.
  (Más `templateId == 11L` en `:1350, 1377, 1445, 1482`, todas dentro de bloques comentados.)
- Existe una segunda lista cableada, en **otro** archivo: `src/main/kotlin/mx/evolutiondev/invitaciones/core/data/MongoDataInitializer.kt:34-44` y `:48-58` enumeran los nombres de fichero a sembrar. Añadir una plantilla por la vía de siembra **obliga a editar Kotlin**, aunque no sea el generador.

### Evidencia en contra / contraejemplos

1. **Sí hay descomposición por sección, y con contrato uniforme.** `mergeConfiguration` (`DefaultConfigGeneratorService.kt:90-180`) delega en 11 funciones privadas — `mergeSettings` (182), `mergeCoverSection` (209), `mergeCoupleSection` (244), `mergeGallerySection` (409), `mergeEventSection` (483), `mergeGiftTableSection` (979), `mergeFamilySection` (1639), `mergeAmenitiesSection` (1852), `mergeSuggestionsSection` (2062), `mergeStorySection` (2203), `mergeDressCodeSection` (2271), `mergeStartedSection` (2664) — **todas** con la misma firma `(InvitationEntity, SecciónVisual?, DefaultContentConfig) : SecciónVisual?`, todas abriendo con `if (visualX == null) return null` (985, 1644, 1857, 2067, 2208, 2276, 2669; y 187, 214, 249, 414, 488 en el tramo previo) y todas invocadas con `?.copy(visibility = true)`. Eso **es** una abstracción por sección — no extensible, pero sí uniforme y legible. La hipótesis, tal como está redactada, es imprecisa aquí: lo que falta es abstracción **por plantilla**, no por sección.
2. **Contraejemplo duro a la consecuencia: cuatro plantillas se dieron de alta sin tocar el generador.** `src/main/resources/db/migration/V25__add_remaining_templates.sql:2-8` inserta los `templateId` 7, 8, 9 y 10 (bautizo, comunión, confirmación, cumpleaños) y `V24__add_new_event_types_and_xv_template.sql:10-13` el 6. El grep de literales de `templateId` en el generador **no contiene ninguno de esos cinco ids**: sólo 14L, 12L y (comentado) 11L. Es decir: cinco plantillas reales, cero líneas del generador tocadas.
3. **Contraejemplo aún más fuerte: la vía API no requiere ni una línea de Kotlin.** `POST /master/templates/complete` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/service/MasterTemplatesService.kt:84-197`) crea la fila de Postgres y el documento visual desde el propio *payload*; con `contentConfig` presente (`:145-150`) tampoco necesita nada preexistente. `scripts/create_complete_template.sh:87-90` es exactamente ese flujo, parametrizado por argumentos. Una plantilla nueva por esta vía es **puro dato**.

### Veredicto y matices

**PARCIAL.**

- Premisa "un solo servicio de ~2700 líneas": **CONFIRMADA** (2744 líneas, una sola clase, 15 repositorios, un único punto de merge).
- Premisa "sin abstracción por sección": **REFUTADA en su literalidad, CONFIRMADA en su espíritu.** Hay 12 funciones de sección con contrato uniforme; lo que no existe es ningún mecanismo para que una plantilla aporte comportamiento propio.
- Consecuencia "por eso cada plantilla nueva obliga a tocar código": **REFUTADA como absoluto.** Depende de la vía y del parecido de la plantilla:
  - Por API con `contentConfig`: **cero** código. Verificado.
  - Por siembra en el classpath: **sí** hay que tocar Kotlin, pero `MongoDataInitializer.kt:34-58`, no el generador.
  - Por migración SQL + siembra: idem (SQL + la lista del initializer).
  - Si la plantilla necesita algo que las convenciones no cubren (etiquetas en galería, un botón extra en recomendaciones, un tipo de evento que no sea el 1 y aun así deba tratarse como boda): **sí**, y la solución existente es un número mágico (`:420`, `:2129`, `:255`).
- **Matiz propio, el más importante y que ningún informe de la Ola 1 formula así**: no tocar código no significa que la plantilla funcione. Hay **convenciones de dato implícitas y no documentadas** que sustituyen a la abstracción ausente, y **5 de 9 plantillas sembradas ya las incumplen**. La comprobé yo con `python3` sobre `src/main/resources/data/mongo/`:

  | Archivo | templateId | `sectionFamily.items[].title.content` |
  |---|---|---|
  | `default_visual_boda_premium.json` | 5 | `['(Padres de la Novia)', '(Padres del novio)', '(Padrinos de Velación)']` |
  | `default_visual_xv_premium.json` | 6 | `['Mis Padres', 'Mis Padrinos']` |
  | `default_visual_bautizo.json` | 7 | `[None, None]` |
  | `default_visual_comunion.json` | 8 | `[None, None]` |
  | `default_visual_confirmacion.json` | 9 | `[None, None]` |
  | `default_visual_cumpleanos.json` | 10 | `[None, None]` |
  | `default_visual_evento.json` | 13 | `[None, None]` |
  | `default_visual_boda_basico.json` | 4 | `[None, None, None]` |

  `mergeFamilySection` (`DefaultConfigGeneratorService.kt:1685` y `:1703`) empareja el grupo con `groupTemplate.title?.content?.contains("Padre"/"Padrino", ignoreCase = true) == true`. Con `title.content = null` el safe-call propaga `null`, `null == true` es `false`, ambas ramas fallan y se cae al `else -> groupTemplate` (`:1721`): **los padres y padrinos capturados por el usuario se descartan en silencio**. Confirmo así el hallazgo 7 de C2, y añado el marco: el coste real de no tener abstracción no es "hay que tocar código", es "hay que acertar una convención textual que no está escrita en ninguna parte, y el propio equipo la falló en 5 de 9 plantillas propias".

---

## Hipótesis 2
> *Hay dos fuentes de verdad (Postgres y Mongo) sin transacción común ni reconciliación, y el estado inconsistente es alcanzable en producción.*

### Qué la refutaría

1. Un `MongoTransactionManager`/`ChainedTransactionManager`, o cualquier compensación explícita (borrado del documento tras el rollback, *outbox*, `TransactionSynchronization`).
2. Algún proceso de reconciliación: un job, un endpoint de "reparar", una comprobación cruzada al arrancar, o al menos una lectura que valide que a cada `invitation_template` le corresponde un `default_visual_configs`.
3. Que los caminos hacia el estado inconsistente estén cerrados en la práctica (validación previa, idempotencia, rol inalcanzable).

### Evidencia a favor (archivo:línea, confirmada por mí)

- **No hay transacción común, y no podría haberla.** `grep -rn "MongoTransactionManager\|ChainedTransactionManager\|PlatformTransactionManager\|@EnableTransactionManagement" src/main/` → **cero resultados** (grep propio). `src/main/resources/application.yml:47-48` configura Mongo sólo con `uri`. `docker-compose.yml:23-25` levanta `image: mongo:6` **sin `--replSet`**, y sin conjunto de réplicas las transacciones multidocumento no están disponibles.
- **Camino A — la vía "oficial" deja huérfanos.** En `MasterTemplatesService.createCompleteTemplate` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/master/templates/service/MasterTemplatesService.kt:84`, `@Transactional`) el orden es: `invitationTemplateRepository.save(...)` (`:103-113`) → `defaultVisualConfigRepository.save(visualConfig)` (`:138`, id null ⇒ **siempre inserta**) → resolución de contenido (`:145-182`). La rama por defecto es `reuseExistingContent` (`CompleteTemplateRequest.kt:67`: `val reuseExistingContent: Boolean = true`, verificado) y busca el contenido por `findByTemplateId(previousTemplate.id)` (`:164`), no por `(eventId, planId)` — la consulta correcta está **comentada** justo encima en `:153-154`. Si no encuentra nada, lanza `IllegalArgumentException` en `:175-178`: Postgres revierte, el documento visual de `:138` **no**. No hay ni un `try/catch` ni un `delete` alrededor.
  - Que eso pase en un entorno recién migrado es **verificable con datos**: ningún `default_content_*.json` trae `templateId` (lo comprobé con mi *round-trip*: el campo no aparece en ninguno de los 9), y el sembrador los guarda por la rama de `(eventTypeId, planId)` (`MongoDataInitializer.kt:118-123`), dejando `templateId = null`. Luego `findByTemplateId` **nunca** acierta.
- **Camino B — un endpoint que crea plantillas rotas por diseño.** `MasterTemplatesService.createTemplate` (`:35-70`) inserta la fila de Postgres y **no escribe nada en Mongo**; además `InvitationTemplateRequest` (`presentation/model/InvitationTemplateRequest.kt:7-26`) **no tiene campo `name`**, así que la plantilla nace con `name = ""` (default de `repository/model/InvitationTemplateEntity.kt:20`). Cualquier invitación que la use falla en `DefaultConfigGeneratorService.kt:48-54` con `DefaultVisualTemplateNotFoundException`.
- **Camino C — hallazgo propio, no recogido por la Ola 1.** `MasterTemplatesService.updateTemplate` (`:246-275`) reasigna `template.invitationPlan = plan` (`:268`) y `template.eventType = eventType` (`:269`) de una plantilla **existente**, sin tocar Mongo. Mover la plantilla 5 (boda premium) a `eventTypeId = 3` deja el diseño de boda en `default_visual_configs` mientras el generador toma la rama **no-boda** (`DefaultConfigGeneratorService.kt:255`, `:1680`) y el contenido se resuelve por el nuevo `(eventTypeId, planId)` (`:72`). El resultado es una invitación con maquetación de boda y textos de bautizo, sin ningún error.
- **Camino D** (confirmo a C3): `AdminUsersService.hardDeleteUser` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/admin/users/service/AdminUsersService.kt:423-426`) borra las invitaciones sin borrar `invitation_configs`, mientras el camino hermano `InvitationAdminService.hardDeleteInvitation:377-379` sí lo hace.
- **No existe borrado en Mongo para plantillas.** Mi grep de `defaultVisualConfigRepository.` / `defaultContentConfigRepository.` / `visualConfigRepo.` / `contentConfigRepo.` sobre todo `src/main/` devuelve **15 usos, ninguno de borrado**: `save` en `MasterTemplatesService.kt:138,148` y `MongoDataInitializer.kt:85,88,109,112,121`; lecturas en `MasterTemplatesService.kt:164`, `DefaultConfigGeneratorService.kt:70,72` y `MongoDataInitializer.kt:83,107,118`. Los huérfanos se acumulan indefinidamente.

### Evidencia en contra / contraejemplos

**"Sin reconciliación" es falso.** Encontré cuatro mecanismos de reconciliación, todos parciales, todos verificados por mí:

1. `InvitationConfigService.saveOrUpdateConfig` reescribe **incondicionalmente** `templateId`, `eventId` y `planId` desde Postgres en **ambas** ramas (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/service/InvitationConfigService.kt:71-73` y `:78-80`). Cada `PUT .../config` es una reconciliación Postgres→Mongo de esos tres campos.
2. La "lazy migration" de `InvitationConfigService.kt:141-147` los rellena en el `GET`, **pero sólo si son `null`** — por eso no repara un cambio de plantilla.
3. `syncGiftRegistryTitles` (`InvitationConfigService.kt:175-211`) reconcilia en sentido Mongo→Postgres el título y el primer mensaje de las mesas de regalo físicas.
4. `MongoDataInitializer` reconcilia, en cada arranque, los documentos de Mongo contra los JSON del classpath (`MongoDataInitializer.kt:83-90`, `:106-123`).

Es decir: el sistema **sí** intenta mantener coherencia, campo a campo y en los dos sentidos. Lo que **no** tiene reconciliación de ningún tipo es exactamente lo que la hipótesis nombra como "dos fuentes de verdad" a nivel de catálogo: la correspondencia `invitation_template` ↔ `default_visual_configs`/`default_content_configs`. Ninguna línea del repositorio lee las dos y compara.

Contraejemplo menor pero real: el orden de las escrituras en `createCompleteTemplate` (primero lo transaccional, después lo no transaccional) es el **menos malo** posible sin transacción distribuida; invertirlo dejaría huérfanos siempre.

### Veredicto y matices

**CONFIRMADA, con un matiz que corrige su redacción.**

- "Sin transacción común": **VERIFICADO** y además estructuralmente imposible con `mongo:6` standalone.
- "Sin reconciliación": **REFUTADO como absoluto** — hay 4 reconciliaciones parciales. Reformulación exacta: *no hay reconciliación del catálogo de plantillas, ni compensación tras un fallo parcial, ni borrado en Mongo.*
- "Alcanzable en producción": **CONFIRMADO** por cuatro caminos independientes verificados en código (A, B, C, D arriba). Los cuatro son código vivo, alcanzables con rol MASTER/ADMIN, sin ninguna guarda.
- **Lo que no puedo determinar**: si el estado inconsistente **ya existe**. La evidencia circunstancial es fuerte (`scripts/apply_template_11_12_local.sh:29-53` hace `UPDATE ... WHERE id=11/12` y `SET is_enabled=false WHERE id IN (16,17)` sobre filas que **ninguna migración crea** — mi grep confirma que sólo V1, V24 y V25 insertan en `invitation_template`), pero eso depende del estado real de la BD.

---

## Hipótesis 3
> *El merge depende de la posición de los elementos en el arreglo y no de un id estable, por lo que plantillas con distinta cantidad u orden de ítems se degradan.*

### Qué la refutaría

1. Que alguna sección empareje por una clave estable (un id, un tipo, una etiqueta) en lugar de por índice.
2. Que la degradación no ocurra: que los ítems sobrantes de la plantilla se conserven, o que los estilos sean homogéneos y por tanto la posición sea irrelevante en los datos reales.
3. Que exista un id compartido entre plantilla y datos de usuario que *pudiera* usarse y no se use — porque si no existe, la hipótesis propone un arreglo inaplicable.

### Evidencia a favor (archivo:línea, confirmada por mí)

Recorrí las 10 secciones con lista y anoté el criterio de emparejamiento leyendo el código:

| Sección | Emparejamiento plantilla ↔ ítem generado | Id resultante | Evidencia (leída por mí) |
|---|---|---|---|
| Gallery | **ninguno**: `visualGallery.items?.firstOrNull()` es la única fuente de estilo para *todos* los ítems | **reescrito** `gallery-N` | `DefaultConfigGeneratorService.kt:433`, `:438`, `:442-444` |
| Event | posicional `visualEvent.items?.getOrNull(index)`, con cascada a `styleSourceItem` y `styleSourceSingle` | id de plantilla, si no `UUID.randomUUID()` | `:527`, `:529`, `:646`, `:648`, `:492-493` |
| GiftTable | **por tipo inferido** (`resolveTemplate`), posicional sólo como último recurso | id de la plantilla emparejada | `:1029-1050`, `:1281` |
| Family (no boda) | **por texto del título** (`contains("Padre"/"Padrino")`); dentro del grupo `getOrNull(index) ?: firstOrNull()` | id del ítem de plantilla, si no `p-N`/`gp-N` | `:1685`, `:1703`, `:1687`, `:1694`, `:1705`, `:1712` |
| Family (boda) | posicional puro: `items[0]` novio, `items[1]` novia, `drop(2)` padrinos | id de plantilla; padrinos **reescritos** `f{2+index}` | `:1747-1748`, `:1773-1774`, `:1799`, `:1813` |
| Amenities | posicional `getOrNull(index) ?: firstOrNull()` | **reescrito** `amenities-N` / `amenities-default-N` / `amenities-img-N` | `:1864`, `:1880`, `:1910-1911`, `:1934-1935` |
| Suggestions | posicional `getOrNull(index) ?: firstOrNull()` | id de plantilla preservado | `:2116`, `:2136`, `:2150`, `:2184` |
| Story | posicional `visualStory.items.getOrNull(index)` | id de plantilla, si no UUID | `:2219`, `:2221` |
| DressCode | posicional fijo: `items.getOrNull(0)` = mujer, `getOrNull(1)` = hombre | id de plantilla, si no UUID | `:2288-2311`, `:2346` |
| Couple | `images.people` por índice 0/1 (contenido); personas reales por `gender` | campos fijos, sin lista | `:290`, `:360`, `:366`, `:314-315` |

Degradación verificada en el código: el tamaño de la lista de salida lo dicta **siempre** la fuente ganadora (usuario o contenido), nunca la plantilla — `galleryUrls.mapIndexed` (`:436`), `userItinerary.mapIndexed` (`:526`), `userGiftRegistry.mapIndexed` (`:1052`), `userActivities.mapIndexed` (`:1862`), `userStory.mapIndexed` (`:2218`). Con menos datos que ítems de plantilla, las tarjetas sobrantes **se pierden**; con más, los extra heredan el estilo del ítem 0 y reciben un UUID o un id duplicado.

### Evidencia en contra / contraejemplos

1. **Dos secciones escapan de la posición, y una de ellas es la que más lo necesitaba.** `resolveTemplate` (`:1029-1050`) empareja las mesas de regalo **por tipo**: `visualGiftTable.items.firstOrNull { inferTemplateType(it) == itemType }`, con una heurística de respaldo que infiere el tipo del texto del cuerpo (`inferTemplateType`, `:1000-1023`, busca "banco", "titular", "clabe", "tarjeta", "cuenta"). La posición sólo entra en `:1049` si nada empareja. Esta sección es **inmune** a que el usuario reordene o cambie la cantidad de sus mesas.
2. `mergeFamilySection` en la rama no-boda (`:1683-1723`) empareja por el **texto del título** del grupo y, crucialmente, itera sobre `visualFamily.items.map { ... }`: **conserva el número de grupos de la plantilla**. Es la única sección que no deja caer ítems de plantilla por tener menos datos.
3. **La alternativa que propone la hipótesis no es aplicable al join principal.** El merge une *ítem de plantilla* (Mongo, ids `event-1`, `g1`, `s1`, `f0`) con *fila del usuario* (Postgres, ids autoincrementales sin ninguna relación con los anteriores). **No existe un id compartido** que pudiera usarse en lugar de la posición; por eso las dos secciones que escaparon lo hicieron con una clave *semántica* (tipo, título), no con un id. La hipótesis plantea una falsa dicotomía para ese join.
4. **La degradación por posición hoy no se nota en la galería, y lo medí.** Comparé, en los 13 JSON de plantilla del repo, cuántas firmas estructurales distintas tienen los ítems de cada sección (eliminando `id`, `content` y `label`):

  | Archivo | Gallery | Event | GiftTable | Suggestions | Amenities |
  |---|---|---|---|---|---|
  | `default_visual_bautizo.json` | 4 ítems / **1 única** | 2/2 | 2/2 | 3/1 | 1/1 |
  | `default_visual_boda_basico.json` | 3 / **1** | 3/3 | 2/2 | 3/3 | 1/1 |
  | `default_visual_boda_premium.json` | 6 / **1** | 3/3 | 4/4 | 3/3 | 1/1 |
  | `default_visual_boda_premium_2.json` | 6 / **1** | 2/2 | 3/3 | 4/1 | 4/1 |
  | `default_visual_comunion.json` | 4 / **1** | 2/2 | 2/2 | 3/1 | 1/1 |
  | `default_visual_confirmacion.json` | 4 / **1** | 2/2 | 2/2 | 3/1 | 1/1 |
  | `default_visual_cumpleanos.json` | 4 / **1** | 2/2 | 2/2 | 3/1 | 1/1 |
  | `default_visual_evento.json` | 4 / **1** | 2/2 | 2/2 | 3/1 | 1/1 |
  | `default_visual_xv_premium.json` | 4 / **1** | 2/2 | 4/4 | 4/4 | 1/1 |
  | `payload-template-2.json` | 6 / **1** | 2/2 | 3/3 | 4/1 | 4/1 |
  | `payload-template-boda-3.json` | 6 / **1** | 4/4 | 3/3 | 4/2 | 4/4 |
  | `payload-template-graduacion.json` | 12 / **1** | 4/4 | 3/3 | 6/2 | 3/1 |
  | `payload-template-xv-2.json` | 4 / **2** | 7/7 | 3/3 | 3/1 | 4/1 |

  Lectura: **en 12 de 13 plantillas todos los ítems de galería son estructuralmente idénticos**, así que colapsarlos al estilo del ítem 0 (`:433`) hoy no cuesta nada visual. La única excepción es `payload-template-xv-2.json` (el *payload* de la plantilla 12), con 2 firmas distintas: ahí sí se degradaría. En cambio los ítems de **evento son heterogéneos en las 13 plantillas** (N ítems / N firmas), así que ahí la posición sí es portadora de diseño y la degradación es real.

### Veredicto y matices

**PARCIAL.**

- "Depende de la posición": **CONFIRMADO para 7 de 10 secciones**, refutado para mesa de regalos (por tipo) y familia no-boda (por texto), e inaplicable a la galería (que no empareja: colapsa todo al ítem 0, que es *peor* que posicional).
- "Y no de un id estable": **REFUTADO en su premisa implícita** para el join plantilla↔usuario, donde no existe id compartido. Pero **exactamente cierto** en el único sitio donde sí lo hay: `InvitationConfigService.syncGiftRegistryTitles` (`:186-188`) casa `sectionGiftTable.items[index]` con `existingGiftRegistry[index]` por índice, **teniendo** `GifttableItem.id` disponible en un lado y el id de la fila en el otro, y sobre un `findAllByInvitationId` sin `ORDER BY`. Ese es el caso donde la hipótesis acierta de lleno.
- "Se degradan": **CONFIRMADO como hecho de código** (la lista de salida siempre la dicta la fuente ganadora), pero la magnitud real depende de la homogeneidad de la plantilla, y la medí: nula en galería hoy (12/13), real en evento (13/13).
- **Matiz propio que añade a C2**: el emparejamiento por tipo de la mesa de regalos, siendo mejor idea, introduce su propio fallo — `firstOrNull` (`:1030`) devuelve **siempre el primer** ítem de ese tipo, y verifiqué que **dos** plantillas sembradas tienen ítems duplicados de tipo `digital`: `default_visual_boda_premium.json` (`s1`, `s4`) y `default_visual_xv_premium.json` (`s1`, `s4`). Dos mesas digitales del usuario producen dos `GifttableItem` con `id = "s1"` y `s4` nunca se usa. C2 (hallazgo 3) sólo señaló la plantilla 5; la 6 tiene el mismo defecto.

---

## Hipótesis 4
> *Existe código muerto/comentado significativo conviviendo con la versión viva, y no es evidente cuál se ejecuta.*

### Qué la refutaría

1. Que el volumen de código muerto sea marginal.
2. Que sí sea evidente cuál se ejecuta — porque el muerto está comentado (y el compilador de Kotlin nunca lo ve), o porque hay marcas claras.

### Evidencia a favor (archivo:línea, confirmada por mí)

Medición propia sobre `DefaultConfigGeneratorService.kt`:
- **607 de 2744 líneas (22,1 %) empiezan por `//`.**
- **36 bloques contiguos de ≥5 líneas comentadas**, que suman 506 líneas. Los grandes: `829-976` (versión antigua de `mergeGiftTableSection`), `1302-1636` (`mergeFamilySection` antigua, con `getSubItemTemplate` en 1331 y `getGroupTemplate` en 1335), `1957-2060` (`mergeSuggestionsSection` antigua), `1221-1248` (layout de banco alternativo), `58-68` (resolución de contenido anterior).
- **Funciones definidas y nunca llamadas** (grep propio sobre todo `src/main/`, resultado literal):
  - `buildTimeRange` (`:774`) — **1 sola aparición en todo el proyecto**: su propia definición.
  - `getFallbackFamilyText` (`:1844`) — **1 sola aparición**: su definición.
  - `createDefaultFamilyItem` (`:1828`) — 10 apariciones, **9 dentro de comentarios** (`:1353, 1362, 1380, 1389, 1434, 1471, 1511, 1566, 1587`).
  - `createDefaultFamilyGroup` (`:1837`) — 6 apariciones, **5 dentro de comentarios** (`:1442, 1479, 1521, 1604, 1621`).
- **Las versiones comentadas tienen semántica distinta de las vivas**, lo cual convierte su lectura en desinformación activa. Verifiqué el caso más caro: `grep -n "contentTemplate.giftRegistry"` sobre el archivo devuelve **una única línea, la 902, comentada**. Es decir, la versión viva **eliminó** el respaldo a la mesa de regalos por defecto; y `:1291-1294` perdió además el `?: visualGiftTable.title.content` que la comentada sí tenía en `:972`. Confirmo así los hallazgos 1 y 25 de C2.

### Evidencia en contra / contraejemplos

**La consecuencia — "no es evidente cuál se ejecuta" — es la parte débil de la hipótesis.**

1. Para el código comentado, **sí es evidente**: cada línea empieza por `//`, y Kotlin no compilaría dos funciones con la misma firma en la misma clase, así que sólo una puede estar viva por construcción.
2. Tres de las funciones muertas (`buildTimeRange`, `getFallbackFamilyText`, y en la práctica `createDefaultFamilyItem`/`Group`) son `private` y sin uso: el compilador de Kotlin emite un aviso de "never used" para cada una. La señal existe; lo que falta es que alguien la lea.

Pero al buscar el contraejemplo encontré que **el problema real es peor y está en otro sitio**: hay código muerto que **no está comentado** y para el que no hay ninguna señal.

1. **Ramas idénticas.** `usesSplitBankLayout` (`:1025-1027`, `body.size >= 6`) decide entre dos `listOf(...)`. Los diferencié yo mismo, normalizando espacios y quitando comentarios: `sed -n '1157,1187p'` vs `sed -n '1190,1220p'` → **IDÉNTICAS**. La única diferencia entre las dos ramas del `if` es un bloque de 28 líneas **comentado** (`:1221-1248`). La función se calcula y no cambia nada. Mismo patrón, más pequeño, en `:627-633` y `:746-752`: `if (item.eventLocation.contains("(Dale clic")) item.eventLocation else "${item.eventLocation}"` — ambas ramas producen el mismo `String`.
2. **Ramas duplicadas byte a byte.** Diferencié `:2380-2490` (`"predefined"`) contra `:2493-2602` (`"standard"`) sustituyendo sólo el nombre de la variable local: **IDÉNTICAS**, ~110 líneas.
3. **Código inalcanzable por early-return, sin comentar.** Lo verifiqué leyendo las dos funciones:
   - `mergeStorySection`: `:2212-2214` retorna si `userStory.isEmpty()`, así que `:2217 if (userStory.isNotEmpty())` es siempre verdadero y `:2240-2266` está muerto. Consecuencia funcional: **`contentTemplate.story` no se usa jamás** (grep propio: sus dos únicas apariciones son `:2240-2241`).
   - `mergeDressCodeSection`: `:2281` retorna si `userDressCode == null`, así que `:2341 if (userDressCode != null)` es siempre verdadero (smart-cast) y `:2608-2659` está muerto.
4. **Hallazgo propio, y el peor de todos: código muerto que ninguna lectura del fuente revela.** `SectionEventData.itemsSinglePlace` lleva `@get:JsonIgnore` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/editor/EditorModels.kt:234-235`). Comprobé empíricamente (ver Hipótesis 5) que esa anotación bloquea también la **deserialización**: `itemsSinglePlace` siempre llega `null`. Por tanto `val styleSourceSingle = visualEvent.itemsSinglePlace?.firstOrNull()` (`:493`) es **siempre null** y las **17 referencias** a `styleSourceSingle` (`:535, 546, 567, 589, 602, 611, 621, 636, 654, 665, 686, 708, 721, 730, 740, 755` más la asignación en `:493`) son un escalón de la cascada de estilos que nunca se ejecuta. Y `EventSinglePlaceCard` (`EditorModels.kt:255-261`) es una clase inalcanzable. Nada en el fuente lo delata: hay que conocer la semántica de `@get:JsonIgnore` en Jackson.

### Veredicto y matices

**PARCIAL.**

- Premisa "código muerto/comentado significativo conviviendo con la versión viva": **CONFIRMADA y cuantificada** (22,1 % de líneas comentadas; 3 funciones enteras duplicadas; 4 funciones nunca llamadas).
- Consecuencia "no es evidente cuál se ejecuta": **REFUTADA para el código comentado** — es trivialmente evidente, y el compilador avisa de las funciones privadas sin uso. **CONFIRMADA, y agravada, para otras cuatro clases de código muerto sin comentar** (ramas idénticas, duplicación byte a byte, inalcanzabilidad por early-return, y muerte por anotación Jackson), donde **no hay ninguna señal**.
- **Reformulación que sí se sostiene**: el riesgo no es confundirse sobre *cuál* se ejecuta; es (a) creer que el comentado describe el comportamiento actual cuando codifica una **regla de precedencia distinta** — el caso de `contentTemplate.giftRegistry`, eliminado en la versión viva, es el ejemplo caro — y (b) el código vivo que parece decidir algo y no decide nada.

---

## Hipótesis 5
> *Los JSON de plantilla y el modelo Kotlin no están alineados: hay campos del frontend que el backend descarta al deserializar.*

### Qué la refutaría

Que un *round-trip* (JSON → modelo Kotlin → JSON) devuelva el mismo conjunto de claves que el original, en los 13 ficheros de plantilla del repo y por las dos rutas de entrada (sembrador y API).

### Prueba empírica que hice (no reutilizo la de J ni la de X)

Compilé con `kotlinc 1.9.25` un arnés propio (`h-tools/src/RoundTrip.kt`, `Probe2.kt`, `RT2.kt`, `RT3.kt`) usando la copia fiel de `EditorModels.kt` (verifiqué con `diff` que sólo difiere del original en los tres imports y las tres anotaciones de Spring Data: `@Document`, `@Id`, `@Indexed`) y una copia de `DefaultContentConfig.kt` sin anotaciones de Spring Data, contra jackson-databind/-core/-annotations y jackson-module-kotlin **2.18.2** (las versiones que resuelve el proyecto). Para cada fichero: deserializar con el mapper de Spring (`FAIL_ON_UNKNOWN_PROPERTIES=false`), reserializar y comparar el conjunto de rutas estructurales de claves contra el original (`h-tools/cmp.py`, `cmp2.py`, `cmp3.py`).

### Evidencia a favor (archivo:línea, confirmada por mí)

**El round-trip encontró exactamente cuatro rutas de campo que se pierden. Ninguna es una falsa alarma de `@JsonInclude`, porque comparé presencia de clave, no valor.**

**(1) `config.sectionEvent.itemsSinglePlace` — el caso grave, y ningún informe de la Ola 1 lo detectó.**

`EditorModels.kt:234-235` declara:
```kotlin
    @get:JsonIgnore
    val itemsSinglePlace: List<EventSinglePlaceCard>? = null
```
Medición directa (`h-tools/src/Probe2.kt`), con los dos mappers reales:
```
default_visual_boda_premium.json  lenient(Spring)  JSON.itemsSinglePlace=3 elems -> modelo.itemsSinglePlace=null
default_visual_boda_premium.json  strict(seeder)   JSON.itemsSinglePlace=3 elems -> modelo.itemsSinglePlace=null
default_visual_boda_basico.json   lenient(Spring)  JSON.itemsSinglePlace=2 elems -> modelo.itemsSinglePlace=null
default_visual_boda_basico.json   strict(seeder)   JSON.itemsSinglePlace=2 elems -> modelo.itemsSinglePlace=null
```
**Prueba de causalidad** (control): recompilé el mismo arnés con una única línea cambiada — `@get:JsonIgnore` comentada — y el resultado se invierte:
```
default_visual_boda_premium.json  lenient(Spring)  JSON.itemsSinglePlace=3 elems -> modelo.itemsSinglePlace=3
default_visual_boda_basico.json   lenient(Spring)  JSON.itemsSinglePlace=2 elems -> modelo.itemsSinglePlace=2
```
Es decir: `@get:JsonIgnore` sobre el *getter* de un parámetro de constructor bloquea la propiedad **en ambos sentidos**, no sólo en la serialización. Confirmé por `python3` que las tarjetas existen realmente en el JSON: 3 en `default_visual_boda_premium.json` (templateId 5) y 2 en `default_visual_boda_basico.json` (templateId 4); ausente en los otros 11 ficheros.

Consecuencias, todas verificadas en código:
- El documento que `MongoDataInitializer.kt:81-90` escribe en `default_visual_configs` **nunca contiene** esas tarjetas: el objeto que persiste es el ya deserializado.
- `DefaultConfigGeneratorService.kt:493` (`styleSourceSingle`) es siempre `null`, y con él sus 17 usos (ver Hipótesis 4).
- `EventSinglePlaceCard` (`EditorModels.kt:255-261`) es inalcanzable, y es además una de las 10 clases sin `@JsonIgnoreProperties`.
- `DefaultConfigGeneratorService.kt:769` fija `singleplace = invitation.allEventsSameLocation`, de modo que el frontend puede recibir `singleplace: true` sin que exista ni pueda existir ninguna tarjeta de lugar único.

**(2) `config.sectionSuggestions.items[].type`** en `default_visual_xv_premium.json` (4 ítems). No existe en `SuggestionItem` (`EditorModels.kt:352-358`) pero sí en `GifttableItem` (`:327-334`). Se descarta en silencio porque `SuggestionItem` **sí** lleva `@JsonIgnoreProperties(ignoreUnknown = true)`. Confirmo el hallazgo 5 de J.

**(3) `contentConfig.itinerary[].locationButton` y `.locationDatetime`** en `payload-template-graduacion.json` y `payload-template-xv-2.json` (ruta API). `DefaultItineraryItem` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/user/invitations/model/defaults/DefaultContentConfig.kt:183-218`) declara sólo `eventName, eventLocation, startTime, endTime, eventMapsUrl, icon, date`. Pero **`EventCard` sí tiene esos dos campos** (`EditorModels.kt:248-249`: `locationButton`, `locationDatetime`) y el generador los lee de la plantilla visual (`DefaultConfigGeneratorService.kt:640-641`, `:759-760`). Resultado: el contenido por defecto **no puede** poblarlos, por diseño accidental. Ejemplo real del ítem descartado:
```json
{ "eventName": "PARTIDA DE BUSES", ..., "locationButton": "UBICACIÓN",
  "locationDatetime": "Jueves 05 / 5:30 pm. - 6:30pm." }
```
Este hallazgo es mío; ningún informe de la Ola 1 lo recoge.

**(4) `story[].image`** en `default_content_evento.json`. `DefaultStoryItem` (`DefaultContentConfig.kt:360-375`) tiene sólo `title`, `date`, `description`. Moot en la práctica porque `contentTemplate.story` está en código inalcanzable (ver Hipótesis 4), pero es un descarte real.

Además, `_comment` en `default_content_cumpleanos.json`, `default_content_evento.json` (raíz) y en `default_content_evento.json.parents` — descarte intencional y correcto.

### Evidencia en contra / contraejemplos

1. **El volumen es pequeño y el resto está impecablemente alineado.** En 13 ficheros de plantilla × 13 secciones, el round-trip no encontró **ninguna otra** clave perdida. Confirmo la valoración positiva de J: la disciplina de sincronización dato↔modelo es alta.
2. **El caso que la hipótesis probablemente tenía en mente — `invitationId` ausente — no es un descarte y no rompe nada.** Ya refutado empíricamente por J §7 y por X (§3, variante i: 9/9 OK con `invitationId = 0`); lo reproduje en mi propio arnés: los 9 ficheros deserializan sin excepción, y `config.templateId` queda `null`, valor que `DefaultConfigGeneratorService.kt:83-87` refija.
3. **Ninguna de las 10 clases sin `@JsonIgnoreProperties`** (`InvitationConfig`:13, `ModelSettings`:44, `ModelPropertiesIcon`:113, `ModelEditIcon`:125, `ModelPropertiesItem`:135, `ModelEditItem`:147, `BackgroundColor`:161, `DateItem`:183, `EventSinglePlaceCard`:255, `SmallText`:492 — conté yo mismo: 26 clases con anotación, 10 sin ella) recibe hoy ninguna clave desconocida. Es fragilidad latente, no fallo activo.

### Veredicto y matices

**CONFIRMADA.**

- Hay campos presentes en los JSON de plantilla que el backend **descarta al deserializar**: cuatro rutas distintas, verificadas empíricamente por round-trip y no por lectura.
- **Matiz de magnitud**: es un desalineamiento *pequeño en número* (4 rutas en 13 ficheros) pero **no menor en efecto**. `itemsSinglePlace` no es una clave suelta: es una lista de 3 y 2 tarjetas completas en las dos plantillas de boda, y su descarte deja muerta una funcionalidad entera del generador (17 referencias) y una clase del modelo.
- **Matiz de causa**: sólo uno de los cuatro descartes se debe a "el modelo no conoce el campo" en el sentido habitual; el grave se debe a una **anotación mal colocada** (`@get:JsonIgnore` sobre un parámetro de constructor), que es un problema distinto y de arreglo distinto.
- Los dos `ObjectMapper` del sistema se comportan **igual** en los cuatro casos, así que el descarte no depende de la vía. La asimetría verificada por X y J (`FAIL_ON_UNKNOWN_PROPERTIES` `true` en el sembrador, `false` en la API) sigue siendo real, pero no interviene aquí.

---

## Hipótesis 6
> *Hay múltiples caminos de alta (SQL, seed, API, scripts) que no producen el mismo resultado.*

### Qué la refutaría

Que los caminos converjan: que produzcan la misma fila de Postgres y el mismo documento de Mongo, o que unos sean estrictamente complementarios de otros sin solaparse.

### Evidencia a favor (archivo:línea, confirmada por mí)

Los caminos existen y los abrí uno a uno. Matriz de divergencia — cada celda verificada por lectura del código citado (salvo las dos marcadas INFERIDO):

| | V1 (`COPY`) | V24/V25 (`INSERT`) | `MongoDataInitializer` | `POST /master/templates` | `POST /master/templates/complete` | `upsert_template_11_12.js` |
|---|---|---|---|---|---|---|
| Fila Postgres | sí, ids 4-5 | sí, ids 6-10 | **no** | sí | sí | **no**: sólo `UPDATE` |
| `name` | **cadena vacía** | poblado | — | **cadena vacía** (el request no tiene campo `name`) | poblado | poblado (por `UPDATE`) |
| `created_by` | null | null | — | `userId` | `userId` | — |
| Doc `default_visual_configs` | no | no | **upsert por `templateId`** (destructivo) | **no** | **insert siempre** (id null) | **upsert por `templateId`** |
| `config.templateId/eventId/planId` dentro del doc | — | — | **`null`** | — | **poblados** | **poblados** |
| `config.invitationId` | — | — | `0` | — | `0` | `0` |
| `itemsSinglePlace` sobrevive | — | — | **no** (Jackson lo descarta) | — | **no** | **sí** (JSON crudo, sin Jackson) |
| `_class` en el documento | — | — | sí | — | sí | **no** (`updateOne`) — INFERIDO |
| Doc `default_content_configs` | no | no | sí, con `templateId = null` | no | sí con `templateId`, o **ninguno propio** en modo *reuse* | sí, con `templateId` |
| Idempotente | `ON CONFLICT DO NOTHING` | `ON CONFLICT DO NOTHING` | sí (upsert) | **no** | **no** | sí (upsert) |

Citas de respaldo:
- `src/main/resources/db/migration/V1__initial_schema.sql:1133-1135` (ids 4 y 5; el campo `name` está **vacío** en el `COPY`, entre `is_enabled` y `price`) y `:1385` `setval(...,5)`.
- `V24__add_new_event_types_and_xv_template.sql:10-17` y `V25__add_remaining_templates.sql:2-10` (`setval(...,10)`).
- `MongoDataInitializer.kt:34-58` (listas cableadas, dos entradas comentadas en `:36` y `:50`), `:83-90` (upsert visual destructivo: `config.copy(id = existing.id)` + `save`), `:106-123` (contenido: upsert si hay `templateId`, si no **skip-if-exists**).
- `MasterTemplatesService.kt:35-70` (vía sin Mongo) vs `:84-197` (vía completa; inyección de los 4 campos en `:116-121` y de nuevo en `:131-136`).
- `scripts/apply_template_11_12_local.sh:29-53` — **sólo `UPDATE ... WHERE id=11/12`**, ni un `INSERT`, pese a que su cabecera (`:4`) dice "Aplica el alta/correccion". Confirmo el hallazgo 8 de B.
- `scripts/upsert_template_11_12.js:22-32` inyecta `templateId/eventId/planId/invitationId` dentro de `visualConfig` y `:36-68` escribe con `updateOne(..., {upsert: true})` el **JSON crudo**, sin pasar por Jackson.
- Que el sembrador deja `config.templateId = null` está **verificado empíricamente** (mi arnés y la sonda de X: `config.templateId=null` en los 9), no inferido.

### Evidencia en contra / contraejemplos

1. **No es cierto que *ninguna* pareja coincida** (así lo formula B en su §1). V24 y V25 son estructuralmente idénticos entre sí (`INSERT` con id explícito + `ON CONFLICT (id) DO NOTHING` + `setval`).
2. `scripts/create_complete_template.sh:87-90` **no es un séptimo camino**: es un envoltorio de `curl` sobre `POST /master/templates/complete`, y produce por construcción exactamente su mismo resultado. Lo leí entero: sólo compone el JSON con `jq` y lo envía. (Nota lateral: incrusta credenciales de MASTER en `:5-6`.)
3. Los caminos SQL y el sembrador son **complementarios por diseño**, no alternativas: uno crea la fila relacional y el otro el documento de Mongo. La divergencia real está entre {SQL+seed} y {API} y {script mongosh}.
4. La divergencia de `config.templateId/eventId/planId` es **funcionalmente inocua en la generación**, porque `DefaultConfigGeneratorService.kt:83-87` los refija desde la invitación (esto lo verificó X §5 y lo confirmé leyendo esas líneas). Sólo afecta a un consumidor que leyera `default_visual_configs` directamente.
5. La corrección del brief: la premisa habla de "migraciones SQL (V2/V24/V25)", pero **V2 no da de alta ninguna plantilla**: mi grep de `invitation_template` sobre las 28 migraciones devuelve sólo V1, V9, V13, V24 y V25, y V2 (`V2__add_initial_data_and_customer_fields.sql`) sólo inserta filas en `customer`.

### Veredicto y matices

**CONFIRMADA.**

- Los caminos existen (5 reales + 1 envoltorio) y divergen en **9 dimensiones verificadas**. La divergencia más sorprendente es la que descubrí con la Hipótesis 5: el script `mongosh` es el **único** camino que puede preservar campos que Jackson descarta (escribe JSON crudo), lo que significa que "el mismo JSON" produce documentos **distintos** según se cargue por classpath, por API o por `mongosh`.
- **Matices que la acotan**: (a) V24≡V25 y `create_complete_template.sh`≡API, así que "ninguna produce el mismo resultado" es demasiado fuerte; (b) parte de la divergencia (los tres campos dentro de `config`) es inocua para la generación; (c) los caminos SQL y seed son complementarios, no competidores.
- La divergencia **que sí duele**, y es la que hace la hipótesis relevante: sólo dos de los cinco caminos escriben el documento visual, así que `POST /master/templates` y `apply_template_11_12_local.sh` pueden dejar una plantilla relacional **sin** configuración visual, y `DefaultConfigGeneratorService.kt:48-54` no tiene fallback alguno para eso.

---

## Hipótesis 7
> *El seed de arranque puede pisar o desincronizar plantillas creadas por API.*

> El brief indica que, de existir, `X-dirimidor-seed.md` manda sobre A y B. Existe, y su veredicto (la siembra **sí** funciona; el Hallazgo #1 de A es falso) es la base de todo lo que sigue: si la siembra no deserializara, esta hipótesis sería vacua. Reproduje su resultado con mi propio arnés antes de usarlo.

### Qué la refutaría

1. Que el seed no sobrescriba (que sea *insert-if-absent*).
2. Que sus `templateId` no puedan colisionar con los que asigna la API.
3. Que, sin colisión de id, el documento sembrado y el creado por API sean equivalentes.

### Evidencia a favor (archivo:línea, confirmada por mí)

- **El upsert visual es destructivo.** `MongoDataInitializer.kt:83-90`:
  ```kotlin
  visualConfigRepo.findByTemplateId(config.templateId).ifPresentOrElse({ existing ->
      val updatedConfig = config.copy(id = existing.id)
      visualConfigRepo.save(updatedConfig)
      logger.info("Plantilla visual para templateId {} actualizada.", config.templateId)
  }, { visualConfigRepo.save(config) ... })
  ```
  `save` con `_id` no nulo **reemplaza el documento entero**; se conserva el `_id`, se pierde todo lo demás. El único rastro es un `logger.info` que dice "actualizada".
- **La colisión de id no es hipotética.** `V25__add_remaining_templates.sql:10` deja `invitation_template_id_seq` en **10** (lo leí). `InvitationTemplateEntity.kt:17` usa `GenerationType.IDENTITY`, así que la API asigna 11, 12, **13**… y `default_visual_evento.json` está sembrado con `templateId = 13` (`MongoDataInitializer.kt:43`; el `templateId` interno lo verifiqué con mi arnés: `OK ... templateId=13`). La **tercera** plantilla creada por API en un entorno recién migrado se pisa a sí misma en el siguiente reinicio. Confirmo el hallazgo 5 de B.
- **No hay ninguna otra forma de corregir una plantilla sembrada.** Mi grep de usos de `defaultVisualConfigRepository` sobre todo `src/main/` devuelve sólo `save` en `MasterTemplatesService.kt:138` (insert de plantilla nueva) y en `MongoDataInitializer.kt:85,88`. `MasterTemplatesService.updateTemplate` (`:246-275`) **no toca Mongo**. Es decir, el mismo mecanismo que pisa es el único que repara: reiniciar la aplicación.
- **Desincronización que ocurre siempre, aun sin colisión.** El documento que escribe el sembrador y el que escribe la API **no tienen la misma forma**, y las dos diferencias están verificadas empíricamente:
  1. `config.templateId/eventId/planId` = `null` por la vía del sembrador (mi arnés y la sonda de X: `config.templateId=null` en los 9) frente a poblados por la API (`MasterTemplatesService.kt:116-121, 131-136`).
  2. `config.sectionEvent.itemsSinglePlace` se pierde por ambas vías Jackson pero **sobrevive** por `upsert_template_11_12.js` (ver Hipótesis 5 y 6).

### Evidencia en contra / contraejemplos

1. **El contenido NO se pisa.** `MongoDataInitializer.kt:118-123`: cuando el JSON no trae `templateId` — el caso de los 9 ficheros de contenido, verificado — la rama es *skip-if-exists*: si ya hay documento para ese `(eventTypeId, planId)`, sólo registra `"…ya existe. Omitiendo."` y no escribe. Un `default_content_configs` creado por la API **no** es sobrescrito por el arranque. La hipótesis, leída como "el seed pisa las plantillas creadas por API", es **falsa para la mitad del par**.
2. **El seed nunca toca `invitation_configs`.** Sus únicas escrituras son a `default_visual_configs` y `default_content_configs` (`:85, 88, 109, 112, 121`); la única operación sobre `invitation_configs` es el índice único (`:65-72`). Las invitaciones ya generadas están **congeladas** (`InvitationConfigService.kt:138`: si existe config, se devuelve tal cual) y no las afecta ningún reinicio.
3. **El alcance del pisado es acotado y enumerable**: exactamente los 8 `templateId` de la lista viva — 5, 4, 6, 7, 8, 9, 10, 13 (`MongoDataInitializer.kt:34-44`, con `default_visual_boda_premium_2.json`/templateId 11 **comentado** en `:36`). Todo lo demás es inmune.
4. Y ese alcance es **estrecho en la práctica**: 4-10 los ocupan las migraciones, así que la única colisión realista con la API es el 13. Si el entorno ya avanzó la secuencia más allá de 13, la colisión es imposible.

### Veredicto y matices

**CONFIRMADA, con matices que cambian bastante su forma.**

- "Pisar": **CONFIRMADO pero acotado**. Sólo lo visual, sólo para 8 ids cableados, en la práctica sólo el 13, y sólo mientras la secuencia esté donde la dejó V25. Que eso haya ocurrido en algún entorno concreto es **NO DETERMINABLE** sin consultar `invitation_template_id_seq`.
- "Desincronizar": **CONFIRMADO y, además, incondicional** — no depende de ninguna colisión. Un documento sembrado y uno creado por API difieren siempre en `config.templateId/eventId/planId`, y un documento escrito por `mongosh` difiere de los dos en qué campos conserva. Ésta es la parte de la hipótesis que se sostiene sin condiciones.
- **Matiz que agrava**: el efecto del pisado no es un cambio uniforme. Como las invitaciones ya generadas quedan congeladas (`InvitationConfigService.kt:138`), tras un pisado las invitaciones **anteriores** al reinicio conservan el diseño de la API y las **posteriores** reciben el del repositorio, ambas bajo el mismo `templateId`. La desincronización no es entre dos almacenes: es entre dos cohortes de invitaciones.
- **Matiz que atenúa**: el upsert es, en su intención, correcto — `config.copy(id = existing.id)` preserva el `_id` de Mongo y evita duplicar documentos al reiniciar. El defecto no está en el upsert sino en que la lista de qué sembrar sea una constante de código y no un dato con dueño.

---

## 8. Citas de la Ola 1 que no pude confirmar o que son erróneas

| Informe | Cita | Qué dice el informe | Qué dice el código | Acción sugerida |
|---|---|---|---|---|
| **J** | §8 hallazgo 7: *"`itemsSinglePlace`/`EventSinglePlaceCard` nunca aparecen poblados en ninguno de los 18 archivos de datos inspeccionados"* | Rama del modelo sin datos, "peso muerto" | **Falso para 2 ficheros**: `default_visual_boda_premium.json` tiene **3** elementos y `default_visual_boda_basico.json` **2** (verificado con `python3` y con mi arnés Jackson). El *peso muerto* es real pero por otra causa: `@get:JsonIgnore` en `EditorModels.kt:234` los descarta al deserializar | Corregir el hecho y sustituir la causa: no es que falten datos, es que la anotación los borra |
| **C1** | Hallazgo 21: *"`itemsSinglePlace` … conserva las tarjetas demo de la plantilla (3 en boda premium, verificado con `jq`)"* | Las tarjetas demo sobreviven en la config generada | La primera mitad es correcta (el JSON las tiene); la conclusión no: `itemsSinglePlace` **nunca se deserializa**, así que la config generada lleva `null`, no las tarjetas demo. Probado con control causal (quitar la anotación → 3 y 2 elementos) | Reescribir el hallazgo: el campo no se serializa **ni se deserializa**; el frontend recibe `singleplace: true` y el backend no puede guardar ninguna tarjeta |
| **C1** | §4, tabla de `mergeEventSection`: la cascada de estilo *"`items[index]` → `items[0]` → `itemsSinglePlace[0]` → defaults"* (y §8, *"degrada con elegancia"*, citando `:533-535, 542-545`) | Tres escalones de respaldo de estilo | El tercer escalón está **muerto**: `styleSourceSingle` (`DefaultConfigGeneratorService.kt:493`) es siempre `null` y sus 17 usos no se ejecutan nunca. La cascada real tiene dos escalones | Corregir la tabla y el apartado "lo que está bien resuelto" |
| **C1** | Hallazgo 17: cita *"`MongoDataInitializer.kt:127-133`"* para el upsert por `(eventTypeId, planId)` | Referencia de línea | El fichero tiene **127 líneas** (más la 128 sin salto final). Las líneas correctas son **`:118-123`** | Corregir la cita |
| **C1** | §8: cita *"el índice reforzado en arranque (`MongoDataInitializer.kt:68-76`)"* | Referencia de línea | `ensureUniqueIndexes()` va de **`:65` a `:72`**; la 76 no existe en esa función | Corregir la cita |
| **C2** | §9-3: los ids duplicados de mesa de regalos se ilustran sólo con `default_visual_boda_premium.json` (`s1`, `s4` de tipo `digital`) | Un solo fichero afectado | **También `default_visual_xv_premium.json`** (templateId 6) tiene `s1` y `s4` con `type: "digital"` (verificado). Y 7 de los 9 ficheros tienen `type: null` en todos sus ítems, así que ahí el emparejamiento depende de la heurística textual de `inferTemplateType` (`:1000-1023`), no del campo `type` | Ampliar el hallazgo a la plantilla 6 y anotar la dependencia de la heurística en las otras 7 |
| **A** | Hallazgo #1: la siembra visual falla por `invitationId` ausente | Fallo activo | Ya refutado por J §7 y por X §3, y reproducido por mí: los 9 ficheros deserializan con `invitationId = 0` | Reclasificar como riesgo latente (se activa con `FAIL_ON_NULL_FOR_PRIMITIVES`), como propone X |
| **B** | §5: *"pierde de paso `config.templateId/eventId/planId`"*, marcado como inferencia | Inferido | **Confirmado empíricamente** por X y por mi propio arnés (`config.templateId=null` en los 9) | Promover de inferido a verificado |
| **Brief** (no es cita de la Ola 1) | *"Alta de plantillas: migraciones SQL (V2/V24/V25)"* | V2 da de alta plantillas | `V2__add_initial_data_and_customer_fields.sql` **no menciona `invitation_template`**; sólo inserta filas en `customer`. Las migraciones que insertan plantillas son **V1, V24 y V25** | Corregir la premisa del encargo |

Todo lo demás que verifiqué de la Ola 1 resultó **correcto**: la refutación de D sobre `EmailGuestNotifier` (`src/main/kotlin/mx/evolutiondev/invitaciones/modules/shared/guests/notifier/EmailGuestNotifier.kt:65` calcula `templateId` y `:68` devuelve una URL sin él, con la versión que usa `frontendUrl` comentada en `:69`); la corrección de C2 sobre el cierre de la clase en 2744; los bloques comentados y las funciones muertas de C1/C2; la ausencia de `throw InvitationConfigNotFoundException` en todo el repo con handler registrado en `GeneralExceptionHandler.kt:175-177` (D, hallazgo 3); la ausencia de `INSERT INTO invitation_template` en V26 (B, §7); y el método muerto `DefaultContentConfigRepository.findByEventTypeIdAndPlanIdAndTemplateId` (`:37-41`, A hallazgo 8).

---

## 9. Lo que no pude determinar y por qué

1. **Si alguno de los estados inconsistentes de la Hipótesis 2 existe hoy.** Los cuatro caminos son código vivo y alcanzable, pero contar huérfanos en `default_visual_configs`/`invitation_configs`, o filas de `invitation_template` sin documento, exige la base de datos real. La evidencia circunstancial (los ids 11, 12, 16 y 17 que manipulan los scripts y que **ninguna** migración crea) es fuerte pero no es prueba.
2. **El valor actual de `invitation_template_id_seq` en cada entorno.** De él depende que la colisión con el `templateId` 13 de la Hipótesis 7 ya haya ocurrido, esté por ocurrir o sea imposible. Las migraciones lo dejan en 10 (`V25:10`), pero cada `POST` posterior lo avanza, incluidos los que terminan en rollback.
3. **Si existen los índices únicos en Mongo.** El código sólo crea explícitamente el de `invitation_configs.invitationId` (`MongoDataInitializer.kt:65-72`, y dentro de un `catch (e: Exception) {}` **vacío** en `:71`). Los `@Indexed(unique = true)` de `DefaultVisualConfig` no se materializan sin `spring.data.mongodb.auto-index-creation`, ausente de `application.yml` (verificado por grep propio: el bloque `mongodb` de `:47-48` sólo define `uri`). Requiere `db.default_visual_configs.getIndexes()` contra el entorno real.
4. **Si `_class` está realmente ausente en los documentos escritos por `upsert_template_11_12.js`.** Es lo esperable (`updateOne` con `$set` no lo añade y Spring Data lo escribe por su `MappingMongoConverter`), pero no ejecuté Mongo. Marcado INFERIDO en la matriz de la Hipótesis 6.
5. **El impacto visual real** de los descartes de la Hipótesis 5 y de las degradaciones de la Hipótesis 3. Puedo probar qué produce el backend y qué traen las plantillas; el renderizador no está en este repositorio.
6. **Si el `save()` de Mongo tiene éxito tras la deserialización.** Mi arnés (como el de X) prueba sólo Jackson. El paso `MappingMongoConverter` → BSON no fue ejecutado por falta de una instancia de MongoDB; no hay `src/test` (verificado: `ls src/` → sólo `main`) pese a que `build.gradle.kts` declara `de.flapdoodle.embed.mongo`.
7. **Desde cuándo existe cada bloque comentado y cuál sustituyó a cuál** (Hipótesis 4). El repositorio tiene un único commit; `git log`/`git blame` no aportan nada.
