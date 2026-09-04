package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * `DocumentNormalizer` (`02 §7.3`, ADR-029): lo usan `:choose-template` y `restore`. Un documento
 * restaurado desde un snapshot antiguo puede traer claves que la versión vigente ya no declara; sin
 * normalizar, la siguiente escritura lo rechazaría con I-12/I-19/I-20 y el cliente se quedaría
 * bloqueado sin poder recuperar su invitación.
 */
class DocumentNormalizerTest {

    private val m = Fx.manifiesto(
        listOf(
            Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title"), Fx.texto("cover.legal", source = BlockSource.FIXED)), variants = listOf("default", "alt"), required = true),
            Fx.seccion("family", SectionType.FAMILY, listOf(Fx.texto("family.intro"))),
            Fx.seccion("event", SectionType.EVENT, listOf(Fx.texto("event.title"))),
        ),
    )
    private val tema = Fx.tema(paletas = listOf("olive", "rosa"), fuentes = listOf("clasica"))
    private val pkg = Fx.paquete(m, tema)

    @Test
    fun `las claves no declaradas y las no editables van al attic, nunca se borran`() {
        val doc = Fx.documento(
            m, tema,
            content = mapOf(
                "cover.title" to TextValue("Ana"),
                "cover.legal" to TextValue("intento sobre un bloque fixed"),
                "zz.viejo" to TextValue("de otra versión"),
            ),
        )
        val r = DocumentNormalizer.normalize(doc, pkg)
        assertEquals(listOf(BlockId("cover.title")), r.doc.content.keys.toList())
        assertEquals(listOf(BlockId("cover.legal"), BlockId("zz.viejo")), r.toAttic)
        val clave = "fixture-tpl@1.0.0"
        assertEquals(TextValue("de otra versión"), r.doc.attic[clave]?.get(BlockId("zz.viejo")))
        assertEquals(TextValue("intento sobre un bloque fixed"), r.doc.attic[clave]?.get(BlockId("cover.legal")))
    }

    @Test
    fun `la estructura se reconstruye con el orden relativo del manifiesto y sin claves desconocidas`() {
        val doc = Fx.documento(
            m, tema,
            structure = listOf(
                StructureEntry(SectionKey("event"), "no-declarada", true),
                StructureEntry(SectionKey("fantasma"), "default", true),
                StructureEntry(SectionKey("cover"), "alt", false),
                StructureEntry(SectionKey("cover"), "default", true),
            ),
        )
        val r = DocumentNormalizer.normalize(doc, pkg)
        assertEquals(listOf(SectionKey("fantasma")), r.removedSections)
        assertEquals(listOf(SectionKey("event"), SectionKey("cover"), SectionKey("family")), r.doc.structure.sections.map { it.key })
        assertEquals("default", r.doc.structure.sections.first { it.key == SectionKey("event") }.variant)
        assertTrue(r.doc.structure.sections.first { it.key == SectionKey("cover") }.visible, "cover es required (I-17)")
    }

    @Test
    fun `un id de tema desconocido cae al de la plantilla`() {
        val doc = Fx.documento(m, tema, paletteId = "no-existe", fontSetId = "tampoco")
        val r = DocumentNormalizer.normalize(doc, pkg)
        assertEquals("olive", r.doc.theme.paletteId)
        assertEquals("clasica", r.doc.theme.fontSetId)
    }

    @Test
    fun `un documento ya normalizado no cambia y pasa las invariantes`() {
        val doc = Fx.documento(m, tema, content = mapOf("cover.title" to TextValue("Ana")), paletteId = "rosa")
        val r = DocumentNormalizer.normalize(doc, pkg)
        assertEquals(doc, r.doc)
        assertTrue(r.toAttic.isEmpty())
        assertTrue(r.removedSections.isEmpty())
        assertTrue(Invariants.validateInvariants(r.doc, pkg).isEmpty(), "el resultado siempre es escribible")
    }

    @Test
    fun `normalizar es idempotente`() {
        val doc = Fx.documento(
            m, tema,
            content = mapOf("zz.viejo" to TextValue("x")),
            structure = listOf(StructureEntry(SectionKey("fantasma"), "default", true)),
            paletteId = "no-existe",
        )
        val una = DocumentNormalizer.normalize(doc, pkg).doc
        val dos = DocumentNormalizer.normalize(una, pkg).doc
        assertEquals(una, dos)
        assertTrue(Invariants.validateInvariants(una, pkg).isEmpty())
    }
}
