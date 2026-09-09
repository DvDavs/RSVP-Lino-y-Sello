package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.ObjectMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import mx.evolutiondev.invitaciones.modules.templates2.api.PublicRenderInvalidated
import org.springframework.context.ApplicationEventPublisher
import java.time.Instant

/**
 * Revisión adversarial 5-4-ADV del webhook: **los casos en los que el cuerpo llega firmado pero no
 * dice lo que el contrato exige**.
 *
 * Todo lo de aquí presupone una firma válida a propósito. La firma ya se ataca en
 * [StripeWebhookServiceTest] (sin cabecera, otro secreto, caducada, cuerpo alterado) y esas defensas
 * aguantan; lo que estas pruebas miden es la segunda línea: qué pasa cuando el evento **sí** viene de
 * Stripe pero le falta el dato con el que se decide que hay dinero cobrado. El criterio del contrato
 * §2.5 es "se verifica que `amount_total` y `currency` coinciden": un campo ausente no se puede
 * verificar, así que **no abre la puerta** — se anota el resultado en `product_stripe_event` y se
 * responde `200` para revisión manual, igual que `IMPORTE_DISTINTO`.
 */
class StripeWebhookAdversarialTest {

    private val eventos: ProductStripeEventRepository = mock()
    private val pagos: ProductPaymentRepository = mock()
    private val banderas: InvitationPaymentFlagRepository = mock()
    private val dominio: ApplicationEventPublisher = mock()

    private fun servicio() =
        StripeWebhookService(PagosFx.propiedades(), eventos, pagos, banderas, ObjectMapper(), dominio)

    private fun pagoPendiente() = ProductPaymentEntity(
        id = 1, invitationId = 12, customerId = 7, productPlanId = 2,
        estado = EstadoDePago.PENDIENTE, importeCentavos = 89900, moneda = "MXN",
        stripeCheckoutSessionId = "cs_test_prueba",
    )

    private fun nuevoEvento() {
        whenever(eventos.insertarSiEsNuevo(any(), any())).thenReturn(1)
    }

    /** Evento `checkout.session.completed` con el objeto que se le pase, tal cual. */
    private fun evento(id: String, objeto: String, tipo: String = StripeWebhookService.TIPO_COMPLETADA): String =
        """{"id":"$id","object":"event","type":"$tipo","api_version":"2024-06-20","created":1700000000,""" +
            """"data":{"object":$objeto}}"""

    private fun procesar(cuerpo: String) = servicio().procesar(cuerpo, PagosFx.firmar(cuerpo))

    // =============================================================================================
    // El objeto del evento tiene que ser una sesión de Checkout
    // =============================================================================================

