package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.ObjectMapper
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.http.MediaType
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Instant
import java.util.Optional

/**
 * Contrato HTTP de las rutas de pagos y de su manejador de errores (contrato §2 y §3).
 *
 * `standaloneSetup` (mismo estilo que `PaymentsHealthControllerTest.kt:26`): sin contexto de Spring
 * y sin base de datos. Lo que se mide aquí es la **superficie**: códigos, forma del cuerpo y qué
 * llega a los servicios. La persistencia se prueba aparte, contra Postgres real.
 *
 * Los servicios son **reales** y lo falso son los repositorios: una prueba que simulara el servicio
 * no probaría ni una de las reglas que este módulo tiene que hacer cumplir.
 */
class PaymentsControllerTest {

    private val json = ObjectMapper()
    private val planes: ProductPlanRepository = mock()
    private val pagos: ProductPaymentRepository = mock()
    private val jerarquia: HierarchyValidationService = mock()
    private val invitaciones: InvitationPaymentInfoReader = mock()
    private val escrituras: PaymentWriteService = mock()
    private val pasarela = PasarelaFalsa()

    private val planFiesta = ProductPlanEntity(
        id = 2, codigo = "fiesta", nombre = "Fiesta", descripcion = "El de siempre",
        precioCentavos = 89900, moneda = "MXN", invitadosMax = 150,
        incluye = """["Hasta 150 invitados","Galería de fotos"]""", recomendado = true, orden = 20,
    )

    private fun catalogo(props: ProductPaymentsProperties = PagosFx.propiedades()) =
        PlanCatalogService(planes, props, json)

    private fun consultas(props: ProductPaymentsProperties = PagosFx.propiedades()) =
        PaymentsQueryService(jerarquia, invitaciones, pagos, planes, catalogo(props), props)

    private fun checkout(props: ProductPaymentsProperties = PagosFx.propiedades()) = CheckoutService(
        consultas(props), catalogo(props), escrituras, invitaciones, pasarela, props,
        "https://app.pruebas.local/",
    )

    private fun mvcPublico(props: ProductPaymentsProperties = PagosFx.propiedades()): MockMvc =
        MockMvcBuilders.standaloneSetup(PublicPlansController(catalogo(props)))
            .setControllerAdvice(PaymentsExceptionHandler())
            .build()

    private fun mvcPrivado(
        customerId: Long = 7,
        props: ProductPaymentsProperties = PagosFx.propiedades(),
    ): MockMvc = MockMvcBuilders.standaloneSetup(PaymentsController(consultas(props), checkout(props)))
        .defaultRequest<org.springframework.test.web.servlet.setup.StandaloneMockMvcBuilder>(
            PagosFx.peticionPorDefecto(PagosFx.autenticacion(customerId)),
        )
        .setControllerAdvice(PaymentsExceptionHandler())
        .build()

    // =============================================================================================
    // 2.1 — catálogo público
    // =============================================================================================

