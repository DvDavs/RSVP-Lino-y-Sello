package mx.evolutiondev.invitaciones.modules.templates2.domain

/** Espejo de `document.ts` `ThemeChoice`: el documento solo guarda ids, nunca colores (P3). */
data class ThemeChoice(val paletteId: String, val fontSetId: String)

/**
 * Espejo de `document.ts` `StructureEntry`. **NO existe `order`**: el orden es el del array
 * (contratos.md §3). Sin claves repetidas (I-11).
 */
data class StructureEntry(val key: SectionKey, val variant: String, val visible: Boolean)

/** Espejo de `document.ts` `Structure`. */
data class Structure(val sections: List<StructureEntry>)

/** Referencia inmutable a la versión de plantilla que este documento usa. */
data class TemplateRef(val slug: TemplateSlug, val version: SemverVersion)

/** Espejo de `document.ts` `InvitationDocument.meta`. */
data class DocumentMeta(val locale: Locale)

/**
 * Espejo de `document.ts` `InvitationDocument` — capas 2-4 del modelo. Sin URLs, colores, tamaños ni
 * fuentes: eso es del paquete de plantilla (P3).
 *
 * `attic` lleva `.default({})` en Zod y el JSON Schema emitido (`io:"input"`) **no** lo marca como
 * requerido: un documento crudo válido llega sin él (objeción O-02).
 */
data class InvitationDocument(
    val schemaVersion: Int,
    val template: TemplateRef,
    val theme: ThemeChoice,
    val structure: Structure,
    /** mapa plano por `blockId` declarado en esa versión (I-12); los grupos llevan sus ítems dentro */
    val content: Map<BlockId, BlockValue>,
    /** `{"<slug>@<version>": {blockId: value}}`; solo lo escribe el sistema (P8) */
    val attic: Map<String, Map<BlockId, BlockValue>> = emptyMap(),
    val meta: DocumentMeta,
)