    /**
     * `data.object` que **no** es una `checkout.session`. Un evento así no describe una sesión de
     * pago, y leerle `metadata.paymentId` para marcar pagada una invitación es confiar en la forma
     * de un objeto que nadie ha comprobado.
     */
    @Test
    fun `un data object que no es una checkout session no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_1",
            """{"id":"cs_test_prueba","object":"payment_intent","payment_status":"paid",""" +
                """"amount_total":89900,"currency":"mxn","metadata":{"invitationId":"12","paymentId":"1"}}""",
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado, "solo una checkout.session abre la puerta")
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_adv_1", StripeWebhookService.RES_OBJETO_INESPERADO)
    }

    // =============================================================================================
    // Campos ausentes: no se puede verificar, no se paga
    // =============================================================================================

    /** Sin `payment_status` no consta que el dinero llegara: la sesión existe, el cobro no. */
    @Test
    fun `una sesion sin payment_status no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_2",
            """{"id":"cs_test_prueba","object":"checkout.session","amount_total":89900,"currency":"mxn",""" +
                """"metadata":{"invitationId":"12","paymentId":"1"}}""",
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_adv_2", StripeWebhookService.RES_NO_PAGADA)
    }

    /** Sin `amount_total` no hay nada que comparar con el importe guardado (contrato §2.5). */
    @Test
    fun `una sesion sin amount_total no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_3",
            """{"id":"cs_test_prueba","object":"checkout.session","payment_status":"paid","currency":"mxn",""" +
                """"metadata":{"invitationId":"12","paymentId":"1"}}""",
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_adv_3", StripeWebhookService.RES_SIN_IMPORTE)
    }

    /** Y sin `currency` tampoco: 89900 de otra divisa no es el precio del plan. */
    @Test
    fun `una sesion sin currency no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_4",
            """{"id":"cs_test_prueba","object":"checkout.session","payment_status":"paid","amount_total":89900,""" +
                """"metadata":{"invitationId":"12","paymentId":"1"}}""",
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(eventos).marcarProcesado("evt_adv_4", StripeWebhookService.RES_SIN_IMPORTE)
    }

    /** `amount_total` como texto tampoco cuenta: se compara un número, no lo que parezca uno. */
    @Test
    fun `un amount_total que no es numero no marca pagada`() {
        nuevoEvento()
        val pago = pagoPendiente()
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_5",
            """{"id":"cs_test_prueba","object":"checkout.session","payment_status":"paid",""" +
                """"amount_total":"89900","currency":"mxn","metadata":{"invitationId":"12","paymentId":"1"}}""",
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PENDIENTE, pago.estado)
        verify(eventos).marcarProcesado("evt_adv_5", StripeWebhookService.RES_SIN_IMPORTE)
    }

    // =============================================================================================
    // Replay con otro `event.id` sobre la MISMA sesión
    // =============================================================================================

    /**
     * Escenario 1 del encargo: pagar una vez y **marcar dos**. El `event.id` distinto se salta la
     * idempotencia de `product_stripe_event`, así que la segunda defensa es el estado de la fila.
     */
    @Test
    fun `otro event id sobre una sesion ya pagada no vuelve a escribir`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.pagadoEn = Instant.parse("2026-01-01T00:00:00Z")
        }
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_prueba")).thenReturn(pago)
        val cuerpo = PagosFx.eventoDeSesion("evt_adv_6_otro_id")
        procesar(cuerpo)
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), pago.pagadoEn, "no se reescribe la fecha de cobro")
        verify(pagos, never()).saveAndFlush(any())
        verify(banderas, never()).marcarPagada(any(), any())
        verify(eventos).marcarProcesado("evt_adv_6_otro_id", StripeWebhookService.RES_YA_PAGADO)
    }

    /**
     * Dos sesiones distintas pagadas para la MISMA invitación: la clienta abrió el checkout dos
     * veces (o pagó mientras un ADMIN la marcaba a mano) y se le cobró dos veces. El cobro se
     * registra —el dinero está tomado y negarlo no lo devuelve— pero el evento queda anotado como
     * `PAGO_DUPLICADO` para que alguien lo reembolse a mano.
     */
    @Test
    fun `un segundo cobro de la misma invitacion queda anotado como duplicado`() {
        nuevoEvento()
        val segundo = pagoPendiente().also { it.id = 2; it.stripeCheckoutSessionId = "cs_test_segunda" }
        whenever(pagos.findByStripeCheckoutSessionId("cs_test_segunda")).thenReturn(segundo)
        whenever(pagos.countByInvitationIdAndEstado(eq(12L), eq(EstadoDePago.PAGADO))).thenReturn(1L)
        val cuerpo = PagosFx.eventoDeSesion("evt_adv_7", sessionId = "cs_test_segunda", paymentId = 2)
        procesar(cuerpo)
        assertEquals(EstadoDePago.PAGADO, segundo.estado, "el dinero se cobró: la fila lo dice")
        verify(eventos).marcarProcesado("evt_adv_7", StripeWebhookService.RES_PAGO_DUPLICADO)
    }

    // =============================================================================================
    // Reembolso parcial
    // =============================================================================================

    /**
     * `charge.refunded` **no distingue** total de parcial: llega igual por devolver un peso que por
     * devolverlo todo. Retirar el enlace público por una devolución parcial apaga la invitación de
     * una clienta que sigue habiendo pagado el plan.
     */
    @Test
    fun `un reembolso parcial no retira el release ni quita is_paid`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_8",
            """{"id":"ch_test_prueba","object":"charge","payment_intent":"pi_test_prueba",""" +
                """"refunded":false,"amount":89900,"amount_refunded":100}""",
            tipo = StripeWebhookService.TIPO_REEMBOLSO,
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.PAGADO, pago.estado, "un reembolso parcial no anula el plan")
        verify(banderas, never()).marcarNoPagada(any())
        verify(banderas, never()).retirarReleaseActivo(any())
        verify(eventos).marcarProcesado("evt_adv_8", StripeWebhookService.RES_REEMBOLSO_PARCIAL)
    }

    /** El reembolso total sí retira, aunque `refunded` no venga: `amount_refunded` cubre el cargo. */
    @Test
    fun `un reembolso total por importe si retira el release`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_9",
            """{"id":"ch_test_prueba","object":"charge","payment_intent":"pi_test_prueba",""" +
                """"amount":89900,"amount_refunded":89900}""",
            tipo = StripeWebhookService.TIPO_REEMBOLSO,
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.REEMBOLSADO, pago.estado)
        verify(banderas).retirarReleaseActivo(12L)
    }

    /**
     * Retirar el release apaga el enlace **en origen**. Sin anunciar la invalidación, el borde sigue
     * sirviendo lo que cacheó durante toda la ventana de revalidación (ADR-2-6-01): una invitación
     * reembolsada o con contracargo seguiría abierta unos minutos más para cualquiera con el enlace.
     */
    @Test
    fun `un reembolso total anuncia la invalidacion del enlace publico`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        whenever(banderas.retirarReleaseActivo(12L)).thenReturn(1)
        whenever(banderas.publicTokenDe(12L)).thenReturn("pub_01ARZ3NDEKTSV4RRFFQ69G5FAV")
        val cuerpo = PagosFx.eventoDeCargo("evt_adv_11")
        procesar(cuerpo)
        verify(dominio).publishEvent(
            PublicRenderInvalidated(12L, "pub_01ARZ3NDEKTSV4RRFFQ69G5FAV", PublicRenderInvalidated.Motivo.DESPUBLICADO),
        )
    }

    /** Sin release activo que retirar no se anuncia nada: no hay nada cacheado que invalidar. */
    @Test
    fun `un reembolso sin release activo no anuncia nada`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        whenever(banderas.retirarReleaseActivo(12L)).thenReturn(0)
        val cuerpo = PagosFx.eventoDeCargo("evt_adv_12")
        procesar(cuerpo)
        verify(dominio, never()).publishEvent(any<PublicRenderInvalidated>())
    }

    /** Un contracargo no trae `refunded` ni importes reembolsados y **siempre** retira el release. */
    @Test
    fun `un contracargo retira el release aunque no hable de reembolsos`() {
        nuevoEvento()
        val pago = pagoPendiente().also {
            it.estado = EstadoDePago.PAGADO
            it.stripePaymentIntentId = "pi_test_prueba"
        }
        whenever(pagos.findByStripePaymentIntentId("pi_test_prueba")).thenReturn(pago)
        val cuerpo = evento(
            "evt_adv_10",
            """{"id":"dp_test_prueba","object":"dispute","payment_intent":"pi_test_prueba","status":"needs_response"}""",
            tipo = StripeWebhookService.TIPO_DISPUTA,
        )
        procesar(cuerpo)
        assertEquals(EstadoDePago.REEMBOLSADO, pago.estado)
        verify(banderas).retirarReleaseActivo(12L)
    }
}
