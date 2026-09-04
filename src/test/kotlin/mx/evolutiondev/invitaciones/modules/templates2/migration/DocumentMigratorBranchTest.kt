package mx.evolutiondev.invitaciones.modules.templates2.migration

import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.ConverterId
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationOp
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichDoc
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichParagraph
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichSpan
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Ramas de `migrate`/`switchTemplate` que el par golden no alcanza. */
class DocumentMigratorBranchTest {

    private val I1 = ItemId("01J8AAAAAAAAAAAAAAAAAAAAAA")
    private val I2 = ItemId("01J8BBBBBBBBBBBBBBBBBBBBBB")

    private val mFrom = Fx.manifiesto(
        listOf(
            Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("a.uno"), Fx.rico("a.rico"), Fx.lista("a.lista"))),
            Fx.seccion("gifts", SectionType.GIFT_TABLE, listOf(Fx.grupo("g.list", itemBlocks = listOf(Fx.texto("title")), max = 8))),
        ),
        version = "1.0.0",
    )
    private val mTo = Fx.manifiesto(
        listOf(
            Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("a.uno", maxLength = 20), Fx.texto("a.rico", maxLength = 20, multiline = true), Fx.texto("a.lista", maxLength = 20))),
            Fx.seccion("gifts", SectionType.GIFT_TABLE, listOf(Fx.grupo("g.list", itemBlocks = listOf(Fx.texto("title")), max = 8))),
        ),
        version = "2.0.0",
    )
    private val from = Fx.paquete(mFrom)
    private val to = Fx.paquete(mTo)

    private fun plan(vararg ops: MigrationOp) = MigrationPlan(
        TemplateSlug("fixture-tpl"), SemverVersion.parse("1.0.0"), SemverVersion.parse("2.0.0"), ops.toList(),
    )

    @Test
    fun `el slug del plan tiene que ser el de la plantilla destino`() {
        val p = MigrationPlan(TemplateSlug("otra-plantilla"), SemverVersion.parse("1.0.0"), SemverVersion.parse("2.0.0"), emptyList())
        val r = DocumentMigrator.migrate(Fx.documento(mFrom), from, to, p)
        assertTrue((r as MigrationResult.Failed).error is MigrationError.PlanVersionMismatch)
    }

    @Test
    fun `richTextToText trunca por limite de palabra`() {
        val doc = Fx.documento(
            mFrom,
            content = mapOf("a.rico" to RichTextValue(RichDoc(listOf(RichParagraph(listOf(RichSpan("uno dos tres cuatro cinco seis"))))))),
        )
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.ChangeBlockType(BlockId("a.rico"), ConverterId.RICH_TEXT_TO_TEXT)))
        val v = (r as MigrationResult.Ok).doc.content[BlockId("a.rico")] as TextValue
        assertEquals("uno dos tres cuatro", v.value)
        assertTrue(v.value.length <= 20)
        assertEquals(listOf("a.rico"), r.report.converted.map { it.blockId })
        assertTrue(!r.report.lossless, "una conversión nunca es lossless")
    }

    @Test
    fun `listTextToText une con coma y trunca`() {
        val doc = Fx.documento(mFrom, content = mapOf("a.lista" to ListTextValue(listOf("alfa", "beta", "gamma", "delta"))))
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.ChangeBlockType(BlockId("a.lista"), ConverterId.LIST_TEXT_TO_TEXT)))
        assertEquals("alfa, beta, gamma,", (((r as MigrationResult.Ok).doc.content[BlockId("a.lista")]) as TextValue).value)
    }

    @Test
    fun `sin espacio, el truncado corta por el limite exacto`() {
        assertEquals("abcde", DocumentMigrator.truncarPorPalabra("abcdefghij", 5))
        assertEquals("abc", DocumentMigrator.truncarPorPalabra("abc", 5), "por debajo del límite no toca nada")
        assertEquals("ab", DocumentMigrator.truncarPorPalabra("ab cdefgh", 5), "corta en el espacio y no deja cola")
    }

    @Test
    fun `un converter aplicado a un tipo que no admite falla`() {
        val doc = Fx.documento(mFrom, content = mapOf("a.uno" to TextValue("x")))
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.ChangeBlockType(BlockId("a.uno"), ConverterId.LIST_TEXT_TO_TEXT)))
        assertEquals(MigrationError.ConverterUnsupported("text", "listTextToText"), (r as MigrationResult.Failed).error)
    }

    @Test
    fun `un converter sobre un grupo falla en vez de destrozarlo`() {
        val doc = Fx.documento(mFrom, content = mapOf("g.list" to GroupValue(listOf(GroupItem(I1, emptyMap())))))
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.ChangeBlockType(BlockId("g.list"), ConverterId.TEXT_TO_RICH_TEXT)))
        assertEquals(MigrationError.ConverterUnsupported("group", "textToRichText"), (r as MigrationResult.Failed).error)
    }

    @Test
    fun `textToRichText y textToListText sobre cadena vacia producen contenido vacio`() {
        assertEquals(
            RichTextValue(RichDoc(listOf(RichParagraph(emptyList())))),
            DocumentMigrator.convertir(TextValue(""), ConverterId.TEXT_TO_RICH_TEXT, 100),
        )
        assertEquals(ListTextValue(emptyList()), DocumentMigrator.convertir(TextValue(""), ConverterId.TEXT_TO_LIST_TEXT, 100))
        assertEquals(
            RichTextValue(RichDoc(listOf(RichParagraph(listOf(RichSpan("hola")))))),
            DocumentMigrator.convertir(TextValue("hola"), ConverterId.TEXT_TO_RICH_TEXT, 100),
        )
    }

    @Test
    fun `shrinkGroup que no sobra no toca nada, y flattenGroup sobre un grupo ausente tampoco`() {
        val doc = Fx.documento(mFrom, content = mapOf("g.list" to GroupValue(listOf(GroupItem(I1, emptyMap()), GroupItem(I2, emptyMap())))))
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.ShrinkGroup(BlockId("g.list"), 4)))
        assertTrue((r as MigrationResult.Ok).report.lossless)
        assertEquals(2, (r.doc.content[BlockId("g.list")] as GroupValue).items.size)

        val vacio = Fx.documento(mFrom)
        val r2 = DocumentMigrator.migrate(vacio, from, to, plan(MigrationOp.ShrinkGroup(BlockId("g.list"), 1), MigrationOp.FlattenGroup(BlockId("g.list"), BlockId("title"), BlockId("a.uno"))))
        assertTrue((r2 as MigrationResult.Ok).report.lossless)
    }

    @Test
    fun `flattenGroup sobre un grupo cuyo primer item no tiene el itemBlock manda el resto al attic`() {
        val doc = Fx.documento(
            mFrom,
            content = mapOf(
                "g.list" to GroupValue(
                    listOf(GroupItem(I1, emptyMap()), GroupItem(I2, mapOf(BlockId("title") to TextValue("B")))),
                ),
            ),
        )
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.FlattenGroup(BlockId("g.list"), BlockId("title"), BlockId("a.uno"))))
        r as MigrationResult.Ok
        assertTrue(!r.doc.content.containsKey(BlockId("a.uno")), "el primer ítem no tenía el itemBlock: no se mueve nada")
        val guardado = r.doc.attic["fixture-tpl@1.0.0"]?.get(BlockId("g.list")) as GroupValue
        assertEquals(listOf(I2), guardado.items.map { it.itemId })
        assertEquals(listOf(AtticReason.REMOVE_BLOCK), r.report.toAttic.map { it.reason })
    }

    @Test
    fun `flattenGroup contra un destino ya ocupado falla`() {
        val doc = Fx.documento(
            mFrom,
            content = mapOf(
                "a.uno" to TextValue("ya está"),
                "g.list" to GroupValue(listOf(GroupItem(I1, mapOf(BlockId("title") to TextValue("A"))))),
            ),
        )
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.FlattenGroup(BlockId("g.list"), BlockId("title"), BlockId("a.uno"))))
        assertEquals(MigrationError.TargetBlockExists("flattenGroup", "a.uno"), (r as MigrationResult.Failed).error)
    }

    @Test
    fun `moveIntoGroup contra un grupo o itemBlock inexistente falla`() {
        val doc = Fx.documento(mFrom, content = mapOf("a.uno" to TextValue("x")))
        val a = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.MoveIntoGroup(BlockId("a.uno"), BlockId("no.existe"), BlockId("title"))))
        assertEquals(MigrationError.TargetBlockUnknown("moveIntoGroup", "no.existe"), (a as MigrationResult.Failed).error)
        val b = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.MoveIntoGroup(BlockId("a.uno"), BlockId("g.list"), BlockId("no.existe"))))
        assertEquals(MigrationError.TargetBlockUnknown("moveIntoGroup", "no.existe"), (b as MigrationResult.Failed).error)
    }

    @Test
    fun `renameSection y removeSection contra claves que no existen fallan`() {
        val doc = Fx.documento(mFrom)
        val a = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RenameSection(SectionKey("cover"), SectionKey("fantasma"))))
        assertEquals(MigrationError.TargetBlockUnknown("renameSection", "fantasma"), (a as MigrationResult.Failed).error)
        val b = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RemoveSection(SectionKey("fantasma"))))
        assertEquals(MigrationError.TargetBlockUnknown("removeSection", "fantasma"), (b as MigrationResult.Failed).error)
    }

    @Test
    fun `removeBlock y addBlock contra ids que no existen fallan`() {
        val doc = Fx.documento(mFrom)
        val a = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RemoveBlock(BlockId("no.existe"))))
        assertEquals(MigrationError.TargetBlockUnknown("removeBlock", "no.existe"), (a as MigrationResult.Failed).error)
        val b = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.AddBlock(BlockId("no.existe"))))
        assertEquals(MigrationError.TargetBlockUnknown("addBlock", "no.existe"), (b as MigrationResult.Failed).error)
        val c = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RenameBlock(BlockId("no.existe"), BlockId("a.uno"))))
        assertEquals(MigrationError.TargetBlockUnknown("renameBlock", "no.existe"), (c as MigrationResult.Failed).error)
    }

    @Test
    fun `renamePalette y renameFontSet contra ids que el destino no declara fallan`() {
        val doc = Fx.documento(mFrom)
        val a = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RenamePalette("olive", "no-existe")))
        assertEquals(MigrationError.TargetBlockUnknown("renamePalette", "no-existe"), (a as MigrationResult.Failed).error)
        val b = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RenameFontSet("clasica", "no-existe")))
        assertEquals(MigrationError.TargetBlockUnknown("renameFontSet", "no-existe"), (b as MigrationResult.Failed).error)
    }

    @Test
    fun `renamePalette y renameFontSet que si casan cambian el tema del documento`() {
        val temaDoble = Fx.tema(paletas = listOf("olive", "verde"), fuentes = listOf("clasica", "serif"))
        val to2 = Fx.paquete(mTo, temaDoble)
        val from2 = Fx.paquete(mFrom, temaDoble)
        val doc = Fx.documento(mFrom, temaDoble, paletteId = "olive", fontSetId = "clasica")
        val r = DocumentMigrator.migrate(
            doc, from2, to2,
            plan(MigrationOp.RenamePalette("olive", "verde"), MigrationOp.RenameFontSet("clasica", "serif")),
        )
        r as MigrationResult.Ok
        assertEquals("verde", r.doc.theme.paletteId)
        assertEquals("serif", r.doc.theme.fontSetId)
    }

    @Test
    fun `renameBlock sin contenido de origen no registra un movimiento`() {
        val r = DocumentMigrator.migrate(Fx.documento(mFrom), from, to, plan(MigrationOp.RenameBlock(BlockId("a.uno"), BlockId("a.rico"))))
        r as MigrationResult.Ok
        assertTrue(r.report.moved.isEmpty())
        assertEquals(listOf("renameBlock"), r.report.applied.map { it.op })
        assertTrue(r.report.lossless)
    }

    @Test
    fun `el attic previo del documento se conserva`() {
        val doc = Fx.documento(
            mFrom,
            content = mapOf("a.uno" to TextValue("x")),
            attic = mapOf("otra@1.0.0" to mapOf(BlockId("z.viejo") to TextValue("de antes"))),
        )
        val r = DocumentMigrator.migrate(doc, from, to, plan(MigrationOp.RemoveBlock(BlockId("a.uno"))))
        r as MigrationResult.Ok
        assertEquals(TextValue("de antes"), r.doc.attic["otra@1.0.0"]?.get(BlockId("z.viejo")))
        assertEquals(TextValue("x"), r.doc.attic["fixture-tpl@1.0.0"]?.get(BlockId("a.uno")))
    }

    @Test
    fun `switchTemplate conserva el locale si el destino lo soporta y cae al primero si no`() {
        val mA = Fx.manifiesto(
            listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("a.title", mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole.COVER_TITLE)))),
            slug = "plantilla-a",
            locales = listOf(mx.evolutiondev.invitaciones.modules.templates2.domain.Locale.ES_MX, mx.evolutiondev.invitaciones.modules.templates2.domain.Locale.EN_US),
        )
        val mB = Fx.manifiesto(
            listOf(Fx.seccion("portada", SectionType.COVER, listOf(Fx.texto("b.title", mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole.COVER_TITLE)))),
            slug = "plantilla-b",
            locales = listOf(mx.evolutiondev.invitaciones.modules.templates2.domain.Locale.ES_MX),
        )
        val pA = Fx.paquete(mA)
        val pB = Fx.paquete(mB)
        val doc = Fx.documento(mA, content = mapOf("a.title" to TextValue("Ana")), locale = mx.evolutiondev.invitaciones.modules.templates2.domain.Locale.EN_US)
        val r = DocumentMigrator.switchTemplate(doc, pA, pB)
        assertEquals(mx.evolutiondev.invitaciones.modules.templates2.domain.Locale.ES_MX, r.doc.meta.locale)
        assertEquals(TextValue("Ana"), r.doc.content[BlockId("b.title")])
        assertEquals(listOf("a.title"), r.report.matchedByRole.map { it.fromBlockId })
        assertTrue(r.report.toAttic.isEmpty(), "todo lo del origen se transportó")
        assertTrue(r.report.reset.isEmpty())
        assertTrue(!r.doc.attic.containsKey("plantilla-a@1.0.0"), "sin nada que guardar, no se crea la clave")
    }
}
