package mx.evolutiondev.invitaciones.modules.product.payments

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.Instant

/**
 * Cuerpos de las cuatro rutas del contrato §2 y del error §3. Son `data class` de lectura: ninguna
 * acepta importe, moneda ni `is_paid` del cliente (contrato §4) — [CheckoutRequest] lleva
 * exactamente dos campos y los dos son identificadores.
 */

/**
 * **Todos los DTO de lectura declaran `@JsonInclude(ALWAYS)` a propósito.** El `ObjectMapper` de la
 * aplicación es el de `templates2` (`Templates2JsonConfig.kt:35`, un bean de tipo `ObjectMapper` que
 * desactiva el de Spring Boot por `@ConditionalOnMissingBean`) y viene con
 * `serializationInclusion(NON_NULL)` (`Templates2Json.kt:32`). Sin esta anotación, `invitadosMax`,
 * `plan` y `pagadoEn` **desaparecerían** del JSON en vez de viajar como `null`, y el contrato de §2.1
 * y §2.2 dice justo lo contrario: `invitadosMax: null` significa «sin límite» y `plan: null` significa
 * «pagada sin cobro registrado». Un campo ausente obligaría al frontend a adivinar cuál de las dos
 * cosas pasó. Verificado contra el backend vivo antes de añadirla.
 */

/** Un plan del catálogo, tal y como lo pinta `/precios` y la pantalla de plan del editor. */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class PlanDto(
    val codigo: String,
    val nombre: String,
    val descripcion: String,
    val precioCentavos: Long,
    val moneda: String,
    /** `null` = sin límite. */
    val invitadosMax: Int?,
    val incluye: List<String>,
    val recomendado: Boolean,
    val orden: Int,
)

/**
 * `GET /public/plans`. [pagoEnLinea] dice si el backend tiene clave de Stripe: sin él, `/precios`
 * prometería un pago que el servidor no puede abrir, que es exactamente el botón muerto de G-01.
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class CatalogoDePlanesDto(
    val moneda: String,
    val planes: List<PlanDto>,
    val pagoEnLinea: Boolean,
)

/** Una fila del historial de cobros. `comprobanteUrl` es la `receipt_url` de Stripe, si la hubo. */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class PagoDto(
    val id: Long,
    val estado: String,
    val invitationId: Long,
    val nombreEvento: String?,
    val planCodigo: String?,
    val planNombre: String?,
    val importeCentavos: Long,
    val moneda: String,
    val creadoEn: Instant,
    val pagadoEn: Instant?,
    val comprobanteUrl: String?,
)

/**
 * `GET /product/payments/invitations/{id}`.
 *
 * `plan` y `pagadoEn` son `null` sin pago. Con `pagada = true` y **sin** fila en `product_payment`
 * (invitación marcada por un ADMIN o sembrada) la respuesta es `plan: null`, `pagos: []`,
 * `pagada: true`: el frontend lo enseña como «Plan activo» sin importe (contrato §2.2).
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class PlanDeInvitacionDto(
    val invitationId: Long,
    val pagada: Boolean,
    val nombreEvento: String?,
    val plan: PlanDto?,
    val pagadoEn: Instant?,
    val pagos: List<PagoDto>,
    val pagoEnLinea: Boolean,
)

/** `GET /product/payments/pagos`: los cobros de quien pregunta y de nadie más. */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class HistorialDePagosDto(val pagos: List<PagoDto>)

/**
 * `POST /product/payments/checkout`. **Dos campos y ninguno más**: el importe sale de
 * `product_plan.precio_centavos` en el servidor (contrato §0).
 */
data class CheckoutRequest(
    val invitationId: Long? = null,
    val planCodigo: String? = null,
)

/** `201` de `POST …/checkout`: a dónde mandar el navegador y con qué referencia seguirlo. */
@JsonInclude(JsonInclude.Include.ALWAYS)
data class CheckoutCreadoDto(
    val checkoutUrl: String,
    val sessionId: String,
    val paymentId: Long,
)

/** Respuesta del webhook. Siempre `200` salvo firma inválida o fallo de base. */
data class WebhookRecibidoDto(val received: Boolean, val duplicado: Boolean? = null)

/**
 * Cuerpo **único** de cualquier `4xx`/`5xx` del módulo: `{code, message, details}`, la misma forma
 * que `templates2` (`TplErrorResponse.kt:400-406`) para que el frontend tenga un solo lector de
 * errores. `details` nunca lleva trazas ni mensajes internos.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class PayErrorResponse(
    val code: String,
    val message: String,
    val details: Map<String, Any?>? = null,
) {
    companion object {
        fun de(code: PayErrorCode, message: String, details: Map<String, Any?> = emptyMap()) =
            PayErrorResponse(code.name, message, details.ifEmpty { null })
    }
}
