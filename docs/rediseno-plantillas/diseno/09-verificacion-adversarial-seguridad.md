# 09 — Verificación adversarial: persistencia, API y seguridad

Autor: fase 1, rol `1-adv-seguridad` (ronda 2). Objetivo: romper `02-persistencia-y-catalogo.md`, `03-api.md` y `04-frontend-y-editor.md` (superficie iframe/postMessage): autorización, fallo parcial, ids inyectables, límites.

Método: para cada control de seguridad que el diseño afirma tener (P8), se buscó el punto exacto del pipeline donde se aplicaría y se verificó si de verdad cierra el caso o solo lo cierra en apariencia.

---

## Casos que SÍ están cubiertos (verificado, no objeción)

- **`_id` inyectable (H-13)**: `invitationId` siempre viene de la ruta, nunca del body; `itemId`/`assetId` los genera el servidor — verificado en `03 §1`, `esquema/common.ts` (`AssetId`/`Ulid` regex), `esquema/operations.ts` (`TempId` solo se resuelve a `Ulid` del lado servidor). Cerrado correctamente para el caso original de H-13.
- **Autorización uniforme**: `HierarchyValidationService` reusado en toda ruta `/editor/**` (`03 §1`, ADR-015) — un solo punto, no una autorización paralela que pueda divergir.
- **Contrato de errores uniforme**: tabla `TPL_*` (`03 §5`) — mata H-52 (403 vs. 400 inconsistente) al fijar un código por caso.
- **Fallo parcial en el registro de plantillas**: transacción única + tabla de auditoría append-only (`02 §4`) — un intento fallido no deja fila huérfana en `tpl_template`/`tpl_template_version` (verificado contra el flujo de 4 pasos).
- **Body sin límite (H-45)**: límite explícito de 256 KiB + `operations ≤ 50` (`03 §8`) — ver S-05 más abajo para una inconsistencia de cálculo, pero el control en sí existe.

## Objeciones

### S-01 (ALTA) — `assetId` no se valida por propiedad: un usuario autorizado puede referenciar el asset de OTRA invitación
**Documento/sección atacada**: `03-api.md` §3.3 (`setBlock`/`setItemBlock` con `ImageValue`/`AudioValue`), §5 (tabla de errores — no existe un código para este caso); `02-persistencia-y-catalogo.md` §2.3 (`tpl_asset`, sin verificación de pertenencia documentada en ningún punto del pipeline de escritura de `03`).

**Ataque**: `POST .../assets` (`03 §3.4`) sube un asset y devuelve `assetId` — hasta aquí, correcto (`tpl_asset.invitation_id = invitationId` de la ruta autorizada). Pero cuando ese `assetId` se usa después dentro de una `Operation` (`setBlock {blockId: "cover.image", value: {kind:"image", assetId: "as_...", ...}}`), el pipeline de validación descrito (`03 §3.3`: "cada Operation se valida contra el manifiesto... antes de aplicar") solo valida **forma** (`AssetId` regex, `01 §3.2`/`esquema/common.ts`) — no valida que ese `assetId` pertenezca a `tpl_asset` con `invitation_id = invitationId` (o `template_version_id` de la plantilla vigente, para assets propios de la plantilla). Un usuario A con acceso legítimo a su invitación 100, que en algún momento vio (por captura de red, por ser ADMIN con acceso jerárquico a otra invitación, o por casualidad de un enlace compartido) el `assetId` de una foto de la invitación 200 de otro cliente, puede escribir ese `assetId` en su propio documento. La composición (`compose()`) resolvería igualmente la URL (pertenece a un bucket público, `S3Buckets.kt`/`ASSETS`, según `03 §7`) — el resultado visible es que la foto privada de otro cliente aparece en la invitación del atacante. Es la misma familia de riesgo que H-13 (referenciar un recurso ajeno por id), reintroducida en un punto que el diseño no cubrió.

**Consecuencia real**: fuga de fotos entre clientes (menor severidad que el H-13 original porque no permite ESCRIBIR sobre la invitación ajena, pero sí exponer/reutilizar su contenido — sigue siendo una violación de P8 y potencialmente de privacidad de datos de otro cliente).

