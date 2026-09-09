package mx.evolutiondev.invitaciones.modules.product.account

import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
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
    }
}
