# Handoff — 1R-backend → orquestador (consolidación de `contratos.md` §4 y §5)

Entregables: `diseno/02-persistencia-y-catalogo.md` (219 → 745 líneas), `diseno/03-api.md` (135 → 655), apéndice en `diseno/09-verificacion-adversarial-seguridad.md`, `bitacora/1R-backend.md`, ADR-1R-B-01…14 (propuestas), 9 preguntas nuevas. **Sin commits.**

## A. Cambios que el orquestador DEBE volcar a `contratos.md` §5 (persistencia)

1. **Rango Flyway: `V29`-`V37`, no `V29`-`V36`.** Se añade `V37__create_tpl_asset_gc.sql` (cola de borrado de objetos S3 + trigger `trg_tpl_asset_gc`). Última migración real confirmada por `ls`: `V28__add_whatsapp_sent_column.sql`. Nombres exactos de los 9 archivos en `02 §2`. Afecta también a `00-INDICE.md` y a `06 §7`, que citan el rango viejo.
2. **Tabla nueva `tpl_asset_gc`** (8ª tabla del módulo). Sin ella no hay derecho al olvido posible tras un borrado en cascada.
3. **Integridad referencial fijada**: `ON DELETE CASCADE` hacia `invitation` (`tpl_document`, `tpl_release`, `tpl_asset`), `ON DELETE SET NULL` en toda referencia a `customer`, `ON DELETE RESTRICT` hacia `tpl_template_version`. Evidencia: el borrado físico de invitaciones y clientes existe hoy (`InvitationRepository.kt:42-43`, `InvitationAdminService.kt:382`, `AdminUsersService.kt:426,433`).
4. **Columnas nuevas**: `tpl_template_version.migration_plans jsonb` (sin ella `:choose-template` no puede migrar sin leer del disco) y `.published_by`; `tpl_document.doc_bytes` con `CHECK ≤ 1 MiB` y `.updated_by`; `tpl_document_snapshot.origin` y `.created_by`; `tpl_release.business_snapshot` (necesaria para calcular `stale` sin recomponer) y `.unpublished_at`; `tpl_asset.bucket/width/height/created_by`; `tpl_template_registration.detail/template_version_id/requested_by`.
5. **`event_kinds` pasa de `TEXT[]` a `JSONB`** (GIN `jsonb_path_ops`). Motivo: `ddl-auto: validate` (`application.yml:32`) convierte un desajuste de mapeo en caída de arranque de **toda** la aplicación, y no hay hoy ningún mapeo de array/JSON en el repositorio.
6. **Índices de idempotencia nuevos**: `ux_tpl_document_snapshot_batch (document_id, client_batch_id)`, `ux_tpl_asset_invitation_sha`, `ux_tpl_asset_version_sha`.
7. **`public_token` es `VARCHAR(30)`** (no 29) con `CHECK` de patrón; su entropía imprevisible es de **80 bits** (ULID), no 130.
8. **Mapeo JSONB**: JPA + Hibernate 6.6, `@JdbcTypeCode(SqlTypes.JSON)` sobre atributos `JsonNode` con `columnDefinition = "jsonb"`; **sin dependencias nuevas** (nada de `hypersistence-utils`). Un único `ObjectMapper` `templates2ObjectMapper` (**no `@Primary`**, con `FAIL_ON_UNKNOWN_PROPERTIES`) y `HibernatePropertiesCustomizer` que fija el `FormatMapper` — así muere H-35 en el módulo nuevo sin alterar el antiguo.
9. **Validación de esquema**: `com.networknt:json-schema-validator:1.5.4`, draft 2020-12; los `*.schema.json` emitidos se consumen desde `frontend/packages/schema/json-schema` vía `sourceSets.main.resources.srcDir(...)`; tarea Gradle **`verifyJsonSchemaEmitted`** enganchada a `check` que reemite y falla si hay deriva, más `JsonSchemaPresenceTest` e `InvariantParityTest`.

## B. Cambios que el orquestador DEBE volcar a `contratos.md` §4 (API)

