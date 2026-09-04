package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.composition.OperationError
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode

/**
 * Excepciones tipadas del **editor** (rutas 2-6 y 10-14 de `03 §2`). Las mapea el
 * `@RestControllerAdvice` de 2-5 leyendo `code`, `status` y `details`, exactamente igual que
 * `catalog.TemplateRegistryException`.
 *
 * **Por qué no heredan de `domain.Templates2Exception`**: es una `sealed class` y Kotlin exige que sus
 * subclases directas vivan en el mismo paquete; `templates2.domain` está congelado para este bloque
 * (mismo motivo y misma solución que ADR-2-3-01, para no tener tres formas distintas de error).
 *
 * `contratos.md §4` prohíbe `require`/`check`/`error()` en todo `templates2`: caerían en el `400`
 * genérico de `GeneralExceptionHandler.kt:42-52`, sin código tipado, reintroduciendo H-14. Todo fallo
 * de este bloque sale por aquí, por `TemplateRegistryException` o por `Templates2Exception`.
 */
open class EditorException(
    val code: TplErrorCode,
    message: String,
    val details: Map<String, Any?> = emptyMap(),
    cause: Throwable? = null,
) : RuntimeException(message, cause) {

    /** `code.httpStatus` (Int, no `HttpStatus`: `domain` no depende de Spring). */
    val status: Int get() = code.httpStatus
}

/** `403` — `HierarchyValidationService.validateInvitationAccess` dijo que no (ADR-015, mata H-52). */
class ForbiddenException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_FORBIDDEN, message, details)

/** `404` — ruta de documento sin haber llamado antes a `:choose-template` (X-07, `03 §3.3`). */
class DocumentNotStartedException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_DOCUMENT_NOT_STARTED, message, details)

/** `409` — la invitación aún la sirve el módulo antiguo (`02 §6`). */
class NotMigratedException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_NOT_MIGRATED, message, details)

/** `403` — `manifest.minPlanTier` > `business.planTier` en `:choose-template` (`03 §5`). */
class PlanTierInsufficientException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_PLAN_TIER_INSUFFICIENT, message, details)

/** `409` — subir de versión sin `MigrationPlan` que cubra el salto (ADR-028, `03 §3.2`). */
class MigrationPlanMissingException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_MIGRATION_PLAN_MISSING, message, details)

/**
 * `409` — `baseRevision` desactualizada (ADR-014). `details` lleva `currentRevision` y, cuando quien
 * lanza puede componerlos sin coste, `document`, `composed` y `report` para que el cliente rebase sus
 * operaciones pendientes (`03 §3.4` punto 5). No hay merge automático (`contratos.md §2`).
 */
class RevisionConflictException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_REVISION_CONFLICT, message, details)

/** `404` — `restore` de una revisión inexistente, de otro documento o ya purgada (`03 §9.2`). */
class SnapshotNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_SNAPSHOT_NOT_FOUND, message, details)

/** `422` — el documento resultante supera 1 MiB serializado (`02 §2` V32). */
class DocumentTooLargeException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_DOCUMENT_TOO_LARGE, message, details)

/** `403` — invitación deshabilitada, o su dueño deshabilitado o baneado (`03 §3.12` paso 3). */
class InvitationUnavailableException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_INVITATION_UNAVAILABLE, message, details)

/**
 * `422` — el preflight de publicación bloquea (`03 §6`). El `code` concreto viene del bloqueo:
 * `TPL_PUBLISH_BLOCKED_MISSING_REQUIRED`, `…_DEFAULT_CONTENT` o `…_INVALID_VALUES`.
 *
 * `…_DEFAULT_CONTENT` es el que mata H-03 en la vía de publicación: un bloque obligatorio que sigue
 * mostrando el valor de demostración de la plantilla **no** se publica como si fuera del cliente.
 */
class PublishBlockedException(
    code: TplErrorCode,
    message: String,
    details: Map<String, Any?> = emptyMap(),
) : EditorException(code, message, details)

