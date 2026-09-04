package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `composed.ts` `ResolvedValue` — el valor YA resuelto que consumen los componentes de
 * sección. Aquí sí hay URLs y textos formateados; el documento nunca los lleva.
 */
sealed interface ResolvedValue { val kind: BlockKind }

data class ResolvedText(val value: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.TEXT
}
data class ResolvedRichText(val doc: RichDoc) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.RICH_TEXT
}
data class ResolvedListText(val items: List<String>) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.LIST_TEXT
}
data class ResolvedImage(val url: String, val alt: String, val focal: Focal) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.IMAGE
}
data class ResolvedAudio(val url: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.AUDIO
}
data class ResolvedDate(val value: String, val formatted: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.DATE
}
data class ResolvedTime(val value: String, val formatted: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.TIME
}
data class ResolvedDateTimeRange(val start: String, val end: String? = null, val formatted: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.DATE_TIME_RANGE
}
data class ResolvedLink(val href: String, val label: String? = null) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.LINK
}
data class ResolvedLocation(val name: String, val address: String? = null, val mapHref: String? = null) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.LOCATION
}
data class ResolvedChoice(val optionId: String, val label: String) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.CHOICE
}
data class ResolvedBoolean(val value: Boolean) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.BOOLEAN
}
data class ResolvedPerson(val name: String, val note: String? = null) : ResolvedValue {
    override val kind: BlockKind get() = BlockKind.PERSON
}

/** Espejo de `composed.ts` `ComposedBlock` / `ComposedGroup` (unión en `ComposedSection.blocks`). */
sealed interface ComposedEntry {
    val id: BlockId
    val role: BlockRole
    val type: BlockKind
    val label: String
    val provenance: Provenance
}

data class ComposedBlock(
    override val id: BlockId,
    override val role: BlockRole,
    override val type: BlockKind,
    override val label: String,
    override val provenance: Provenance,
    val value: ResolvedValue?,
) : ComposedEntry

data class ComposedItem(val itemId: ItemId, val blocks: List<ComposedBlock>)

data class ComposedGroup(
    override val id: BlockId,
    override val role: BlockRole,
    override val label: String,
    override val provenance: Provenance,
    val items: List<ComposedItem>,
) : ComposedEntry {
    override val type: BlockKind get() = BlockKind.GROUP
}

data class ComposedSection(
    val key: SectionKey,
    val type: SectionType,
    val variant: String,
    val visible: Boolean,
    val title: String,
    val blocks: List<ComposedEntry>,
)

/** Espejo de `composed.ts` `ResolvedTheme`. */
data class ResolvedFont(val family: String, val weights: List<Int>, val source: String)
data class ResolvedFonts(val heading: ResolvedFont, val body: ResolvedFont)
data class ResolvedTheme(
    val paletteId: String,
    val fontSetId: String,
    val tokens: Map<String, String>,
    val fonts: ResolvedFonts,
)

/**
 * Espejo de `composed.ts` `ComposedDocument`. Es lo ÚNICO que consumen los componentes de sección.
 * `AssetIndex` NO aparece dentro a propósito: las URLs viajan ya resueltas (ADR-1R-D-01).
 */
data class ComposedDocument(
    val composedVersion: Int,
    val template: TemplateRef,
    val locale: Locale,
    val theme: ResolvedTheme,
    /** ya ordenadas; las no visibles se incluyen con `visible = false` */
    val sections: List<ComposedSection>,
)
