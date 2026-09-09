package mx.evolutiondev.invitaciones.modules.product.payments

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Escrituras de `product_payment` que tienen que sobrevivir al fallo de la petición que las provocó.
 *
 * Es un bean **aparte** de [CheckoutService] a propósito: `@Transactional` de Spring viaja por el
 * proxy, y un método anotado que se llama a sí mismo desde la misma clase **no** abre transacción
 * nueva — el `FALLIDO` se escribiría dentro de la transacción que la excepción va a revertir, y por
 * tanto no se escribiría nunca. Con dos beans, la llamada pasa por el proxy y `REQUIRES_NEW` hace lo
 * que dice.
 */
@Service
class PaymentWriteService(private val pagos: ProductPaymentRepository) {

    @Transactional
    fun crearPendiente(
        invitationId: Long,
        customerId: Long,
        planId: Long,
        importeCentavos: Long,
        moneda: String,
    ): ProductPaymentEntity = pagos.save(
        ProductPaymentEntity(
            invitationId = invitationId,
            customerId = customerId,
            productPlanId = planId,
            estado = EstadoDePago.PENDIENTE,
            importeCentavos = importeCentavos,
            moneda = moneda,
            updatedAt = Instant.now(),
        ),
    )

    @Transactional
    fun guardarSesion(paymentId: Long, sessionId: String) {
        pagos.findById(paymentId).ifPresent {
            it.stripeCheckoutSessionId = sessionId
            it.updatedAt = Instant.now()
            pagos.save(it)
        }
    }

    /**
     * El cobro no se abrió: la fila queda `FALLIDO` y no `PENDIENTE`, para que el historial no enseñe
     * un pago «en curso» que nunca existió (contrato §2.4).
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    fun marcarFallido(paymentId: Long) {
        pagos.findById(paymentId).ifPresent {
            it.estado = EstadoDePago.FALLIDO
            it.updatedAt = Instant.now()
            pagos.save(it)
        }
    }
}

/**
 * `POST /product/payments/checkout` (contrato §2.4): abre la sesión de pago.
 *
 * Las tres reglas que esta clase hace cumplir, y que son el motivo de que el checkout no se pueda
 * armar en el navegador:
 *
 * 1. **El precio lo pone el servidor.** La petición trae `invitationId` y `planCodigo`; el importe
 *    sale de `product_plan.precio_centavos`. Un importe que viaje desde el cliente es un descuento
 *    gratis para quien sepa abrir la consola.
 * 2. **La propiedad se comprueba antes de crear nada.** Un id ajeno responde `404`, igual que uno
 *    inexistente, sin decir cuál de las dos cosas era.
 * 3. **La fila de `product_payment` se escribe antes de llamar a Stripe** y su `session_id` se guarda
 *    después: así el webhook siempre encuentra a quién apuntar.
 *
 * Abrir el checkout **no** marca nada como pagado: eso solo lo hace el webhook con firma verificada.
 * El método no es `@Transactional`: la llamada de red a Stripe tarda, y mantener abierta una
 * transacción de Postgres mientras se espera a un tercero es cómo se agota un pool de conexiones.
 */
@Service
class CheckoutService(
    private val consultas: PaymentsQueryService,
    private val catalogo: PlanCatalogService,
    private val escrituras: PaymentWriteService,
    private val invitaciones: InvitationPaymentInfoReader,
    private val stripe: StripeGateway,
    private val propiedades: ProductPaymentsProperties,
    @Value("\${app.frontend.url}") private val frontendUrl: String,
) {

    private val log = LoggerFactory.getLogger(CheckoutService::class.java)

    fun crear(requesterId: Long, peticion: CheckoutRequest): CheckoutCreadoDto {
        val invitationId = peticion.invitationId
            ?: throw MalformedJsonException("falta invitationId", mapOf("field" to "invitationId"))
        val planCodigo = peticion.planCodigo?.trim()?.takeIf { it.isNotEmpty() }
            ?: throw MalformedJsonException("falta planCodigo", mapOf("field" to "planCodigo"))

        // Orden deliberado: propiedad, plan, "ya pagada" y solo entonces la configuración. Quien no
        // es dueño de la invitación no debe poder distinguir un servidor configurado de uno que no.
        val datos = consultas.exigirAcceso(requesterId, invitationId)
        val plan = catalogo.exigirActivo(planCodigo)
        if (datos.pagada) {
            throw AlreadyPaidException(
                "esa invitación ya está pagada",
                mapOf("invitationId" to invitationId),
            )
        }
        if (!propiedades.configurado) {
            throw NotConfiguredException("el cobro en línea no está configurado en este servidor")
        }

        val pago = escrituras.crearPendiente(
            invitationId, datos.customerId, plan.id, plan.precioCentavos, plan.moneda,
        )

        val sesion = try {
            stripe.crearSesion(
                PeticionDeSesion(
                    invitationId = invitationId,
                    paymentId = pago.id,
                    customerId = datos.customerId,
                    planCodigo = plan.codigo,
                    planNombre = plan.nombre,
                    planDescripcion = plan.descripcion,
                    importeCentavos = plan.precioCentavos,
                    moneda = plan.moneda,
                    stripePriceId = plan.stripePriceId,
                    correoDelCliente = invitaciones.correoDelCliente(datos.customerId),
                    successUrl = "$base/pago?inv=$invitationId&sesion={CHECKOUT_SESSION_ID}",
                    cancelUrl = "$base/pago?inv=$invitationId&cancelado=1",
                ),
            )
        } catch (e: PaymentException) {
            escrituras.marcarFallido(pago.id)
            throw e
        }

        escrituras.guardarSesion(pago.id, sesion.id)
        // Ni correo, ni importe, ni nombre: identificadores del servidor y nada más.
        log.info("pagos: sesión de checkout creada (paymentId={}, invitationId={})", pago.id, invitationId)
        return CheckoutCreadoDto(sesion.url, sesion.id, pago.id)
    }

    /** `app.frontend.url` sin barra final: las URLs de retorno se componen concatenando. */
    private val base: String get() = frontendUrl.trimEnd('/')
}
