package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructuralDiff

/**
 * Forma serializable del diff estructural: `details.diff` de `03 §3.17` y `detail` de la auditoría
 * (`02 §2` V35) usan **la misma**, para que lo que ve el autor de la plantilla en la respuesta HTTP y
 * lo que queda en `tpl_template_registration` no puedan divergir.
 */
object StructuralDiffWire {
    fun de(d: StructuralDiff): Map<String, Any?> = mapOf(
        "removedBlocks" to d.removedBlocks.map { it.value },
        "removedSections" to d.removedSections.map { it.value },
        "retypedBlocks" to d.retypedBlocks.map { mapOf("id" to it.id.value, "from" to it.from.wire, "to" to it.to.wire) },
        "narrowedGroups" to d.narrowedGroups.map { mapOf("id" to it.id.value, "fromMax" to it.fromMax, "toMax" to it.toMax) },
        "removedPalettes" to d.removedPalettes,
        "removedFontSets" to d.removedFontSets,
        "removedVariants" to d.removedVariants.map { mapOf("sectionKey" to it.sectionKey.value, "variant" to it.variant) },
    )
}

/**
 * Lo que devuelve un registro que **no** fue rechazado (`02 §4`, `03 §3.17`).
 *
 * `domain.RegistrationResult` (congelado en 2-0b) distingue `Created` de `NoopSameHash` pero no lleva
 * el `templateVersionId` ni el recuento de assets que la respuesta HTTP necesita, así que se envuelve
 * aquí en vez de tocar `domain` (ADR-2-3-01).
 *
 * `alreadyRegistered = true` es **el punto entero de este bloque**: un paquete cuyo `package_hash` ya
 * está registrado responde `200` diciéndolo, nunca un descarte mudo ni un `409` opaco
 * (`contratos.md §4`, ADR-008 con la fórmula corregida de ADR-1R-D-03).
 */
data class TemplateRegistrationOutcome(
    val result: RegistrationResult,
    val templateVersionId: Long,
    val slug: String,
    val version: String,
    val packageHash: String,
    val assetsRegistered: Int,
    /** diff estructural contra la versión publicada anterior; `null` si es la primera versión */
    val structuralDiff: StructuralDiff? = null,
) {
    val alreadyRegistered: Boolean get() = result is RegistrationResult.NoopSameHash

    /** El diff en la forma que viaja por HTTP; `null` si es la primera versión de la plantilla. */
    val structuralDiffWire: Map<String, Any?>? get() = structuralDiff?.let { StructuralDiffWire.de(it) }

    /** Literal de `ck_tpl_template_registration_result` y del campo `result` de `03 §3.17`. */
    val wire: String
        get() = when (result) {
            is RegistrationResult.Created -> "created"
            is RegistrationResult.NoopSameHash -> "noop_same_hash"
            is RegistrationResult.Rejected -> "rejected"
        }
}
