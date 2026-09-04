package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage

/**
 * Normalización de un documento contra el manifiesto vigente (`02 §7.3`, ADR-029). Lo usan
 * `:choose-template` y `restore`: un documento restaurado desde un snapshot antiguo, o recién creado,
 * puede traer claves que la versión vigente ya no declara.
 *
 * **Nada se borra**: todo lo que sale de `content` va al `attic`, indexado por `<slug>@<version>` del
 * propio documento (ADR-006). El `attic` no se poda nunca automáticamente.
 *
 * Es pura y no genera identificadores.
 */
object DocumentNormalizer {

    data class Resultado(val doc: InvitationDocument, val toAttic: List<BlockId>, val removedSections: List<SectionKey>)

    fun normalize(doc: InvitationDocument, pkg: TemplatePackage): Resultado {
        val m = pkg.manifest
        val specs = m.topLevelBlocks()
        val secciones = m.sections.associateBy { it.key }

        // 1. `content`: fuera lo no declarado y lo que no es del usuario (I-12 e I-21).
        val alAttic = LinkedHashMap<BlockId, BlockValue>()
        val contenido = LinkedHashMap<BlockId, BlockValue>()
        for (k in doc.content.keys.sortedBy { it.value }) {         // orden estable: el de `jsonb` no lo es
            val spec = specs[k]
            val v = doc.content.getValue(k)
            if (spec == null || spec.source != BlockSource.USER) alAttic[k] = v else contenido[k] = v
        }

        // 2. `structure`: fuera las claves desconocidas y las repetidas; dentro las que faltan, en su
        //    posición relativa del manifiesto (mismo criterio que R1c, para que el editor y el render
        //    no discrepen sobre el orden).
        val vistas = LinkedHashSet<SectionKey>()
        val entradas = mutableListOf<StructureEntry>()
        val quitadas = mutableListOf<SectionKey>()
        for (e in doc.structure.sections) {
            val s = secciones[e.key]
            if (s == null) { quitadas.add(e.key); continue }
            if (!vistas.add(e.key)) continue
            entradas.add(
                StructureEntry(
                    key = e.key,
                    variant = if (s.variants.contains(e.variant)) e.variant else s.defaultVariant,
                    visible = if (s.required) true else e.visible,
                ),
            )
        }
        for (i in m.sections.indices) {
            val s = m.sections[i]
            if (vistas.contains(s.key)) continue
            var pos = 0
            for (j in i - 1 downTo 0) {
                val k = entradas.indexOfFirst { it.key == m.sections[j].key }
                if (k >= 0) { pos = k + 1; break }
            }
            entradas.add(pos, StructureEntry(s.key, s.defaultVariant, if (s.required) true else s.defaultVisible))
            vistas.add(s.key)
        }

        // 3. `theme`: un id que la versión vigente no declara se sustituye por el de la plantilla
        //    (I-20 rechazaría el documento en la siguiente escritura si se dejara como está).
        val paletteId = if (pkg.theme.palettes.any { it.id == doc.theme.paletteId }) doc.theme.paletteId
        else pkg.theme.defaultPaletteId
        val fontSetId = if (pkg.theme.fontSets.any { it.id == doc.theme.fontSetId }) doc.theme.fontSetId
        else pkg.theme.defaultFontSetId

        val attic = doc.attic.toMutableMap()
        if (alAttic.isNotEmpty()) {
            val clave = "${doc.template.slug.value}@${doc.template.version}"
            attic[clave] = (attic[clave] ?: emptyMap()) + alAttic
        }

        return Resultado(
            doc = doc.copy(
                theme = doc.theme.copy(paletteId = paletteId, fontSetId = fontSetId),
                structure = Structure(entradas),
                content = contenido,
                attic = attic,
            ),
            toAttic = alAttic.keys.toList(),
            removedSections = quitadas,
        )
    }
}
