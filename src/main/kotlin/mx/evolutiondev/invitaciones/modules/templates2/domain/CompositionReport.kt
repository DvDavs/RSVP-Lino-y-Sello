package mx.evolutiondev.invitaciones.modules.templates2.domain

/** Entrada de `CompositionReport.invalidValues`. */
data class InvalidValue(val blockId: BlockId, val code: String)

/** Paleta/tipografía a la que R8 tuvo que caer porque la elegida no existe. `null` si no hubo caída. */
data class ThemeFallback(val paletteId: String? = null, val fontSetId: String? = null)

/**
 * Espejo de `composed.ts` `CompositionReport`. Tiene **una sola forma** y es exactamente esta
 * (contratos.md §3): `fallbacks` NO existe.
 *
 * RIESGO HEREDADO (objeción O-12 de `bitacora/2-0a-REV.md`): `compose()` de TypeScript **nunca**
 * puebla `invalidValues`, y los dos `reporte.json` de `golden/templates/` congelan `[]`. Reproducirlo
 * a ciegas haría que TS y Kotlin coincidan en un silencio que viola P1. Es decisión del bloque 2-2.
 */
data class CompositionReport(
    val missingRequired: List<BlockId>,
    val stillDefault: List<BlockId>,
    val orphanContent: List<BlockId>,
    val orphanSections: List<SectionKey>,
    val invalidValues: List<InvalidValue>,
    val themeFallback: ThemeFallback?,
)

/** Espejo de `composed.ts` `CompositionResult`. */
data class CompositionResult(val composed: ComposedDocument, val report: CompositionReport)
