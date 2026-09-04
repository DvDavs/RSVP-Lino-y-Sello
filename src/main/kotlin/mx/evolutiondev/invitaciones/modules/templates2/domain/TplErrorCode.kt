package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Catálogo cerrado de códigos de error del módulo. **Fuente única** de la tabla de `03-api.md §5`
 * (ADR-016); `ErrorCatalogParityTest` (fase 2-4) comprueba que enum y tabla coinciden.
 *
 * `httpStatus` es un `Int` y no `org.springframework.http.HttpStatus` a propósito: `02 §7.1` exige que
 * `templates2.domain` no dependa de Spring. La capa `api` traduce el entero a `HttpStatus`.
 *
 * El prefijo `TPL_AI_*` queda **reservado sin enumerar** (decisión X-14): la IA no entra en fase 1 ni 2.
 */
enum class TplErrorCode(val httpStatus: Int) {
    TPL_FORBIDDEN(403),
    TPL_NOT_MIGRATED(409),
    TPL_DOCUMENT_NOT_STARTED(404),
    TPL_TEMPLATE_VERSION_NOT_FOUND(404),
    TPL_PLAN_TIER_INSUFFICIENT(403),
    TPL_MIGRATION_PLAN_MISSING(409),
    TPL_REVISION_CONFLICT(409),
    TPL_OPERATION_INVALID(422),
    TPL_BLOCK_UNKNOWN(422),
    TPL_BLOCK_NOT_EDITABLE(422),
    TPL_TEMP_ID_UNRESOLVED(422),
    TPL_TEMP_ID_DUPLICATE(422),
    TPL_ASSET_NOT_OWNED(422),
    TPL_ASSET_SPEC_MISMATCH(422),
    TPL_ASSET_NOT_FOUND(404),
    TPL_ASSET_IN_USE(409),
    TPL_ASSET_TOO_LARGE(413),
    TPL_ASSET_TYPE_UNSUPPORTED(415),
    TPL_ASSET_QUOTA_EXCEEDED(409),
    TPL_ASSET_STORAGE_UNAVAILABLE(502),
    TPL_DOCUMENT_TOO_LARGE(422),
    TPL_BODY_TOO_LARGE(413),
    TPL_MALFORMED_JSON(400),
    TPL_SNAPSHOT_NOT_FOUND(404),
    TPL_PUBLISH_BLOCKED_MISSING_REQUIRED(422),
    TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT(422),
    TPL_PUBLISH_BLOCKED_INVALID_VALUES(422),
    TPL_RELEASE_NOT_FOUND(404),
    TPL_INVITATION_UNAVAILABLE(403),
    TPL_MANIFEST_INVALID(422),
    TPL_PACKAGE_ASSET_MISMATCH(422),
    TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR(422),
    TPL_VERSION_HASH_MISMATCH(409),
    TPL_VERSION_LAST_PUBLISHED(409),
    TPL_INTERNAL(500),
}
