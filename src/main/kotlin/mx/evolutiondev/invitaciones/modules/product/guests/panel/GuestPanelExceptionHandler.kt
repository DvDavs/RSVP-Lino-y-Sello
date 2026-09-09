package mx.evolutiondev.invitaciones.modules.product.guests.panel

import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/** Cuerpo único de cualquier `4xx`/`5xx` del panel de invitados. Sin `details`, sin traza. */
data class GuestPanelErrorResponse(
    val timestamp: String,
    val statusCode: Int,
    val code: String,
    val message: String,
)

/**
 * El único traductor de errores del panel de invitados (contrato `5-2` §0.6).
 *
 * Tres decisiones, cada una con su motivo verificado en el árbol:
 *
 * 1. **Advice propio.** El de `templates2` está acotado con
 *    `basePackages = ["…modules.templates2.api"]` (`Templates2ExceptionHandler.kt:118`) y **no**
 *    alcanza a `modules.product`; ampliarlo o tocar `core/error/GeneralExceptionHandler` sería tocar
 *    territorio ajeno. ADR-5-0C-01 ya dejó dicho que cada sesión declara el suyo.
 * 2. **`basePackages` acotado a este subpaquete, no a `modules.product.guests`.** Declara un handler
 *    de `Exception`, así que sin el acotado sería el manejador de errores de media aplicación; y el
 *    subpaquete hermano `…guests.rsvp` es de otra sesión y tiene su propio contrato de fallos
 *    (contrato §2), que este advice no debe secuestrar.
 * 3. **`@Order(HIGHEST_PRECEDENCE)`.** `GeneralExceptionHandler` e `InternalExceptionHandler` no
 *    declaran orden y quedan en `LOWEST_PRECEDENCE`; sin esto, una `IllegalArgumentException` podría
 *    resolverse allí, sin `code` y **filtrando el mensaje interno** al cliente, que con
 *    `server.error.include-message: always` (hallazgo S-02) es exactamente lo que hay que evitar.
 *
 * **Lo que este advice no puede capturar**: nada de la cadena de filtros de Spring Security. El `401`
 * sin token y el `403` por rol los escriben `AuthEntryPointJwt` y `InvitationsAccessDeniedHandler`
 * (`SecurityConfig.kt:34-35`), y sus cuerpos son los de la plataforma.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.product.guests.panel"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class GuestPanelExceptionHandler {

    private val log = LoggerFactory.getLogger(GuestPanelExceptionHandler::class.java)

    /** Los fallos tipados del panel: el mensaje ya viene escrito en es-MX y sin detalle interno. */
    @ExceptionHandler(GuestPanelException::class)
    fun panel(e: GuestPanelException): ResponseEntity<GuestPanelErrorResponse> {
        if (e.code.httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR.value()) {
            log.error("product.guests.panel: {}", e.code.name, e)
        } else {
            log.debug("product.guests.panel: {}", e.code.name)
        }
        return respuesta(e.code, e.message.orEmpty())
    }

    /** Cuerpo que no es JSON válido para la ruta. */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun ilegible(e: HttpMessageNotReadableException): ResponseEntity<GuestPanelErrorResponse> =
        respuesta(GuestPanelErrorCode.GUEST_INVALID, "No pudimos leer los datos que enviaste")

    /**
     * Un `invitationId` o un `guestId` que no son números son un error **del cliente**: sin este
     * handler caerían en el de `Exception` y devolverían un `500` por una petición mal formada.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun tipoInvalido(e: MethodArgumentTypeMismatchException): ResponseEntity<GuestPanelErrorResponse> =
        respuesta(GuestPanelErrorCode.GUEST_INVALID, "Alguno de los datos de la dirección no es válido")

    /** Misma razón: un parámetro obligatorio ausente es `422`, nunca `500`. */
    @ExceptionHandler(MissingServletRequestParameterException::class)
    fun parametroAusente(e: MissingServletRequestParameterException): ResponseEntity<GuestPanelErrorResponse> =
        respuesta(GuestPanelErrorCode.GUEST_INVALID, "Falta un dato obligatorio en la petición")

    /**
     * Último recurso: `500 GUEST_INTERNAL`, **con traza en el log del servidor y sin traza en la
     * respuesta**. Ninguna ruta de este subpaquete devuelve un `500` sin `code`.
     */
    @ExceptionHandler(Exception::class)
    fun cualquiera(e: Exception): ResponseEntity<GuestPanelErrorResponse> {
        log.error("product.guests.panel: excepción no prevista en una ruta del panel", e)
        return respuesta(GuestPanelErrorCode.GUEST_INTERNAL, "No pudimos completar la operación")
    }

    private fun respuesta(
        code: GuestPanelErrorCode,
        message: String,
    ): ResponseEntity<GuestPanelErrorResponse> = ResponseEntity.status(code.httpStatus).body(
        GuestPanelErrorResponse(
            timestamp = LocalDateTime.now().format(FORMATO_FECHA),
            statusCode = code.httpStatus,
            code = code.name,
            message = message,
        ),
    )

    companion object {
        /** El patrón del resto del backend (`GeneralExceptionHandler.kt:34`); no se introduce otro. */
        private val FORMATO_FECHA: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    }
}
