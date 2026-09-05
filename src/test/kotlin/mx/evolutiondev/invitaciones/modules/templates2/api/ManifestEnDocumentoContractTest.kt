package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.templates2.composition.Fx
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * **El editor recibe el manifiesto de su versión de plantilla en `GET .../document`** (bloque 3-4b,
 * ADR-3-4b-01).
 *
 * El defecto que reproduce esta prueba: hasta 3-4b la respuesta traía `templateVersion`
 * (`{slug, version, status}`) y el `ComposedDocument`, que lleva `label`, `role`, `type`, `provenance`
 * y `value` por bloque — **suficiente para pintar, insuficiente para editar**. Faltaban, y ninguna de
 * las 19 rutas los daba:
 *
 * 1. `BlockSpec.constraints` (`maxLength`, `multiline`) → sin ellos no hay resolver de formulario ni
 *    el escenario **U-17** de `04 §20.1` («impide guardar con 41 caracteres»);
 * 2. las opciones de un bloque `choice`;
 * 3. `SectionSpec.required` → sin él no existe **U-18** («no hay interruptor; la fila dice *siempre
 *    visible*»): hoy el editor sólo puede descubrirlo **fallando** con `TPL_SECTION_REQUIRED`;
 * 4. `SectionSpec.variants` → sin ellas no hay selector de variante;
 * 5. el catálogo de **paletas y conjuntos tipográficos**: `composed.theme` es el tema **ya resuelto**
 *    (un `paletteId` y unos tokens), no los presets entre los que elegir.
 *
 * Va por **MockMvc** y no contra el servicio en memoria por la misma razón que
 * [ResponseSchemaContractTest]: entre el dominio y el cuerpo hay una serialización que puede
 * renombrar u omitir campos, y el editor consume el cuerpo.
 */
