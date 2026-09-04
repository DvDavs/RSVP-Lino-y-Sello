package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Ramas del reductor que los 51 casos de `golden/operations/` no alcanzan: límites de grupo por abajo,
 * grupo no reordenable, grupo `source != user`, `setTheme` de fontSet, y las cinco relaciones de
 * aspecto de `image.aspect` (X-06), que ningún manifiesto de ejemplo declara.
 */
class OperationReducerBranchTest {

    private val ITEM_1 = ItemId("01J8AAAAAAAAAAAAAAAAAAAAAA")
    private val ITEM_2 = ItemId("01J8BBBBBBBBBBBBBBBBBBBBBB")
    private val NUEVO = "01J8CCCCCCCCCCCCCCCCCCCCCC"
    private val ASSET = AssetId("as_01J8DDDDDDDDDDDDDDDDDDDDDD")

    private fun ctx(pkg: mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage, meta: AssetMeta? = null) =
        ReducerContext(pkg, { NUEVO }, { if (it == ASSET) meta else null })

    private val grupo = Fx.grupo("g.cards", itemBlocks = listOf(Fx.texto("title")), min = 1, max = 2, reorderable = false)
    private val m = Fx.manifiesto(
        listOf(
            Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title")), required = true),
            Fx.seccion("event", SectionType.EVENT, listOf(grupo)),
        ),
    )
    private val pkg = Fx.paquete(m, Fx.tema(paletas = listOf("olive"), fuentes = listOf("clasica", "moderna")))
    private val doc = Fx.documento(
        m, pkg.theme,
        content = mapOf(
            "g.cards" to GroupValue(
                listOf(
                    GroupItem(ITEM_1, mapOf(BlockId("title") to TextValue("A"))),
                    GroupItem(ITEM_2, mapOf(BlockId("title") to TextValue("B"))),
                ),
            ),
        ),
    )

    private fun error(op: Operation): OperationError =
        (DefaultOperationReducer.apply(doc, op, ctx(pkg)) as OperationResult.Failed).error

    @Test
    fun `addItem por encima del maximo`() {
        val e = error(Operation.AddItem(BlockId("g.cards"), "tmp:abcdefgh", emptyMap()))
        assertEquals(OperationError.GroupLimit(BlockId("g.cards"), 1, 2), e)
    }

    @Test
    fun `removeItem por debajo del minimo`() {
        val doc1 = Fx.documento(
            m, pkg.theme,
            content = mapOf("g.cards" to GroupValue(listOf(GroupItem(ITEM_1, emptyMap())))),
        )
        val r = DefaultOperationReducer.apply(doc1, Operation.RemoveItem(BlockId("g.cards"), ITEM_1.value), ctx(pkg))
        assertEquals(OperationError.GroupLimit(BlockId("g.cards"), 1, 2), (r as OperationResult.Failed).error)
    }

    @Test
    fun `moveItem sobre un grupo no reordenable`() {
        val e = error(Operation.MoveItem(BlockId("g.cards"), ITEM_1.value, 1))
        assertTrue(e is OperationError.OperationInvalid && e.detail.contains("reorderable"))
    }

    @Test
    fun `toIndex fuera de rango`() {
        val reordenable = Fx.grupo("g.cards", itemBlocks = listOf(Fx.texto("title")), min = 0, max = 4)
        val m2 = Fx.manifiesto(listOf(Fx.seccion("event", SectionType.EVENT, listOf(reordenable))))
        val pkg2 = Fx.paquete(m2)
        val doc2 = Fx.documento(m2, pkg2.theme, content = mapOf("g.cards" to GroupValue(listOf(GroupItem(ITEM_1, emptyMap())))))
        val r = DefaultOperationReducer.apply(doc2, Operation.MoveItem(BlockId("g.cards"), ITEM_1.value, 3), ctx(pkg2))
        assertTrue((r as OperationResult.Failed).error is OperationError.OperationInvalid)
    }

    @Test
    fun `un grupo que no es del usuario no se puede editar`() {
        val fijo = Fx.grupo("g.fijo", itemBlocks = listOf(Fx.texto("title")), source = BlockSource.FIXED)
        val m2 = Fx.manifiesto(listOf(Fx.seccion("event", SectionType.EVENT, listOf(fijo))))
        val pkg2 = Fx.paquete(m2)
        val r = DefaultOperationReducer.apply(
            Fx.documento(m2, pkg2.theme), Operation.AddItem(BlockId("g.fijo"), "tmp:abcdefgh", emptyMap()), ctx(pkg2),
        )
        assertEquals(
            OperationError.BlockNotEditable(BlockId("g.fijo"), BlockSource.FIXED),
            (r as OperationResult.Failed).error,
        )
    }

    @Test
    fun `setTheme cambia solo el fontSet`() {
        val r = DefaultOperationReducer.apply(doc, Operation.SetTheme(null, "moderna"), ctx(pkg))
        val d = (r as OperationResult.Ok).doc
        assertEquals("moderna", d.theme.fontSetId)
        assertEquals("olive", d.theme.paletteId)
        assertTrue(
            DefaultOperationReducer.apply(doc, Operation.SetTheme(null, "no-existe"), ctx(pkg)) is OperationResult.Failed,
        )
    }