/**
 * `422` — una operación del lote no es aplicable. Traduce un [OperationError] del reductor único
 * conservando **su** `TplErrorCode` (`TPL_BLOCK_UNKNOWN`, `TPL_BLOCK_NOT_EDITABLE`,
 * `TPL_ASSET_NOT_OWNED`, `TPL_ASSET_SPEC_MISMATCH`, `TPL_TEMP_ID_DUPLICATE` o `TPL_OPERATION_INVALID`)
 * y añadiendo `details.operations = [{index, code, path}]`, la forma que fija `03 §3.4` punto 1.
 *
 * El lote es **todo o nada** (ADR-014): basta una operación inválida para rechazarlo entero, y el
 * documento queda exactamente como estaba. El descarte operación por operación es del pipeline de IA
 * (`07 §4`), que no entra en esta fase.
 */
class OperationRejectedException(
    code: TplErrorCode,
    message: String,
    details: Map<String, Any?> = emptyMap(),
) : EditorException(code, message, details) {

    companion object {

        /** `03 §3.4` punto 1: `details.operations = [{index, code, path}]`. */
        fun de(error: OperationError, index: Int): OperationRejectedException {
            val entrada = mutableMapOf<String, Any?>("index" to index, "code" to error.wire)
            ruta(error)?.let { entrada["path"] = it }
            extra(error).forEach { (k, v) -> entrada[k] = v }
            return OperationRejectedException(
                code = error.code,
                message = "la operación $index del lote no es aplicable: ${error.wire}",
                details = mapOf("operations" to listOf(entrada)),
            )
        }

        private fun ruta(error: OperationError): String? = when (error) {
            is OperationError.BlockUnknown -> error.blockId.value
            is OperationError.BlockNotEditable -> error.blockId.value
            is OperationError.BlockTypeMismatch -> error.blockId.value
            is OperationError.ItemUnknown -> "${error.groupId.value}[${error.itemId}]"
            is OperationError.GroupLimit -> error.groupId.value
            is OperationError.SectionUnknown -> error.sectionKey.value
            is OperationError.SectionRequired -> error.sectionKey.value
            is OperationError.VariantUnknown -> error.sectionKey.value
            is OperationError.ThemeIdUnknown -> "theme.${error.field}"
            is OperationError.AssetNotOwned -> null
            is OperationError.AssetSpecMismatch -> null
            is OperationError.InvariantViolation -> error.violations.firstOrNull()?.path
            is OperationError.OperationInvalid -> null
            is OperationError.TempIdDuplicate -> null
        }

        /** Los campos que `03 §5` exige para poder actuar sobre el error, no solo leerlo. */
        private fun extra(error: OperationError): Map<String, Any?> = when (error) {
            // `details.source` distingue "el valor lo pone Postgres" de "lo pone la plantilla"
            // (decisión X-04: `TPL_BUSINESS_BLOCK_WRITE` no cubría el caso `fixed`).
            is OperationError.BlockNotEditable -> mapOf("source" to error.source.wire)
            is OperationError.AssetNotOwned -> mapOf("assetId" to error.assetId.value)
            is OperationError.AssetSpecMismatch ->
                mapOf("assetId" to error.assetId.value, "constraint" to error.constraint)
            is OperationError.TempIdDuplicate -> mapOf("tempId" to error.tempId)
            is OperationError.GroupLimit -> mapOf("min" to error.min, "max" to error.max)
            is OperationError.BlockTypeMismatch -> mapOf("expected" to error.expected, "got" to error.got)
            is OperationError.InvariantViolation ->
                mapOf("violations" to error.violations.map { mapOf("code" to it.wire, "path" to it.path) })
            else -> emptyMap()
        }
    }
}

/** `422` — un `tempId` que ningún `addItem` previo del lote declaró (`03 §3.4` punto 2). */
class TempIdUnresolvedException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_TEMP_ID_UNRESOLVED, message, details)

/** `422` — dos `addItem` del mismo lote declaran el mismo `tempId` (`03 §3.4` punto 2). */
class TempIdDuplicateException(message: String, details: Map<String, Any?> = emptyMap()) :
    EditorException(TplErrorCode.TPL_TEMP_ID_DUPLICATE, message, details)
