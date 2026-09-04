package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSet
import mx.evolutiondev.invitaciones.modules.templates2.domain.Palette
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedFont
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedFonts
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedTheme
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeFallback
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeSpec

/**
 * R8 de `01 §5.2`: `theme` del documento → `defaultPaletteId`/`defaultFontSetId` de la plantilla,
 * registrando `themeFallback`. Es la rama que **ninguno** de los dos golden de `golden/templates/`
 * ejercita (`themeFallback` es `null` en los dos), y por eso `golden/compose/r8-*` existe.
 */
object ThemeResolver {

    data class Resultado(val tema: ResolvedTheme, val fallback: ThemeFallback?)

    fun resolve(theme: ThemeSpec, eleccion: ThemeChoice): Resultado {
        var paletteId = eleccion.paletteId
        var fontSetId = eleccion.fontSetId
        var pedidaPaleta: String? = null
        var pedidaFuente: String? = null

        var paleta: Palette? = theme.palettes.firstOrNull { it.id == paletteId }
        if (paleta == null) {
            pedidaPaleta = paletteId
            paletteId = theme.defaultPaletteId
            paleta = theme.palettes.firstOrNull { it.id == paletteId }
        }
        var fuentes: FontSet? = theme.fontSets.firstOrNull { it.id == fontSetId }
        if (fuentes == null) {
            pedidaFuente = fontSetId
            fontSetId = theme.defaultFontSetId
            fuentes = theme.fontSets.firstOrNull { it.id == fontSetId }
        }

        // I-09 garantiza que los ids por defecto existen; si aun así faltaran, `compose` NO lanza
        // (01 §5.1): se emite un tema vacío y el informe ya trae el fallback.
        val tokens = paleta?.let {
            linkedMapOf(
                "bg" to it.tokens.bg, "surface" to it.tokens.surface, "ink" to it.tokens.ink,
                "accent" to it.tokens.accent, "accentInk" to it.tokens.accentInk, "muted" to it.tokens.muted,
            )
        } ?: linkedMapOf()

        val cabecera = fuentes?.heading?.let { ResolvedFont(it.family, it.weights, it.source.wire) }
            ?: ResolvedFont("", emptyList(), "")
        val cuerpo = fuentes?.body?.let { ResolvedFont(it.family, it.weights, it.source.wire) }
            ?: ResolvedFont("", emptyList(), "")

        val fallback = if (pedidaPaleta != null || pedidaFuente != null) ThemeFallback(pedidaPaleta, pedidaFuente) else null
        return Resultado(ResolvedTheme(paletteId, fontSetId, tokens, ResolvedFonts(cabecera, cuerpo)), fallback)
    }
}
