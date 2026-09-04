package mx.evolutiondev.invitaciones.modules.templates2.migration

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.NarrowedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.RemovedVariant
import mx.evolutiondev.invitaciones.modules.templates2.domain.RetypedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructuralDiff
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage

/**
 * `structuralDiff(anterior, nueva)` del paso 5 de `02 §4`. Un diff no vacío exige bump **mayor** más
 * un `MigrationPlan` que lo cubra (ADR-028), o el registro se rechaza con
 * `TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`.
 *
 * Solo mira lo que puede **romper un documento ya escrito**: lo que desaparece o se estrecha. Añadir
 * un bloque, una sección, una variante o una paleta no entra en el diff — es compatible por
 * construcción, porque R2 le da su default y R1c lo coloca en su sitio.
 *
 * Puro y sin E/S. Todas las listas van ordenadas para que el informe sea determinista (R9).
 */
object StructuralDiffCalculator {

    fun diff(anterior: TemplatePackage, nueva: TemplatePackage): StructuralDiff {
        val antes = anterior.manifest.topLevelBlocks()
        val ahora = nueva.manifest.topLevelBlocks()

        val removedBlocks = mutableListOf<BlockId>()
        val retyped = mutableListOf<RetypedBlock>()
        val narrowed = mutableListOf<NarrowedGroup>()
        for (id in antes.keys.sortedBy { it.value }) {
            val a = antes.getValue(id)
            val b = ahora[id]
            if (b == null) { removedBlocks.add(id); continue }
            if (a.type != b.type) { retyped.add(RetypedBlock(id, a.type, b.type)); continue }
            if (a is GroupSpec && b is GroupSpec && b.max < a.max) narrowed.add(NarrowedGroup(id, a.max, b.max))
        }

        val seccionesAhora = nueva.manifest.sections.associateBy { it.key }
        val removedSections = mutableListOf<SectionKey>()
        val removedVariants = mutableListOf<RemovedVariant>()
        for (s in anterior.manifest.sections.sortedBy { it.key.value }) {
            val n = seccionesAhora[s.key]
            if (n == null) { removedSections.add(s.key); continue }
            for (v in s.variants.sorted()) if (!n.variants.contains(v)) removedVariants.add(RemovedVariant(s.key, v))
        }

        val removedPalettes = anterior.theme.palettes.map { it.id }
            .filter { id -> nueva.theme.palettes.none { it.id == id } }.sorted()
        val removedFontSets = anterior.theme.fontSets.map { it.id }
            .filter { id -> nueva.theme.fontSets.none { it.id == id } }.sorted()

        return StructuralDiff(
            removedBlocks = removedBlocks,
            removedSections = removedSections,
            retypedBlocks = retyped,
            narrowedGroups = narrowed,
            removedPalettes = removedPalettes,
            removedFontSets = removedFontSets,
            removedVariants = removedVariants,
        )
    }
}