@Import(Templates2ApiTestConfig::class)
class ManifestEnDocumentoContractTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var esquemas: JsonSchemaValidatorService

    private val slug = "prueba-manifiesto-editor"
    private val otroSlug = "prueba-manifiesto-editor-otra"
    private var customerId = 0L
    private var invitationId = 0L
    private var otraInvitacion = 0L

    private lateinit var mvc: MockMvc

    /**
     * Manifiesto con las cuatro cosas que el compuesto no lleva: un `text` con `maxLength = 40` (el
     * tope exacto de U-17), un `choice` con tres opciones, una sección `required` y otra que no, y
     * dos `variants` por sección. El tema trae tres paletas y dos conjuntos tipográficos.
     */
    private fun paqueteConTodo(slug: String, maxLength: Int = 40): TemplatePackage {
        val manifiesto = Fx.manifiesto(
            listOf(
                Fx.seccion(
                    "cover", SectionType.COVER,
                    listOf(
                        Fx.texto("cover.title", BlockRole.COVER_TITLE, required = true, maxLength = maxLength),
                        Fx.texto("cover.note", BlockRole.COVER_SUBTITLE, maxLength = 500, multiline = true),
                    ),
                    variants = listOf("full", "framed"), defaultVariant = "full", required = true,
                ),
                Fx.seccion(
                    "gifts", SectionType.GIFT_TABLE,
                    listOf(
                        Fx.grupo(
                            "gifts.options", BlockRole.GIFT_OPTIONS,
                            itemBlocks = listOf(
                                Fx.opcion("kind", listOf("bank", "store", "cash"), BlockRole.GIFT_OPTION_KIND),
                            ),
                            min = 0, max = 6,
                        ),
                    ),
                    variants = listOf("cards", "list"), defaultVariant = "cards", required = false,
                ),
            ),
            slug = slug,
        )
        return TemplatePackage(
            manifest = manifiesto,
            theme = Fx.tema(paletas = listOf("blush", "olive", "navy"), fuentes = listOf("serif", "moderna")),
            defaults = Fx.defaults(manifiesto),
        )
    }

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        limpiarPlantilla(otroSlug)
        registrarVersion(paqueteConTodo(slug))
        registrarVersion(paqueteConTodo(otroSlug, maxLength = 7))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        otraInvitacion = nuevaInvitacion(customerId)
        editor.chooseTemplate(
            customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
        )
        editor.chooseTemplate(
            customerId, otraInvitacion, json("""{"templateSlug":"$otroSlug","templateVersion":"1.0.0"}"""),
        )
        mvc = MockMvcBuilders
            .standaloneSetup(EditorDocumentController(editor))
            .setControllerAdvice(Templates2ExceptionHandler(DateFormatterImpl()))
            .build()
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarInvitacion(otraInvitacion)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
        limpiarPlantilla(otroSlug)
    }

    // ---------------------------------------------------------------------------------------------
    // El campo existe y es EXACTAMENTE lo que guarda la fila (P3: se expone, no se transforma)
    // ---------------------------------------------------------------------------------------------

    @Test
    fun `GET document trae el manifiesto completo de la version de plantilla vigente`() {
        val cuerpo = documento(invitationId)

        val manifiesto = cuerpo["manifest"]
        assertNotNull(manifiesto, "la respuesta no trae `manifest`: el editor no puede construir formularios")
        assertEquals(slug, manifiesto["slug"].asText())
        assertEquals("1.0.0", manifiesto["version"].asText())
        assertEquals(
            cuerpo["templateVersion"]["slug"].asText(), manifiesto["slug"].asText(),
            "el manifiesto tiene que ser el de la versión que `templateVersion` nombra",
        )
    }

    @Test
    fun `manifest y theme son byte a byte lo que guarda tpl_template_version`() {
        val cuerpo = documento(invitationId)
        val pkg = paqueteConTodo(slug)

        // Nada se recorta ni se reordena (P1, P3): la comparación es contra la columna, no contra una
        // proyección hecha para la ocasión.
        assertNotNull(cuerpo["manifest"], "la respuesta no trae `manifest`")
        assertNotNull(cuerpo["theme"], "la respuesta no trae `theme` (paletas y conjuntos tipográficos)")
        assertEquals(columna("manifest"), Templates2Json.canonical(cuerpo["manifest"]))
        assertEquals(columna("theme"), Templates2Json.canonical(cuerpo["theme"]))
        assertEquals(Templates2Json.canonical(DomainJson.encode(pkg.manifest)), Templates2Json.canonical(cuerpo["manifest"]))
        assertEquals(Templates2Json.canonical(DomainJson.encode(pkg.theme)), Templates2Json.canonical(cuerpo["theme"]))
    }

    @Test
    fun `manifest y theme validan contra los esquemas emitidos desde Zod`() {
        val cuerpo = documento(invitationId)

        assertNotNull(cuerpo["manifest"], "la respuesta no trae `manifest`")
        assertNotNull(cuerpo["theme"], "la respuesta no trae `theme`")
        assertEquals(emptyList<Any>(), esquemas.validate("template-manifest", cuerpo["manifest"]))
        assertEquals(emptyList<Any>(), esquemas.validate("theme", cuerpo["theme"]))
    }

    // ---------------------------------------------------------------------------------------------
    // Lo que el editor no podía hacer y ahora sí (los cinco puntos del defecto)
    // ---------------------------------------------------------------------------------------------

    @Test
    fun `U-17 — el editor ve maxLength y multiline de cada bloque de texto`() {
        val cuerpo = documento(invitationId)

        val titulo = bloque(cuerpo, "cover", "cover.title")
        assertEquals(40, titulo["constraints"]["maxLength"].asInt(), "sin maxLength no hay U-17")
        assertEquals(false, titulo["constraints"]["multiline"].asBoolean())
        assertEquals(true, titulo["required"].asBoolean())

        val nota = bloque(cuerpo, "cover", "cover.note")
        assertEquals(500, nota["constraints"]["maxLength"].asInt())
        assertEquals(true, nota["constraints"]["multiline"].asBoolean(), "un textarea se decide con `multiline`")

        // El compuesto, que es lo único que había antes, no lleva NADA de esto.
        assertTrue(
            cuerpo["composed"]["sections"].none { s -> s["blocks"].any { it.has("constraints") } },
            "el compuesto no trae constraints: por eso hacía falta el manifiesto",
        )
    }

    @Test
    fun `el editor ve las opciones de un bloque choice`() {
        val cuerpo = documento(invitationId)

        val grupo = bloque(cuerpo, "gifts", "gifts.options")
        val kind = grupo["itemBlocks"].single { it["id"].asText() == "kind" }
        assertEquals(listOf("bank", "store", "cash"), kind["options"].map { it["id"].asText() })
        assertEquals(0, grupo["min"].asInt())
        assertEquals(6, grupo["max"].asInt())
    }

    @Test
    fun `U-18 — el editor ve required de cada seccion sin tener que fallar`() {
        val cuerpo = documento(invitationId)

        assertEquals(true, seccion(cuerpo, "cover")["required"].asBoolean(), "sin `required` no hay U-18")
        assertEquals(false, seccion(cuerpo, "gifts")["required"].asBoolean())
        assertTrue(
            cuerpo["composed"]["sections"].none { it.has("required") },
            "el compuesto no dice si una sección es obligatoria: ocultarla sólo respondía TPL_SECTION_REQUIRED",
        )
    }

    @Test
    fun `el editor ve las variants disponibles de cada seccion`() {
        val cuerpo = documento(invitationId)

        assertEquals(listOf("full", "framed"), seccion(cuerpo, "cover")["variants"].map { it.asText() })
        assertEquals("full", seccion(cuerpo, "cover")["defaultVariant"].asText())
        assertEquals(listOf("cards", "list"), seccion(cuerpo, "gifts")["variants"].map { it.asText() })
        // El compuesto sólo dice la variante ELEGIDA, nunca las disponibles.
        assertEquals("full", cuerpo["composed"]["sections"].first()["variant"].asText())
        assertTrue(cuerpo["composed"]["sections"].none { it.has("variants") })
    }

    @Test
    fun `el editor ve el catalogo de paletas y de conjuntos tipograficos`() {
        val cuerpo = documento(invitationId)

        val tema = cuerpo["theme"]
        assertNotNull(tema, "sin los presets del tema no hay selector de paleta ni de tipografía")
        assertEquals(listOf("blush", "olive", "navy"), tema["palettes"].map { it["id"].asText() })
        assertEquals(listOf("serif", "moderna"), tema["fontSets"].map { it["id"].asText() })
        assertEquals("blush", tema["defaultPaletteId"].asText())
        assertEquals(
            listOf("bg", "surface", "ink", "accent", "accentInk", "muted").sorted(),
            tema["palettes"].first()["tokens"].fieldNames().asSequence().toList().sorted(),
        )
        // `composed.theme` es el tema YA RESUELTO: un id y unos tokens, sin los presets entre los que elegir.
        assertEquals("blush", cuerpo["composed"]["theme"]["paletteId"].asText())
        assertTrue(cuerpo["composed"]["theme"].none { it.isArray })
    }

    // ---------------------------------------------------------------------------------------------
    // Ámbito de documento: cada invitación recibe el manifiesto de SU plantilla
    // ---------------------------------------------------------------------------------------------

    @Test
    fun `otra invitacion con otra plantilla recibe su propio manifiesto`() {
        val unaCosa = documento(invitationId)
        val otraCosa = documento(otraInvitacion)

        assertNotNull(unaCosa["manifest"], "la respuesta no trae `manifest`")
        assertEquals(slug, unaCosa["manifest"]["slug"].asText())
        assertEquals(otroSlug, otraCosa["manifest"]["slug"].asText())
        assertEquals(40, bloque(unaCosa, "cover", "cover.title")["constraints"]["maxLength"].asInt())
        assertEquals(7, bloque(otraCosa, "cover", "cover.title")["constraints"]["maxLength"].asInt())
    }

    // ---------------------------------------------------------------------------------------------

    private fun documento(iid: Long): JsonNode =
        cuerpoDe(get("/editor/invitations/$iid/document").principal(principal(customerId)))

    private fun seccion(cuerpo: JsonNode, key: String): JsonNode {
        val manifiesto = cuerpo["manifest"]
        assertNotNull(manifiesto, "la respuesta no trae `manifest`: el editor no puede editar con lo que recibe")
        return manifiesto["sections"].single { it["key"].asText() == key }
    }

    private fun bloque(cuerpo: JsonNode, seccion: String, id: String): JsonNode =
        seccion(cuerpo, seccion)["blocks"].single { it["id"].asText() == id }

    /** El JSON tal cual está en `tpl_template_version`, en forma canónica para poder compararlo. */
    private fun columna(nombre: String): String = Templates2Json.canonical(
        Templates2Json.readTree(
            consultar(
                "SELECT v.$nombre::text FROM tpl_template_version v JOIN tpl_template t ON t.id = v.template_id " +
                    "WHERE t.slug = ?",
                slug,
            ) as String,
        ),
    )

    private fun cuerpoDe(peticion: MockHttpServletRequestBuilder): JsonNode {
        val respuesta = mvc.perform(peticion).andReturn().response
        assertEquals(200, respuesta.status, respuesta.contentAsString)
        return Templates2Json.readTree(respuesta.contentAsString)
    }

    private fun principal(id: Long) = org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
        mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails(id, "a@b.test", "x", emptyList()),
        null,
        emptyList(),
    )
}