1. **Siete rutas nuevas**: `GET /editor/templates2/catalog`, `GET`/`DELETE` de assets, `DELETE …/release` (despublicar), `POST …/public-token:rotate` (revocar enlace filtrado), `GET /master/templates2/versions`, `POST …/versions/{id}:deprecate`. Sin las dos primeras de release/token, un enlace filtrado era irrevocable.
2. **`baseRevision` pasa a ser obligatorio en `:choose-template` y en `restore`**, no solo en `operations`.
3. **Idempotencia del `OperationBatch` redefinida**: la clave real es `(document_id, clientBatchId)` con índice único; el reintento responde `200 {applied:false, revision:<la que produjo>}`. El argumento del borrador ("el reintento falla su chequeo de `baseRevision`") es falso en el caso de timeout.
4. **Assets del editor por cuerpo binario crudo**, no `multipart/form-data` (el multipart por defecto corta en 1 MB y elevarlo relajaría una protección del módulo antiguo). La única ruta multipart es `POST /master/templates2/versions`, que sí exige elevar `spring.servlet.multipart.max-file-size: 15MB` / `max-request-size: 64MB` — **única modificación de `application.yml` que pide este módulo**.
5. **Errores**: el cuerpo es un DTO propio `TplErrorResponse` (`timestamp, statusCode, code, message, details`), **no** `ErrorMessage` (que no tiene `code`, `ErrorMessage.kt:251-256`). El handler es `@RestControllerAdvice(basePackages = ["…templates2.api"])` con `@Order(HIGHEST_PRECEDENCE)`; incluye handler final de `Exception → 500 TPL_INTERNAL`. **Prohibido `require`/`check`/`error()` en `templates2`** (irían a parar al `400` genérico de `GeneralExceptionHandler.kt:42-52`).
6. **Códigos nuevos**: `TPL_NOT_MIGRATED`, `TPL_BUSINESS_BLOCK_WRITE`, `TPL_TEMP_ID_UNRESOLVED`, `TPL_TEMP_ID_DUPLICATE`, `TPL_ASSET_NOT_FOUND`, `TPL_ASSET_IN_USE`, `TPL_ASSET_STORAGE_UNAVAILABLE`, `TPL_DOCUMENT_TOO_LARGE`, `TPL_BODY_TOO_LARGE`, `TPL_MALFORMED_JSON`, `TPL_SNAPSHOT_NOT_FOUND`, `TPL_PUBLISH_BLOCKED_INVALID_VALUES`, `TPL_INVITATION_UNAVAILABLE`, `TPL_PACKAGE_ASSET_MISMATCH`, `TPL_VERSION_LAST_PUBLISHED`, `TPL_INTERNAL`. Tabla completa en `03 §5`.
7. **Render público**: comprueba `invitation.is_enabled`, `customer.is_enabled` y `!customer.is_banned` (igual que `PublicGuestInfoController.kt:65-75`) → `403 TPL_INVITATION_UNAVAILABLE`. La invalidación de CDN **no** es instantánea: hay ventana de `max-age` 300 s tras despublicar o rotar.
8. **`GET .../document` ya NO crea el documento** perezosamente: la creación es exclusiva de `:choose-template` (ADR-013 debe matizarse; ver C-02).
9. **Límite de cuerpo**: se aplica con `Templates2BodyLimitFilter` propio (no existe ajuste de plataforma para JSON). 768 KiB en `operations`, 8 KiB en el resto de rutas JSON.
10. **`/editor/**` no está en `SecurityConfig`**: se protege con `@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")` a nivel de clase (posible por `@EnableMethodSecurity`, `SecurityConfig.kt:17`). Los 401/403 de la cadena de filtros **no** llevan `TPL_*`.

## C. Contradicciones — estado al cerrar la ronda

Detecté cinco contra `01-dominio-y-esquema.md`/`esquema/*.ts`. **Cuatro las resolvió `1R-dominio` en paralelo durante esta misma ronda** (verificado releyendo los archivos al cerrar); solo **C-02** queda para dirimir.

| ID | Estado | Detalle |
|---|---|---|
| **C-02** | **ABIERTA — a dirimir** | ADR-013 dice que el documento de trabajo "se crea perezosamente en el primer acceso autenticado". `03 §3.3` (1R) dice que `GET .../document` responde `404 TPL_DOCUMENT_NOT_STARTED` y que **solo** `:choose-template` crea. Postura 1R: crear en el `GET` obliga al servidor a elegir una plantilla por defecto (decisión de presentación en el backend, viola P3) y reintroduce la ambigüedad de orden de H-39; además el propio borrador ya definía `TPL_DOCUMENT_NOT_STARTED`, incoherente con la creación perezosa. Postura ADR-013: menos viajes para el editor. **Decide el orquestador**; si gana ADR-013, hay que quitar `TPL_DOCUMENT_NOT_STARTED` de la tabla de errores y definir qué plantilla se elige por defecto. |
| C-01 | cerrada por `1R-dominio` | `richText` sin validación de longitud → `esquema/invariants.ts` ya trae `richTextLength()` y el caso `"richText"` en `validateValueAgainstSpec` (I-16). El tope de 1 MiB por documento de `02 §2` V32 **se mantiene** como defensa en profundidad. |
| C-03 | cerrada por `1R-dominio` | `StructureEntry.order` → el orden es el del array; el ejemplo de `01 §4` ya no lo muestra. |
| C-04 | cerrada por `1R-dominio` | clave de `attic` → `document.ts` usa `AtticKey` = `<slug>@<semver>`. Coincide con lo que asumen `03 §3.2`/`§3.6`. |
| C-05 | cerrada por `1R-dominio` | `CompositionReport` → `stillDefault`/`invalidValues` en `composed.ts` y en `01 §5`; `fallbacks` eliminado. `03 §6` (preflight) depende de `stillDefault` y queda coherente. |

Observación adicional (no contradicción, pero conviene decidir): `AssetIndex` (`esquema/composed.ts`) no aparece dentro de `ComposedDocument` — las URLs van ya resueltas en `ResolvedValue`. O se usa o sobra.

## D. ADR propuestas

`ADR-1R-B-01` a `ADR-1R-B-14`, todas con estado **propuesta**, al final de `decisiones.md`. Las que cambian contratos vigentes: 02 (`migration_plans`), 03 (`V37`/GC de S3), 04 (cascadas), 05 (despublicar + rotar token), 08 (JPA en vez de JDBC), 09 (`event_kinds` JSONB), 11 (`baseRevision` en restore/choose-template), 12 (assets por cuerpo crudo), 13 (advice propio + `TplErrorResponse`), 14 (`Templates2BodyLimitFilter`).
