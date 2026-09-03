# E — Riesgos, deuda y costo operativo

> Convenciones. **VERIFICADO POR MÍ** = abrí el archivo y confirmé la línea en esta fase.
> **VERIFICADO (origen X)** = lo tomo de un informe de la Ola 1 y comprobé la cita.
> **INFERIDO** = deducción lógica sobre código verificado.
> **NO DETERMINABLE** = depende del estado real de Postgres/Mongo/S3, no del repositorio.
> Todas las rutas son relativas a la raíz del repo. `X-dirimidor-seed.md` **sí existía** al escribir esta
> sección: su veredicto (la siembra de `default_visual_*` funciona, `invitationId` ausente → `0L`) manda y
> está incorporado.
> El código de `src/main` sigue teniendo **un solo commit** (`git log --oneline -- src/main` → `d142778`);
> los otros 6 commits del repo son los informes de esta misma auditoría. Ninguna afirmación temporal
> ("esto se comentó antes que aquello") es verificable.

---

## 1. Resumen (≤10 líneas)

El subsistema no falla ruidosamente: falla **en silencio y en producción**. De los 20 modos de fallo catalogados, 13 no lanzan ninguna excepción — publican una sección vacía, el texto de la pareja de demo, o descartan lo que el usuario capturó. Los cuatro más graves son: (a) el emparejamiento de la sección familia por el **texto** del título (`DefaultConfigGeneratorService.kt:1685,1703`), que falla en **5 de las 6 plantillas sembradas que alcanzan esa rama** (las no-boda; hay 8 sembradas en total) porque sus títulos son `null` — verificado con los JSON reales — y tira a la basura los padres y padrinos capturados; (b) `mergeStorySection`/`mergeFamilySection` devolviendo los **datos de demo de la plantilla** ("Raul Estrada Santiago", "Teresa Lopez") cuando el usuario no rellenó nada, en cada cliente Premium; (c) la mesa de regalos **vacía y forzada a visible**; (d) la desincronización permanente Postgres→Mongo, sin ninguna ruta de regeneración. Agregar una plantilla hoy cuesta **3 archivos versionados + 1 edición de Kotlin + 1 reinicio + 2 sistemas fuera de Git**, con **≥12 decisiones humanas** no documentadas en ningún sitio; agregar un tipo de evento cuesta **6 tablas de catálogo** y, si el evento es tipo boda, **una edición obligatoria del generador** por un `eventTypeId == 1L`. La deuda está concentrada: **607 de 2743 líneas (22,1%) del generador son código comentado**, hay 4 funciones muertas, 2 ramas `if` con brazos idénticos byte a byte, ~79 líneas inalcanzables y **cero tests** con 7 dependencias de test declaradas.

---

## 2. Catálogo de modos de fallo