**Corrección propuesta**: en el paso de validación de cada `Operation` que porta un `assetId` (`03 §3.3`, antes de aplicar), añadir una comprobación de pertenencia: `SELECT 1 FROM tpl_asset WHERE public_id = ? AND (invitation_id = ? OR template_version_id = ?)` (invitationId de la ruta, template_version_id vigente del documento) — si no hay fila, `422 TPL_ASSET_NOT_OWNED`. Añadir esta comprobación también al pipeline de IA (`07 §4`, que ya declara el principio pero no el mecanismo concreto — esta es la implementación de ese principio).

### S-02 (MEDIA) — La ruta de registro de plantillas no está en la tabla de rutas de la API
**Documento/sección atacada**: `03-api.md` §2 (tabla de rutas — no incluye ninguna ruta de registro); `02-persistencia-y-catalogo.md` §4 (menciona "CLI o endpoint MASTER" en prosa, sin ruta ni verbo HTTP exactos).

**Ataque conceptual**: no es un ataque ejecutable, es una omisión de especificación que un implementador de fase 2 tendría que resolver por su cuenta — exactamente el tipo de ambigüedad que el criterio de terminado de esta fase ("concreto para que Sonnet implemente sin volver a diseñar") prohíbe. Sin una ruta fija con su exigencia de rol explícita en la MISMA tabla que el resto de la API, hay riesgo de que se implemente sin la verificación de rol MASTER que `02 §4` da por sentada pero no ata a un control de Spring Security concreto.

**Corrección propuesta**: añadir a `03 §2`: `POST /master/templates2/versions` (rol `MASTER` exclusivamente, verificado por el mismo mecanismo de roles que protege hoy `modules/master/**` — no `HierarchyValidationService`, que es para invitaciones, sino el chequeo de rol simple ya usado en el resto de `modules/master`), body = paquete completo (manifest+theme+defaults+assets en base64 o multipart), respuesta según `02 §4` (created/noop/rejected).

### S-03 (MEDIA) — `sandbox="allow-scripts allow-same-origin"` anula buena parte del aislamiento real del iframe
**Documento/sección atacada**: `04-frontend-y-editor.md` §3.

**Ataque conceptual**: `allow-scripts` + `allow-same-origin` juntos en un `<iframe sandbox>` es un patrón de sandbox-bypass conocido: el contenido del iframe, al considerarse "mismo origen", puede en principio manipular su propio atributo `sandbox` o acceder al `document` del padre si hay algún punto de contacto adicional no anticipado — el sandboxing deja de aportar una barrera real, solo una separación cosmética. El propio diseño (ADR-018) ya decidió comunicarse EXCLUSIVAMENTE por `postMessage`, sin necesitar acceso directo al DOM del padre — es decir, **no hay ninguna razón funcional para `allow-same-origin`** en este iframe.

**Consecuencia real**: si en el futuro `packages/sections` introdujera una vulnerabilidad de renderizado (p. ej. al añadir un tipo de bloque que sí requiera HTML enriquecido, o un bug real en el mapeo de `RichDoc`), el sandbox actual no contendría el impacto tanto como debería, precisamente porque ya está debilitado por `allow-same-origin`.

**Corrección propuesta**: quitar `allow-same-origin` del `sandbox` del iframe (`04 §3`): `sandbox="allow-scripts"` a secas. Verificar en fase 3 que ningún flujo real dependa de acceso same-origin (no debería, dado que todo pasa por `postMessage`); si `next/image` u otro mecanismo interno de Next.js resultara necesitar same-origin dentro del iframe, es una señal de que la arquitectura de canvas necesita revisarse, no de que haya que restaurar el flag débilmente.

### S-04 (referencia, ya cerrado en ronda 1) — Patrón de `blockId`/`sectionKey` sin acotar
Ya identificado y corregido proactivamente por 1-dominio como ADR-020 (`01 §2.2`) antes de esta ronda adversarial — se cita aquí solo para que el registro quede completo y trazable, no es una objeción abierta.

### S-05 (MEDIA) — Límites de tamaño inconsistentes entre esquema y transporte
**Documento/sección atacada**: `03-api.md` §8 (límite de body 256 KiB) vs. `esquema/operations.ts` (`OperationBatch.operations ≤ 50`) + `esquema/blocks.ts` (`RichTextSpec.constraints.maxLength` hasta 8000 caracteres).

