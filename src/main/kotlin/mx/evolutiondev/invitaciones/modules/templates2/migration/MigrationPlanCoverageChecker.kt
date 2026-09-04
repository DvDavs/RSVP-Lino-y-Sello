package mx.evolutiondev.invitaciones.modules.templates2.migration

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationOp
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructuralDiff
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage

/**
 * ADR-028, paso 5 de `02 §4`: el registro de una versión nueva **exige** que cada elemento del diff
 * estructural esté cubierto por una operación del `MigrationPlan`. Si falta cobertura de alguno,
 * el registro se rechaza con `TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR`.
 *
 * Sin esta comprobación, `migrate()` acabaría devolviendo `MIG_RESULT_INVALID` **en producción, por
 * invitación**, en vez de rechazar el paquete una sola vez en el registro: el caso literal de
 * `01 §6.3` es el `max` de un grupo que baja sin `shrinkGroup` en el plan.
 *
 * Puro. Devuelve la lista de elementos **no cubiertos**, en texto estable y ordenado; vacía = cubierto.
 */
object MigrationPlanCoverageChecker {

    /** Un elemento del diff que ningún `MigrationOp` del plan atiende. */
    data class Uncovered(val kind: String, val target: String, val expectedOps: List<String>)

    /** `blockId → sectionKey` de la versión ANTERIOR: `removeSection` cubre los bloques de su sección. */
    fun seccionPorBloque(anterior: TemplatePackage): Map<BlockId, SectionKey> {
        val r = LinkedHashMap<BlockId, SectionKey>()
        for (s in anterior.manifest.sections) for (b in s.blocks) r[b.id] = s.key
        return r
    }

    /** Sobrecarga cómoda para `TemplateRegistrar` (2-3): calcula el índice de secciones por su cuenta. */
    fun uncovered(anterior: TemplatePackage, diff: StructuralDiff, plan: MigrationPlan?): List<Uncovered> =
        uncovered(diff, plan, seccionPorBloque(anterior))

    fun uncovered(
        diff: StructuralDiff, plan: MigrationPlan?, seccionDeBloque: Map<BlockId, SectionKey> = emptyMap(),
    ): List<Uncovered> {
        if (diff.isEmpty) return emptyList()
        val ops = plan?.ops ?: emptyList()

        // Índices por tipo de operación: qué identificadores atiende cada una.
        val bloquesAtendidos = mutableSetOf<String>()
        val seccionesAtendidas = mutableSetOf<String>()
        val gruposEstrechados = mutableSetOf<String>()
        val bloquesRetipados = mutableSetOf<String>()
        val paletasAtendidas = mutableSetOf<String>()
        val fuentesAtendidas = mutableSetOf<String>()
        val variantesAtendidas = mutableSetOf<String>()
        for (op in ops) when (op) {
            is MigrationOp.RenameBlock -> bloquesAtendidos.add(op.from.value)
            is MigrationOp.RemoveBlock -> bloquesAtendidos.add(op.id.value)
            is MigrationOp.MoveIntoGroup -> bloquesAtendidos.add(op.blockId.value)
            is MigrationOp.FlattenGroup -> bloquesAtendidos.add(op.groupId.value)
            is MigrationOp.ChangeBlockType -> bloquesRetipados.add(op.id.value)
            is MigrationOp.RenameSection -> seccionesAtendidas.add(op.from.value)
            is MigrationOp.RemoveSection -> seccionesAtendidas.add(op.key.value)
            is MigrationOp.ShrinkGroup -> gruposEstrechados.add(op.groupId.value)
            is MigrationOp.RenamePalette -> paletasAtendidas.add(op.from)
            is MigrationOp.RenameFontSet -> fuentesAtendidas.add(op.from)
            is MigrationOp.AddBlock -> Unit   // añadir nunca rompe: no cubre nada del diff
        }
        // Una `removeSection` cubre también los bloques que vivían en esa sección: `migrate` manda al
        // attic **todos** los `content[b.id]` de sus bloques (`01 §6.2`), así que el plan no tiene que
        // enumerarlos uno a uno. Solo se puede aplicar si el llamador aporta el índice de secciones.
        val seccionesRetiradas = ops.filterIsInstance<MigrationOp.RemoveSection>().map { it.key.value }.toSet()

        val faltan = mutableListOf<Uncovered>()
        for (b in diff.removedBlocks) {
            if (bloquesAtendidos.contains(b.value)) continue
            if (seccionesRetiradas.contains(seccionDeBloque[b]?.value)) continue
            faltan.add(Uncovered("removedBlock", b.value, listOf("removeBlock", "renameBlock", "moveIntoGroup", "flattenGroup")))
        }
        for (s in diff.removedSections)
            if (!seccionesAtendidas.contains(s.value))
                faltan.add(Uncovered("removedSection", s.value, listOf("removeSection", "renameSection")))
        for (r in diff.retypedBlocks)
            if (!bloquesRetipados.contains(r.id.value))
                faltan.add(Uncovered("retypedBlock", r.id.value, listOf("changeBlockType")))
        for (g in diff.narrowedGroups)
            if (!gruposEstrechados.contains(g.id.value))
                faltan.add(Uncovered("narrowedGroup", g.id.value, listOf("shrinkGroup")))
        for (p in diff.removedPalettes)
            if (!paletasAtendidas.contains(p)) faltan.add(Uncovered("removedPalette", p, listOf("renamePalette")))
        for (f in diff.removedFontSets)
            if (!fuentesAtendidas.contains(f)) faltan.add(Uncovered("removedFontSet", f, listOf("renameFontSet")))
        for (v in diff.removedVariants) {
            val clave = "${v.sectionKey.value}.${v.variant}"
            // HUECO CONOCIDO, registrado en `preguntas-abiertas.md` (2-2): el catálogo CERRADO de 11
            // operaciones de `01 §6.2` **no tiene ninguna** que remapee la variante de una sección, así
            // que una variante retirada solo puede cubrirse retirando o renombrando su sección entera.
            // No se inventa una operación nueva: ampliar el catálogo exige ADR y espejo en TypeScript.
            if (!variantesAtendidas.contains(clave) && !seccionesRetiradas.contains(v.sectionKey.value))
                faltan.add(Uncovered("removedVariant", clave, listOf("removeSection", "renameSection")))
        }
        return faltan.sortedWith(compareBy({ it.kind }, { it.target }))
    }

    /** Atajo del paso 5 de `02 §4`: ¿puede registrarse esta versión con este plan? */
    fun isCovered(
        diff: StructuralDiff, plan: MigrationPlan?, seccionDeBloque: Map<BlockId, SectionKey> = emptyMap(),
    ): Boolean = uncovered(diff, plan, seccionDeBloque).isEmpty()

    fun isCovered(anterior: TemplatePackage, diff: StructuralDiff, plan: MigrationPlan?): Boolean =
        uncovered(anterior, diff, plan).isEmpty()
}
