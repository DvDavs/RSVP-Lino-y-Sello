package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `operations.ts` `Operation` — catálogo CERRADO de **11** operaciones (ADR-1R-X-01 añadió
 * `clearItemBlock`). Un solo reductor las aplica para el editor humano, el autoguardado y la IA (ADR-014).
 *
 * En operaciones ENTRANTES un ítem puede referirse por id temporal (`tmp:<...>`); el servidor devuelve
 * `idMap tmp→ULID`. Por eso `itemId` es `String` y no `ItemId`: el tipo fuerte solo aplica a lo persistido.
 */
sealed interface Operation {
    val op: String

    data class SetBlock(val blockId: BlockId, val value: ScalarValue) : Operation {
        override val op: String get() = "setBlock"
    }
    data class ClearBlock(val blockId: BlockId) : Operation {
        override val op: String get() = "clearBlock"
    }
    data class AddItem(
        val groupId: BlockId, val tempId: String,
        val values: Map<BlockId, ScalarValue>, val index: Int? = null,
    ) : Operation {
        override val op: String get() = "addItem"
    }
    data class RemoveItem(val groupId: BlockId, val itemId: String) : Operation {
        override val op: String get() = "removeItem"
    }
    data class MoveItem(val groupId: BlockId, val itemId: String, val toIndex: Int) : Operation {
        override val op: String get() = "moveItem"
    }
    data class SetItemBlock(
        val groupId: BlockId, val itemId: String, val blockId: BlockId, val value: ScalarValue,
    ) : Operation {
        override val op: String get() = "setItemBlock"
    }
    /**
     * ADR-1R-X-01: borra el valor de un `itemBlock` dentro de un ítem. Sin ella la inversa de un
     * `setItemBlock` sobre un itemBlock SIN valor previo no es expresable, y el sustituto que proponía
     * `04 §10.3` promovía contenido de demostración a contenido de usuario (reabre H-03).
     */
    data class ClearItemBlock(val groupId: BlockId, val itemId: String, val blockId: BlockId) : Operation {
        override val op: String get() = "clearItemBlock"
    }
    data class SetSectionVisible(val sectionKey: SectionKey, val visible: Boolean) : Operation {
        override val op: String get() = "setSectionVisible"
    }
    data class SetSectionVariant(val sectionKey: SectionKey, val variant: String) : Operation {
        override val op: String get() = "setSectionVariant"
    }
    /** `order` debe ser una PERMUTACIÓN exacta de las claves actuales (I-24); el esquema solo mide longitud. */
    data class ReorderSections(val order: List<SectionKey>) : Operation {
        override val op: String get() = "reorderSections"
    }
    data class SetTheme(val paletteId: String? = null, val fontSetId: String? = null) : Operation {
        override val op: String get() = "setTheme"
    }
}

/**
 * Espejo de `operations.ts` `OperationBatch` (cuerpo de `POST …/document/operations`).
 * La idempotencia real del lote es `(document_id, clientBatchId)` con índice único (ADR-1R-B-03).
 */
data class OperationBatch(
    val baseRevision: Long,
    val clientBatchId: String,
    val operations: List<Operation>,
)

/** Espejo de `operations.ts` `EditProposal`. Solo el tipo: la IA no se implementa en la fase 2 (ADR-027). */
data class EditProposal(
    val sectionKey: SectionKey,
    val rationale: String,
    val operations: List<Operation>,
)