**Ataque**: un lote legítimo de 50 operaciones `setBlock` sobre bloques `richText` cercanos al máximo (8000 caracteres cada uno) pesa, solo en el campo `value`, del orden de 50 × 8 KB ≈ 400 KB antes de contar el resto del JSON (estructura de `RichDoc`, escapes) — supera holgadamente el límite de transporte de 256 KiB propuesto. El esquema permite construir un lote que la capa HTTP rechazaría igual, aunque cada operación individual sea válida.

**Corrección propuesta**: elevar el límite de body HTTP a 768 KiB (margen sobre el cálculo anterior con overhead de JSON) **o** documentar explícitamente que el límite de transporte es intencionalmente más bajo que el máximo teórico del esquema, y que el cliente (`04 §4`, autoguardado) debe trocear un lote que se acerque al límite antes de enviarlo. Se recomienda la primera opción (subir el límite) por ser más simple de implementar y no reduce ninguna protección real (256 KiB vs. 768 KiB no cambia la naturaleza del límite, solo evita rechazar tráfico legítimo).

### S-06 (BAJA) — Sin límite de tasa explícito en el render público
**Documento/sección atacada**: `03-api.md` §7.

**Corrección propuesta**: no bloqueante — anotar en `03 §7` que la capa de despliegue (CDN/reverse proxy, fuera de alcance de este módulo) debe aplicar un límite de tasa básico por IP sobre `/public/i/**` como defensa en profundidad, aunque `publicToken` no sea adivinable por fuerza bruta en la práctica (26 caracteres Crockford base32 ≈ 130 bits de entropía).

### S-07 (BAJA) — Restricción de implementación no explícita contra XSS vía `richText`
**Documento/sección atacada**: `04-frontend-y-editor.md` §1/§6 (no menciona explícitamente cómo debe renderizarse `RichDoc`).

**Corrección propuesta**: añadir una frase explícita en `04 §6`: el renderer de `RichTextBlock` mapea nodos de `RichDoc` a elementos React directamente (`<strong>`, `<em>`, `<a href>` con la misma validación `HttpUrl` que el resto del esquema) — **nunca** serializar a string HTML ni usar `dangerouslySetInnerHTML`. El esquema (`esquema/blocks.ts`, `RichSpan`/`RichParagraph`/`RichDoc`) ya está diseñado para hacer esto natural (marcas cerradas, sin HTML libre); falta decirlo como restricción de implementación explícita para que fase 3 no lo reintroduzca por comodidad.

---

## Resumen de severidad

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 1 | S-01 |
| Media | 3 | S-02, S-03, S-05 |
| Baja | 2 | S-06, S-07 |
| Ya cerrado (referencia) | 1 | S-04 |

## Resolución (ronda 3)

| ID | Severidad | Corrección aplicada | ADR |
|---|---|---|---|
| S-01 | Alta | `03-api.md` §3.3 + §5: verificación de pertenencia de `assetId` (`invitation_id`/`template_version_id`) antes de aplicar cualquier operación; `TPL_ASSET_NOT_OWNED`; heredado por `07-extension-ia.md` §4 | ADR-030 |
| S-02 | Media | `03-api.md` §2: ruta `POST /master/templates2/versions` formalizada, rol MASTER explícito | ADR-033 |
| S-03 | Media | `04-frontend-y-editor.md` §3: `sandbox="allow-scripts"`, sin `allow-same-origin` | ADR-031 |
| S-05 | Media | `03-api.md` §8: límite de body elevado de 256 KiB a 768 KiB | ADR-032 |
| S-06 | Baja | `03-api.md` §7: nota de límite de tasa en la capa de despliegue | — (recomendación operativa, sin ADR) |
| S-07 | Baja | `04-frontend-y-editor.md` §6: restricción explícita — `RichDoc` se mapea a elementos React, nunca a HTML string | — (aclaración de implementación, sin ADR) |

**Cero objeciones de severidad alta abiertas** tras esta ronda.

---

# Apéndice 1R-backend — segunda ronda adversarial (2026-09-03)

Autor: `1R-backend` (revisión independiente de `02-persistencia-y-catalogo.md` y `03-api.md`). Método distinto al de la ronda 2: en vez de atacar solo el texto del diseño, cada control se contrastó contra **el código real del repositorio** (`SecurityConfig`, `GeneralExceptionHandler`, `HierarchyValidationService`, `S3Service`, `S3KeyService`, `InvitationRepository`, `application.yml`, `build.gradle.kts`). De ahí salen ataques que la ronda 2 no podía ver, porque asumía que el diseño encajaba con la plataforma.

