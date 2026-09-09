package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Instant
import java.util.Optional

/**
 * El webhook, **con la firma calculada de verdad en la prueba** (contrato §2.5 y §4).
 *
 * No hay ninguna cabecera copiada de Stripe: cada caso construye su `Stripe-Signature` con
 * `t=<ts>,v1=HMAC-SHA256(secreto, "<ts>.<payload>")`, que es exactamente lo que verifica
 * `Webhook.constructEvent`. Eso permite probar las tres formas de romperla —otra cuenta, sin
 * cabecera, caducada— y no solo el camino feliz.
 *
 * Los repositorios son falsos: lo que se mide aquí es la **decisión** (qué se acepta, qué se
 * rechaza, qué se escribe). Que la idempotencia funcione de verdad contra Postgres se prueba en
 * `ProductPaymentsPersistenceTest`, porque una clave primaria no se puede simular.
 */
class StripeWebhookServiceTest {

    private val eventos: ProductStripeEventRepository = mock()
    private val pagos: ProductPaymentRepository = mock()
    private val banderas: InvitationPaymentFlagRepository = mock()

    private fun servicio(props: ProductPaymentsProperties = PagosFx.propiedades()) =
        StripeWebhookService(props, eventos, pagos, banderas, ObjectMapper())

    private fun mvc(props: ProductPaymentsProperties = PagosFx.propiedades()): MockMvc =
        MockMvcBuilders.standaloneSetup(StripeWebhookController(servicio(props)))
            .setControllerAdvice(PaymentsExceptionHandler())
            .build()

    private fun pagoPendiente(importe: Long = 89900) = ProductPaymentEntity(
        id = 1, invitationId = 12, customerId = 7, productPlanId = 2,
        estado = EstadoDePago.PENDIENTE, importeCentavos = importe, moneda = "MXN",
        stripeCheckoutSessionId = "cs_test_prueba",
    )

    private fun nuevoEvento() {
        whenever(eventos.insertarSiEsNuevo(any(), any())).thenReturn(1)
    }

    // =============================================================================================
    // Firma
    // =============================================================================================

    @Test
    fun `una firma valida se procesa y responde 200`() {
        nuevoEvento()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pagoPendiente())
        val cuerpo = PagosFx.eventoDeSesion("evt_1")
        mvc().perform(
            post("/public/stripe/webhook")
                .header(StripeWebhookController.CABECERA_FIRMA, PagosFx.firmar(cuerpo))
                .content(cuerpo),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.received").value(true))
    }

    @Test
    fun `sin cabecera de firma responde 400 y no escribe nada`() {
        val cuerpo = PagosFx.eventoDeSesion("evt_2")
        mvc().perform(post("/public/stripe/webhook").content(cuerpo))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_WEBHOOK_SIGNATURE_INVALID"))
        verify(eventos, never()).insertarSiEsNuevo(any(), any())
        verify(banderas, never()).marcarPagada(any(), any())
    }

    /** Una firma de **otra cuenta de Stripe** no vale: el secreto es el de esta cuenta. */
    @Test
    fun `una firma calculada con otro secreto responde 400`() {
        val cuerpo = PagosFx.eventoDeSesion("evt_3")
        mvc().perform(
            post("/public/stripe/webhook")
                .header(StripeWebhookController.CABECERA_FIRMA, PagosFx.firmar(cuerpo, PagosFx.SECRETO_AJENO))
                .content(cuerpo),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_WEBHOOK_SIGNATURE_INVALID"))
        verify(banderas, never()).marcarPagada(any(), any())
    }

    /** Fuera de la tolerancia de 300 s: una firma correcta pero vieja es una firma reproducida. */
    @Test
    fun `una firma con marca de tiempo caducada responde 400`() {
        val cuerpo = PagosFx.eventoDeSesion("evt_4")
        val vieja = com.stripe.net.Webhook.Util.getTimeNow() - 3600
        mvc().perform(
            post("/public/stripe/webhook")
                .header(
                    StripeWebhookController.CABECERA_FIRMA,
                    PagosFx.firmar(cuerpo, PagosFx.SECRETO_FALSO, vieja),
                )
                .content(cuerpo),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_WEBHOOK_SIGNATURE_INVALID"))
    }

    /** Un cuerpo alterado tras firmar deja de verificar: la firma cubre los bytes, no la intención. */
    @Test
    fun `un cuerpo alterado despues de firmar responde 400`() {
        val original = PagosFx.eventoDeSesion("evt_5", amountTotal = 89900)
        val firma = PagosFx.firmar(original)
        val manipulado = original.replace("89900", "1")
        mvc().perform(
            post("/public/stripe/webhook").header(StripeWebhookController.CABECERA_FIRMA, firma).content(manipulado),
        )
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.code").value("PAY_WEBHOOK_SIGNATURE_INVALID"))
    }

    /** Sin `STRIPE_WEBHOOK_SECRET` **no se acepta nada**, ni siquiera con una firma cualquiera. */
    @Test
    fun `sin secreto de webhook responde 503 PAY_NOT_CONFIGURED`() {
        val cuerpo = PagosFx.eventoDeSesion("evt_6")
        mvc(PagosFx.sinConfigurar()).perform(
            post("/public/stripe/webhook")
                .header(StripeWebhookController.CABECERA_FIRMA, PagosFx.firmar(cuerpo))
                .content(cuerpo),
        )
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.code").value("PAY_NOT_CONFIGURED"))
        verify(eventos, never()).insertarSiEsNuevo(any(), any())
    }

    // =============================================================================================
    // Idempotencia y transiciones
    // =============================================================================================

    /** Replay: el `INSERT` choca, se responde `200` y **no se toca nada más**. */
    @Test
    fun `un evento repetido responde 200 duplicado y no vuelve a escribir`() {
        whenever(eventos.insertarSiEsNuevo(eq("evt_7"), any())).thenReturn(0)
        val cuerpo = PagosFx.eventoDeSesion("evt_7")
        mvc().perform(
            post("/public/stripe/webhook")
                .header(StripeWebhookController.CABECERA_FIRMA, PagosFx.firmar(cuerpo))
                .content(cuerpo),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.duplicado").value(true))
        verify(pagos, never()).saveAndFlush(any())
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos, never()).marcarProcesado(any(), any())
    }

    @Test
    fun `checkout completada marca PAGADO y escribe is_paid con el importe guardado`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_8")
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.PAGADO, pago.estado)
        assertEquals("pi_test_prueba", pago.stripePaymentIntentId)
        assertTrue(pago.pagadoEn != null, "un pago confirmado tiene fecha de cobro")
        // 89900 centavos -> 899.0 en la columna heredada `total_amount` (double).
        verify(banderas).marcarPagada(12L, 899.0)
        verify(eventos).marcarProcesado("evt_8", StripeWebhookService.RES_PROCESADO)
    }