| # | Modo de fallo | Precondición | Manifestación para el usuario final | Severidad | Probabilidad (y por qué) | Evidencia | Informe origen |
|---|---|---|---|---|---|---|---|
| 1 | **Plantilla visual faltante** | Existe fila `invitation_template` con id N pero no hay documento en `default_visual_configs` con `templateId = N`. Riesgo real para ids 11, 12, 14 (ninguno sembrado; el JSON de 11 está **comentado**) | La invitación **no se puede abrir en el editor**. `GET /user/invitations/{id}/config` → **HTTP 500 genérico de Spring** (no el `ErrorMessage` de la API): la `DefaultVisualTemplateNotFoundException` la traga el `catch (e: Exception)` del llamador y se relanza como `IllegalStateException`, tipo sin `@ExceptionHandler` | **ALTA** | **Media.** Depende de que alguien cree la fila Postgres sin la contraparte Mongo; el propio repo demuestra que ya pasó (ids 11/12/16/17 sin migración). NO DETERMINABLE si hoy hay alguna | `DefaultConfigGeneratorService.kt:47-54` (`orElseThrow`, sin fallback); `InvitationConfigService.kt:158-163`; `MongoDataInitializer.kt:36` (entrada del tid 11 comentada); `GeneralExceptionHandler.kt` — 19 `@ExceptionHandler`, ninguno para `IllegalStateException` (**verificado por mí**) | A#4, B#7, C1#20, X§5 |
| 2 | **Contenido por defecto faltante** | No hay documento en `default_content_configs` ni por `templateId` ni por `(eventTypeId, planId)` | Idéntico al #1: 500 genérico, editor inaccesible | **ALTA** | **Baja.** Hay fallback por `(eventTypeId, planId)` y los 8 pares sembrados cubren evento 1-7. Solo se dispara con un `event_type`/`plan` nuevo sin contenido | `DefaultConfigGeneratorService.kt:69-79` | C1§2 |
| 3a | **Duplicados en `default_visual_configs` con el mismo `templateId`** | 2+ documentos con el mismo `templateId` (posible: el índice `@Indexed(unique=true)` de `DefaultVisualConfig.kt:23` **no se materializa** — `spring.data.mongodb.auto-index-creation` está ausente del `application.yml`, verificado por mí; y `ensureUniqueIndexes()` solo crea el de `invitation_configs`) | La plantilla deja de generar: `findByTemplateId` devuelve `Optional` sobre una consulta de cardinalidad no garantizada → `IncorrectResultSizeDataAccessException` → mismo 500 del #1, para **todas** las invitaciones de esa plantilla | **ALTA** | **Media.** Cada `POST /master/templates/complete` inserta un documento nuevo (`id=null`, `MasterTemplatesService.kt:138`, **verificado por mí**); dos POST iguales bastan si además el id se reutiliza. NO DETERMINABLE el estado real | `MongoDataInitializer.kt:65-72` (solo `invitation_configs`, **verificado por mí**); `DefaultVisualConfig.kt:23`; `MasterTemplatesService.kt:138` | A#6, B#9 |
| 3b | **Duplicados en `default_content_configs` con el mismo `(eventTypeId, planId)`** | 2+ documentos, que el diseño **admite explícitamente** (`findFirstByEventTypeIdAndPlanId` — el comentario del repositorio dice "retorna el primero sin explotar si hay múltiples") | Silencioso: la invitación recibe el contenido por defecto **de otra plantilla**, elegido sin `Sort` (orden natural de Mongo). Choque real de claves ya en el repo: `default_content_boda_premium.json` y `default_content_boda_premium_2.json` comparten `(1,2)` | **MEDIA** | **Alta.** Cada plantilla creada por API con `contentConfig` inline añade un documento con la misma pareja (`MasterTemplatesService.kt:147` solo sobrescribe `templateId`) | `DefaultContentConfigRepository.kt:31-35`; `DefaultConfigGeneratorService.kt:72`; claves `(1,2)` duplicadas **verificadas por mí** con `jq` sobre los 9 `default_content_*.json` | A#6, B#10, J#12 |
| 3c | **Duplicados que rompen la siembra para siempre** | Consecuencia de 3b: `MongoDataInitializer.kt:118` usa la variante **estricta** `findByEventTypeIdAndPlanId` | En cada arranque, ese archivo de contenido deja de sembrarse. El único rastro es un `logger.error` **sin stack trace** (`:125`) | **MEDIA** | **Alta** una vez que ocurre 3b | `MongoDataInitializer.kt:118-126` (**verificado por mí**: `findByEventTypeIdAndPlanId`, `catch` con solo `e.message`) | B#10 |
| 4a | **Clave desconocida en un JSON de siembra** | Un `default_visual_*.json` gana una clave que no existe en una de las **10 clases sin `@JsonIgnoreProperties`** (`InvitationConfig`, `ModelSettings`, `ModelPropertiesIcon`, `ModelEditIcon`, `ModelPropertiesItem`, `ModelEditItem`, `BackgroundColor`, `DateItem`, `EventSinglePlaceCard`, `SmallText`) | Esa plantilla **entera** (85-155 KB) no se siembra. La app arranca normal. El síntoma aparece después como el modo #1 | **ALTA** si ocurre | **Baja hoy, creciente.** X§3.1 midió `FAIL_ON_UNKNOWN_PROPERTIES = true` en el mapper del seeder y verificó que **hoy ningún JSON del repo la viola** | `MongoDataInitializer.kt:27` (`jacksonObjectMapper()` propio) y `:91-93`; X§2.4 (flags medidos por ejecución) | J#4, X§3.1 |
| 4b | **Clave desconocida vía API (`POST /master/templates/complete`)** | Igual, pero por el endpoint | **Se descarta en silencio**: el `ObjectMapper` de Spring desactiva `FAIL_ON_UNKNOWN_PROPERTIES` (X lo midió, y J lo verificó por desensamblado de `Jackson2ObjectMapperBuilder` de spring-web 6.2.1). El operador cree que subió el diseño completo | **MEDIA** | **Media** | `MasterTemplatesService.kt:32,124` (**verificado por mí**); X§2.4 | J#4, B#15, X |
| 4c | **Campo obligatorio ausente en el JSON de contenido** | `DefaultContentConfig` exige `images`, `phrases`, `itinerary`, `giftRegistry`, `music` **no nulos** (`DefaultContentConfig.kt:41,47,52,57,62`, **verificado por mí**) | Excepción de deserialización al **leer** el contenido en cada generación → mismo 500 del #1 | **ALTA** si ocurre | **Baja** para los 9 sembrados (todos los traen); **expuesto** para documentos creados por API, que no validan forma | `DefaultContentConfig.kt:41,47,52,57,62` | C2§8 |
| 5a | **Plantilla con títulos de grupo familiar `null` o sin las palabras "Padre"/"Padrino"** | Plantilla **no-boda** (es decir, `eventTypeId != 1`) cuyos `sectionFamily.items[].title.content` no contienen esas cadenas | **Los padres y padrinos que el usuario capturó se descartan sin ningún aviso** y se publica la plantilla con sus placeholders. Afecta a **5 de las 6 plantillas sembradas que alcanzan esta rama** (tid 7, 8, 9, 10, 13: `title.content = null` en ambos grupos; solo tid 6 cumple, con "Mis Padres"/"Mis Padrinos") | **ALTA** | **Alta.** Verificado sobre los datos reales; y todo plan Premium recibe `PARENTS_AND_GODPARENTS` automáticamente | `DefaultConfigGeneratorService.kt:1685,1703,1721` (**verificado por mí**); títulos **verificados por mí** con `python3`/`json` sobre los 9 archivos. **Denominador**: ver la nota inmediatamente debajo de la tabla | C2#7 |
| 5b | **Plantilla de boda cuyo grupo familiar tiene `label`/`text` a `null`** | Rama boda (`eventTypeId == 1`): escribe con `templateItem.label?.copy(...)` — si el campo es `null`, el safe-call devuelve `null` y **el nombre no se escribe** | Los nombres de los padres no aparecen. Afecta a **1 de las 2 plantillas de boda sembradas**: en `default_visual_boda_premium.json` (tid 5) los **tres** grupos tienen `label: null` y `text: null`; `default_visual_boda_basico.json` (tid 4) **sí** los trae poblados y no incumple | **ALTA** | **Alta** para tid 5 (es la plantilla de boda premium, la de mayor volumen esperable); nula para tid 4 | `DefaultConfigGeneratorService.kt:1763-1764,1789-1790`; **verificado por mí**: tid 5 → `label=None, text=None` en los 3 grupos; tid 4 → `('A nuestros Padres', …), ('(Padres de la Novia)', 'Raul Estrada Santiago y Teresa Lopez'), ('(Padres del Novio)', …)` | C2#2 |
| 5c | **Orden de ítems distinto del que asume el código** | El código trata `visualFamily.items[0]` como padres del **novio** | En `default_visual_boda_premium.json` `items[0].title = "(Padres de la Novia)"` — **los padres salen intercambiados** | **MEDIA** | **Alta** (dato del repo, no hipótesis) | `DefaultConfigGeneratorService.kt:1747,1769`; **verificado por mí** con `json` sobre tid 5 | C2#2 |
| 5d | **Plantilla con dos ítems de mesa de regalos del mismo `type`** | `resolveTemplate` empareja por tipo con `firstOrNull` y copia el `id` de la plantilla | **Ids duplicados** en la lista publicada. `default_visual_boda_premium.json` tiene `s1` y `s4` ambos `type:"digital"`: dos mesas digitales del usuario producen dos ítems con `id="s1"`. Además `syncGiftRegistryTitles` empareja por **posición** contra Postgres, así que un reordenado escribe el título en la fila equivocada | **MEDIA** | **Media** (requiere 2 mesas del mismo tipo) | `DefaultConfigGeneratorService.kt:1030-1034,1281`; `InvitationConfigService.kt:186-188`; **verificado por mí**: tid 5 items `s1(digital), s2(bank), s3(fisico), s4(digital)` | C2#3, C2#28 |
| 5e | **Plantilla con menos ítems de los que produce el generador** | El bloque de banco emite **siempre 9 bodies** (`msj1..msj9`); tid 4 y tid 11 diseñaron 4 | Las 5 líneas sobrantes heredan el estilo del body 0. Además `msj7` ("Cuenta CLABE:") y `msj9` ("Número de tarjeta:") escriben **el mismo `item.accountNumber`** — la CLABE se publica bajo la etiqueta "Número de tarjeta" | **MEDIA** | **Alta** (siempre que haya una mesa de tipo banco) | `DefaultConfigGeneratorService.kt:1157-1188` y `1190-1221`; duplicación de `accountNumber` en `:1175/1184` y `:1208/1217` (**verificado por mí**) | C2#6, C2#19 |
| 5f | **Menos fotos/ítems que huecos en la plantilla** | Galería: el nº de ítems de salida = nº de URLs disponibles, ignorando el nº de huecos de la plantilla | `default_visual_boda_premium.json` define 6 huecos (`g1..g6`) y el contenido por defecto aporta 2 URLs: una invitación sin fotos propias sale con **2 de 6**. Los ids `g1..g6` se reescriben a `gallery-N` y **todos los ítems heredan el estilo del ítem 0** | **MEDIA** | **Alta** | `DefaultConfigGeneratorService.kt:433,438,442-444`; 6 ids `g1..g6` **verificados por mí** en tid 5 | C1#6 |
| 6 | **Plantilla deshabilitada** | `deactivateTemplate` pone `is_enabled = false` | **Nada se rompe**, y es lo correcto: las invitaciones existentes siguen funcionando porque el generador **no consulta `isEnabled`** (`DefaultConfigGeneratorService.kt:43-55`), y el catálogo público sí filtra en tres niveles. Pero el comportamiento correcto se obtiene por **omisión**, no por decisión, y los documentos Mongo quedan para siempre | **BAJA** | Alta (uso normal) | `MasterTemplatesService.kt:277-299`; `InvitationValidationService.kt:17-31` (**verificado por mí**); ausencia de `delete` sobre los repos Mongo | B#19, B#18, D§5 |
| 7 | **El seed pisa datos editados a mano en Mongo** | `templateId` del documento está en la lista hardcodeada `MongoDataInitializer.kt:34-44` | La edición manual se pierde **en el siguiente arranque**, con un `logger.info("...actualizada")` como único aviso. Upsert destructivo conservando el `_id` | **MEDIA** | **Alta** para las 8 plantillas sembradas — es el comportamiento por diseño | `MongoDataInitializer.kt:83-90` (**verificado por mí**: `config.copy(id = existing.id)` + `save`) | B§5 |
| 8 | **Alta parcial Postgres/Mongo (documento visual huérfano)** | `POST /master/templates/complete` con `reuseExistingContent = true` (**el valor por defecto**) y sin contenido atado por `templateId` a una plantilla anterior — el caso normal, porque los 9 `default_content_*.json` se siembran con `templateId = null` (**verificado por mí**) | El operador ve un 400 con "No existe configuración de contenido para (eventId, planId)" **aunque exista** una perfectamente válida. En Mongo queda **un documento visual huérfano por cada intento**: el `@Transactional` revierte Postgres, pero el `save` de Mongo (`:138`) ya es definitivo. No hay compensación ni transacción Mongo (instancia standalone) | **ALTA** | **Alta.** Es la ruta por defecto y falla en cualquier entorno recién migrado | `MasterTemplatesService.kt:138` vs `:156-166` y `:175-178`, con la consulta correcta **comentada** en `:153-154` (**verificado por mí, línea a línea**); `MongoDataInitializer.kt:118-123` | B#1, B#2, B#3 |
| 9 | **Colisión de ids de secuencia con ids sembrados** | `V25:10` deja `invitation_template_id_seq` en 10 (**verificado por mí**). El primer id que asigna la API es 11, el segundo 12, el **tercero 13** — y `default_visual_evento.json` está sembrado con `templateId = 13` | La **tercera** plantilla creada por API pierde su diseño en el siguiente reinicio, reemplazado por el JSON "evento" del repo, en silencio | **ALTA** | **Media.** El escenario es exacto y verificable; que ya haya ocurrido depende del valor real de la secuencia en cada entorno: **NO DETERMINABLE** | `V25__add_remaining_templates.sql:10` (**verificado por mí**); `MongoDataInitializer.kt:43,83-90` | B#5 |
| 10 | **Cambio de plantilla en admin sin regenerar** | `PUT /admin/invitations/{id}` reasigna `invitation.template` sin tocar `invitation_configs`; `validateEnabledComponents` solo comprueba `isEnabled`, **no impide cambiar de tipo de evento ni de plan** | La invitación queda con plantilla nueva en SQL y **diseño de la vieja** en Mongo. Peor: las dos rutas se contradicen — un `GET` deja el `templateId` viejo (la migración perezosa solo rellena `null`, `InvitationConfigService.kt:141`, **verificado por mí**) y un `PUT` posterior lo reescribe al nuevo (`:71-73`, **verificado por mí**) manteniendo el diseño antiguo | **ALTA** | **Baja-media.** Requiere acción de ADMIN/MASTER; NO DETERMINABLE si se usa | `InvitationAdminService.kt:413`; `InvitationConfigService.kt:71-73` vs `:141-147`; `InvitationValidationService.kt:17-31` y `validateExtraModulesRules` **vacía** en `:59-62` (**verificado por mí**) | C3#1, C3#17, D#6 |
| 11a | **Datos de demo publicados: historia y familia** | El usuario tiene el módulo contratado pero no capturó nada | `mergeStorySection` devuelve la plantilla **tal cual** y `mergeFamilySection` también, forzando `visibility = true`. El invitado ve la historia de la pareja ficticia ("Raul Estrada Santiago", "Teresa Lopez" en los tres grupos de tid 5, **verificado por mí**) | **ALTA** | **Alta.** `ExtraModuleHelper.kt:10-14` da **los 5 módulos a toda invitación Premium**, contrate lo que contrate (**verificado por mí**), así que le pasa a cualquier cliente Premium que no rellene | `DefaultConfigGeneratorService.kt:2212-2214` y `:1676-1678` (**verificado por mí**); `ExtraModuleHelper.kt:10-14`; `V1:1091-1093` (plan 2 `is_premium = t`) | C2#9 |
| 11b | **Datos de demo publicados: hashtags de galería** | Siempre | El hashtag muestra el texto del usuario pero **enlaza al hashtag de la pareja demo**: `content = "#loQueEscribioElUsuario"` sobre `url = https://www.facebook.com/hashtag/antonioYcamila` (y el equivalente de Instagram). Solo se toca `content` | **MEDIA** | **Alta.** Ocurre en cada invitación de boda premium | `DefaultConfigGeneratorService.kt:464-466`; urls demo **verificadas por mí** en tid 5 | C1#5 |
| 11c | **Mesa de regalos vacía y visible** | El usuario no capturó ninguna mesa (`CreateInvitationRequest.kt:22` valida `@NotNull`, no `@NotEmpty`) | Sección de "Mesa de Regalos" **visible y sin ningún ítem**. La versión anterior (comentada, `:899`) rellenaba desde `contentTemplate.giftRegistry`; la viva **no consulta ese campo en ninguna línea activa** | **ALTA** | **Media-alta** | `DefaultConfigGeneratorService.kt:1071` + `:127` (`?.copy(visibility = true)`, **verificado por mí**) | C2#1 |
| 12 | **Ediciones del usuario congeladas frente a cambios en Postgres** | Cualquier `PUT /admin/invitations/{id}`: fecha, hora, nombres, hashtag, foto de portada, `allEventsSameLocation`, módulos extra — y además `syncInvitationSubComponents` **borra y recrea las 12 tablas de subcomponentes** | **Ningún cambio se propaga a Mongo.** El admin corrige la fecha del evento y el invitado sigue viendo la anterior. No existe endpoint de regeneración, ni `force`, ni recálculo: `generateInitialConfig` tiene **un único call site** protegido por `if (existingConfig.isPresent)` | **ALTA** | **Alta.** Es el único camino para corregir datos: `/user/**` no tiene endpoints mutantes de invitación | `InvitationAdminService.kt:413-430`; `InvitationPersistenceHelper.kt:31-49`; `InvitationConfigService.kt:136-155` (**verificado por mí**) | C3#2, C3#13 |
| 13 | **(mío) Nuevo tipo de evento tipo boda con id ≠ 1** | Alguien crea un `event_type` con `isWedding = true` por `POST /master/event-types` (permitido: `MasterEventTypesService.kt:26`) o por migración | **Doble personalidad**: la validación lo trata como boda (exige exactamente 2 personas, `InvitationValidationService.kt:37`; límite de frases `:49`; copy del correo `EmailContentGenerator.kt:181`) pero el generador lo enruta por la rama **no-boda** y el nombre cae al literal **"Nuestra Quinceañera"**. `eventTypeId == 1L` es la **única** decisión de "es boda" por id numérico en todo el código: hay 11 usos vivos de la columna semántica `EventTypeEntity.isWedding` frente a 2 usos del literal, ambos en el generador | **ALTA** | **Baja hoy** (solo existe el evento 1 como boda), **certera** el día que se añada una segunda plantilla de boda con otro tipo de evento | `DefaultConfigGeneratorService.kt:255` y `:1680` vs `EventTypeEntity.kt:20-21`, `InvitationValidationService.kt:37,40,49`, `MasterPhrasesService.kt:52,56,60,158,162,166`, `InvitationNotificationService.kt:32`, `EmailContentGenerator.kt:144,181` (**grep exhaustivo verificado por mí**) | **nuevo (E)** |
| 14 | **Módulo extra "incluido" cuya sección no existe en la plantilla** | Plan Premium (5 módulos automáticos) + plantilla sin esa sección | La sección **nunca se genera** y el campo queda `null` para siempre; no hay log, ni excepción, ni marca. Caso masivo: `sectionStory` es `null` en **6 de las 8** plantillas sembradas (tid 6, 7, 8, 9, 10, 13), todas Premium | **MEDIA** | **Alta** (es el estado actual de los datos) | `DefaultConfigGeneratorService.kt:2208` + `:129-136`; **verificado por mí**: `sectionStory` null en tid 6,7,8,9,10,13 | C2#10 |
| 15 | **Visibilidad forzada: se ignora el `visibility:false` deliberado de la plantilla** | Plan Básico (tid 4), cuyo JSON marca `sectionSuggestions`, `sectionAmenities`, `sectionFamily`, `sectionStory` y `sectionDresscode` como `visibility: false` | Si el módulo está contratado, la sección aparece igualmente — y en familia, con los placeholders de demo, por el **doble forzado** de `:153` y `:1677` | **MEDIA** | **Media** (solo plan Básico con módulos opt-in) | `DefaultConfigGeneratorService.kt:127,135,144,153,162,171,177` + `:1677`; **verificado por mí**: 5 secciones `visibility:false` solo en `default_visual_boda_basico.json` | C2#21 |
| 16 | **Mongo caído al arrancar → la app arranca sin plantillas** | Mongo no responde durante el `CommandLineRunner` | La aplicación arranca **perfectamente**, con cero configuraciones sembradas y **sin índice único**. Todas las generaciones posteriores dan 500. `ensureUniqueIndexes()` tiene un `catch (e: Exception) {}` **completamente vacío** (dos, de hecho: `:68` y `:71`) | **ALTA** | **Baja-media** | `MongoDataInitializer.kt:65-72,91-93,124-126` (**verificado por mí**) | B#17, C3#5 |
| 17 | **El índice único que sostiene la idempotencia no llega a crearse** | Consecuencia del #16, o duplicados preexistentes en `invitation_configs` | Se pierde la única red de seguridad real contra configs duplicadas por invitación (el `ReentrantLock` es por JVM y tiene además una carrera al retirarse del mapa). Nadie se entera: el `catch` no registra nada | **ALTA** | **Baja**; **NO DETERMINABLE** el estado real de los índices en producción | `MongoDataInitializer.kt:66-71`; `InvitationConfigService.kt:132-134,166-172` (**verificado por mí**) | C3#5, C3#10 |
| 18 | **El `_id` de Mongo viaja en el body del `PUT .../config`** | Invitación **sin** config previa; el atacante conoce/adivina el ObjectId de otra config | `configRequest.copy(...)` (`InvitationConfigService.kt:76-81`) **no reescribe `id`**, y `save` con `_id` no nulo reemplaza el documento existente: sobrescribe la config de otra invitación | **ALTA** (si explotable) | **Baja.** Requiere adivinar 24 hex; **INFERIDO** el efecto de `save` con `_id`, no ejecutado | `EditorModels.kt:14-15` (`@Id val id: String? = null`, sin `@JsonIgnore`, **verificado por mí**); `InvitationConfigService.kt:76-84` (**verificado por mí**) | D#1, C3#3 |
| 19 | **Borrado duro de usuario → configs huérfanas** | `DELETE /admin/administrators/users/{id}/force` | Los documentos de `invitation_configs` quedan para siempre. El camino hermano (`hardDeleteInvitation`) **sí** los borra, lo que confirma que es un olvido. No hay job de limpieza (`@Scheduled` → cero ocurrencias) | **MEDIA** | **Baja-media** | `AdminUsersService.kt:423-426` vs `InvitationAdminService.kt:377-379` | C3#4 |
| 20 | **`PUT .../config` antes del primer `GET`** | El frontend guarda antes de leer | La invitación acaba con una config que **nunca pasó por la plantilla**: se persiste el body tal cual y `generateInitialConfig` no se ejecuta jamás (la generación solo ocurre si no hay documento) | **MEDIA** | **NO DETERMINABLE** (depende del frontend, ausente del repo) | `InvitationConfigService.kt:75-82` y `:138` (**verificado por mí**) | C3#11 |

