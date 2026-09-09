package mx.evolutiondev.invitaciones.modules.product.payments

/**
 * Catálogo **cerrado** de errores del módulo de pagos (contrato §3). Misma forma que `TplErrorCode`
 * de `templates2` (`domain/TplErrorCode.kt:12`) y por el mismo motivo: el código es contrato, y una
 * respuesta sin código obliga al frontend a leer mensajes en castellano para decidir qué hacer.
 *
 * `httpStatus` es un `Int` y no un `HttpStatus` de Spring: el catálogo no depende del framework.
 */
enum class PayErrorCode(val httpStatus: Int) {
    /** Sin `STRIPE_SECRET_KEY` (checkout) o sin `STRIPE_WEBHOOK_SECRET` (webhook). */
    PAY_NOT_CONFIGURED(503),

    /** `planCodigo` desconocido o inactivo. */
    PAY_PLAN_NOT_FOUND(404),

    /** Invitación inexistente **o ajena**: la misma respuesta para las dos, sin oráculo. */
    PAY_INVITATION_NOT_FOUND(404),

    /** La invitación ya está pagada; volver a cobrarla sería cobrar dos veces. */
    PAY_ALREADY_PAID(409),

    /** Firma ausente, inválida, de otra cuenta de Stripe o fuera de la tolerancia de 300 s. */
    PAY_WEBHOOK_SIGNATURE_INVALID(400),

    /** Stripe rechaza o no responde al crear la sesión. */
    PAY_STRIPE_UNAVAILABLE(502),

    /** Cuerpo no parseable o con campos que la ruta no acepta. */
    PAY_MALFORMED_JSON(400),

    /** Cualquier fallo no previsto: **con código y sin traza** en la respuesta. */
    PAY_INTERNAL(500),
}

/**
 * Excepción tipada del módulo. La traduce [PaymentsExceptionHandler] leyendo `code` y `details`,
 * igual que `Templates2ExceptionHandler` con `EditorException`.
 *
 * No se usan `require`/`check`/`error()`: caerían en el manejador genérico del núcleo
 * (`GeneralExceptionHandler`), que responde **sin `code`** y además filtra el `rootCause` al cliente.
 */
open class PaymentException(
    val code: PayErrorCode,
    message: String,
    val details: Map<String, Any?> = emptyMap(),
    cause: Throwable? = null,
) : RuntimeException(message, cause) {

    val status: Int get() = code.httpStatus
}

/** `503` — no hay con qué hablarle a Stripe. Nunca un botón muerto: el frontend lo dice. */
class NotConfiguredException(message: String) :
    PaymentException(PayErrorCode.PAY_NOT_CONFIGURED, message)

/** `404` — plan inexistente o dado de baja del catálogo. */
class PlanNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    PaymentException(PayErrorCode.PAY_PLAN_NOT_FOUND, message, details)

/**
 * `404` — la invitación no existe **o no es de quien pregunta**. Las dos cosas responden igual a
 * propósito (contrato §3): distinguirlas convertiría la ruta en un oráculo de existencia de ids.
 */
class InvitationNotFoundException(message: String, details: Map<String, Any?> = emptyMap()) :
    PaymentException(PayErrorCode.PAY_INVITATION_NOT_FOUND, message, details)

/** `409` — `invitation.is_paid` ya es `true`. */
class AlreadyPaidException(message: String, details: Map<String, Any?> = emptyMap()) :
    PaymentException(PayErrorCode.PAY_ALREADY_PAID, message, details)

/** `400` — la firma del webhook no verifica. **Sin detalles**: no se le explica a nadie por qué. */
class WebhookSignatureInvalidException(message: String) :
    PaymentException(PayErrorCode.PAY_WEBHOOK_SIGNATURE_INVALID, message)

/** `502` — Stripe rechazó o no respondió. El `product_payment` queda `FALLIDO`. */
class StripeUnavailableException(message: String, cause: Throwable? = null) :
    PaymentException(PayErrorCode.PAY_STRIPE_UNAVAILABLE, message, emptyMap(), cause)

/** `400` — cuerpo ilegible o con campos desconocidos. */
class MalformedJsonException(message: String, details: Map<String, Any?> = emptyMap()) :
    PaymentException(PayErrorCode.PAY_MALFORMED_JSON, message, details)
