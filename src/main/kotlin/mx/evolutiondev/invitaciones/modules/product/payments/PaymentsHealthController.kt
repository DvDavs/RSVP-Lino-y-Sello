package mx.evolutiondev.invitaciones.modules.product.payments

import mx.evolutiondev.invitaciones.modules.product.ProductHealthResponse
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /product/payments/health` — sonda de salud del subpaquete **`payments`**.
 *
 * **De quién es este subpaquete.** Lo escribe la sesión **E4** (pagos): compra en línea con Stripe
 * (ADR-DUENO-02), planes, y el consumo de [ProductPaymentsProperties].
 *
 * **Qué NO va aquí.** Cuenta y marca (subpaquete `account`, sesión E3); invitados y RSVP (subpaquete
 * `guests`, sesión E2); administración (subpaquete `admin`, sesión E5).
 *
 * **Aviso para el webhook de Stripe.** Stripe llama **sin** token de la aplicación, así que su ruta
 * **no puede** colgar de `/product/payments/`: aquí todo está bajo `anyRequest().authenticated()`
 * (`SecurityConfig.kt:47`) y Stripe recibiría `401`. E4 tiene dos caminos y ninguno pasa por
 * inventarse una excepción silenciosa: colgarla de `/public/` + `**` (ya `permitAll()`,
 * `SecurityConfig.kt:38`) verificando la firma `Stripe-Signature` con
 * `producto.pagos.stripe.secreto-webhook`, o registrar una ADR para añadir una regla a `SecurityConfig`.
 * Sin verificación de firma, una ruta abierta de pagos es un extremo que cualquiera puede invocar.
 *
 * **Autorización.** `@PreAuthorize` de clase como defensa en profundidad, igual que en los otros tres
 * subpaquetes (patrón de `CatalogController.kt:22-25`, ADR-1R-B-10).
 */
@RestController
@RequestMapping("/product/payments")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class PaymentsHealthController {

    /** No consulta nada: responde con el nombre del subpaquete y `ok` (ver [ProductHealthResponse]). */
    @GetMapping("/health")
    fun health(): ProductHealthResponse = ProductHealthResponse.de(SUBPAQUETE)

    companion object {
        const val SUBPAQUETE = "payments"
    }
}
