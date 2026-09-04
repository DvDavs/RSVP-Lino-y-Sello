package mx.evolutiondev.invitaciones.modules.templates2.domain

/** Espejo de `manifest.ts` `Palette.tokens`. Los colores viven SOLO aquí, nunca en el documento (P3). */
data class PaletteTokens(
    val bg: String, val surface: String, val ink: String,
    val accent: String, val accentInk: String, val muted: String,
)

/** Espejo de `manifest.ts` `Palette`. */
data class Palette(val id: String, val name: LocalizedText, val tokens: PaletteTokens)

/** Espejo de `manifest.ts` `FontFace`. */
data class FontFace(val family: String, val weights: List<Int>, val source: FontSource)

/** Espejo de `manifest.ts` `FontSet`. */
data class FontSet(val id: String, val name: LocalizedText, val heading: FontFace, val body: FontFace)

/** Espejo de `manifest.ts` `ThemeSpec` (`theme.json`): presets del autor; el documento solo referencia ids. */
data class ThemeSpec(
    val palettes: List<Palette>,
    val fontSets: List<FontSet>,
    /** debe pertenecer a `palettes` (I-09) */
    val defaultPaletteId: String,
    /** debe pertenecer a `fontSets` (I-09) */
    val defaultFontSetId: String,
)
