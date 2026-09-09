package mx.evolutiondev.invitaciones.modules.product.invitations

import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Errores tipados de `POST /product/invitations`.
 *
 * **Por qué hace falta uno propio.** El advice de `templates2` está acotado a
 * `basePackages = ["…modules.templates2.api"]` (`Templates2ExceptionHandler.kt:55`) y no alcanza a
 * `modules.product`; sin este, los errores del alta saldrían por `GeneralExceptionHandler` con el
 * cuerpo `ErrorMessage`, que **no tiene `code`**. ADR-5-0C-01 ya dejó anotado que quien necesite
 * errores tipados en la fase 5 declara su propio advice acotado y lo respalda con una ADR: es
 * ADR-5-E3-05.
 *
 * **Acotado a este subpaquete**, no a todo `modules.product`: E2, E4 y E5 escriben en paralelo y un
 * advice ancho les cambiaría la forma de sus errores sin que se enteren.
 *
 * `@Order(HIGHEST_PRECEDENCE)` por el mismo motivo que en `templates2`: `GeneralExceptionHandler` es
 * un `@RestControllerAdvice` global sin `basePackages` (`GeneralExceptionHandler.kt:26-27`) y también
 * atiende `HttpMessageNotReadableException`; sin la prioridad, el ganador dependería del orden de
 * registro.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.product.invitations"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class ProductInvitationsExceptionHandler {

    @ExceptionHandler(ProductInvitationException::class)
    fun manejar(ex: ProductInvitationException): ResponseEntity<ProductErrorResponse> =
        ResponseEntity.status(ex.estado).body(
            ProductErrorResponse(
                timestamp = ahora(),
                statusCode = ex.estado.value(),
                code = ex.code,
                message = ex.message,
                details = ex.details,
            ),
        )

    /**
     * Cuerpo ilegible: JSON roto, o un campo con otro tipo (`"childrenAllowed": "quizá"`). El mensaje
     * es **constante**: el de Jackson trae la ruta interna de la clase y el fragmento del cuerpo, y
     * eso es un oráculo de forma que no hace falta regalar (mismo criterio que S-02).
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun manejarCuerpoIlegible(ex: HttpMessageNotReadableException): ResponseEntity<ProductErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            ProductErrorResponse(
                timestamp = ahora(),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                code = "PRD_MALFORMED_JSON",
                message = "El cuerpo de la petición no es un JSON válido para esta ruta.",
            ),
        )

    /**
     * Un `{invitationId}` que no es un número (`/product/invitations/abc`). Sin esto caería en la red
     * final y saldría como `500 PRD_INTERNAL`, que le echaría a la aplicación la culpa de un error de
     * quien llama. Mensaje constante y sin eco del valor recibido.
     */
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException::class)
    fun manejarRutaInvalida(
        ex: org.springframework.web.method.annotation.MethodArgumentTypeMismatchException,
    ): ResponseEntity<ProductErrorResponse> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            ProductErrorResponse(
                timestamp = ahora(),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                code = "PRD_PATH_PARAM_INVALID",
                message = "El identificador de la ruta no es válido.",
            ),
        )

    /**
     * **Trampa evitada.** Un `@ExceptionHandler(Exception)` se traga también la
     * `AccessDeniedException` que lanza `@PreAuthorize` y convierte un `403` en un `500`. Aquí se
     * relanza **la misma instancia** para que la resuelva quien debe: `InvitationsAccessDeniedHandler`
     * de la cadena de filtros (`SecurityConfig.kt:35`), con el cuerpo de la plataforma. Ninguna
     * respuesta de autorización lleva `code` `PRD_*`, igual que en `templates2`
     * (`Templates2ExceptionHandler.kt:43-45`).
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException::class)
    fun relanzarDenegado(ex: org.springframework.security.access.AccessDeniedException): Nothing = throw ex

    /**
     * Red final. Sin ella, una excepción inesperada acabaría en el `500` del núcleo, cuyo cuerpo
     * depende de la configuración del entorno — con `include-message: always` (hallazgo S-02) puede
     * llegar a devolver el mensaje de la excepción original. Aquí es mudo y siempre igual.
     */
    @ExceptionHandler(Exception::class)
    fun manejarInesperado(ex: Exception): ResponseEntity<ProductErrorResponse> =
        ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
            ProductErrorResponse(
                timestamp = ahora(),
                statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value(),
                code = "PRD_INTERNAL",
                message = "No se pudo completar la operación. Inténtalo de nuevo.",
            ),
        )

    /** Mismo patrón de fecha que el resto del backend (`GeneralExceptionHandler.kt:34`). */
    private fun ahora(): String = LocalDateTime.now().format(FORMATO)

    companion object {
        private val FORMATO: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    }
}