## Ataques nuevos y su resultado

| # | Ataque | Resultado contra el diseño de la ronda 2 | Resultado tras la corrección |
|---|---|---|---|
| T-01 | **Borrar una invitación desde la administración** cuando ya tiene documento `templates2` | **Rompe**: `InvitationRepository.kt:42-43` ejecuta `DELETE FROM invitation` (usado en `InvitationAdminService.kt:382` y `AdminUsersService.kt:426`); las FK del borrador no declaraban `ON DELETE`, luego la operación fallaría por violación de clave foránea. Denegación de servicio funcional sobre una función existente | Cerrado: `ON DELETE CASCADE` hacia `invitation`, `SET NULL` hacia `customer`, `RESTRICT` hacia `tpl_template_version` (`02 §2` V31/V32/V34) |
| T-02 | **Derecho al olvido**: borrar al cliente y comprobar que sus fotos desaparecen de S3 | **Falla**: la cascada borra `tpl_asset` sin pasar por código de `templates2`, dejando los objetos en S3 y **sin ninguna fila que registre su clave**. Imposible cumplir el borrado a posteriori | Cerrado: trigger `trg_tpl_asset_gc` + tabla `tpl_asset_gc` (`02 §2` V37) + `AssetGcJob` (`02 §10.3`) |
| T-03 | **Reenviar un `OperationBatch` tras un timeout de red** (el cliente nunca vio la respuesta, su `baseRevision` sigue siendo la vieja) | **Rompe**: el lote se aplica **dos veces**; en un `addItem` eso duplica ítems de galería, en un `setBlock` pisa el texto. La "idempotencia por `clientBatchId`" del borrador solo funcionaba si el cliente ya había actualizado su revisión, que es justo el caso que no ocurre | Cerrado: `ux_tpl_document_snapshot_batch` + respuesta `200 {applied:false}` (`03 §3.4`) |
| T-04 | **Enlace público filtrado** (se comparte por WhatsApp y llega a quien no debe) | **Sin defensa**: no existía ninguna ruta para rotar el token ni para despublicar. El diseño lo llamaba explícitamente "estable de por vida" | Cerrado: `POST …/public-token:rotate` y `DELETE …/release` (`03 §3.10`, `§3.13`), con la ventana de caché documentada |
| T-05 | **Deshabilitar una invitación** (soft delete de la administración) y volver a abrir el enlace público | **Rompe**: el render seguiría sirviendo el release. El módulo antiguo sí bloquea ese caso (`PublicGuestInfoController.kt:65-75`), luego era una regresión de seguridad respecto a lo que ya existe | Cerrado: `TPL_INVITATION_UNAVAILABLE` comprobando `invitation.is_enabled`, `customer.is_enabled`, `customer.is_banned` (`03 §3.15`) |
| T-06 | **Cliente autenticado que engorda su propio documento** con `richText` legítimo, lote tras lote | **Rompe**: `validateValueAgainstSpec` (`esquema/invariants.ts:93-134`) no tiene rama `richText`, así que `RichTextSpec.constraints.maxLength` nunca se aplica; el esquema puro permite ~4·10⁶ caracteres por valor. Sin tope de documento, la tabla se degrada por TOAST y las lecturas del editor se hunden | Mitigado: tope de 1 MiB por documento (`doc_bytes` + `CHECK`, `TPL_DOCUMENT_TOO_LARGE`). La causa raíz (invariante ausente) **quedó cerrada durante la ronda 1R**: `esquema/invariants.ts` ya trae `case "richText"` con `richTextLength` (I-16). El tope de 1 MiB se mantiene como defensa en profundidad |
| T-07 | **Cuerpo JSON de 50 MB** contra `POST …/document/operations` | **Rompe**: el borrador confiaba en un "límite de body de Spring MVC" que **no existe** para `application/json` (`server.tomcat.max-http-form-post-size` solo cubre formularios; `spring.servlet.multipart.*` solo multipart). H-45 seguía vivo en el módulo nuevo | Cerrado: `Templates2BodyLimitFilter` por `Content-Length` y por lectura contada, con cuerpo de error propio (`03 §8`, `§10.4`) |
| T-08 | **Provocar un `require()`** en una ruta del módulo nuevo (por ejemplo, un id mal formado que el código valide con `require`) | **Rompe el contrato de errores**: `GeneralExceptionHandler.kt:42-52` tiene `@ExceptionHandler(IllegalArgumentException::class)` → `400` **sin `code`**. Es H-14 reintroducido en el módulo nuevo por la puerta de atrás del lenguaje | Cerrado: advice propio con `@Order(HIGHEST_PRECEDENCE)` acotado por `basePackages`, prohibición de `require`/`check` y prueba de arquitectura (`03 §10.1`, caso 39 de `03 §12`) |
| T-09 | **Leer el `code` del error** que promete el contrato | **No existe**: `core/error/model/ErrorMessage.kt:251-256` solo tiene `timestamp`, `statusCode`, `errorsListed`, `errors`. El contrato prometía algo imposible sin modificar el núcleo | Cerrado: DTO propio `TplErrorResponse` (`03 §10.2`), sin tocar `core/error` |
| T-10 | **Subir un asset de 6 MB** por la ruta de assets | **Rompe**: no hay configuración de multipart en el repositorio, luego rige el 1 MB por defecto de Spring Boot. Además, elevar el límite global relajaría la protección del módulo antiguo, cuyo control propio (`FileValidationService.kt:11`) es de 5 MB y hoy ni se alcanza | Cerrado: subida por **cuerpo binario crudo** con límite propio de 15 MiB (`03 §3.7`); la única ruta multipart es la de MASTER, cuyo cambio de configuración se declara explícitamente |
| T-11 | **Subir un PNG declarándolo `image/webp`** | **Pasa**: el diseño validaba solo el `content-type` declarado, igual que el módulo antiguo (`FileValidationService.kt:21-24`) | Cerrado: comprobación de número mágico además del tipo declarado (`03 §3.7`) |
| T-12 | **Publicar mientras otra pestaña autoguarda** | **Corrompe la traza**: sin bloqueo, `tpl_release.document_revision` puede no corresponder al `composed` congelado — un release que miente sobre qué revisión publicó | Cerrado: `SELECT … FOR UPDATE` al abrir la transacción de publicación (`02 §11.2`) |
| T-13 | **`restore` desde una pestaña con estado viejo** mientras otra guarda | **Pisa trabajo ajeno en silencio**: `restore` solo recibía `{revision}`, sin control optimista | Cerrado: `baseRevision` obligatorio en `restore` y en `:choose-template` (`03 §3.6`, `§3.2`) |
| T-14 | **`tempId` colgado dentro de un lote** (`setItemBlock` con un `tempId` que ningún `addItem` declaró) | **Indefinido**: el esquema lo permite (`esquema/operations.ts:8,15-17`) y el diseño no decía qué hacer; una implementación ingenua crearía un ítem fantasma o lanzaría `NullPointerException` → 500 | Cerrado: `TPL_TEMP_ID_UNRESOLVED` / `TPL_TEMP_ID_DUPLICATE` y mapa explícito por lote (`03 §3.4` punto 2) |
| T-15 | **Registro de plantilla rechazado**: buscar la fila de auditoría | **No hay fila**: la auditoría se escribía en la misma transacción que después se revierte. La tabla que existe para matar H-16/H-17 no auditaba precisamente los fallos | Cerrado: `Propagation.REQUIRES_NEW` en `TemplateRegistrationAuditor` (`02 §2` V35) |
| T-16 | **Registrar dos versiones del mismo slug a la vez** desde dos sesiones MASTER | **Carrera**: ambas calculan el diff estructural contra la misma versión anterior y ambas pasan; una de las dos rompe la semántica de semver sin que nada lo note | Cerrado: `SELECT … FOR UPDATE` sobre la fila del slug (`02 §4` paso 3) |
| T-17 | **Añadir `event_kinds TEXT[]`** y arrancar la aplicación | **Riesgo de caída total**: `spring.jpa.hibernate.ddl-auto: validate` (`application.yml:32`) hace que un desajuste de mapeo tumbe el arranque de **toda** la aplicación, no solo del módulo nuevo. Ninguna entidad del repositorio usa hoy arrays ni JSON, así que sería el primer mapeo exótico | Cerrado: `event_kinds JSONB`, ningún array SQL, `columnDefinition = "jsonb"` obligatorio y lista de tipos prohibidos (`02 §8.3`) |
| T-18 | **Dos `ObjectMapper` con reglas distintas** (H-35 reintroducido) | **Latente**: el diseño no decía cuál se usa. Con el de Spring (que ignora claves desconocidas) el módulo violaría P1 en la primera deserialización | Cerrado: `templates2ObjectMapper` único, **no `@Primary`**, con `FAIL_ON_UNKNOWN_PROPERTIES`, y `FormatMapper` de Hibernate apuntando a él (`02 §8.1`) |
| T-19 | **Confiar en los bytes de `jsonb`** para el hash | **Rompe R9**: `jsonb` no preserva orden de claves ni espacios; el hash calculado al releer no coincidiría con el guardado | Cerrado: el hash se calcula siempre sobre el JSON canónico de la aplicación, nunca sobre lo leído en crudo (`02 §1` punto 3, `§7.2` `CanonicalJson.kt`) |
| T-20 | **Reutilizar `S3KeyService.generateInvitationAssetKey`** como decía `03 §3.4` | **Imposible y contraproducente**: ese método no produce la clave que el diseño citaba y además inyecta un `UUID.randomUUID()` (`S3KeyService.kt:136`), lo que impide toda idempotencia de reintento y multiplica los objetos huérfanos | Cerrado: `Templates2S3KeyService` con claves deterministas por `sha256` (`02 §10.1`) |
| T-21 | **`previewUrl` de "corta duración"** | **Es de 7 días**: `S3Service.generatePresignedUrl` tiene `duration: Duration = Duration.ofDays(7)` por defecto (`S3Service.kt:33`); llamarlo sin argumento contradice el propio texto del diseño | Cerrado: duración explícita de 15 minutos (`03 §3.7`) |
| T-22 | **Editar en `templates2` una invitación que aún sirve el módulo antiguo** | **Estado mixto**: exactamente H-04/H-05 reintroducido en el módulo nuevo, porque nada ataba las rutas nuevas a la bandera | Cerrado: `409 TPL_NOT_MIGRATED` mientras `uses_templates2 = false` y la invitación tenga `invitation_configs` (`02 §6`) |
| T-23 | **Purgar snapshots con la consulta del borrador** | **Consulta inválida**: `NOT IN (SELECT … ORDER BY … LIMIT 200)` no está correlacionada como el texto suponía; purgaría de más o fallaría | Cerrado: reescrita con `max(revision) - 200` y borrado por lotes (`02 §5.1`) |
| T-24 | **Enumerar tokens públicos** distinguiendo respuestas | **Sin oráculo** ya en la ronda 2 (misma respuesta para token inexistente y sin release) — **verificado, no es objeción**. Se añade el mismo criterio a `DELETE /assets/{id}` (`404`, no `403`) y a `/exists` (`false`, no `404`) | reforzado |
| T-25 | **Alcanzar el 500 genérico** con una excepción no prevista | **Posible**: sin handler de `Exception` en el módulo, cualquier fallo inesperado salía por el mecanismo de Spring, con `server.error.include-message: always` (`application.yml:3-6`) | Cerrado: handler final `Exception → 500 TPL_INTERNAL`, con traza solo en el log (`03 §10.3` punto 9) |