    @Test
    fun `setSectionVisible y setSectionVariant sobre una seccion ausente de la estructura`() {
        val docSinEvent = Fx.documento(
            m, pkg.theme,
            structure = listOf(mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry(SectionKey("cover"), "default", true)),
        )
        val a = DefaultOperationReducer.apply(docSinEvent, Operation.SetSectionVisible(SectionKey("event"), false), ctx(pkg))
        val b = DefaultOperationReducer.apply(docSinEvent, Operation.SetSectionVariant(SectionKey("event"), "default"), ctx(pkg))
        assertEquals(OperationError.SectionUnknown(SectionKey("event")), (a as OperationResult.Failed).error)
        assertEquals(OperationError.SectionUnknown(SectionKey("event")), (b as OperationResult.Failed).error)
    }

    /** Las cinco relaciones de `image.aspect` con las tolerancias de `01 §6.5` (supuesto conservador). */
    @Test
    fun `las cinco relaciones de aspecto`() {
        fun prueba(aspect: ImageAspect, w: Int, h: Int): Boolean {
            val spec = Fx.imagen("cover.image", aspect = aspect)
            val m2 = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(spec))))
            val pkg2 = Fx.paquete(m2)
            val r = DefaultOperationReducer.apply(
                Fx.documento(m2, pkg2.theme),
                Operation.SetBlock(BlockId("cover.image"), ImageValue(ASSET, "", Focal(0.5, 0.5))),
                ctx(pkg2, AssetMeta(1000, w, h, "image/webp")),
            )
            return r is OperationResult.Ok
        }
        assertTrue(prueba(ImageAspect.FREE, 1600, 400), "free no comprueba nada")
        assertTrue(prueba(ImageAspect.SQUARE, 1000, 1000))
        assertTrue(prueba(ImageAspect.SQUARE, 1010, 1000), "tolerancia de 0,02")
        assertTrue(!prueba(ImageAspect.SQUARE, 1600, 400))
        assertTrue(prueba(ImageAspect.PORTRAIT, 800, 1000))
        assertTrue(!prueba(ImageAspect.PORTRAIT, 1000, 800))
        assertTrue(prueba(ImageAspect.LANDSCAPE, 1000, 800))
        assertTrue(!prueba(ImageAspect.LANDSCAPE, 800, 1000))
        assertTrue(prueba(ImageAspect.WIDE, 1600, 900))
        assertTrue(!prueba(ImageAspect.WIDE, 1000, 800))
        // Sin dimensiones NO se comprueba y NUNCA se rechaza por falta de dato (01 §6.5).
        val spec = Fx.imagen("cover.image", aspect = ImageAspect.SQUARE)
        val m2 = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(spec))))
        val pkg2 = Fx.paquete(m2)
        val r = DefaultOperationReducer.apply(
            Fx.documento(m2, pkg2.theme),
            Operation.SetBlock(BlockId("cover.image"), ImageValue(ASSET, "", Focal(0.5, 0.5))),
            ctx(pkg2, AssetMeta(1000, null, null, "image/webp")),
        )
        assertTrue(r is OperationResult.Ok, "faltan width/height: no se comprueba, no se rechaza")
    }

    @Test
    fun `audio maxBytes`() {
        val m2 = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.audio("k.audio", maxBytes = 1000)))))
        val pkg2 = Fx.paquete(m2)
        val r = DefaultOperationReducer.apply(
            Fx.documento(m2, pkg2.theme), Operation.SetBlock(BlockId("k.audio"), AudioValue(ASSET)),
            ctx(pkg2, AssetMeta(2000, null, null, "audio/mpeg")),
        )
        assertEquals(OperationError.AssetSpecMismatch(ASSET, "maxBytes"), (r as OperationResult.Failed).error)
        val ok = DefaultOperationReducer.apply(
            Fx.documento(m2, pkg2.theme), Operation.SetBlock(BlockId("k.audio"), AudioValue(ASSET)),
            ctx(pkg2, AssetMeta(500, null, null, "audio/mpeg")),
        )
        assertTrue(ok is OperationResult.Ok)
    }

    /** Cada `OperationError` expone el `TplErrorCode` del catálogo cerrado de `03 §5`. */
    @Test
    fun `todos los errores llevan codigo tipado del catalogo`() {
        val errores = listOf(
            OperationError.BlockUnknown(BlockId("a")),
            OperationError.BlockNotEditable(BlockId("a"), BlockSource.FIXED),
            OperationError.BlockTypeMismatch(BlockId("a"), "text", "image"),
            OperationError.ItemUnknown(BlockId("a"), "x"),
            OperationError.GroupLimit(BlockId("a"), 0, 1),
            OperationError.SectionUnknown(SectionKey("a")),
            OperationError.SectionRequired(SectionKey("a")),
            OperationError.VariantUnknown(SectionKey("a"), "v"),
            OperationError.ThemeIdUnknown("paletteId", "x"),
            OperationError.AssetNotOwned(ASSET),
            OperationError.AssetSpecMismatch(ASSET, "aspect"),
            OperationError.InvariantViolation(emptyList()),
            OperationError.OperationInvalid("op", "detalle"),
            OperationError.TempIdDuplicate("tmp:abcdefgh"),
        )
        assertEquals(14, errores.map { it.wire }.distinct().size)
        for (e in errores) assertTrue(e.code.httpStatus in 400..499, "${e.wire} debe ser un 4xx tipado")
    }
}
