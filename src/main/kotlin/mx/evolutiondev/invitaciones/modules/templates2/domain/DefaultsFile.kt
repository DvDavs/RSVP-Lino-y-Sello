package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `manifest.ts` `DefaultsFile` (`defaults.json`): contenido de demostración por id de bloque.
 * Toda clave debe ser un `blockId` de primer nivel del manifiesto (I-10) y no puede apuntar a un
 * bloque `source: "business"` (I-28: sería contenido muerto, R4 lo ignora siempre).
 */
data class DefaultsFile(
    val templateSlug: TemplateSlug,
    val templateVersion: SemverVersion,
    val content: Map<BlockId, BlockValue>,
)
