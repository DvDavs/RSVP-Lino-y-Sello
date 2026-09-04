package mx.evolutiondev.invitaciones.modules.templates2.domain

/** Espejo de `manifest.ts` `SectionSpec`. NO existen `hideable` ni `defaultOrder` (contratos.md §3). */
data class SectionSpec(
    val key: SectionKey,
    val type: SectionType,
    val title: LocalizedText,
    val variants: List<String>,
    /** debe pertenecer a `variants` (I-08) */
    val defaultVariant: String,
    val required: Boolean = false,
    val defaultVisible: Boolean = true,
    val blocks: List<BlockSpec>,
)

/** Espejo de `manifest.ts` `AssetEntry`. */
data class AssetEntry(
    val path: String,
    val sha256: String,
    val contentType: AssetContentType,
    val bytes: Int,
)

/**
 * Espejo de `manifest.ts` `TemplateManifest` (`template.json`).
 * **NO** existe `TemplateManifest.theme`: el tema vive en `theme.json` (contratos.md §3).
 */
data class TemplateManifest(
    val manifestVersion: Int,
    val slug: TemplateSlug,
    val version: SemverVersion,
    val name: LocalizedText,
    val description: LocalizedText? = null,
    val eventKinds: List<EventKind>,
    val minPlanTier: Int = 1,
    val locales: List<Locale>,
    val capabilities: List<Capability> = emptyList(),
    val previewImage: String? = null,
    val sections: List<SectionSpec>,
    val assets: List<AssetEntry> = emptyList(),
    /** versiones con plan en `migrations/<from>-to-<version>.json` */
    val migrationsFrom: List<SemverVersion> = emptyList(),
) {
    /** Índice `blockId → spec` de los bloques de primer nivel (los `itemBlocks` NO entran: I-10). */
    fun topLevelBlocks(): Map<BlockId, BlockSpec> =
        sections.flatMap { it.blocks }.associateBy { it.id }
}
