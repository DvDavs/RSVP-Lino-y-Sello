package mx.evolutiondev.invitaciones.modules.templates2.domain

/** Espejo de `manifest.ts` `MigrationOp` — catálogo CERRADO de 11 operaciones declarativas (`01 §6.2`). */
sealed interface MigrationOp {
    /** literal `op` que viaja en JSON */
    val op: String

    data class RenameBlock(val from: BlockId, val to: BlockId) : MigrationOp {
        override val op: String get() = "renameBlock"
    }
    /** al `attic`, nunca borra */
    data class RemoveBlock(val id: BlockId) : MigrationOp {
        override val op: String get() = "removeBlock"
    }
    /** toma el default de la versión destino */
    data class AddBlock(val id: BlockId) : MigrationOp {
        override val op: String get() = "addBlock"
    }
    data class RenameSection(val from: SectionKey, val to: SectionKey) : MigrationOp {
        override val op: String get() = "renameSection"
    }
    data class RemoveSection(val key: SectionKey) : MigrationOp {
        override val op: String get() = "removeSection"
    }
    data class RenamePalette(val from: String, val to: String) : MigrationOp {
        override val op: String get() = "renamePalette"
    }
    data class RenameFontSet(val from: String, val to: String) : MigrationOp {
        override val op: String get() = "renameFontSet"
    }
    data class ChangeBlockType(val id: BlockId, val converterId: ConverterId) : MigrationOp {
        override val op: String get() = "changeBlockType"
    }
    data class MoveIntoGroup(val blockId: BlockId, val groupId: BlockId, val itemBlockId: BlockId) : MigrationOp {
        override val op: String get() = "moveIntoGroup"
    }
    data class FlattenGroup(val groupId: BlockId, val itemBlockId: BlockId, val toBlockId: BlockId) : MigrationOp {
        override val op: String get() = "flattenGroup"
    }
    /** el excedente va al `attic` */
    data class ShrinkGroup(val groupId: BlockId, val max: Int) : MigrationOp {
        override val op: String get() = "shrinkGroup"
    }
}

/** Espejo de `manifest.ts` `MigrationPlan` (`migrations/<from>-to-<to>.json`). */
data class MigrationPlan(
    val templateSlug: TemplateSlug,
    val from: SemverVersion,
    val to: SemverVersion,
    val ops: List<MigrationOp>,
)
