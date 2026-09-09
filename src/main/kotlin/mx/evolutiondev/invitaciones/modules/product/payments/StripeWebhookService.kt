package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.stripe.exception.SignatureVerificationException
import com.stripe.model.Event
import com.stripe.net.Webhook
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * `POST /public/stripe/webhook` (contrato §2.5): **la única vía por la que una invitación pasa a
 * pagada**. Volver a `/pago` en el navegador no cambia nada.
 *
 * Cuatro defensas, y ninguna es opcional:
 *
 * 1. **Firma verificada con el secreto de esta cuenta** (`Webhook.constructEvent`, tolerancia de
 *    300 s del SDK). La ruta cuelga de `/public/` + `**`, que es `permitAll` (`SecurityConfig.kt:38`),
 *    así que la firma **es** la autenticación. Sin `STRIPE_WEBHOOK_SECRET` se responde `503`: jamás
 *    se acepta un evento sin verificar.
 * 2. **Idempotencia por `event.id`**, insertando primero en `product_stripe_event` (V44). Stripe
 *    reintenta; un replay tiene que ser un `200` sin una sola escritura más.
 * 3. **Comprobación del importe**: si `amount_total`/`currency` de la sesión no coinciden con lo que
 *    el servidor guardó, **no se marca pagada**. Se registra `IMPORTE_DISTINTO` y se responde `200`
 *    (Stripe no debe reintentar algo que reintentar no arregla) para revisión manual.
 * 4. **Todo en una sola transacción.** La marca de "evento visto" y el efecto viven o mueren juntos:
 *    si el proceso falla, el evento no queda marcado y el reintento de Stripe sí sirve para algo.
 *
 * **Los logs llevan `event.id` y `tipo`, nunca correo ni importe del cliente** (contrato §4).
 */