    /** El importe de la sesión tiene que coincidir con el que el servidor guardó. Si no, no se paga. */
    @Test
    fun `un amount_total distinto del guardado no marca pagada y queda registrado`() {
        nuevoEvento()
        val pago = pagoPendiente(importe = 89900)
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_9", amountTotal = 100)
        val respuesta = servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(true, respuesta.received)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado, "no se marca pagado con otro importe")
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_9", StripeWebhookService.RES_IMPORTE_DISTINTO)
    }

    /** Misma regla para la moneda: cobrar 899 de otra divisa no es cobrar el plan. */
    @Test
    fun `una moneda distinta de la guardada no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_10", currency = "usd")
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_10", StripeWebhookService.RES_IMPORTE_DISTINTO)
    }

    /** `payment_status` distinto de `paid`: la sesión se completó, el dinero no llegó. */
    @Test
    fun `una sesion completada sin pagar no abre la puerta`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_11", paymentStatus = "unpaid")
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(banderas, never()).marcarPagada(any(), any())
    }

    /** Sin `session_id` conocido, se cae a `metadata.paymentId` comprobando el `invitationId`. */
    @Test
    fun `si la sesion no esta guardada se busca por metadata comprobando la invitacion`() {
        nuevoEvento()
        val pago = pagoPendiente().also { it.stripeCheckoutSessionId = null }
        whenever(pagos.findByStripeCheckoutSessionId(any())).thenReturn(null)
        whenever(pagos.findById(1L)).thenReturn(Optional.of(pago))
        val cuerpo = PagosFx.eventoDeSesion("evt_12", invitationId = 12, paymentId = 1)
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.PAGADO, pago.estado)
    }

    /** La metadata llega por la red: si dice otra invitación, no se usa. */
    @Test
    fun `una metadata con otra invitacion no marca el pago`() {
        nuevoEvento()
        val pago = pagoPendiente().also { it.stripeCheckoutSessionId = null }
        whenever(pagos.findByStripeCheckoutSessionId(any())).thenReturn(null)
        whenever(pagos.findById(1L)).thenReturn(Optional.of(pago))
        val cuerpo = PagosFx.eventoDeSesion("evt_13", invitationId = 999, paymentId = 1)
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(eventos).marcarProcesado("evt_13", StripeWebhookService.RES_SIN_PAGO)
    }

    @Test
    fun `checkout caducada deja el cobro en CADUCADO y no toca la invitacion`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_14", tipo = StripeWebhookService.TIPO_CADUCADA)
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.CADUCADO, pago.estado)
        verify(banderas, never()).marcarPagada(any(), any())
    }

    @Test
    fun `un reembolso deja REEMBOLSADO, quita is_paid y retira el release activo`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
            it.pagadoEn = Instant.now()
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeCargo("evt_15")
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.REEMBOLSADO, pago.estado)
        assertEquals("https://pay.stripe.com/receipts/prueba", pago.comprobanteUrl)
        verify(banderas).marcarNoPagada(12L)
        verify(banderas).retirarReleaseActivo(12L)
    }

    /** Un contracargo se trata igual que un reembolso (ADR-5-0B-01). */
    @Test
    fun `un contracargo tambien retira el release`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeCargo("evt_16", tipo = StripeWebhookService.TIPO_DISPUTA)
        servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(EstadoDePago.REEMBOLSADO, pago.estado)
        verify(banderas).retirarReleaseActivo(12L)
    }

    /** Cualquier otro tipo: `200` y ni una escritura. */
    @Test
    fun `un tipo de evento desconocido no hace nada`() {
        nuevoEvento()
        val cuerpo = PagosFx.eventoDeSesion("evt_17", tipo = "customer.created")
        val respuesta = servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))
        assertEquals(true, respuesta.received)
        assertNull(respuesta.duplicado)
        verify(pagos, never()).saveAndFlush(any())
        verify(eventos).marcarProcesado("evt_17", StripeWebhookService.RES_IGNORADO)
    }

    /** El servicio no traga un cuerpo vacío como si fuera un evento, ni aunque venga firmado. */
    @Test
    fun `un cuerpo vacio con firma valida responde 400 PAY_MALFORMED_JSON`() {
        val e = assertThrows<PaymentException> { servicio().procesar("", PagosFx.firmar("")) }
        assertEquals(PayErrorCode.PAY_MALFORMED_JSON, e.code)
        verify(eventos, never()).insertarSiEsNuevo(any(), any())
    }
}
