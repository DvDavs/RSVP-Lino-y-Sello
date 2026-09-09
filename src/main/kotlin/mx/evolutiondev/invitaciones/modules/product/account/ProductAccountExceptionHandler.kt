package mx.evolutiondev.invitaciones.modules.product.account

import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Errores con `code` estable de las rutas de cuenta (fase 5, E3; `ADR-5-E3-04`).
 *
 * Acotado con `basePackages` **a este subpaquete y solo a este**, igual que
 * `Templates2ExceptionHandler.kt:55`: ni toca las rutas heredadas de `/auth/` + `**` y `/user/profile`
 * —que conservan su cuerpo de siempre— ni se lo pisan las otras tres sesiones de la fase 5, que
 * escriben en sus propios subpaquetes.
 *
 * **Lo que este advice NO puede capturar**, dicho para que nadie escriba una prueba imposible: nada de
 * la cadena de filtros de seguridad. El `401` por token ausente o caducado lo escribe
 * `AuthEntryPointJwt` / `JwtTokenFilter` y el `403` por rol `InvitationsAccessDeniedHandler`
 * (`SecurityConfig.kt:34-35`); esos cuerpos son los de la plataforma y **no llevan `code`**.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.product.account"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class ProductAccountExceptionHandler(private val dateFormatter: DateFormatter) {

    @ExceptionHandler(AccountException::class)
    fun cuenta(e: AccountException): ResponseEntity<AccountErrorResponse> =
        respuesta(e.code, e.message.orEmpty())

    /**
     * `429` del limitador compartido. Se traduce aquí para que el cuerpo tenga la misma forma que el
     * resto de errores de estas rutas; el estado ya lo llevaba la propia excepción
     * (`AuthThrottleService.kt:33`). El mensaje es el constante del limitador: no dice si el bloqueo
     * fue por cuenta o por IP, ni cuánto falta.
     */
    @ExceptionHandler(DemasiadosIntentosException::class)
    fun demasiadosIntentos(e: DemasiadosIntentosException): ResponseEntity<AccountErrorResponse> =
        respuesta(AccountErrorCode.CUENTA_DEMASIADOS_INTENTOS, e.message.orEmpty())

    /**
     * Validación del cuerpo (`@Valid`). Se resume el primer defecto y **no** se vuelca la lista
     * entera: al frontend le basta el `code` y un texto para la persona.
     */
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun cuerpoInvalido(e: MethodArgumentNotValidException): ResponseEntity<AccountErrorResponse> {
        val detalle = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage
            ?: "Revisa los datos que enviaste"
        return respuesta(AccountErrorCode.CUENTA_DATOS_INVALIDOS, detalle)
    }

    /**
     * Cuerpo ilegible: JSON roto, o una propiedad desconocida contra el `ObjectMapper` estricto que la
     * aplicación usa entera (R1-09; `Templates2JsonConfig.kt:35-36`). Sale como `400` con `code`, no
     * como `500`, y **el texto de Jackson no se reexpone**: cuenta nombres de clase y de campo.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun cuerpoIlegible(e: HttpMessageNotReadableException): ResponseEntity<AccountErrorResponse> =
        respuesta(AccountErrorCode.CUENTA_DATOS_INVALIDOS, "Revisa los datos que enviaste")

    /**
     * **Trampa evitada**, igual que en `ProductInvitationsExceptionHandler.kt:71-72`: la red final de
     * abajo se tragaría también la `AccessDeniedException` de `@PreAuthorize` y convertiría un `403` en
     * un `500`. Se relanza **la misma instancia** para que la resuelva `InvitationsAccessDeniedHandler`
     * en la cadena de filtros (`SecurityConfig.kt:35`), con el cuerpo de la plataforma y sin `code`.
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException::class)
    fun relanzarDenegado(e: org.springframework.security.access.AccessDeniedException): Nothing = throw e

    /**
     * Red final (R1-08). Sin ella este advice **no tenía suelo**: una excepción que no fuese
     * `AccountException`, `DemasiadosIntentosException` ni `MethodArgumentNotValidException` se escapaba
     * al manejo genérico del núcleo, cuyo cuerpo depende de la configuración del entorno — con
     * `include-message: always` (S-02) llega a devolver el mensaje de la excepción original. El caso
     * concreto que lo motiva es la `DataIntegrityViolationException` del choque de correo al confirmar:
     * su mensaje lleva el nombre de la restricción y **el valor en conflicto**, o sea el correo de otra
     * clienta. Aquí el cuerpo es mudo y siempre el mismo.
     *
     * El patrón está copiado de `ProductInvitationsExceptionHandler.kt:79-88` a propósito: los dos
     * advice del producto responden igual ante lo inesperado.
     */
    @ExceptionHandler(Exception::class)
    fun inesperado(e: Exception): ResponseEntity<AccountErrorResponse> {
        // R2-06. La red se tragaba tambien los 4xx que Spring MVC ya sabe contestar —el caso medido
        // es `Content-Type: text/plain`, que respondia `500 CUENTA_ERROR_INTERNO` en vez de `415`— y
        // convertir un error del cliente en uno del servidor es mentirle a quien llama y ensuciar la
        // alarma de errores del servidor. Los `ErrorResponse` de Spring (415, 405, 406, 400 de
        // parametros...) traen su propio estado y su cuerpo ya es mudo: se relanzan, igual que la
        // `AccessDeniedException` de arriba. Lo que no es de esa familia sigue saliendo mudo por aqui.
        if (e is org.springframework.web.ErrorResponse) throw e
        return respuesta(AccountErrorCode.CUENTA_ERROR_INTERNO, MENSAJE_INTERNO)
    }

    private fun respuesta(code: AccountErrorCode, message: String): ResponseEntity<AccountErrorResponse> =
        ResponseEntity.status(code.estado).body(
            AccountErrorResponse(
                timestamp = dateFormatter.parseCurrentDate(PATRON_FECHA),
                statusCode = code.estado.value(),
                code = code.name,
                message = message,
            )
        )

    companion object {
        /** El mismo patrón que el resto del backend (`GeneralExceptionHandler.kt:35`). */
        const val PATRON_FECHA = "dd/MM/yyyy HH:mm:ss"

        /** Texto único de la red final. Constante y mudo: no describe lo que pasó por dentro. */
        const val MENSAJE_INTERNO = "No se pudo completar la operación. Inténtalo de nuevo."
    }
}
