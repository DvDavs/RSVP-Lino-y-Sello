package mx.evolutiondev.invitaciones.modules.product.payments

import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * `GET /public/plans` (contrato §2.1) — el catálogo de venta, **sin sesión**.
 *
 * Cuelga de `/public/` + `**`, que es `permitAll` (`SecurityConfig.kt:38`), porque `/precios` es una
 * página pública: pedir sesión para ver un precio es pedirle a alguien que se registre antes de
 * saber cuánto cuesta. No devuelve ni un dato de ninguna cuenta.
 */
@RestController
@RequestMapping("/public/plans")
class PublicPlansController(private val catalogo: PlanCatalogService) {

    @GetMapping
    fun catalogo(): CatalogoDePlanesDto = catalogo.catalogo()
}

/**
 * Las tres rutas con sesión del módulo (contrato §2.2, §2.3, §2.4).
 *
 * `@PreAuthorize` a nivel de **clase**, igual que los otros controladores del módulo `product`
 * (`PaymentsHealthController.kt:31`, ADR-5-0C-01): defensa en profundidad. Sin él, la ruta seguiría
 * cerrada por `anyRequest().authenticated()` (`SecurityConfig.kt:47`), pero abierta a **cualquier**
 * rol autenticado; la anotación fija cuáles.
 *
 * El `requesterId` sale **del token** (`Authentication.userId()`), nunca del cuerpo ni de la URL: es
 * lo que hace imposible pedir el plan de otra cuenta cambiando un número.
 */
@RestController
@RequestMapping("/product/payments")
@PreAuthorize("hasAnyRole('USER','ADMIN','MASTER')")
class PaymentsController(
    private val consultas: PaymentsQueryService,
    private val checkout: CheckoutService,
) {

    /** Plan y cobros de **esa** invitación. Un id ajeno responde `404`, igual que uno inexistente. */
    @GetMapping("/invitations/{invitationId}")
    fun planDeInvitacion(auth: Authentication, @PathVariable invitationId: Long): PlanDeInvitacionDto =
        consultas.planDeInvitacion(auth.userId(), invitationId)

    /** Historial completo de la clienta. Nunca lleva pagos de otra cuenta (contrato §2.3). */
    @GetMapping("/pagos")
    fun misPagos(auth: Authentication): HistorialDePagosDto = consultas.misPagos(auth.userId())

    /** Abre la sesión de Checkout. El cuerpo no lleva importe: lo pone el servidor (contrato §0). */
    @PostMapping("/checkout")
    fun crearCheckout(
        auth: Authentication,
        @RequestBody peticion: CheckoutRequest,
    ): ResponseEntity<CheckoutCreadoDto> =
        ResponseEntity.status(HttpStatus.CREATED).body(checkout.crear(auth.userId(), peticion))
}

/**
 * `POST /public/stripe/webhook` (contrato §2.5).
 *
 * **Por qué cuelga de `/public/` y no de `/product/payments/`**: Stripe llama sin token de la
 * aplicación, y bajo `/product/payments/` recibiría `401` (`PaymentsHealthController.kt:18-24`). No
 * es una ruta sin autenticación: su autenticación es la **firma** `Stripe-Signature`, verificada
 * contra `STRIPE_WEBHOOK_SECRET`, y sin secreto configurado responde `503` en vez de aceptar nada.
 *
 * El cuerpo se recibe como `String` **crudo**, sin deserializar: la firma se calcula sobre los bytes
 * exactos que Stripe envió, y cualquier reserialización intermedia la invalidaría.
 */
@RestController
@RequestMapping("/public/stripe")
class StripeWebhookController(private val webhook: StripeWebhookService) {

    @PostMapping("/webhook")
    fun recibir(
        @RequestBody(required = false) payload: String?,
        @RequestHeader(name = CABECERA_FIRMA, required = false) firma: String?,
    ): WebhookRecibidoDto = webhook.procesar(payload.orEmpty(), firma)

    companion object {
        const val CABECERA_FIRMA = "Stripe-Signature"
    }
}
