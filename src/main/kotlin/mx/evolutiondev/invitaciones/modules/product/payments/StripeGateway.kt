package mx.evolutiondev.invitaciones.modules.product.payments

import com.stripe.StripeClient
import com.stripe.param.checkout.SessionCreateParams
import org.springframework.stereotype.Component

/** Lo que el servidor le pide a Stripe. Todo sale de la base; nada de esto viene del navegador. */
data class PeticionDeSesion(
    val invitationId: Long,
    val paymentId: Long,
    val customerId: Long,
    val planCodigo: String,
    val planNombre: String,
    val planDescripcion: String,
    val importeCentavos: Long,
    val moneda: String,
    val stripePriceId: String?,
    val correoDelCliente: String?,
    val successUrl: String,
    val cancelUrl: String,
)

/** Lo que Stripe devuelve y este módulo guarda. */
data class SesionDeCheckout(val id: String, val url: String)

/**
 * La **única** puerta de salida hacia Stripe del módulo.
 *
 * Existe por dos razones y las dos importan. (1) Las pruebas de [CheckoutService] no pueden abrir una
 * sesión real, y una prueba que necesite red no es una prueba. (2) Con la llamada aislada aquí, el
 * resto del módulo no conoce ni una clase del SDK, así que cambiar de versión de `stripe-java` toca
 * un fichero y no once.
 */
interface StripeGateway {

    /** Crea la sesión de Checkout. Lanza [StripeUnavailableException] si Stripe rechaza o no responde. */
    fun crearSesion(peticion: PeticionDeSesion): SesionDeCheckout
}

/**
 * Implementación real con el SDK oficial.
 *
 * **Nunca se toca `com.stripe.Stripe.apiKey`** (el estático global): se construye un [StripeClient]
 * por llamada con la clave de [ProductPaymentsProperties]. Con el estático, una prueba que fijara la
 * clave la dejaría puesta para todas las demás, y en producción dos configuraciones no podrían
 * convivir. El cliente es barato de construir: es un envoltorio sobre la configuración HTTP.
 */
@Component
class StripeCheckoutGateway(private val propiedades: ProductPaymentsProperties) : StripeGateway {

    override fun crearSesion(peticion: PeticionDeSesion): SesionDeCheckout {
        if (!propiedades.configurado) {
            throw NotConfiguredException("el cobro en línea no está configurado en este servidor")
        }
        val linea = SessionCreateParams.LineItem.builder().setQuantity(1L).apply {
            // `price` gana cuando existe: tener el importe en dos sistemas que se desincronizan es
            // justo lo que `stripe_price_id` evita (12-producto-completo.md §A5.3 punto 2).
            if (!peticion.stripePriceId.isNullOrBlank()) {
                setPrice(peticion.stripePriceId)
            } else {
                setPriceData(
                    SessionCreateParams.LineItem.PriceData.builder()
                        .setCurrency(peticion.moneda.lowercase())
                        .setUnitAmount(peticion.importeCentavos)
                        .setProductData(
                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                .setName(peticion.planNombre)
                                .setDescription(peticion.planDescripcion.ifBlank { peticion.planNombre })
                                .build(),
                        )
                        .build(),
                )
            }
        }.build()

        val params = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.PAYMENT)
            .addLineItem(linea)
            .setClientReferenceId(peticion.invitationId.toString())
            .putMetadata(META_INVITATION, peticion.invitationId.toString())
            .putMetadata(META_PAYMENT, peticion.paymentId.toString())
            .putMetadata(META_CUSTOMER, peticion.customerId.toString())
            .putMetadata(META_PLAN, peticion.planCodigo)
            .setSuccessUrl(peticion.successUrl)
            .setCancelUrl(peticion.cancelUrl)
            .apply { peticion.correoDelCliente?.let { setCustomerEmail(it) } }
            .build()

        val sesion = try {
            StripeClient(propiedades.claveSecreta).checkout().sessions().create(params)
        } catch (e: Exception) {
            // El mensaje de Stripe no viaja al cliente: lo registra el manejador con la traza.
            throw StripeUnavailableException("Stripe no pudo abrir la sesión de pago", e)
        }
        val url = sesion.url
            ?: throw StripeUnavailableException("Stripe devolvió una sesión sin URL de pago")
        return SesionDeCheckout(sesion.id, url)
    }

    companion object {
        const val META_INVITATION = "invitationId"
        const val META_PAYMENT = "paymentId"
        const val META_CUSTOMER = "customerId"
        const val META_PLAN = "planCodigo"
    }
}