## Resumen de severidad (ronda 1R, bloque backend)

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 9 | B-01, B-02, B-03, B-05, B-07 · A-01, A-05, A-07, A-10, A-11, A-13 (11 contando ambos documentos) |
| Media | 14 | B-04, B-06, B-08, B-09, B-10, B-11, B-12 · A-02, A-03, A-04, A-06, A-08, A-12, A-14, A-15 |
| Baja | 5 | B-13, B-14, B-15 · A-09, A-16 |

Todas cerradas en `02 §14` y `03 §15`. **Cero objeciones altas abiertas** tras esta ronda.

La causa raíz de T-06 (`richText` sin invariante de longitud) quedó **mitigada** en el backend con el tope de 1 MiB por documento y, al cerrar esta ronda, **también resuelta en el esquema**: `1R-dominio`, trabajando en paralelo, añadió `richTextLength()` y el caso `"richText"` a `validateValueAgainstSpec` (`esquema/invariants.ts`, invariante I-16). El tope de documento se mantiene igualmente: protege contra la acumulación de muchos valores válidos, no solo contra un valor gigante. Lo mismo ocurrió con las contradicciones C-03 (`StructureEntry.order`), C-04 (clave de `attic`) y C-05 (`CompositionReport.fallbacks`). **C-02 quedó dirimida** (X-07 / ADR-1R-X-03): la creación es exclusiva de `:choose-template` y `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED`.