**Nota sobre los denominadores de los modos #5a, #5b y #14 (corrección tras control de calidad).** Hay **9** archivos `default_visual_*.json` en disco pero solo **8 sembrados**: `default_visual_boda_premium_2.json` (tid 11) está **comentado** en la lista del cargador (`MongoDataInitializer.kt:36`, verificado por mí). De esas 8, la sección familia se bifurca en dos ramas mutuamente excluyentes según `val isWedding = eventTypeId == 1L` (`DefaultConfigGeneratorService.kt:1680`) y `return if (!isWedding)` (`:1682`):

| Rama | Sembradas que la alcanzan | Cómo empareja | Modo de fallo aplicable |
|---|---|---|---|
| **no-boda** (`eventTypeId != 1`) | **6**: tid 6 (evtType 2), 7 (3), 8 (4), 9 (5), 10 (6), 13 (7) | por **texto** del título (`:1685`, `:1703`) | **#5a** — fallan 5 de 6 (todas menos tid 6) |
| **boda** (`eventTypeId == 1`) | **2**: tid 4 y tid 5 | **posicional** (`:1747, 1769, 1773, 1795, 1799`), el título nunca se lee | **#5b** y **#5c** — falla 1 de 2 (tid 5) |

Por eso `default_visual_boda_basico.json` (tid 4) queda fuera del modo #5a **pese a tener sus tres títulos a `null`**: es evento tipo boda (`invitation_template.id=4 → event_type_id=1`, `V1__initial_schema.sql:1133-1134`, verificado por mí), así que nunca llega a `:1685`. Lo mismo aplicaría a tid 11 (`event_type_id=1` según `scripts/apply_template_11_12_local.sh:35`), que además no se siembra. **La versión anterior de este informe decía "5 de las 9 plantillas sembradas": el numerador (5) era correcto, el denominador no.** La exclusión de tid 4 fue deliberada y correcta, pero el motivo — la bifurcación boda/no-boda, no el plan Básico ni el gating de módulos extra — no estaba escrito. Corregido aquí y propagado al resumen (§1) y a §4a.

**Patrón transversal.** De los 20 modos, **13 no producen ninguna excepción** (5a, 5b, 5c, 5d, 5e, 5f, 6, 7, 10, 11a, 11b, 11c, 12, 14, 15). El tramo del generador es notablemente disciplinado con los operadores peligrosos — cero `!!`, cero `.first()` sin guarda, cero indexaciones sin comprobación de `size` en las 2743 líneas (C1§8 y C2§10, **verificado por mí con grep**) — y precisamente por eso los fallos son **silenciosos**, que es el modo más caro de detectar: no hay alerta, no hay log, solo un cliente que llama porque su invitación muestra los padres de otra pareja.