@Service
class StripeWebhookService(
    private val propiedades: ProductPaymentsProperties,
    private val eventos: ProductStripeEventRepository,
    private val pagos: ProductPaymentRepository,
    private val banderas: InvitationPaymentFlagRepository,
    private val json: ObjectMapper,
) {

    private val log = LoggerFactory.getLogger(StripeWebhookService::class.java)

    @Transactional
    fun procesar(payload: String, firma: String?): WebhookRecibidoDto {
        if (propiedades.secretoWebhook.isBlank()) {
            throw NotConfiguredException("el webhook de pagos no está configurado en este servidor")
        }
        if (firma.isNullOrBlank()) {
            throw WebhookSignatureInvalidException("falta la cabecera de firma")
        }
        val evento: Event? = try {
            Webhook.constructEvent(payload, firma, propiedades.secretoWebhook)
        } catch (e: SignatureVerificationException) {
            // Sin detalles en la respuesta: no se le explica a quien lo intenta qué falló.
            log.warn("pagos: firma de webhook rechazada")
            throw WebhookSignatureInvalidException("la firma del webhook no es válida")
        } catch (e: RuntimeException) {
            // `constructEvent` verifica la firma y **luego** deserializa con Gson: un cuerpo firmado
            // pero vacío o que no es un objeto JSON revienta ahí dentro (verificado). Eso no es un
            // fallo de firma, es un cuerpo que no es un evento, y sale como `400 PAY_MALFORMED_JSON`
            // en vez de como un `500` opaco.
            throw MalformedJsonException("el cuerpo no es un evento de Stripe")
        }
        if (evento?.id == null) {
            throw MalformedJsonException("el cuerpo no es un evento de Stripe")
        }

        val id = evento.id
        val tipo = evento.type ?: ""
        if (eventos.insertarSiEsNuevo(id, tipo.take(TOPE_TIPO)) == 0) {
            log.info("pagos: evento de Stripe repetido, no se reprocesa (id={}, tipo={})", id, tipo)
            return WebhookRecibidoDto(received = true, duplicado = true)
        }

        val objeto = objetoDelEvento(evento)
        val resultado = when (tipo) {
            TIPO_COMPLETADA, TIPO_ASINCRONA_OK -> completar(objeto)
            TIPO_ASINCRONA_FALLIDA -> cambiarEstadoPorSesion(objeto, EstadoDePago.FALLIDO)
            TIPO_CADUCADA -> cambiarEstadoPorSesion(objeto, EstadoDePago.CADUCADO)
            TIPO_REEMBOLSO, TIPO_DISPUTA -> reembolsar(objeto)
            else -> RES_IGNORADO
        }
        eventos.marcarProcesado(id, resultado)
        log.info("pagos: evento de Stripe procesado (id={}, tipo={}, resultado={})", id, tipo, resultado)
        return WebhookRecibidoDto(received = true)
    }

    // =============================================================================================
    // Tipos concretos
    // =============================================================================================

    /**
     * `checkout.session.completed` / `…async_payment_succeeded`. Se exige `payment_status = paid`:
     * una sesión completada con el pago aún pendiente **no** abre la puerta de publicación.
     */
    private fun completar(objeto: JsonNode?): String {
        val sesion = objeto ?: return RES_SIN_OBJETO
        val estadoDePago = sesion.path("payment_status").asText(null)
        if (estadoDePago != null && estadoDePago != "paid") return RES_NO_PAGADA
        val pago = buscarPago(sesion) ?: return RES_SIN_PAGO
        if (pago.estado == EstadoDePago.PAGADO) return RES_YA_PAGADO

        // La comprobación que impide que alguien pague 1 centavo por un plan de 899 pesos.
        val importe = sesion.path("amount_total").takeIf { it.isNumber }?.asLong()
        val moneda = sesion.path("currency").asText(null)
        if (importe != null && importe != pago.importeCentavos) return RES_IMPORTE_DISTINTO
        if (moneda != null && !moneda.equals(pago.moneda, ignoreCase = true)) return RES_IMPORTE_DISTINTO

        pago.estado = EstadoDePago.PAGADO
        pago.pagadoEn = Instant.now()
        pago.updatedAt = Instant.now()
        texto(sesion, "payment_intent")?.let { pago.stripePaymentIntentId = it }
        texto(sesion, "id")?.let { if (pago.stripeCheckoutSessionId == null) pago.stripeCheckoutSessionId = it }
        pagos.saveAndFlush(pago)

        // `total_amount` es un dato HEREDADO que el panel antiguo pinta; el importe de verdad es
        // `product_payment.importe_centavos` (`12-producto-completo.md §A5.3`).
        banderas.marcarPagada(pago.invitationId, pago.importeCentavos / 100.0)
        return RES_PROCESADO
    }

    /** `async_payment_failed` y `expired`: la sesión muere, la invitación no cambia de estado. */
    private fun cambiarEstadoPorSesion(objeto: JsonNode?, estado: EstadoDePago): String {
        val pago = objeto?.let(::buscarPago) ?: return RES_SIN_PAGO
        if (pago.estado == EstadoDePago.PAGADO) return RES_YA_PAGADO
        pago.estado = estado
        pago.updatedAt = Instant.now()
        pagos.saveAndFlush(pago)
        return RES_PROCESADO
    }

    /**
     * `charge.refunded` y `charge.dispute.created` (ADR-5-0B-01): el pago pasa a `REEMBOLSADO`,
     * `is_paid` vuelve a `false` **y se retira el release activo**, para que el enlace público deje
     * de servir en origen de inmediato. La invitación y sus invitados **no** se borran.
     */
    private fun reembolsar(objeto: JsonNode?): String {
        val cargo = objeto ?: return RES_SIN_OBJETO
        val intent = texto(cargo, "payment_intent") ?: return RES_SIN_PAGO
        val pago = pagos.findByStripePaymentIntentId(intent) ?: return RES_SIN_PAGO
        pago.estado = EstadoDePago.REEMBOLSADO
        pago.updatedAt = Instant.now()
        texto(cargo, "receipt_url")?.let { pago.comprobanteUrl = it }
        pagos.saveAndFlush(pago)
        banderas.marcarNoPagada(pago.invitationId)
        banderas.retirarReleaseActivo(pago.invitationId)
        return RES_PROCESADO
    }

    // =============================================================================================

    /**
     * Busca el `product_payment` por `stripe_checkout_session_id` y, si no aparece, por
     * `metadata.paymentId` **comprobando que el `invitationId` de la metadata es el de esa fila**:
     * la metadata la escribe este servidor, pero llega de vuelta por la red y no se usa a ciegas.
     */
    private fun buscarPago(sesion: JsonNode): ProductPaymentEntity? {
        texto(sesion, "id")?.let { pagos.findByStripeCheckoutSessionId(it)?.let { p -> return p } }
        val meta = sesion.path("metadata")
        val paymentId = texto(meta, StripeCheckoutGateway.META_PAYMENT)?.toLongOrNull() ?: return null
        val invitationId = texto(meta, StripeCheckoutGateway.META_INVITATION)?.toLongOrNull() ?: return null
        val pago = pagos.findById(paymentId).orElse(null) ?: return null
        return pago.takeIf { it.invitationId == invitationId }
    }

    /**
     * `event.data.object` como JSON crudo.
     *
     * Se lee el JSON y **no** `getDataObjectDeserializer().getObject()`: ese camino devuelve
     * `Optional.empty()` cuando la versión de la API de la cuenta no coincide con la del SDK, y un
     * pago que se pierde en silencio por una diferencia de versión es exactamente el fallo que este
     * módulo no se puede permitir. Los cinco campos que se leen (`id`, `payment_status`,
     * `amount_total`, `currency`, `metadata`) son estables desde hace años.
     */
    private fun objetoDelEvento(evento: Event): JsonNode? = runCatching {
        evento.dataObjectDeserializer?.rawJson?.let { json.readTree(it) }
    }.getOrNull()

    private fun texto(nodo: JsonNode, campo: String): String? =
        nodo.path(campo).takeIf { it.isTextual }?.asText()?.takeIf { it.isNotBlank() }

    companion object {
        const val TIPO_COMPLETADA = "checkout.session.completed"
        const val TIPO_ASINCRONA_OK = "checkout.session.async_payment_succeeded"
        const val TIPO_ASINCRONA_FALLIDA = "checkout.session.async_payment_failed"
        const val TIPO_CADUCADA = "checkout.session.expired"
        const val TIPO_REEMBOLSO = "charge.refunded"
        const val TIPO_DISPUTA = "charge.dispute.created"

        /** `product_stripe_event.tipo` es `varchar(80)` (V44). */
        const val TOPE_TIPO = 80

        const val RES_PROCESADO = "PROCESADO"
        const val RES_IGNORADO = "IGNORADO"
        const val RES_IMPORTE_DISTINTO = "IMPORTE_DISTINTO"
        const val RES_SIN_PAGO = "PAGO_NO_ENCONTRADO"
        const val RES_SIN_OBJETO = "SIN_OBJETO"
        const val RES_NO_PAGADA = "SESION_NO_PAGADA"
        const val RES_YA_PAGADO = "YA_PAGADO"
    }
}
