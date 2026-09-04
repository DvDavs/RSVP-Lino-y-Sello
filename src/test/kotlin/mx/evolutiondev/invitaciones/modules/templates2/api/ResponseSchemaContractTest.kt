package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * **El JSON que sale por HTTP valida contra el esquema emitido desde Zod**, no solo contra el modelo
 * Kotlin.
 *
 * Es una prueba de frontera, y por eso pasa por MockMvc y por el `ObjectMapper` real en vez de mirar
 * los objetos en memoria: entre el dominio y el cuerpo de la respuesta hay una serialización que puede
 * renombrar, omitir o inventar campos —`@JsonInclude`, nombres de propiedad, tipos de fecha— y el
 * frontend de la fase 3 consume **eso**, no el objeto Kotlin. Si esta prueba pasa, el cliente
 * TypeScript que genere sus tipos desde el mismo esquema encaja con la respuesta real.
 */
@Import(Templates2ApiTestConfig::class)
class ResponseSchemaContractTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var render: PublicRenderService
    @Autowired private lateinit var esquemas: JsonSchemaValidatorService

    private val slug = "prueba-esquema-respuesta"
    private var customerId = 0L
    private var invitationId = 0L
    private lateinit var token: String

    private lateinit var mvc: MockMvc

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        token = editor.chooseTemplate(
            customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
        ).publicToken
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":0,"clientBatchId":"b_esquema_01","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Ana y Luis"}}]}""",
            ),
        )
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        mvc = MockMvcBuilders
            .standaloneSetup(
                EditorDocumentController(editor),
                PublicRenderController(render),
            )
            .setControllerAdvice(Templates2ExceptionHandler(DateFormatterImpl()))
            .build()
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    @Test
    fun `el cuerpo de GET document valida contra los tres esquemas que promete`() {
        val cuerpo = cuerpoDe(
            get("/editor/invitations/$invitationId/document").principal(principal(customerId)),
        )

        validar("invitation-document", cuerpo["document"])
        validar("composed-document", cuerpo["composed"])
        validar("composition-report", cuerpo["report"])
    }

    @Test
    fun `el cuerpo del render publico valida contra composed-document`() {
        val cuerpo = cuerpoDe(get("/public/i/$token/render"))

        validar("composed-document", cuerpo["composed"])
        assertTrue(cuerpo["contentHash"].asText().startsWith("sha256:"))
        assertTrue(cuerpo.hasNonNull("publishedAt"), "el render promete publishedAt")
    }

    private fun validar(esquema: String, nodo: JsonNode?) {
        assertTrue(nodo != null && !nodo.isNull, "la respuesta no trae el campo de $esquema")
        val violaciones = esquemas.validate(esquema, nodo!!)
        assertEquals(emptyList<Any>(), violaciones, "el cuerpo servido no valida contra $esquema")
    }

    private fun cuerpoDe(peticion: org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder): JsonNode {
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