---

## 3. Costo de agregar una plantilla nueva hoy

### 3a. Tipo de evento existente

**Camino 1 — Flyway + seeder (el único reproducible desde el repositorio).**

| # | Paso | Archivo / sistema | ¿Manual? | ¿Fuera de Git? | ¿Toca Kotlin? (línea) | ¿Reinicio? |
|---|---|---|---|---|---|---|
| 1 | Diseñar y producir el JSON visual (85-155 KB; el de boda premium tiene **149 objetos con triplete `md/sm/xs`**) | `src/main/resources/data/mongo/default_visual_<x>.json` | **Sí**, a mano o exportando desde el editor. No hay ningún script de generación en el repo | No | No | — |
| 2 | Decidir si hace falta un `default_content_*.json` propio, o si se reutiliza el de `(eventTypeId, planId)` | `src/main/resources/data/mongo/default_content_<x>.json` | **Sí** | No | No | — |
| 3 | Subir la captura de preview (columna `image`) y el HTML de demo (columna `url`) | **S3** (`invitacionesdigitales.s3.us-east-2.amazonaws.com`, patrón de `V25:4-7`) | **Sí** | **Sí (S3)** | No | — |
| 4 | Nueva migración con id **explícito** + `ON CONFLICT (id) DO NOTHING` + `setval` | `src/main/resources/db/migration/Vnn__....sql` (modelo: `V25__add_remaining_templates.sql:2-10`) | Sí | No | No | Sí (Flyway) |
| 5 | **Añadir el nombre del archivo a la lista hardcodeada del seeder** | `MongoDataInitializer.kt:34-44` (visual) y `:48-58` (contenido) | Sí | No | **Sí** — es una `listOf` de literales | Sí |
| 6 | Reiniciar la aplicación (el seeder es un `CommandLineRunner`) | — | Sí | No | No | **Sí** |

**Ediciones de Kotlin condicionales, según lo que exija el diseño** (ninguna documentada en ningún sitio):

