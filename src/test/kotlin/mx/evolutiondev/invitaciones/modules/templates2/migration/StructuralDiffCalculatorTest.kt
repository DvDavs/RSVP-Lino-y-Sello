package mx.evolutiondev.invitaciones.modules.templates2.migration

import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationOp
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * `structuralDiff` (paso 5 de `02 §4`) y su comprobador de cobertura (ADR-028). Los consume el bloque
 * 2-3 en `TemplateRegistrar`: sin ellos, `migrate()` acabaría devolviendo `MIG_RESULT_INVALID` **en
 * producción, invitación por invitación**, en vez de rechazar el paquete una sola vez al registrarlo.
 */
class StructuralDiffCalculatorTest {

    private val v1 = Fx.paquete(
        Fx.manifiesto(
            listOf(
                Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title"), Fx.texto("cover.old")), variants = listOf("default", "alt")),
                Fx.seccion("gifts", SectionType.GIFT_TABLE, listOf(Fx.grupo("gifts.list", itemBlocks = listOf(Fx.texto("title")), max = 8))),
                Fx.seccion("extra", SectionType.SUGGESTIONS, listOf(Fx.texto("extra.note"))),
            ),
            version = "1.0.0",
        ),
        Fx.tema(paletas = listOf("olive", "rosa"), fuentes = listOf("clasica", "moderna")),
    )

    private val v2 = Fx.paquete(
        Fx.manifiesto(
            listOf(
                // `cover.old` desaparece, `cover.title` cambia de tipo, la variante `alt` se retira.
                Fx.seccion("cover", SectionType.COVER, listOf(Fx.rico("cover.title")), variants = listOf("default")),
                // el grupo estrecha su `max` de 8 a 4
                Fx.seccion("gifts", SectionType.GIFT_TABLE, listOf(Fx.grupo("gifts.list", itemBlocks = listOf(Fx.texto("title")), max = 4))),
                // la sección `extra` desaparece; entra una nueva, que NO es un cambio incompatible
                Fx.seccion("nueva", SectionType.STORY, listOf(Fx.texto("nueva.title"))),
            ),
            version = "2.0.0",
        ),
        Fx.tema(paletas = listOf("olive"), fuentes = listOf("clasica")),
    )

    @Test
    fun `el diff recoge los siete tipos de cambio incompatible`() {
        val d = StructuralDiffCalculator.diff(v1, v2)
        assertEquals(listOf(BlockId("cover.old"), BlockId("extra.note")), d.removedBlocks)
        assertEquals(listOf(SectionKey("extra")), d.removedSections)
        assertEquals(1, d.retypedBlocks.size)
        assertEquals(BlockKind.TEXT, d.retypedBlocks[0].from)
        assertEquals(BlockKind.RICH_TEXT, d.retypedBlocks[0].to)
        assertEquals(listOf(BlockId("gifts.list")), d.narrowedGroups.map { it.id })
        assertEquals(8, d.narrowedGroups[0].fromMax)
        assertEquals(4, d.narrowedGroups[0].toMax)
        assertEquals(listOf("rosa"), d.removedPalettes)
        assertEquals(listOf("moderna"), d.removedFontSets)
        assertEquals(listOf(SectionKey("cover")), d.removedVariants.map { it.sectionKey })
        assertEquals("alt", d.removedVariants[0].variant)
        assertFalse(d.isEmpty)
    }

    @Test
    fun `anadir no rompe - una version que solo anade tiene diff vacio`() {
        val v3 = Fx.paquete(
            Fx.manifiesto(
                listOf(
                    Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title"), Fx.texto("cover.old"), Fx.texto("cover.nuevo")), variants = listOf("default", "alt", "extra")),
                    Fx.seccion("gifts", SectionType.GIFT_TABLE, listOf(Fx.grupo("gifts.list", itemBlocks = listOf(Fx.texto("title")), max = 12))),
                    Fx.seccion("extra", SectionType.SUGGESTIONS, listOf(Fx.texto("extra.note"))),
                    Fx.seccion("nueva", SectionType.STORY, listOf(Fx.texto("nueva.title"))),
                ),
                version = "1.1.0",
            ),
            Fx.tema(paletas = listOf("olive", "rosa", "verde"), fuentes = listOf("clasica", "moderna")),
        )
        assertTrue(StructuralDiffCalculator.diff(v1, v3).isEmpty, "ampliar el catálogo es compatible")
    }

