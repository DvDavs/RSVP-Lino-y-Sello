package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Resultado de `structuralDiff(anterior, nueva)` (`02 §4`, paso 5). Un diff no vacío exige bump mayor
 * o un `MigrationPlan` que lo cubra (ADR-028), o el registro se rechaza con
 * `TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`.
 */
data class StructuralDiff(
    val removedBlocks: List<BlockId> = emptyList(),
    val removedSections: List<SectionKey> = emptyList(),
    val retypedBlocks: List<RetypedBlock> = emptyList(),
    val narrowedGroups: List<NarrowedGroup> = emptyList(),
    val removedPalettes: List<String> = emptyList(),
    val removedFontSets: List<String> = emptyList(),
    val removedVariants: List<RemovedVariant> = emptyList(),
) {
    val isEmpty: Boolean
        get() = removedBlocks.isEmpty() && removedSections.isEmpty() && retypedBlocks.isEmpty() &&
            narrowedGroups.isEmpty() && removedPalettes.isEmpty() && removedFontSets.isEmpty() &&
            removedVariants.isEmpty()
}

data class RetypedBlock(val id: BlockId, val from: BlockKind, val to: BlockKind)
data class NarrowedGroup(val id: BlockId, val fromMax: Int, val toMax: Int)
data class RemovedVariant(val sectionKey: SectionKey, val variant: String)