| Si el diseño… | Hay que tocar | Si no se toca |
|---|---|---|
| …lleva `label` en los ítems de galería | `DefaultConfigGeneratorService.kt:420` (`templateId == 14L && eventTypeId == 7L && planId == 2L`) y `:446-451` | `label` se fuerza a `null` en silencio |
| …lleva un segundo body/botón en recomendaciones | `:2129, :2156, :2177` (guardados por `templateId == 12L`, variable de `:2069`) | el botón no se genera |
| …tiene títulos de grupo familiar que no contienen "Padre"/"Padrino" | `:1685` y `:1703` (o poner esos literales en el JSON) | **los padres y padrinos del usuario se descartan** (modo #5a) |
| …repite `type` entre ítems de mesa de regalos | `:1030-1034` y `:1281` | ids duplicados (modo #5d) |
| …tiene menos de 9 `body` en el ítem de banco | `:1157-1188` | 5 líneas heredan el estilo del body 0 (modo #5e) |
| …quiere que la sección respete `visibility: false` | `:127,135,144,153,162,171,177` y `:1677` | se fuerza visible (modo #15) |
| …usa una tipografía distinta de "Poppins" en textos generados por defecto | `:2724` | todo `createDefaultEditText` sale en Poppins gris 16px |

**Camino 2 — `POST /master/templates/complete`** (`scripts/create_complete_template.sh`). Cero archivos versionados, cero reinicios, pero:
- `reuseExistingContent = true` es **el valor por defecto** y **falla siempre en un entorno recién migrado** (modo #8), dejando un documento visual huérfano por intento → hay que enviar `contentConfig` inline, lo que crea un duplicado más por `(eventTypeId, planId)` (modo #3b).
- La plantilla creada **no es reproducible desde el repositorio**: no queda en ninguna migración ni en ningún JSON (es exactamente la deriva de los ids 11, 12, 14, 16, 17).
- Si su id cae en 4-10 o 13, el siguiente reinicio la sobrescribe (modo #9).
- El script trae **credenciales MASTER en texto plano** (`scripts/create_complete_template.sh:5-6`: `EMAIL` y `PASSWORD` por defecto), commiteadas al repo. **Verificado por mí.**

**Camino 3 — `scripts/apply_template_11_12_local.sh` + `mongosh`.** Solo hace `UPDATE ... WHERE id=11/12`, **nunca `INSERT`** (verificado: líneas 29-53). Si las filas no existen, `psql` reporta `UPDATE 0`, `set -euo pipefail` no lo detecta y el script escribe igualmente los documentos Mongo (`:61-64`) → configuraciones huérfanas. Su propia cabecera (`:4`, "Aplica el alta/correccion") contradice a su código. **Verificado por mí.**

### 3b. Tipo de evento nuevo

Todo lo de 3a, **más**:

| # | Paso | Archivo / sistema | ¿Manual? | ¿Fuera de Git? | ¿Toca Kotlin? (línea) | ¿Reinicio? |
|---|---|---|---|---|---|---|
| 7 | Fila en `event_type` (con `is_wedding`) | migración (modelo `V24:1-7`) o `POST /master/event-types` (`MasterEventTypesService.kt:19-30`) | Sí | No (o **sí**, si se usa la API) | No | Sí |
| 8 | Filas en `custom_phrase` + `phrase_options` por `(event_type_id, invitation_plan_id)` | migración (modelo `V26:9-122`) | Sí | No | No | Sí |
| 9 | Filas en `gift_image` | migración (modelo `V26:125-186`) | Sí | No | No | Sí |
| 10 | Filas en `invitation_song` | migración (modelo `V26:189-202`) | Sí | No | No | Sí |
| 11 | Filas en `dress_code` (`service_type_id` e `invitation_plan_id` son **NOT NULL**, `V1:135-147`) | migración | Sí | No | No | Sí |
| 12 | Slug del tipo de evento en la URL del correo | `EmailGuestNotifier.kt:63-64` (`"quince-anos" → "xv"` está hardcodeado) | Sí | No | **Sí** | Sí |
| 13 | **Si el evento es tipo boda**: la bifurcación del generador | `DefaultConfigGeneratorService.kt:255` y `:1680` (`eventTypeId == 1L`) | Sí | No | **Sí, obligatorio** | Sí |
| 14 | Texto de reserva del nombre del festejado | `DefaultConfigGeneratorService.kt:285` (`"Nuestra Quinceañera"`, usado para **todos** los eventos no-boda) y `:283` (el mismo literal como lista negra) | Sí | No | **Sí, si importa el texto** | Sí |

Los cuatro catálogos que el frontend consulta por `(eventId, planId)` son endpoints públicos reales — `dress-code/predefined`, `gift-registry/predefined-data`, `music/recommendations`, `phrases/configuration` (`PublicInvitationInfoController.kt:33-101`, **verificado por mí**) — así que un tipo de evento sin esas filas produce catálogos vacíos en el alta de invitación, no un error.

### 3c. Totales

| Métrica | Tipo de evento existente | Tipo de evento nuevo |
|---|---|---|
| Archivos versionados creados/modificados | **3-4** (1-2 JSON + 1 SQL + `MongoDataInitializer.kt`) | **4-6** (los anteriores + 1-2 SQL de catálogos) |
| Ediciones de Kotlin obligatorias | **1** (la lista del seeder) | **1**, o **3-4** si el evento es tipo boda (`:255`, `:1680`, `:285`, `EmailGuestNotifier.kt:64`) |
| Ediciones de Kotlin condicionales al diseño | hasta **7** puntos distintos del generador | los mismos 7 |
| Reinicios | **1** (obligatorio: el seeder es `CommandLineRunner`) | **1** |
| Sistemas fuera de Git | **2** (S3 para preview + demo; Postgres/Mongo si se usa la API o los scripts) | **2** |
| Tablas de Postgres a poblar | **1** (`invitation_template`) | **6** (`event_type`, `custom_phrase`, `phrase_options`, `gift_image`, `invitation_song`, `dress_code`, `invitation_template`) |
| Decisiones humanas no documentadas | **≥12** (ver §4: orden de `items`, títulos con "Padre"/"Padrino", unicidad de `type` en gifttable, ≥9 bodies en banco, `label` de galería, `visibility`, tipografía, nº de huecos de galería, `texts` del contenido, `id` de cada ítem, `templateId` dentro del JSON, no introducir claves desconocidas) | **≥15** |
| Validación automática de que la plantilla es correcta | **ninguna** (`src/test` no existe; 7 dependencias de test declaradas en `build.gradle.kts:79-85` y ni un solo archivo que las use — **verificado por mí**) | ninguna |
| Rollback si sale mal | **ninguno**: no existe ni una llamada `delete` sobre `defaultVisualConfigRepository`/`defaultContentConfigRepository` en todo `src/main` | ninguno |

---

## 4. Contrato implícito de una plantilla

Esto es lo que nadie escribió y el generador exige. Todas las consecuencias son **silenciosas** salvo donde se indica lo contrario.

### 4a. `default_visual_configs`

| Regla | Sección | Consecuencia de incumplir | Evidencia |
|---|---|---|---|
| El documento raíz debe ser `{templateId: Long, config: {...}}` y `templateId` debe coincidir con una fila `invitation_template.id` | raíz | Si falta el documento para ese id → excepción y **HTTP 500** en cada apertura del editor | `DefaultVisualConfig.kt:16-30`; `DefaultConfigGeneratorService.kt:47-54` |
| `config.invitationId` puede faltar (queda `0L`), y `config.templateId/eventId/planId` también (quedan `null`) | raíz de `config` | **Ninguna hoy**: el generador los reescribe en `:83-87` y `:99`. Riesgo latente: si alguien activa `FAIL_ON_NULL_FOR_PRIMITIVES` o `StrictNullChecks`, los 9 archivos dejan de deserializar (medido en X§3, variante iii: 9/9 FAIL) | X§3, X§5 (veredicto empírico); `DefaultConfigGeneratorService.kt:83-87,99` |
| **Ninguna clave desconocida** en las 10 clases sin `@JsonIgnoreProperties`: `InvitationConfig`(13), `ModelSettings`(44), `ModelPropertiesIcon`(113), `ModelEditIcon`(125), `ModelPropertiesItem`(135), `ModelEditItem`(147), `BackgroundColor`(161), `DateItem`(183), `EventSinglePlaceCard`(255), `SmallText`(492) | todas | **Solo por la vía del seeder**: la plantilla entera no se siembra, con un `logger.error` sin stack trace. Por la vía de la API la clave se descarta en silencio (asimetría de `ObjectMapper`) | `EditorModels.kt` (líneas citadas); `MongoDataInitializer.kt:27,91-93`; X§2.4 (flags medidos) |
| La sección debe **existir** para poder generarse; `mergeXSection` abre con `if (visualX == null) return null` en las 12 funciones | todas | El módulo contratado se pierde sin traza. Caso real: `sectionStory` es `null` en tid 6, 7, 8, 9, 10, 13 y **todos son Premium** (los 5 módulos incluidos) | `DefaultConfigGeneratorService.kt:187,214,249,414,488,985,1644,1857,2067,2208,2276,2669`; `sectionStory: null` **verificado por mí** en 6 archivos |
| `visibility` es **irrelevante** en 7 secciones: se fuerza a `true` | cover, couple, gallery, event, gifttable, story, dresscode, family, suggestions, amenities, started | El `visibility:false` deliberado de `default_visual_boda_basico.json` (5 secciones) se ignora | `DefaultConfigGeneratorService.kt:103,110,117,120,127,135,144,153,162,171,177` + `:1677` |
| **`sectionFamily.items[i].title.content` debe contener la palabra `"Padre"` o `"Padrino"`** — solo aplica a plantillas **no-boda** (`eventTypeId != 1`), que son las únicas que llegan a esa comparación | family | **Los padres y padrinos capturados por el usuario se descartan**. Incumplen **5 de las 6 plantillas sembradas no-boda** (tid 7, 8, 9, 10, 13, con títulos `null`); cumple solo tid 6 | `DefaultConfigGeneratorService.kt:1680,1682,1685,1703,1721`; títulos **verificados por mí**; ver la nota de denominadores al final de §2 |
| **`sectionFamily.items[0]` = padres del NOVIO, `items[1]` = padres de la NOVIA, `items[2..]` = padrinos** (boda) | family | Padres intercambiados. `default_visual_boda_premium.json` incumple: `items[0].title = "(Padres de la Novia)"` | `DefaultConfigGeneratorService.kt:1747,1769,1773,1795,1799`; **verificado por mí** |
| **`sectionFamily.items[i].label` y `.text` deben ser NO nulos** a nivel de grupo (boda) | family | El nombre no se escribe (`?.copy` sobre `null` devuelve `null`). Incumplen los 3 grupos de **tid 5**; **tid 4 sí los trae poblados** y no incumple | `DefaultConfigGeneratorService.kt:1763-1764,1789-1790`; ambos **verificados por mí** |
| No debe haber **dos ítems con el mismo `type`** | gifttable | Ids duplicados en la lista publicada; el ítem repetido nunca se usa. Incumple tid 5 (`s1` y `s4`, ambos `digital`) | `DefaultConfigGeneratorService.kt:1030-1034,1281`; **verificado por mí** |
| El ítem de tipo banco debería tener **≥9 entradas en `body`** | gifttable | Los bodies 5-9 heredan el estilo del body 0. tid 4 y tid 11 tienen 4 | `DefaultConfigGeneratorService.kt:1066-1068,1157-1188` |
| El `title.content` de la sección **no se usa**: el título es `texts["giftTableTitle"]` o el literal `"Mesa de Regalos"` | gifttable | El título de la plantilla se pierde. Como **los 3 JSON de contenido de boda no tienen `texts` en absoluto** (verificado por mí), en boda el título es **siempre** el literal | `DefaultConfigGeneratorService.kt:1293-1294` vs `:972` (comentada) |
| Los `id` de `items` **se descartan**: se reescriben como `gallery-N` | gallery | Se pierden `g1..g6`. El frontend que dependa de esos ids ve otros | `DefaultConfigGeneratorService.kt:438` |
| Solo `items[0]` aporta estilo: **todos** los ítems heredan `md/sm/xs` del primero | gallery | Cualquier retícula heterogénea se aplana. Hoy inocuo (los ítems de tid 5/6 son homogéneos) | `DefaultConfigGeneratorService.kt:433,442-444` |
| El nº de ítems de salida lo dicta el nº de fotos, no la plantilla | gallery | Con 2 URLs y 6 huecos diseñados, salen 2 | `DefaultConfigGeneratorService.kt:438` |
| `hashtags[].url` e `icon` **nunca se tocan** | gallery | El hashtag del usuario enlaza a la cuenta de la demo | `DefaultConfigGeneratorService.kt:464-466` |
| `label` en los ítems de galería solo sobrevive si `templateId==14 && eventTypeId==7 && planId==2` | gallery | Se fuerza a `null` en cualquier otra plantilla | `DefaultConfigGeneratorService.kt:420,446-451` |
| `items[i]` se empareja **por índice** con el itinerario del usuario; los ítems sobrantes se pierden y los faltantes reciben estilo de `items[0]` e **id UUID aleatorio** | event | Ids inconsistentes (`event-1`, `event-2`, `<uuid>`) en la misma lista | `DefaultConfigGeneratorService.kt:527,529,646,648` |
| `itemsSinglePlace` **nunca se escribe**, solo se lee como estilo de reserva, y lleva `@get:JsonIgnore` | event | `singleplace: true` llega al frontend sin ninguna tarjeta de lugar único | `DefaultConfigGeneratorService.kt:493,769`; `EditorModels.kt:234-235` |
| `items[0]` = **Mujeres**, `items[1]` = **Hombres**; sus `title` se pisan con esos literales | dresscode | Título de la plantilla ignorado; con `type = "link"` solo se genera **1 ítem** y el segundo desaparece | `DefaultConfigGeneratorService.kt:2288-2311,2346,2401,2430` |
| El `message` de la pareja debe existir en la plantilla si se quiere conservar su estilo | couple | `createDefaultEditText` lo fabrica en **Poppins gris 16px 100×100**, ajeno al diseño. tid 5 no lo define | `DefaultConfigGeneratorService.kt:385,390,2709-2728` |
| `imageTopBg`/`imageBottomBg` se **crean** aunque la plantilla no los tenga | couple | Dos `ModelEditImage` con `content = null` y geometría 100×100 inyectados en cada config de boda | `DefaultConfigGeneratorService.kt:397-404` |

### 4b. `default_content_configs`

| Regla | Sección | Consecuencia de incumplir | Evidencia |
|---|---|---|---|
| `eventTypeId` y `planId` son **obligatorios y no nulos**; `templateId` es opcional | raíz | Sin `templateId` el documento solo se alcanza por el fallback `findFirstByEventTypeIdAndPlanId`, **sin orden**. Los 9 del repo lo omiten (verificado por mí) | `DefaultContentConfig.kt:24,30,36`; `DefaultConfigGeneratorService.kt:70-72` |
| `images`, `phrases`, `itinerary`, `giftRegistry`, `music` son **obligatorios y no nulos** | raíz | Excepción de deserialización en **cada** generación → 500. Los 9 del repo los traen | `DefaultContentConfig.kt:41,47,52,57,62` (**verificado por mí**) |
| Claves desconocidas: **permitidas**. `DefaultContentConfig` y sus 13 clases anidadas llevan `@JsonIgnoreProperties(ignoreUnknown = true)` | todas | Ninguna. `_comment` en cumpleaños/evento se descarta limpiamente | `DefaultContentConfig.kt:13`; J§9 |
| El par `(eventTypeId, planId)` **debería ser único** | raíz | Si hay 2, la siembra de ese archivo se rompe para siempre (variante estricta en el seeder) y la lectura devuelve uno arbitrario. `default_content_boda_premium.json` y `_2` comparten `(1,2)` — por eso el segundo está comentado en el seeder | `MongoDataInitializer.kt:118` vs `DefaultConfigGeneratorService.kt:72`; claves **verificadas por mí** |
| `texts` es opcional pero **su ausencia arrastra todos los títulos a literales en español** | todas | **Los 3 JSON de contenido de boda no tienen `texts`** (verificado por mí): `"Mesa de Regalos"`, `"Itinerario"`, `"Galería"`, `"Amenidades"`, `"Recomendaciones"`, `"Confirma tu asistencia"` quedan cableados | `DefaultConfigGeneratorService.kt:1293,767,473,1951,2198,2675`; claves raíz **verificadas por mí** |
| Claves de `texts` reconocidas (lista cerrada): `coverSubtitle`, `coupleHeading`, `galleryTitle`, `galleryIntro`, `itineraryTitle`, `giftTableTitle`, `amenitiesTitle`, `recommendationsTitle`, `dressCodeTitle`, `rsvpTitle` | varias | Cualquier otra clave es inerte. `coverButton` existe en 6 archivos y **no lo consume ninguna línea del código** | `DefaultConfigGeneratorService.kt:226,268,473,476,767,1293,1951,2198,2322,2673`; C1#24 |
| `images.people[0]` = **novio**, `[1]` = **novia** (boda); `[0]` = festejado (no-boda) | couple | Fotos intercambiadas, sin ningún error | `DefaultConfigGeneratorService.kt:290,360,366` |
| `images.backgrounds` debe usar exactamente las claves `"topBg"`, `"bottomBg"`, `"rsvpBg"` | couple, started | La imagen no se aplica | `DefaultConfigGeneratorService.kt:305,309,398,402,2687` |
| `images.parents` debe usar exactamente `"mother"` / `"father"` | family | Se cae a `""` | `DefaultConfigGeneratorService.kt:1690-1691` |
| `phrases` debe usar `"hombre"`/`"male"`, `"mujer"`/`"female"`, `"Pareja"`/`"pareja"` | couple (boda) | El texto no se aplica. La rama **no-boda ignora `phrases` por completo**: `default_content_xv_premium.json` define `phrases: {celebrated, intro}` que no se leen en ninguna parte | `DefaultConfigGeneratorService.kt:330-335` vs `:293-303`; C1#12 |
| `story` y `giftRegistry` **nunca se usan** en la generación | story, gifttable | Datos muertos: la rama que leería `contentTemplate.story` es inalcanzable (`:2240-2266`, tras el early-return de `:2212`), y `contentTemplate.giftRegistry` no aparece en ninguna línea viva | `DefaultConfigGeneratorService.kt:2212,2217,2240`; `:1071` |
| `dressCode` solo se usa si el usuario **no** capturó dress code, y para el título | dresscode | Las 3 copias restantes del bloque de fallback están en código inalcanzable (`:2608-2659`) | `DefaultConfigGeneratorService.kt:2281,2341,2608` |
| `parents.*.names` **nunca se usa** (solo lo leía `getFallbackFamilyText`, función muerta) | family | Dato muerto | grep de `getFallbackFamilyText` → **1 sola ocurrencia, la definición** (**verificado por mí**) |

### 4c. Relación con Postgres (fila `invitation_template`, `event_type`, `plan`)

| Regla | Consecuencia de incumplir | Evidencia |
|---|---|---|
| Debe existir la fila `invitation_template` con el mismo id que `default_visual_configs.templateId` — **sin FK, sin validación cruzada, en ningún sentido** | Fila sin documento → modo #1 (500). Documento sin fila → ruido permanente (`default_visual_evento.json` con `templateId=13` y `default_content_evento.json` con `eventTypeId=7`, ninguno con fila en las migraciones) | A§6, B#6 |
| `event_type.id == 1` es la **única** definición de "boda" que usa el generador | Un tipo de evento con `is_wedding = true` e id ≠ 1 se valida como boda pero se renderiza como XV (modo #13) | `DefaultConfigGeneratorService.kt:255,1680` vs `InvitationValidationService.kt:37` (**verificado por mí**) |
| `invitation_plan.is_premium = true` implica **los 5 módulos extra**, siempre | Toda plantilla Premium debe traer las 5 secciones o el cliente pierde módulos que "tiene" (modo #14) | `ExtraModuleHelper.kt:10-14` (**verificado por mí**) |
| Los `templateId` 12 y 14 tienen **lógica de negocio dedicada en Kotlin** pero ninguna fila en Flyway y ningún JSON | Si esas plantillas se recrean con otro id, sus ramas dejan de aplicarse en silencio | `DefaultConfigGeneratorService.kt:420` y `:2129,2156,2177`; `V25:10` deja la secuencia en 10 (**verificado por mí**) |
| No hay `UNIQUE` sobre `invitation_template(event_type_id, invitation_plan_id)` y el diseño **espera** varias plantillas por combinación | La resolución de contenido por el fallback pasa a ser no determinista (modo #3b) | `MasterTemplatesService.kt:318-339`; B§6 |
| La secuencia `invitation_template_id_seq` queda en **10** tras `V25` | Los ids 11, 12, 13 los asigna la API en runtime, y el 13 está sembrado → colisión (modo #9) | `V25__add_remaining_templates.sql:10` (**verificado por mí**) |

---

## 5. Acoplamiento con el frontend

**Cuantificación en el modelo.** `EditorModels.kt` declara **221 campos** (`val` no comentados). De ellos, **79 (35,7%) son decisiones puras de presentación** — recuento propio, verificado campo a campo:

| Categoría | Nº | Dónde |
|---|---|---|
| Campos de las 5 clases "properties" (todas 100% presentación) | 27 | `ModelPropertiesText`(7, :57-65), `ModelPropertiesImage`(7, :87-95), `ModelPropertiesIcon`(6, :113-120), `ModelPropertiesItem`(6, :135-142), `BackgroundColor`(1, :161-163) |
| Referencias a los breakpoints `md`/`sm`/`xs` | 18 | `:78-80, 104-106, 127-129, 153-155, 186-188, 306-308` |
| `backgroundColor` + `background: ModelEditImage` en las secciones | 22 | 11 secciones × 2 |
| `fontFamily` | 4 | `:75, 150, 305, 493` |
| `icon` (string FontAwesome o `ModelEditIcon`) | 6 | `:74, 149, 303, 204, 268, 278` |
| `ModelEditIcon.content` (es la clase FontAwesome) | 1 | `:126` |
| `showImage` | 1 | `:413` |

**Cuantificación en los datos.** Cada `ModelEditText` transporta 3 × 7 = **21 valores de estilo** más `fontFamily` e `icon`. Medido sobre las plantillas reales (script propio, `python3` recursivo sobre `config`):

| Plantilla | objetos con triplete `md/sm/xs` | `fontFamily` | `fontSize` | arrays `color` | iconos FontAwesome |
|---|---|---|---|---|---|
| `default_visual_boda_premium.json` (tid 5) | **149** | 111 | 336 | 357 | 34 |
| `default_visual_boda_basico.json` (tid 4) | 114 | 84 | 255 | 276 | 29 |
| `default_visual_xv_premium.json` (tid 6) | 111 | 78 | 237 | 237 | 20 |
| `default_visual_bautizo/comunion/confirmacion/cumpleanos` | 87 c/u | 65 | 198 | 198 | 18 |

Es decir: **una sola plantilla de boda premium es un contrato de ~1000 valores de CSS almacenados en MongoDB**, sin esquema versionado y sin ninguna validación.

**Cuantificación en el generador** (recuento propio con `grep` sobre `DefaultConfigGeneratorService.kt`, excluyendo comentarios):

| Tipo de hardcodeo de presentación | Nº | Líneas |
|---|---|---|
| Literales FontAwesome | **14** | `541, 597, 660, 716, 1144, 1160, 1167, 1176, 1185, 1193, 1200, 1209, 1218, 1262` |
| `fontFamily = "Poppins"` | 1 | `2724` |
| Arrays RGBA cableados (color/background/margin) | **14** | `2088-2090, 2097-2099, 2106-2108, 2715-2717, 2733-2734` |
| `fontSize` / `lineHeight` | 8 | `2086-2087, 2095-2096, 2104-2105, 2713-2714` |
| `fontAlign` / `fontStyle` | 8 | `2084-2085, 2093-2094, 2102-2103, 2711-2712` |
| `width`/`height` fijos (100×100) | 2 | `2695-2696` |
| **URL de un bucket S3 concreto** | 1 | `2357` (`https://invitacionesdigitales.s3.us-east-2.amazonaws.com/wedding/demo/premium-new/DRESSCODE-LINK.jpg`) |
| Ids de plantilla mágicos que cambian el layout | 3 | `420` (14L/7L/2L), `2129/2156/2177` (12L), `255`+`1680` (1L) |

**Qué implica.**

1. **Versionar plantillas es hoy imposible sin versionar el generador.** No existe ningún campo de versión: `grep` de `version|@Version|createdAt|updatedAt|LastModified` sobre `EditorModels.kt`, `DefaultVisualConfig.kt` y `DefaultContentConfig.kt` da **cero coincidencias** (C3§6). Un cambio de diseño que altere el nº de ítems, el orden o los títulos de una sección cambia el comportamiento del merge (§4), así que "v2 de la plantilla X" es en la práctica una plantilla nueva con id nuevo — que es exactamente lo que pasó con los ids 11 ("Boda Premium 2") y 12 ("XV Premium 2"), cada uno con su propia rama de código (`templateId == 11L` en la versión comentada, `templateId == 12L` en la viva).

2. **Rediseñar el frontend obliga a tocar el backend.** Cambiar la escala tipográfica, la paleta o la librería de iconos exige: (i) reescribir los ~1000 valores de cada uno de los 9 JSON, (ii) editar los 14 literales FontAwesome, los 14 arrays RGBA y el `fontFamily = "Poppins"` del generador, y (iii) migrar **todos los documentos ya existentes en `invitation_configs`**, porque la config es una copia por valor congelada en el instante de la generación y **no hay ninguna ruta de regeneración** (C3#13). Un cambio de librería de iconos (FontAwesome → cualquier otra) es una migración de datos sobre toda la base, no un cambio de CSS.

3. **Soportar dos versiones de frontend a la vez es inviable con el modelo actual.** El `InvitationConfig` no lleva versión de esquema, `GET .../config` devuelve siempre la misma forma, y campos como `singleplace` llevan `@get:JsonIgnore` sobre su lista asociada (`EditorModels.kt:234-235`) — es decir, el contrato ya tiene asimetrías serialización/persistencia que un segundo consumidor descubriría a golpes. Añadir un campo nuevo al JSON de plantilla para el frontend v2 tiene además un coste asimétrico verificado: la API lo aceptaría descartándolo, pero **el seeder rechazaría el archivo entero** si el campo cae en una de las 10 clases sin `@JsonIgnoreProperties` (modo #4a). El primer paso hacia dos versiones tendría que ser poner `@JsonIgnoreProperties(ignoreUnknown = true)` en esas 10 clases y añadir un campo de versión al documento; ninguna de las dos cosas existe.

4. **Riesgo operativo inmediato ya presente**: la URL de S3 de `:2357` es un objeto concreto en un bucket concreto. Si se rota el bucket o se borra el objeto, la tarjeta de dress code de tipo `link` queda con imagen rota en producción y el arreglo requiere desplegar código.

---

## 6. Deuda concentrada

| Tipo de deuda | Cifra | Dónde | Evidencia |
|---|---|---|---|
| **Líneas comentadas** en el generador | **607 de 2743 (22,1%)** — 594 en el tramo 829-2743, 13 en 1-828 | `DefaultConfigGeneratorService.kt` | `grep -c '^\s*//'` (**verificado por mí**) |
| Bloques comentados contiguos de ≥10 líneas | **18** | `58-68, 838-847, 856-883, 885-909, 918-929, 953-968, 1221-1248, 1345-1400, 1415-1450, 1452-1487, 1519-1530, 1565-1584, 1586-1600, 1602-1612, 1620-1629, 1973-1983, 1985-2011, 2025-2052` | script `awk` propio (**verificado por mí**) |
| **Funciones completas duplicadas y comentadas**, conviviendo con su reemplazo | **3** | `mergeGiftTableSection` (829-976 vs 979-1298), `mergeFamilySection` (1302-1636 vs 1639-1825), `mergeSuggestionsSection` (1957-2060 vs 2062-2202) | C2§4.1-4.4; declaraciones **verificadas por mí** |
| Funciones **definidas y nunca llamadas** | **4** | `buildTimeRange` (:774, **0 referencias en todo `src/main/kotlin`**), `getFallbackFamilyText` (:1844, **0 referencias**), `createDefaultFamilyItem` (:1828, 9 referencias, **todas comentadas**), `createDefaultFamilyGroup` (:1837, 5 referencias, **todas comentadas**) | `grep -rn` sobre `src/main/kotlin` (**verificado por mí, uno a uno**) |
| Método de repositorio muerto | **1** | `DefaultContentConfigRepository.findByEventTypeIdAndPlanIdAndTemplateId` (:37) — 1 sola ocurrencia, su declaración | grep (**verificado por mí**) |
| Data class muerta | **1** | `EditorModels.kt:423` `FamilySubItem` — 1 sola ocurrencia | grep (**verificado por mí**) |
| Parámetros / defaults muertos | **3** | `createDefaultEditText(content, id = null)` (:2720, ninguna llamada pasa `id`); default `id = "msj${bodyIndex+1}"` de `bodyFromTemplate` (:1062, ninguna llamada lo omite); `mergeStartedSection(invitation, ...)` (:2665) recibe `invitation` y **no lo usa** | C2#14, C2#17 |
| **Ramas `if` con brazos idénticos byte a byte** | **2** | `usesSplitBankLayout` (:1025) decide entre `:1157-1188` y `:1190-1221`, **idénticos** (`diff` normalizado propio: la única diferencia es el inicio del bloque comentado de `:1221`). `mergeDressCodeSection`: `"predefined"` (:2380-2490) y `"standard"` (:2493-2602) son **idénticos**, 108 líneas significativas cada uno (`diff` propio tras renombrar la variable local: **0 diferencias**) | **verificado por mí con `diff`** |
| Condicional sin efecto | **2** (duplicado) | `if (item.eventLocation.contains("(Dale clic")) item.eventLocation else "${item.eventLocation}"` en `:627-633` y `:746-752`: ambas ramas devuelven lo mismo | C1#1 |
| **Código inalcanzable** (no comentado) | **~79 líneas** | `:2240-2266` (story: tras el early-return de `:2212`, `userStory.isNotEmpty()` de `:2217` es siempre true) y `:2608-2659` (dresscode: tras el early-return de `:2281`, `userDressCode != null` de `:2341` es siempre true por smart-cast). Consecuencia funcional: **`contentTemplate.story` no se usa jamás** | C2#13; early-returns **verificados por mí** en `:2212-2214` |
| Bloque de fallback de dress code repetido | **4 copias** | `:2285-2313, 2444-2484, 2556-2596, 2609-2656` (la cuarta, inalcanzable) | C2§4.6 |
| **Consultas redundantes a Postgres** por generación | **3 round-trips** | `invitationPersonRepository.findAllByInvitationId` × **3** (`:216` cover, `:252` couple, `:1726` family) e `invitationPhraseRepository.findAllByInvitationId` × **2** (`:253`, `:1650`), todas con los mismos parámetros | `grep -n` (**verificado por mí**) |
| Consulta a Mongo **siempre fallida** | 1 por generación | `defaultContentConfigRepository.findByTemplateId(templateId)` (:70): **ninguno** de los 9 `default_content_*.json` trae `templateId` (**verificado por mí**), así que siempre se ejecuta también el fallback de `:72` | C1#17, J#11 |
| Total de consultas Postgres por generación | 6 (mínimo) a **16** (máximo) | — | C1§2 |
| **`catch (Exception)` que silencian errores** | **26** en todo `src/main/kotlin`; **6** en la ruta crítica de plantillas, de los cuales **2 completamente vacíos** | `MongoDataInitializer.kt:68` (vacío), `:71` (**vacío**, envuelve la creación del índice único), `:91-93` y `:124-126` (solo `logger.error` con `e.message`, **sin stack trace**); `InvitationConfigService.kt:158` (traga la excepción tipada y la convierte en `IllegalStateException`); `DefaultConfigGeneratorService.kt:824` (benigno, `formatEventDate`) | `grep -rn` (**verificado por mí**) |
| Handlers de excepción **inalcanzables** | **3** | `InvitationConfigNotFoundException` (handler 404 en `GeneralExceptionHandler.kt:175-185`, **nunca lanzada en todo el repo**); `DefaultVisualTemplateNotFoundException` y `DefaultContentTemplateNotFoundException` (handlers 500 en `:187-206`, inalcanzables porque el `catch` de `InvitationConfigService.kt:158` intercepta antes). No hay handler para `IllegalStateException` ni catch-all: 19 `@ExceptionHandler` en total, **verificado por mí** | D#3, D#4, X§5 |
| **Cobertura de pruebas** | **0 tests, 7 dependencias de test declaradas** | `src/` contiene solo `main` (**verificado por mí**); `build.gradle.kts:79-85` declara `spring-boot-starter-test`, `kotlin-test-junit5`, `spring-security-test`, `mockito-kotlin`, `junit-platform-launcher`, `h2` y `de.flapdoodle.embed.mongo` — el entorno está montado y no hay ni un archivo que lo use | **verificado por mí** |
| Historia de cambios | **1 commit** en `src/main` | `git log --oneline -- src/main` → `d142778` (los otros 6 commits son los informes de esta auditoría) | **verificado por mí** |
| Basura empaquetada en el JAR | 2 archivos | `src/main/resources/data/mongo/bash.exe.stackdump` (530 B, volcado de crash de Cygwin, viaja dentro del artefacto); `payload-template-2.json` en la raíz, **0 bytes** | B#20, J#10 |
| JSON huérfanos sin ningún consumidor | 2 (358 KB) | `payload-template-boda-3.json` (185 KB), `payload-template-graduacion.json` (173 KB) — cero referencias en `.kt/.sh/.js/.yml` | J#2 |
| Credenciales en texto plano en el flujo de alta | 1 | `scripts/create_complete_template.sh:5-6` (`EMAIL` y `PASSWORD` de MASTER por defecto, commiteados) — **hallazgo propio**; se suma a las credenciales de `application.yml` reportadas por D#9 | **verificado por mí** |
| Documentación que contradice al código | ≥7 afirmaciones | `HOTFIX_ADD_TEMPLATES_CAMBIOS.md` L12, L87, L127, L128, L145, L200-207 | B§7 |
| Comentarios que contradicen al código | **4** | `:1090` (`// ⚠️ aquí no tienes customName en backend` — sí existe, `InvitationEntity.kt:265`); `:1940` (`// Esto dejará el null` — deja `emptyList()`); `EditorModels.kt:264` y `:274` (`EventDate` documentado como "Fecha" contiene horas y `EventTime` como "Hora" contiene la fecha; el generador es el que está bien); `EditorModels.kt:389` ("El JSON de bodas debe actualizarse" — ya se actualizó) | C2#5, C2#30, C1#22, J§9 |

---

## 7. Contradicciones entre informes detectadas (no resueltas por mí)

Solo encontré **imprecisiones de citación**, no contradicciones sustantivas nuevas. Las que corresponden a la lista de correcciones ya conocida (siembra visual, URL del correo, cierre de la clase en 2744) no las reabro. Las que sí anoto:

1. **Número de línea del upsert de contenido en el seeder.** C1 (hallazgo 17) cita `MongoDataInitializer.kt:127-133`; B (§5) y J citan `:118-123`. **Cita dudosa: la de C1.** Motivo: el archivo tiene **128 líneas** en total y el bloque `findByEventTypeIdAndPlanId(...).ifPresentOrElse(...)` está en `:118-123` (**abierto y verificado por mí**). La línea 127-133 no existe. La afirmación de fondo de C1 es correcta; solo el rango está mal.

2. **Número de línea del índice único.** C1 (§8) cita `MongoDataInitializer.kt:68-76`; C3 (§4) y B (§6) citan `:65-72`. **Cita dudosa: la de C1.** El método `ensureUniqueIndexes()` va de `:65` a `:72`, con el `ensureIndex` en `:70` (**verificado por mí**). Sustancia idéntica.

3. **Líneas de los campos obligatorios de `DefaultContentConfig`.** C1 (§6) cita `DefaultContentConfig.kt:38,46,51,56,61`; C2 (§8) cita `:41,47,52,57,62`. **La correcta es la de C2** (`images`=41, `phrases`=47, `itinerary`=52, `giftRegistry`=57, `music`=62, **verificado por mí**). La de C1 apunta a los KDoc inmediatamente anteriores.

4. **Ubicación del magic number `12L`.** C2 (hallazgo 18 y §7.4) lista `2069, 2129, 2156, 2177`. **Matiz, no error:** `:2069` es la asignación `val templateId = invitation.template.id`; las comparaciones `templateId == 12L` reales están en `:2129, :2156, :2177` (**verificado por mí**). Cito las tres.

5. **Líneas de las dependencias de test.** D (§7) cita `build.gradle.kts:82-87`; las declaraciones están en **`:79-85`** (**verificado por mí**). El recuento de 7 dependencias es correcto.

6. **Volumen de código comentado en el tramo 829-2743.** C2 (§4.1, hallazgo 32) da **≈556 líneas** contando solo bloques contiguos de ≥3 líneas; mi conteo de **todas** las líneas que empiezan por `//` en ese mismo rango da **594**. No es una contradicción: son dos métricas distintas y ambas son correctas bajo su definición. Uso 607 (archivo completo) y 594 (tramo) por ser el conteo directo.

Ninguna de estas seis altera una conclusión. **No encontré ninguna contradicción sustantiva entre informes que requiera arbitraje.**

---

## 8. Lo que está bien resuelto y no debería tocarse

1. **La disciplina anti-`NullPointerException` del generador es ejemplar y hay que preservarla.** Cero `!!`, cero `.single()`, cero indexaciones sin guarda en 2743 líneas; el único `.first()` (`:391`) está protegido por `isNotEmpty()` en `:389`, y los cuatro `visualFamily.items[0]/[1]` (`:1748, 1770, 1774, 1796`) tienen su comprobación de `size` en la línea inmediatamente anterior. Verificado por C1§8, C2§10 y por mí con grep. Cualquier refactor debe mantener este invariante.

2. **El contrato "plantilla visual nula → sección nula" es uniforme en las 12 funciones de merge** (`:187, 214, 249, 414, 488, 985, 1644, 1857, 2067, 2208, 2276, 2669`). Nunca se fabrica una sección desde cero, así que nunca se publica una sección sin maquetación. Es una decisión de diseño correcta.

3. **La resolución de la plantilla visual falla ruidosamente en vez de inventarse un fallback** (`:47-54`). Servir una invitación con el diseño de otra plantilla sería mucho peor que un 500. Lo que hay que arreglar es la ruta del error (que la excepción tipada llegue al cliente), no la estrictez.

4. **La guarda anti-duplicado de la generación perezosa.** `if (existingConfig.isPresent)` (`InvitationConfigService.kt:138`) + `catch` que relee el documento ganador (`:158-163`) es el patrón correcto: el lock optimiza el caso común y el índice único es la garantía real. **No tocar la estructura de ese `try/catch`** — solo hay que asegurarse de que el índice exista de verdad y de que el `catch` no borre el tipo de la excepción.

5. **`ReentrantLock` por invitación en lugar de un `synchronized` global** (`:32`, `:132`): no serializa el editor entero por un cliente lento. La elección es correcta; solo la retirada del mapa (`:169-170`) tiene una carrera.

6. **`bodyFromTemplate` (`:1057-1075`) es el mejor patrón de fallback del archivo**: `getOrNull(bodyIndex) ?: firstOrNull() ?: createDefaultEditText("")`. Degrada en tres escalones sin lanzar y conserva el estilo de la plantilla. Se reutiliza bien en `:1687, 1705, 1802, 1864, 1910, 1934, 2116, 2150, 2172`. Es el modelo a extender, no a sustituir.

7. **`formatEventDate` (`:784-823`) está bien construida**: `LocalDate` sin zona horaria (correcto para una fecha de evento), `try/catch` con fallback razonable, y — crucialmente — indexa los mapas por `date.dayOfWeek.toString()` y `monthValue`, no por `getDisplayName(..., Locale)`, lo que hace la salida **determinista entre entornos**. El problema es que no se reutiliza en `sectionCouple`, no la función en sí.

8. **La validación de precondiciones relacionales es correcta y consistente** entre `createTemplate`, `createCompleteTemplate` y `updateTemplate` (`MasterTemplatesService.kt:36-48, 87-100, 250-262`): existencia **y** `isEnabled` de evento y plan antes de escribir nada. No conviene relajarlo.

9. **`listAllFiltered` filtra en cascada por `eventType.isEnabled` y `invitationPlan.isEnabled`**, no solo por el `isEnabled` de la plantilla (`MasterTemplatesService.kt:333-336`). Es un detalle correcto y fácil de perder en una refactorización, y es lo que impide que el catálogo público exponga plantillas de tipos de evento retirados.

10. **La autorización jerárquica está centralizada en un único servicio** (`HierarchyValidationService.validateInvitationAccess`) y todos los puntos de entrada delegan en él; no hay una segunda implementación paralela de la regla. Los endpoints públicos de RSVP verifican además `invitation.isEnabled`, `customer.isEnabled` y `!customer.isBanned`.

11. **`hardDeleteInvitation` sí limpia Mongo** (`InvitationAdminService.kt:377-379`). Es el modelo a replicar en `hardDeleteUser`, no algo a cambiar.

12. **`DefaultContentConfig` y sus 13 clases anidadas llevan `@JsonIgnoreProperties(ignoreUnknown = true)` de forma consistente** (J§9). Es lo que hace que `_comment` en dos JSON de contenido se descarte limpiamente. Ese criterio debería extenderse a las 10 clases de `EditorModels.kt` que no lo tienen, no retirarse de donde está.

13. **El seeder preserva el `_id` al actualizar** (`MongoDataInitializer.kt:84`, `config.copy(id = existing.id)`), de modo que el upsert no rompe referencias. El comportamiento destructivo es discutible; la preservación del `_id` no lo es.

---

## 9. Preguntas que no pude responder y por qué

1. **Cuántos documentos huérfanos, duplicados y plantillas fuera de Flyway existen hoy.** El repositorio prueba que el mecanismo existe (modo #8: un huérfano por intento fallido; modo #3: duplicados posibles) y que ya se usó (los ids 11, 12, 16 y 17 no están en ninguna migración). El alcance real exige `db.default_visual_configs.count()`, `db.default_content_configs.aggregate([{$group:{_id:{e:"$eventTypeId",p:"$planId"},n:{$sum:1}}}])` y `SELECT * FROM invitation_template` contra el entorno real. **Depende del estado de la BD.**

2. **Si los índices únicos existen realmente en la Mongo de producción.** El código solo crea el de `invitation_configs.invitationId`, y lo hace dentro de un `catch` vacío que no registra ni el éxito ni el fallo (`MongoDataInitializer.kt:66-71`). Los `@Indexed(unique = true)` de `DefaultVisualConfig.kt:23` y `EditorModels.kt:17` son inertes sin `auto-index-creation`, propiedad ausente del `application.yml` (verificado por mí). Requiere `db.<col>.getIndexes()`. **NO DETERMINABLE.**

3. **El valor actual de `invitation_template_id_seq` en cada entorno.** De él depende si la colisión del modo #9 (id 13) ya ocurrió, está por ocurrir o se esquivó. Las migraciones lo dejan en 10, pero cada `POST` posterior lo avanza, **incluidos los que terminan en rollback**.

4. **El impacto visual real de la mayoría de los modos de fallo silenciosos.** El frontend que consume el `InvitationConfig` no está en este repositorio. Puedo probar qué produce el backend (ids duplicados, `label`/`text` intercambiados, `singleplace: true` sin `itemsSinglePlace`, `music: ""` en vez de `null`, `date.hours` en formato `"4:30 PM"` sobre un placeholder `"16:30:00"`) y contrastarlo con los placeholders de las plantillas, pero no cómo se renderiza. Marcado como **INFERIDO** donde corresponde.

5. **Si el `POST /master/templates/complete` se usa realmente en producción, y con qué frecuencia.** De ello depende la probabilidad que asigné a los modos #3a, #8 y #9. La evidencia indirecta (ids 11-17 sin migración, el script `create_complete_template.sh`, los dos `payload-template-*.json` huérfanos de 358 KB) sugiere que sí, pero no hay logs ni historia git que lo confirmen.

6. **Cuánto cuesta realmente producir el JSON visual de una plantilla nueva** (paso 1 de §3a). Puedo medir el resultado (85-155 KB, hasta 149 objetos con triplete `md/sm/xs`, ~1000 valores de estilo) y constatar que **no existe ningún generador, exportador ni validador en el repositorio**; los cinco `data*Premium.ts` de la raíz parecen ser exportaciones manuales de una invitación de demo (J#8). Cuánto tiempo humano representa eso es una pregunta de proceso, no de código.

7. **Si algún entorno tiene ya `FAIL_ON_NULL_FOR_PRIMITIVES` o `StrictNullChecks` activado por configuración externa** (perfil no versionado, variables `SPRING_JACKSON_*`). X§7 lo dejó abierto. Para el seeder da igual —usa su propio `jacksonObjectMapper()` (`MongoDataInitializer.kt:27`)— pero determinaría si el riesgo latente del contrato (§4a, fila `invitationId`) ya es un fallo activo por la vía de la API.

8. **El contenido del diff `main..hotfix-add-template` que declara `HOTFIX_ADD_TEMPLATES_CAMBIOS.md:14-23`.** `src/main` tiene un único commit y ninguna de esas dos ramas existe. **NO DETERMINABLE**, igual que para B.
