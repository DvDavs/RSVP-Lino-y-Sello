package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BooleanValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.Provenance
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedImage
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Ramas de R1-R9 que ningún golden compartido alcanza porque exigen un paquete deliberadamente roto. */
class CompositionUnitTest {

    private val ULID_A = "01J8AAAAAAAAAAAAAAAAAAAAAA"

    /** I-09 garantiza que los ids por defecto existen; si aun así faltaran, `compose` NO lanza. */
    @Test
    fun `un tema sin la paleta por defecto no rompe la composicion`() {
        val roto = Fx.tema(paletas = listOf("olive"), fuentes = listOf("clasica"))
            .copy(defaultPaletteId = "no-existe", defaultFontSetId = "tampoco")
        val r = ThemeResolver.resolve(roto, ThemeChoice("otra", "otra"))
        assertEquals("no-existe", r.tema.paletteId)
        assertTrue(r.tema.tokens.isEmpty(), "sin paleta no hay tokens, pero tampoco excepción")
        assertEquals("", r.tema.fonts.heading.family)
        assertEquals("otra", r.fallback?.paletteId)
        assertEquals("otra", r.fallback?.fontSetId)
    }

    @Test
    fun `un asset ausente del indice deja el bloque vacio en vez de inventar una URL`() {
        val m = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.imagen("cover.image", required = true)))))
        val pkg = Fx.paquete(m)
        val doc = Fx.documento(m, content = mapOf("cover.image" to ImageValue(AssetId("as_$ULID_A"), "alt", Focal(0.5, 0.5))))
        val r = DefaultComposer.compose(pkg, doc, Fx.negocio, emptyMap(), Locale.ES_MX)
        val b = r.composed.sections[0].blocks[0] as ComposedBlock
        assertNull(b.value)
        assertEquals(Provenance.EMPTY, b.provenance)
        assertEquals(listOf(BlockId("cover.image")), r.report.missingRequired)
    }

    @Test
    fun `un bloque fixed toma su valor de defaults y se marca fixed`() {
        val m = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.legal", source = BlockSource.FIXED)))))
        val pkg = Fx.paquete(m, Fx.tema(), Fx.defaults(m, mapOf("cover.legal" to TextValue("Aviso"))))
        // Aunque el documento traiga un valor, `fixed` lo ignora: solo puede venir de defaults.
        val doc = Fx.documento(m, content = mapOf("cover.legal" to TextValue("intento del cliente")))
        val b = DefaultComposer.compose(pkg, doc, Fx.negocio, emptyMap(), Locale.ES_MX)
            .composed.sections[0].blocks[0] as ComposedBlock
        assertEquals(Provenance.FIXED, b.provenance)
        assertEquals("Aviso", (b.value as mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedText).value)
    }

    @Test
    fun `un bloque business sin businessField queda vacio en vez de romper`() {
        val spec = Fx.fecha("biz.date", source = BlockSource.BUSINESS, businessField = null)
        val m = Fx.manifiesto(listOf(Fx.seccion("event", SectionType.EVENT, listOf(spec))))
        val b = DefaultComposer.compose(Fx.paquete(m), Fx.documento(m), Fx.negocio, emptyMap(), Locale.ES_MX)
            .composed.sections[0].blocks[0] as ComposedBlock
        assertEquals(Provenance.EMPTY, b.provenance)
        assertNull(b.value)
    }

    @Test
    fun `la portada de negocio se resuelve como imagen con foco centrado`() {
        val spec = Fx.imagen("biz.cover", source = BlockSource.BUSINESS)
            .let { it.copy(base = it.base.copy(businessField = BusinessField.INVITATION_COVER_PHOTO_URL)) }
        val m = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(spec))))
        val negocio = Fx.negocio.copy(coverPhotoUrl = "https://cdn.example.com/p.jpg")
        val b = DefaultComposer.compose(Fx.paquete(m), Fx.documento(m), negocio, emptyMap(), Locale.ES_MX)
            .composed.sections[0].blocks[0] as ComposedBlock
        val v = b.value as ResolvedImage
        assertEquals("https://cdn.example.com/p.jpg", v.url)
        assertEquals(Focal(0.5, 0.5), v.focal)
        assertEquals(Provenance.BUSINESS, b.provenance)
    }

    @Test
    fun `una choice con optionId fuera de options usa el propio id como etiqueta`() {
        val m = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.opcion("k.choice", listOf("instagram"))))))
        val doc = Fx.documento(m, content = mapOf("k.choice" to ChoiceValue("tiktok")))
        val r = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.ES_MX)
        val v = (r.composed.sections[0].blocks[0] as ComposedBlock).value as ResolvedChoice
        assertEquals("tiktok", v.optionId)
        assertEquals("tiktok", v.label)
        assertEquals(1, r.report.invalidValues.size, "y queda registrado como I-02 (O-12)")
    }

    /** Un valor de tipo equivocado bajo un spec escalar no se resuelve, pero DEJA RASTRO (O-12). */
    @Test
    fun `un grupo guardado bajo un spec escalar deja rastro y no se renderiza`() {
        val m = Fx.manifiesto(listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title")))))
        val doc = Fx.documento(m, content = mapOf("cover.title" to GroupValue(emptyList())))
        val r = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.ES_MX)
        assertNull((r.composed.sections[0].blocks[0] as ComposedBlock).value)
        assertEquals(1, r.report.invalidValues.size)
        assertEquals("I-15_BLOCK_KIND_MISMATCH", r.report.invalidValues[0].code)
    }

    /** Y al revés: un escalar bajo un spec `group` también se registra. */
    @Test
    fun `un escalar guardado bajo un spec group deja rastro`() {
        val g = Fx.grupo("g.cards", itemBlocks = listOf(Fx.texto("title")))
        val m = Fx.manifiesto(listOf(Fx.seccion("event", SectionType.EVENT, listOf(g))))
        val doc = Fx.documento(m, content = mapOf("g.cards" to TextValue("no soy un grupo")))
        val r = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.ES_MX)
        val grupo = r.composed.sections[0].blocks[0] as ComposedGroup
        assertEquals(Provenance.EMPTY, grupo.provenance)
        assertTrue(grupo.items.isEmpty())
        assertEquals("I-15_BLOCK_KIND_MISMATCH", r.report.invalidValues[0].code)
    }

    /** R7: un ítem con un `itemBlock` sin valor lo marca `empty` aunque el grupo sea `user`. */
    @Test
    fun `los itemBlocks sin valor son empty dentro de un grupo de usuario`() {
        val g = Fx.grupo("g.cards", itemBlocks = listOf(Fx.texto("title"), Fx.texto("nota")))
        val m = Fx.manifiesto(listOf(Fx.seccion("event", SectionType.EVENT, listOf(g))))
        val doc = Fx.documento(
            m, content = mapOf("g.cards" to GroupValue(listOf(GroupItem(ItemId(ULID_A), mapOf(BlockId("title") to TextValue("Misa")))))),
        )
        val grupo = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.ES_MX)
            .composed.sections[0].blocks[0] as ComposedGroup
        assertEquals(Provenance.USER, grupo.provenance)
        assertEquals(Provenance.USER, grupo.items[0].blocks[0].provenance)
        assertEquals(Provenance.EMPTY, grupo.items[0].blocks[1].provenance)
        assertNull(grupo.items[0].blocks[1].value)
    }

    /**
     * R1 fuerza `visible = true` sobre una sección `required` **que está en `doc.structure`** (I-17),
     * pero R1c inserta las ausentes con `spec.defaultVisible` TAL CUAL — así lo dice el pseudocódigo de
     * `01 §5.3` (`{ spec, spec.defaultVariant, spec.defaultVisible }`) y así lo hace `compose.ts`.
     *
     * Consecuencia: un manifiesto con `required: true` **y** `defaultVisible: false` produce una
     * sección obligatoria invisible en cuanto el documento no la menciona. Es una contradicción del
     * propio manifiesto que ninguna invariante detecta (I-17 solo mira `doc.structure`).
     * **Se conserva la paridad con TypeScript y se registra en `preguntas-abiertas.md` (2-2)**: cambiar
     * `compose` aquí sería desviarse del pseudocódigo normativo sin ADR aceptada.
     */
    @Test
    fun `R1c inserta con defaultVisible tal cual, aunque la seccion sea required`() {
        val m = Fx.manifiesto(
            listOf(
                Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title")), required = true, defaultVisible = false),
                Fx.seccion("event", SectionType.EVENT, listOf(Fx.texto("event.title"))),
            ),
        )
        val doc = Fx.documento(m, structure = listOf(StructureEntry(SectionKey("event"), "default", true)))
        val r = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.ES_MX)
        val cover = r.composed.sections.first { it.key == SectionKey("cover") }
        assertTrue(!cover.visible, "01 §5.3: R1c usa spec.defaultVisible sin pasar por I-17")
        assertEquals(listOf(SectionKey("cover"), SectionKey("event")), r.composed.sections.map { it.key })

        // Y la misma sección, presente en el documento con `visible:false`, SÍ se fuerza a `true`.
        val conEntrada = Fx.documento(
            m,
            structure = listOf(StructureEntry(SectionKey("cover"), "default", false), StructureEntry(SectionKey("event"), "default", true)),
        )
        val r2 = DefaultComposer.compose(Fx.paquete(m), conEntrada, Fx.negocio, emptyMap(), Locale.ES_MX)
        assertTrue(r2.composed.sections.first { it.key == SectionKey("cover") }.visible, "I-17 sobre doc.structure")
    }

    /** `L(texto)` cae a `es-MX` cuando el locale pedido no está; I-27 impide que sea silencioso. */
    @Test
    fun `las etiquetas caen a es-MX cuando falta el locale pedido`() {
        val m = Fx.manifiesto(
            listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title")))),
            locales = listOf(Locale.ES_MX, Locale.EN_US),
        )
        val doc = Fx.documento(m, locale = Locale.EN_US)
        val s = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, emptyMap(), Locale.EN_US).composed.sections[0]
        assertEquals("cover", s.title)
        assertEquals("cover.title", (s.blocks[0] as ComposedBlock).label)
    }

    @Test
    fun `boolean y audio de usuario se resuelven`() {
        val m = Fx.manifiesto(
            listOf(Fx.seccion("cover", SectionType.COVER, listOf(Fx.texto("cover.title"), Fx.audio("k.audio")))),
        )
        val assets = mapOf(AssetId("as_$ULID_A") to ResolvedAsset("https://cdn.example.com/a.mp3"))
        val doc = Fx.documento(
            m,
            content = mapOf(
                "cover.title" to TextValue("x"),
                "k.audio" to mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue(AssetId("as_$ULID_A")),
            ),
        )
        val r = DefaultComposer.compose(Fx.paquete(m), doc, Fx.negocio, assets, Locale.ES_MX)
        val audio = (r.composed.sections[0].blocks[1] as ComposedBlock).value
        assertEquals("https://cdn.example.com/a.mp3", (audio as mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedAudio).url)

        val vBool = ValueResolver.resolve(Fx.texto("x"), BooleanValue(true), emptyMap(), Locale.ES_MX)
        assertEquals(true, (vBool as mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedBoolean).value)
    }
}