    /**
     * El plan "completo" cubre todo **salvo la variante retirada**: el catálogo CERRADO de 11
     * operaciones de `01 §6.2` no tiene ninguna que remapee la variante de una sección, así que la
     * única forma de cubrirla es retirar o renombrar la sección entera. Es un hueco real del diseño,
     * registrado en `preguntas-abiertas.md` (2-2); aquí se fija para que nadie lo descubra en producción.
     */
    @Test
    fun `un plan completo cubre el diff y uno incompleto lo dice campo a campo`() {
        val d = StructuralDiffCalculator.diff(v1, v2)
        val seccionDeBloque = MigrationPlanCoverageChecker.seccionPorBloque(v1)
        val completo = MigrationPlan(
            TemplateSlug("fixture-tpl"), SemverVersion.parse("1.0.0"), SemverVersion.parse("2.0.0"),
            listOf(
                MigrationOp.RemoveBlock(BlockId("cover.old")),
                MigrationOp.ChangeBlockType(BlockId("cover.title"), mx.evolutiondev.invitaciones.modules.templates2.domain.ConverterId.TEXT_TO_RICH_TEXT),
                MigrationOp.ShrinkGroup(BlockId("gifts.list"), 4),
                // `removeSection` cubre además `extra.note`: `migrate` manda al attic TODOS los
                // `content[b.id]` de la sección (01 §6.2), sin enumerarlos en el plan.
                MigrationOp.RemoveSection(SectionKey("extra")),
                MigrationOp.RenamePalette("rosa", "olive"),
                MigrationOp.RenameFontSet("moderna", "clasica"),
            ),
        )
        val faltanConCompleto = MigrationPlanCoverageChecker.uncovered(v1, d, completo)
        assertEquals(listOf("removedVariant"), faltanConCompleto.map { it.kind }, "el único hueco es la variante")
        assertEquals("cover.alt", faltanConCompleto[0].target)

        // Sin el índice de secciones, `extra.note` no puede darse por cubierto: el comprobador no
        // adivina a qué sección pertenecía.
        assertEquals(2, MigrationPlanCoverageChecker.uncovered(d, completo).size)

        val incompleto = completo.copy(ops = completo.ops.filter { it !is MigrationOp.ShrinkGroup })
        val faltan = MigrationPlanCoverageChecker.uncovered(d, incompleto, seccionDeBloque)
        assertEquals(listOf("narrowedGroup", "removedVariant"), faltan.map { it.kind })
        assertEquals("gifts.list", faltan[0].target)
        assertEquals(listOf("shrinkGroup"), faltan[0].expectedOps)
    }

    @Test
    fun `sin plan, todo el diff queda sin cubrir`() {
        val d = StructuralDiffCalculator.diff(v1, v2)
        val faltan = MigrationPlanCoverageChecker.uncovered(v1, d, null)
        assertEquals(
            listOf(
                "narrowedGroup", "removedBlock", "removedBlock", "removedFontSet", "removedPalette",
                "removedSection", "removedVariant", "retypedBlock",
            ),
            faltan.map { it.kind },
        )
        // `extra.note` aparece porque sin plan no hay `removeSection` que lo cubra.
        assertTrue(faltan.any { it.target == "extra.note" })
    }

    @Test
    fun `un diff vacio esta cubierto aunque no haya plan`() {
        assertTrue(MigrationPlanCoverageChecker.isCovered(StructuralDiffCalculator.diff(v1, v1), null))
        assertTrue(MigrationPlanCoverageChecker.isCovered(v1, StructuralDiffCalculator.diff(v1, v1), null))
        assertTrue(MigrationPlanCoverageChecker.uncovered(StructuralDiffCalculator.diff(v1, v1), null).isEmpty())
    }

    @Test
    fun `renameBlock, moveIntoGroup y flattenGroup tambien cubren un bloque retirado`() {
        val d = StructuralDiffCalculator.diff(v1, v2)
        val soloBloques = d.copy(
            removedSections = emptyList(), retypedBlocks = emptyList(), narrowedGroups = emptyList(),
            removedPalettes = emptyList(), removedFontSets = emptyList(), removedVariants = emptyList(),
        )
        val plan = MigrationPlan(
            TemplateSlug("fixture-tpl"), SemverVersion.parse("1.0.0"), SemverVersion.parse("2.0.0"),
            listOf(
                MigrationOp.RenameBlock(BlockId("cover.old"), BlockId("cover.title")),
                MigrationOp.MoveIntoGroup(BlockId("extra.note"), BlockId("gifts.list"), BlockId("title")),
                MigrationOp.AddBlock(BlockId("nueva.title")),
            ),
        )
        assertTrue(MigrationPlanCoverageChecker.isCovered(soloBloques, plan))
    }

    /** Una variante retirada de una sección que el plan retira entera queda cubierta. */
    @Test
    fun `una variante de una seccion retirada esta cubierta`() {
        val d = StructuralDiffCalculator.diff(v1, v2).copy(
            removedBlocks = emptyList(), removedSections = emptyList(), retypedBlocks = emptyList(),
            narrowedGroups = emptyList(), removedPalettes = emptyList(), removedFontSets = emptyList(),
        )
        val plan = MigrationPlan(
            TemplateSlug("fixture-tpl"), SemverVersion.parse("1.0.0"), SemverVersion.parse("2.0.0"),
            listOf(MigrationOp.RemoveSection(SectionKey("cover"))),
        )
        assertTrue(MigrationPlanCoverageChecker.isCovered(d, plan))
        assertEquals(1, MigrationPlanCoverageChecker.uncovered(d, null).size)
    }
}