    @Test
    fun `el catalogo publico devuelve los planes activos con su precio en centavos`() {
        whenever(planes.findByActivoTrueOrderByOrdenAscIdAsc()).thenReturn(listOf(planFiesta))
        mvcPublico().perform(get("/public/plans"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.moneda").value("MXN"))
            .andExpect(jsonPath("$.pagoEnLinea").value(true))
            .andExpect(jsonPath("$.planes[0].codigo").value("fiesta"))
            .andExpect(jsonPath("$.planes[0].precioCentavos").value(89900))
            .andExpect(jsonPath("$.planes[0].invitadosMax").value(150))
            .andExpect(jsonPath("$.planes[0].incluye[0]").value("Hasta 150 invitados"))
    }

    /** Sin clave, el catálogo **sigue** funcionando: enseñar precios no es cobrar (contrato §0). */
    @Test
    fun `sin clave de Stripe el catalogo responde igual pero avisa de que no hay pago en linea`() {
        whenever(planes.findByActivoTrueOrderByOrdenAscIdAsc()).thenReturn(listOf(planFiesta))
        mvcPublico(PagosFx.sinConfigurar()).perform(get("/public/plans"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.pagoEnLinea").value(false))
            .andExpect(jsonPath("$.planes[0].codigo").value("fiesta"))
    }

    // =============================================================================================
    // 2.2 y 2.3 — plan de una invitación e historial
    // =============================================================================================

    @Test
    fun `el plan de una invitacion propia sin pagos responde pagada false y plan nulo`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, false, "Boda de Ana y Luis"))
        whenever(pagos.findByInvitationIdOrderByIdDesc(12L)).thenReturn(emptyList())
        mvcPrivado().perform(get("/product/payments/invitations/12"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.invitationId").value(12))
            .andExpect(jsonPath("$.pagada").value(false))
            .andExpect(jsonPath("$.nombreEvento").value("Boda de Ana y Luis"))
            .andExpect(jsonPath("$.plan").doesNotExist())  // standalone MockMvc usa el mapper por defecto
            .andExpect(jsonPath("$.pagos").isEmpty)
    }

    /**
     * Invitación marcada pagada a mano por un ADMIN o sembrada: `pagada = true` **sin** fila de
     * cobro. La respuesta no se inventa un plan ni un importe (contrato §2.2).
     */
    @Test
    fun `pagada sin fila de cobro responde plan nulo y pagos vacio`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, true, null))
        whenever(pagos.findByInvitationIdOrderByIdDesc(12L)).thenReturn(emptyList())
        mvcPrivado().perform(get("/product/payments/invitations/12"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.pagada").value(true))
            .andExpect(jsonPath("$.plan").doesNotExist())  // standalone MockMvc usa el mapper por defecto
            .andExpect(jsonPath("$.pagos").isEmpty)
    }

    @Test
    fun `con un cobro pagado devuelve el plan y la fecha del cobro`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, true, "Boda"))
        whenever(pagos.findByInvitationIdOrderByIdDesc(12L)).thenReturn(listOf(pagoPagado()))
        whenever(planes.findAllById(any<Iterable<Long>>())).thenReturn(listOf(planFiesta))
        mvcPrivado().perform(get("/product/payments/invitations/12"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.plan.codigo").value("fiesta"))
            .andExpect(jsonPath("$.plan.precioCentavos").value(89900))
            .andExpect(jsonPath("$.pagos[0].estado").value("PAGADO"))
            .andExpect(jsonPath("$.pagos[0].importeCentavos").value(89900))
    }

    /** **IDOR**: una invitación ajena responde `404`, exactamente igual que una inexistente. */
    @Test
    fun `una invitacion ajena responde 404 con el mismo codigo que una inexistente`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(99L))).thenReturn(false)
        mvcPrivado().perform(get("/product/payments/invitations/99"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("PAY_INVITATION_NOT_FOUND"))
        // Y no llega a leer nada de esa invitación: el corte es antes de la consulta.
        verify(invitaciones, never()).leer(99L)
    }

    @Test
    fun `el historial solo trae los pagos de quien pregunta`() {
        whenever(pagos.findByCustomerIdOrderByIdDesc(7L)).thenReturn(listOf(pagoPagado()))
        whenever(planes.findAllById(any<Iterable<Long>>())).thenReturn(listOf(planFiesta))
        whenever(invitaciones.nombresDeEvento(any())).thenReturn(mapOf(12L to "Boda"))
        mvcPrivado().perform(get("/product/payments/pagos"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.pagos[0].invitationId").value(12))
            .andExpect(jsonPath("$.pagos[0].nombreEvento").value("Boda"))
        // La consulta se hace con el id del TOKEN, no con nada que venga de la petición.
        verify(pagos).findByCustomerIdOrderByIdDesc(7L)
    }

    // =============================================================================================
    // 2.4 — checkout
    // =============================================================================================

    @Test
    fun `el checkout responde 201 con la url de Stripe y el importe lo pone el servidor`() {
        prepararCheckout()
        whenever(escrituras.crearPendiente(any(), any(), any(), any(), any())).thenReturn(
            ProductPaymentEntity(id = 41, invitationId = 12, customerId = 7, productPlanId = 2),
        )
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"fiesta"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.checkoutUrl").value(pasarela.url))
            .andExpect(jsonPath("$.paymentId").value(41))
        val peticion = pasarela.peticiones.single()
        assertEquals(89900, peticion.importeCentavos, "el importe sale de product_plan, no del cliente")
        assertEquals("MXN", peticion.moneda)
        assertEquals("https://app.pruebas.local/pago?inv=12&sesion={CHECKOUT_SESSION_ID}", peticion.successUrl)
        assertEquals("https://app.pruebas.local/pago?inv=12&cancelado=1", peticion.cancelUrl)
    }

    /** El precio NUNCA llega del cliente: un importe en el cuerpo ni siquiera se lee. */
    @Test
    fun `un importe en el cuerpo del checkout no cambia lo que se le pide a Stripe`() {
        prepararCheckout()
        whenever(escrituras.crearPendiente(any(), any(), any(), any(), any())).thenReturn(
            ProductPaymentEntity(id = 41, invitationId = 12, customerId = 7, productPlanId = 2),
        )
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"fiesta","importeCentavos":1,"precio":1}"""),
        ).andExpect(status().isCreated)
        assertEquals(89900, pasarela.peticiones.single().importeCentavos)
    }

    @Test
    fun `sin clave de Stripe el checkout responde 503 PAY_NOT_CONFIGURED`() {
        prepararCheckout()
        mvcPrivado(props = PagosFx.sinConfigurar()).perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"fiesta"}"""),
        )
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.code").value("PAY_NOT_CONFIGURED"))
        assertTrue(pasarela.peticiones.isEmpty(), "sin clave no se llama a Stripe")
    }

    @Test
    fun `un plan inexistente o inactivo responde 404 PAY_PLAN_NOT_FOUND`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, false, null))
        whenever(planes.findByCodigoAndActivoTrue("retirado")).thenReturn(null)
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"retirado"}"""),
        )
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("PAY_PLAN_NOT_FOUND"))
    }

    @Test
    fun `una invitacion ya pagada responde 409 PAY_ALREADY_PAID`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, true, null))
        whenever(planes.findByCodigoAndActivoTrue("fiesta")).thenReturn(planFiesta)
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"fiesta"}"""),
        )
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("PAY_ALREADY_PAID"))
    }

    /** Stripe caído: `502` y la fila queda `FALLIDO`, no `PENDIENTE` (contrato §2.4). */
    @Test
    fun `si Stripe falla responde 502 y el cobro queda marcado como fallido`() {
        prepararCheckout()
        whenever(escrituras.crearPendiente(any(), any(), any(), any(), any())).thenReturn(
            ProductPaymentEntity(id = 41, invitationId = 12, customerId = 7, productPlanId = 2),
        )
        pasarela.falla = true
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12,"planCodigo":"fiesta"}"""),
        )
            .andExpect(status().isBadGateway)
            .andExpect(jsonPath("$.code").value("PAY_STRIPE_UNAVAILABLE"))
        verify(escrituras).marcarFallido(41L)
    }

    @Test
    fun `un cuerpo sin planCodigo responde 400 PAY_MALFORMED_JSON`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON)
                .content("""{"invitationId":12}"""),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_MALFORMED_JSON"))
    }

    @Test
    fun `un cuerpo que no es JSON responde 400 PAY_MALFORMED_JSON`() {
        mvcPrivado().perform(
            post("/product/payments/checkout").contentType(MediaType.APPLICATION_JSON).content("{no-es-json"),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_MALFORMED_JSON"))
    }

    /** Un `invitationId` que no es un número es `400`, nunca un `500` (regla dura del advice). */
    @Test
    fun `un invitationId no numerico responde 400 y no 500`() {
        mvcPrivado().perform(get("/product/payments/invitations/abc"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_MALFORMED_JSON"))
    }

    // =============================================================================================
    // Forma del error y autorización por anotación
    // =============================================================================================

    /** El cuerpo del error tiene exactamente la forma del contrato: `{code, message, details}`. */
    @Test
    fun `el cuerpo del error lleva code y message y nunca una traza`() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(99L))).thenReturn(false)
        val cuerpo = mvcPrivado().perform(get("/product/payments/invitations/99"))
            .andReturn().response.contentAsString
        val nodo = json.readTree(cuerpo)
        // `details` viaja solo cuando hay algo que contar; aquí lo hay (`invitationId`).
        assertEquals(
            listOf("code", "details", "message"),
            nodo.fieldNames().asSequence().sorted().toList(),
        )
        assertTrue(nodo["message"].asText().isNotBlank())
        assertTrue(
            !cuerpo.contains("Exception") && !cuerpo.contains("at mx.evolutiondev"),
            "el cuerpo no puede llevar clases ni trazas: $cuerpo",
        )
    }

    /**
     * La autorización de estas rutas depende de una anotación, y una anotación que alguien borre en
     * un refactor no rompe ninguna prueba funcional. Esta sí (mismo criterio que
     * `PaymentsHealthControllerTest.kt:43-50`).
     */
    @Test
    fun `el controlador con sesion exige los roles del contrato`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            PaymentsController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "PaymentsController debe llevar @PreAuthorize de clase")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value)
    }

    /**
     * **`null` viaja, no desaparece.** El `ObjectMapper` de la aplicación es el de `templates2`
     * (`Templates2JsonConfig.kt:35`; un bean de tipo `ObjectMapper` desactiva el de Spring Boot por
     * `@ConditionalOnMissingBean`) y trae `serializationInclusion(NON_NULL)`
     * (`Templates2Json.kt:32`). Sin `@JsonInclude(ALWAYS)` en los DTO, `invitadosMax`, `plan` y
     * `pagadoEn` se caían del JSON y el frontend no podía distinguir «sin límite» de «no lo sé»
     * (comprobado contra el backend vivo antes de anotarlos).
     */
    @Test
    fun `los nulos del contrato viajan como null aunque el mapper omita nulos`() {
        val mapper = ObjectMapper().setSerializationInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
        val plan = catalogo().dto(planFiesta.also { it.invitadosMax = null })
        val nodoPlan = mapper.readTree(mapper.writeValueAsString(plan))
        assertTrue(nodoPlan.has("invitadosMax"), "invitadosMax: null significa «sin límite»")
        assertTrue(nodoPlan["invitadosMax"].isNull)

        val invitacion = PlanDeInvitacionDto(12, true, null, null, null, emptyList(), true)
        val nodo = mapper.readTree(mapper.writeValueAsString(invitacion))
        listOf("nombreEvento", "plan", "pagadoEn").forEach {
            assertTrue(nodo.has(it), "$it debe viajar como null, no desaparecer")
        }
    }

    /** El catálogo y el webhook son públicos a propósito: no llevan `@PreAuthorize`. */
    @Test
    fun `las dos rutas publicas no llevan PreAuthorize`() {
        listOf(PublicPlansController::class.java, StripeWebhookController::class.java).forEach {
            assertEquals(
                null,
                AnnotatedElementUtils.findMergedAnnotation(it, PreAuthorize::class.java),
                "${it.simpleName} cuelga de /public/ y no debe exigir sesión",
            )
        }
    }

    // =============================================================================================

    private fun prepararCheckout() {
        whenever(jerarquia.validateInvitationAccess(eq(7L), eq(12L))).thenReturn(true)
        whenever(invitaciones.leer(12L)).thenReturn(DatosDeInvitacion(12, 7, false, "Boda"))
        whenever(invitaciones.correoDelCliente(7L)).thenReturn("cliente7@example.test")
        whenever(planes.findByCodigoAndActivoTrue("fiesta")).thenReturn(planFiesta)
        whenever(pagos.findById(41L)).thenReturn(Optional.empty())
    }

    private fun pagoPagado() = ProductPaymentEntity(
        id = 41, invitationId = 12, customerId = 7, productPlanId = 2,
        estado = EstadoDePago.PAGADO, importeCentavos = 89900, moneda = "MXN",
        stripeCheckoutSessionId = "cs_test_prueba", stripePaymentIntentId = "pi_test_prueba",
        pagadoEn = Instant.parse("2026-03-03T18:22:10Z"), createdAt = Instant.parse("2026-03-03T18:20:00Z"),
    )
}
