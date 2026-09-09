package mx.evolutiondev.invitaciones.modules.product.payments

import com.stripe.net.Webhook
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders

/**
 * Utilidades compartidas por las pruebas de pagos.
 *
 * **Ningún secreto real aparece en este fichero ni en ninguna prueba** (regla dura del encargo). Las
 * claves son constantes evidentemente ficticias y las propiedades se construyen a mano, nunca desde
 * `application.yml`: una prueba que dependiera del entorno pasaría o fallaría según quién la corra.
 */
object PagosFx {

    /** Ficticia. No es una clave de Stripe: no tiene el formato de una y no vale para nada. */
    const val CLAVE_FALSA = "sk_prueba_no_es_una_clave_real"

    /** Ficticia. El HMAC de las pruebas se calcula con ella, así que no hace falta que sea real. */
    const val SECRETO_FALSO = "whsec_prueba_no_es_un_secreto_real"

    /** Otro secreto ficticio, para el caso "firma de OTRA cuenta de Stripe". */
    const val SECRETO_AJENO = "whsec_prueba_de_otra_cuenta_distinta"

    fun propiedades(
        clave: String = CLAVE_FALSA,
        secretoWebhook: String = SECRETO_FALSO,
        moneda: String = "MXN",
    ) = ProductPaymentsProperties(clave, secretoWebhook, moneda)

    /** Servidor sin Stripe: ni clave ni secreto. Es el estado de un entorno recién levantado. */
    fun sinConfigurar() = ProductPaymentsProperties("", "", "MXN")

    /**
     * Cabecera `Stripe-Signature` **calculada de verdad**, con el mismo algoritmo que verifica el
     * SDK: `t=<ts>,v1=HMAC-SHA256(secreto, "<ts>.<payload>")`.
     *
     * Se calcula aquí en vez de traer una cabecera copiada de Stripe por dos razones: una cabecera
     * fija caduca (la tolerancia es de 300 s) y una firma que no se sabe calcular no se sabe romper,
     * y estas pruebas necesitan romperla de tres maneras distintas.
     */
    fun firmar(
        payload: String,
        secreto: String = SECRETO_FALSO,
        timestamp: Long = Webhook.Util.getTimeNow(),
    ): String {
        val hmac = Webhook.Util.computeHmacSha256(secreto, "$timestamp.$payload")
        return "t=$timestamp,v1=$hmac"
    }

    /** Un `Authentication` con el `CustomerDetails` que `Authentication.userId()` sabe leer. */
    fun autenticacion(customerId: Long, rol: String = "ROLE_USER"): Authentication =
        UsernamePasswordAuthenticationToken(
            CustomerDetails(customerId, "cliente$customerId@example.test", "x", listOf(SimpleGrantedAuthority(rol))),
            null,
            listOf(SimpleGrantedAuthority(rol)),
        )

    /**
     * Petición por defecto que lleva el `Principal` de esa clienta.
     *
     * Se hace así y **no** con un `HandlerMethodArgumentResolver` propio (probado y descartado):
     * `Authentication` extiende `java.security.Principal`, y el resolutor interno de Spring
     * (`ServletRequestMethodArgumentResolver`) lo atiende **antes** que cualquier resolutor
     * personalizado, así que el parámetro llegaba `null` y toda ruta respondía `500`. Poniendo el
     * principal en la petición se recorre el mismo camino que en producción.
     */
    fun peticionPorDefecto(auth: Authentication): MockHttpServletRequestBuilder =
        MockMvcRequestBuilders.get("/").principal(auth)

    /** Cuerpo de `checkout.session.completed` con los campos que el módulo lee. */
    @Suppress("LongParameterList")
    fun eventoDeSesion(
        eventId: String,
        tipo: String = StripeWebhookService.TIPO_COMPLETADA,
        sessionId: String = "cs_test_prueba",
        paymentStatus: String = "paid",
        amountTotal: Long = 89900,
        currency: String = "mxn",
        paymentIntent: String = "pi_test_prueba",
        invitationId: Long = 1,
        paymentId: Long = 1,
        planCodigo: String = "fiesta",
    ): String = """
        {"id":"$eventId","object":"event","type":"$tipo","api_version":"2024-06-20","created":1700000000,
         "data":{"object":{"id":"$sessionId","object":"checkout.session","payment_status":"$paymentStatus",
           "amount_total":$amountTotal,"currency":"$currency","payment_intent":"$paymentIntent",
           "metadata":{"invitationId":"$invitationId","paymentId":"$paymentId","planCodigo":"$planCodigo"}}}}
    """.trimIndent().replace("\n", "")

    /** Cuerpo de `charge.refunded` / `charge.dispute.created`: lo que importa es `payment_intent`. */
    fun eventoDeCargo(
        eventId: String,
        tipo: String = StripeWebhookService.TIPO_REEMBOLSO,
        paymentIntent: String = "pi_test_prueba",
        receiptUrl: String = "https://pay.stripe.com/receipts/prueba",
    ): String = """
        {"id":"$eventId","object":"event","type":"$tipo","api_version":"2024-06-20","created":1700000000,
         "data":{"object":{"id":"ch_test_prueba","object":"charge","payment_intent":"$paymentIntent",
           "refunded":true,"receipt_url":"$receiptUrl"}}}
    """.trimIndent().replace("\n", "")
}

/**
 * [StripeGateway] falso: registra lo que se le pidió y permite forzar el fallo. Sin él, probar el
 * checkout exigiría red y una cuenta real de Stripe, y una prueba que necesita red no es una prueba.
 */
class PasarelaFalsa(
    var url: String = "https://checkout.stripe.com/c/pay/cs_test_prueba",
    var sessionId: String = "cs_test_prueba",
) : StripeGateway {

    val peticiones = mutableListOf<PeticionDeSesion>()

    @Volatile var falla: Boolean = false

    override fun crearSesion(peticion: PeticionDeSesion): SesionDeCheckout {
        peticiones.add(peticion)
        if (falla) throw StripeUnavailableException("Stripe no responde (simulado)")
        return SesionDeCheckout(sessionId, url)
    }
}
