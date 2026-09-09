package mx.evolutiondev.invitaciones.modules.product.invitations

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.io.File
import java.time.LocalDate

/**
 * Contrato HTTP de `POST /product/invitations` (`memoria/handoffs/5-1b-contrato-alta.md`).
 *
 * Estilo de `AccountHealthControllerTest.kt`: `standaloneSetup`, sin contexto de Spring y sin base de
 * datos; la persistencia es [FakeProductInvitationRepository]. Se registra el advice del subpaquete
 * porque los codigos de error **son** parte del contrato que consumen E2 y E4.
 */
class ProductInvitationsControllerTest {

    private val repositorio = FakeProductInvitationRepository()
    private val servicio = ProductInvitationService(repositorio)
    /**
     * **El convertidor va con `FAIL_ON_UNKNOWN_PROPERTIES` a proposito.** Es el que usa la aplicacion
     * real: `templates2` publica su `ObjectMapper` estricto como bean y `JacksonAutoConfiguration`
     * crea el suyo con `@ConditionalOnMissingBean(ObjectMapper)`, asi que se retira y el estricto se
     * queda con todo Spring MVC (medido contra `:6003` el 2026-09-09). Con el convertidor laxo por
     * defecto de `standaloneSetup`, la prueba del dueno ajeno pasaria aqui y fallaria en produccion.
     */
    private val convertidorEstricto = MappingJackson2HttpMessageConverter(
        ObjectMapper().registerKotlinModule()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES),
    )

    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(ProductInvitationsController(servicio))
        .setControllerAdvice(ProductInvitationsExceptionHandler())
        .setMessageConverters(convertidorEstricto)
        .build()

    private fun tokenDe(id: Long, rol: String = "ROLE_USER"): Authentication {
        val detalles = CustomerDetails(id, "clienta$id@ejemplo.mx", "x", listOf(SimpleGrantedAuthority(rol)))
        return UsernamePasswordAuthenticationToken(detalles, null, detalles.authorities)
    }

    /**
     * La fecha se calcula, no se escribe: cualquier fecha fija acabaria cayendo fuera de la ventana
     * de diez anos del contrato y la prueba moriria de vieja sin que nadie tocara el codigo.
     */
    private val fecha: String = LocalDate.now(ProductInvitationService.ZONA).plusMonths(6).toString()

    private val cuerpoValido = """{"eventKind":"wedding","eventDate":"$fecha","eventTime":"17:00"}"""

    @Test
    fun `alta feliz responde 201 y la invitacion nace sin pagar y del lado de templates2`() {
        mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json").content(cuerpoValido),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.invitationId").value(100))
            .andExpect(jsonPath("$.eventKind").value("wedding"))
            .andExpect(jsonPath("$.eventDate").value(fecha))
            .andExpect(jsonPath("$.eventTime").value("17:00"))
            .andExpect(jsonPath("$.isPaid").value(false))
            .andExpect(jsonPath("$.isEnabled").value(true))
            .andExpect(jsonPath("$.isFinished").value(false))
            .andExpect(jsonPath("$.usesTemplates2").value(true))
            // Defecto del contrato: nacen en true porque hoy no hay ruta que las edite.
            .andExpect(jsonPath("$.childrenAllowed").value(true))
            .andExpect(jsonPath("$.youngAllowed").value(true))

        // El dueno es el del token, y la fila apunta a la plantilla puente del `eventKind` pedido.
        assertEquals(1, repositorio.insertadas.size)
        assertEquals(7L, repositorio.insertadas[0].customerId)
        assertEquals(901L, repositorio.insertadas[0].templateId)
    }

    /** Sin enumeracion: la respuesta no lleva ids ajenos, ni conteos, ni listas. */
    @Test
    fun `la respuesta no filtra nada mas que la invitacion recien creada`() {
        val cuerpo = mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json").content(cuerpoValido),
        ).andReturn().response.contentAsString

        listOf("customerId", "customer_id", "templateId", "template_id", "count", "total", "publicToken")
            .forEach { assertTrue(!cuerpo.contains(it), "la respuesta no debe llevar «$it»: $cuerpo") }
    }

    /**
     * El dueno **nunca** llega del cuerpo: un `customerId` ajeno se **ignora** (ni se acepta ni se
     * rechaza), porque el `ObjectMapper` del nucleo descarta lo desconocido y el servicio solo mira
     * `authentication.userId()`.
     */
    @Test
    fun `un intento de fijar dueno ajeno en el payload se ignora`() {
        mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json")
                .content(
                    """
                    {"eventKind":"wedding","eventDate":"$fecha","eventTime":"17:00",
                     "customerId":999,"customer_id":999,"ownerId":999,"isPaid":true,"id":12345}
                    """.trimIndent(),
                ),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.invitationId").value(100))
            .andExpect(jsonPath("$.isPaid").value(false))

        assertEquals(7L, repositorio.insertadas[0].customerId)
    }

    @Test
    fun `un eventKind fuera del catalogo cerrado responde 400 con codigo estable`() {
        mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json")
                .content("""{"eventKind":"boda","eventDate":"$fecha","eventTime":"17:00"}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PRD_EVENT_KIND_INVALID"))
            .andExpect(jsonPath("$.details.allowed", org.hamcrest.Matchers.hasSize<Any>(8)))

        assertTrue(repositorio.insertadas.isEmpty(), "un payload invalido no escribe nada")
    }

    @Test
    fun `superar el limite de borradores responde 409 con el codigo del contrato`() {
        repositorio.borradoresPorCliente[7L] = ProductInvitationService.MAXIMO_BORRADORES

        mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json").content(cuerpoValido),
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("PRD_DRAFT_LIMIT_REACHED"))
            .andExpect(jsonPath("$.details.limit").value(3))

        assertTrue(repositorio.insertadas.isEmpty())
    }

    /** El limite es por clienta: el de otra no gasta cupo (consulta acotada al `customer_id`). */
    @Test
    fun `el limite de una clienta no afecta a otra`() {
        repositorio.borradoresPorCliente[7L] = ProductInvitationService.MAXIMO_BORRADORES

        mvc.perform(
            post("/product/invitations").principal(tokenDe(8))
                .contentType("application/json").content(cuerpoValido),
        ).andExpect(status().isCreated)

        assertEquals(8L, repositorio.insertadas.single().customerId)
    }

    @Test
    fun `un cuerpo ilegible responde 400 sin filtrar la forma interna`() {
        mvc.perform(
            post("/product/invitations").principal(tokenDe(7))
                .contentType("application/json").content("""{"eventKind":"wedding",,}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PRD_MALFORMED_JSON"))
            .andExpect(jsonPath("$.message").value("El cuerpo de la petición no es un JSON válido para esta ruta."))
    }

    @Test
    fun `la clase exige los roles del contrato`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            ProductInvitationsController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "ProductInvitationsController debe llevar @PreAuthorize (ADR-1R-B-10)")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value)
    }

    /**
     * El `401` sin token no lo escribe esta clase sino la cadena de filtros: `/product/` + `**` no
     * tiene regla en `SecurityConfig` y cae en `anyRequest().authenticated()` (`SecurityConfig.kt:47`).
     * Esta prueba vigila justo eso — que nadie abra el prefijo con un `permitAll` —, porque una regla
     * nueva ahi dejaria el alta abierta a cualquiera y ninguna prueba funcional se enteraria.
     */
    @Test
    fun `SecurityConfig no abre ninguna ruta bajo product`() {
        val fuente = File(
            "src/main/kotlin/mx/evolutiondev/invitaciones/core/auth/security/SecurityConfig.kt",
        )
        assertTrue(fuente.exists(), "no se encontro SecurityConfig.kt en ${fuente.absolutePath}")
        val reglas = fuente.readLines().filter { it.contains("requestMatchers") }
        assertTrue(
            reglas.none { it.contains("/product") },
            "SecurityConfig no debe declarar reglas para /product: $reglas",
        )
    }
}
