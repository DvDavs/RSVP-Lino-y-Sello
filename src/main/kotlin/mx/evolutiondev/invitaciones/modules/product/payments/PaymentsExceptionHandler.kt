package mx.evolutiondev.invitaciones.modules.product.payments

import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

/**
 * El **único** traductor de errores del módulo de pagos. Copia deliberada del criterio de
 * `Templates2ExceptionHandler` (`templates2/api/Templates2ExceptionHandler.kt:55-56`), por las
 * mismas tres razones verificadas allí:
 *
 * 1. **Advice propio, no ampliación del existente**: `core/error/GeneralExceptionHandler` es del
 *    núcleo y este módulo no lo toca. Además responde **sin `code`** y filtra el `rootCause` al
 *    cliente, dos cosas que el contrato de pagos prohíbe.
 * 2. **`basePackages` acotado**: este advice declara un handler de `Exception`; sin acotarlo se
 *    convertiría en el manejador de errores de toda la aplicación.
 * 3. **`@Order(HIGHEST_PRECEDENCE)`**: los advices del núcleo no declaran orden y quedan en
 *    `LOWEST_PRECEDENCE`; sin este `@Order`, una excepción que ambos declaren podría resolverse allí
 *    y salir sin `code`.
 *
 * **Regla dura: ninguna ruta de pagos devuelve un cuerpo sin `code`, ni un `500` con traza.** La
 * traza se registra en el servidor; la respuesta lleva `{code, message, details}` y nada más.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.product.payments"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class PaymentsExceptionHandler {

    private val log = LoggerFactory.getLogger(PaymentsExceptionHandler::class.java)

    /** Los siete códigos del contrato §3, tal y como los lanza el módulo. */
    @ExceptionHandler(PaymentException::class)
    fun pagos(e: PaymentException): ResponseEntity<PayErrorResponse> {
        if (e.code.httpStatus >= 500) {
            // El detalle interno (por ejemplo, qué contestó Stripe) se queda aquí, no en la respuesta.
            log.error("pagos: {} ({})", e.code.name, e.message, e)
        } else {
            log.debug("pagos: {} ({})", e.code.name, e.message)
        }
        return respuesta(e.code, e.message.orEmpty(), e.details)
    }

    /**
     * `400 PAY_MALFORMED_JSON`. Necesario: sin él lo capturaría `GeneralExceptionHandler`, que
     * además devuelve el `rootCause` al cliente.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun ilegible(e: HttpMessageNotReadableException): ResponseEntity<PayErrorResponse> = respuesta(
        PayErrorCode.PAY_MALFORMED_JSON,
        "el cuerpo de la petición no es JSON válido para esta ruta",
    )

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun argumentos(e: MethodArgumentNotValidException): ResponseEntity<PayErrorResponse> = respuesta(
        PayErrorCode.PAY_MALFORMED_JSON,
        "la petición no cumple el contrato de esta ruta",
        mapOf("fields" to e.bindingResult.fieldErrors.map { mapOf("field" to it.field) }),
    )

    /** Un `invitationId` que no es un número es un error del cliente, nunca un `500`. */
    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun tipoInvalido(e: MethodArgumentTypeMismatchException): ResponseEntity<PayErrorResponse> = respuesta(
        PayErrorCode.PAY_MALFORMED_JSON,
        "el parámetro \"${e.name}\" no tiene el tipo que esta ruta espera",
        mapOf("param" to e.name),
    )

    /** Último recurso: `500 PAY_INTERNAL`, **con traza en el log y sin traza en la respuesta**. */
    @ExceptionHandler(Exception::class)
    fun cualquiera(e: Exception): ResponseEntity<PayErrorResponse> {
        log.error("pagos: excepción no prevista en una ruta del módulo", e)
        return respuesta(PayErrorCode.PAY_INTERNAL, "error interno del servidor")
    }

    private fun respuesta(
        code: PayErrorCode,
        message: String,
        details: Map<String, Any?> = emptyMap(),
    ): ResponseEntity<PayErrorResponse> =
        ResponseEntity.status(code.httpStatus).body(PayErrorResponse.de(code, message, details))
}
