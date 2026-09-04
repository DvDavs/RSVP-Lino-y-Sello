package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `blocks.ts` `BlockValue` — los 14 tipos de valor que viven en `doc.content[blockId]` y en
 * `defaults.json`. Discriminados por `kind`, igual que la unión discriminada de Zod.
 */
sealed interface BlockValue { val kind: BlockKind }

/** Todo valor que NO es grupo (`blocks.ts` `ScalarValue`). Los grupos no anidan (`01 §2.5`). */
sealed interface ScalarValue : BlockValue

data class TextValue(val value: String) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.TEXT
}

/** `blocks.ts` `RichSpan` */
data class RichSpan(val text: String, val marks: List<RichMark>? = null, val href: String? = null)
/** `blocks.ts` `RichParagraph` */
data class RichParagraph(val content: List<RichSpan>)
/** `blocks.ts` `RichDoc` */
data class RichDoc(val content: List<RichParagraph>)

data class RichTextValue(val doc: RichDoc) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.RICH_TEXT
}

data class ListTextValue(val items: List<String>) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.LIST_TEXT
}

/** `blocks.ts` `Focal` — punto focal normalizado 0..1. */
data class Focal(val x: Double, val y: Double)

data class ImageValue(val assetId: AssetId, val alt: String, val focal: Focal) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.IMAGE
}

data class AudioValue(val assetId: AssetId) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.AUDIO
}

data class DateValue(val value: String) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.DATE
}

data class TimeValue(val value: String) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.TIME
}

/** Invariante NO expresable en el esquema: `end >= start` (I-01). */
data class DateTimeRangeValue(val start: String, val end: String? = null) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.DATE_TIME_RANGE
}

data class LinkValue(val href: String, val label: String? = null) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.LINK
}

data class LocationValue(val name: String, val address: String? = null, val mapHref: String? = null) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.LOCATION
}

/** Invariante NO expresable en el esquema: `optionId ∈ spec.options` (I-02). */
data class ChoiceValue(val optionId: String) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.CHOICE
}

data class BooleanValue(val value: Boolean) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.BOOLEAN
}

data class PersonValue(val name: String, val note: String? = null) : ScalarValue {
    override val kind: BlockKind get() = BlockKind.PERSON
}

/**
 * `blocks.ts` `GroupItem` — identidad estable (ULID del servidor, ADR-020) + valores por id de bloque
 * RELATIVO al grupo. El merge por id estable de P2 se hace sobre `itemId`, nunca por índice.
 */
data class GroupItem(val itemId: ItemId, val values: Map<BlockId, ScalarValue>)

/** Invariantes NO expresables: `itemId` únicos (I-03) y `spec.min ≤ items.size ≤ spec.max` (I-04). */
data class GroupValue(val items: List<GroupItem>) : BlockValue {
    override val kind: BlockKind get() = BlockKind.GROUP
}
