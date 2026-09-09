package mx.evolutiondev.invitaciones.modules.product.account

import org.springframework.http.HttpStatus

/**
 * Códigos de error **estables** de las rutas de cuenta de la fase 5 (E3).
 *
 * Por qué existen: `ADR-5-0C-01` dejó dicho que el advice de `templates2` está acotado con
 * `basePackages` (`Templates2ExceptionHandler.kt:55`) y **no alcanza** a `modules.product`, así que sin
 * esto los errores de estas rutas saldrían por `GeneralExceptionHandler` con el cuerpo
 * `{timestamp, statusCode, errors}` y **sin `code`**. La interfaz de `/perfil` tiene que distinguir
 * «token caducado» de «token inválido» para ofrecer el reenvío, y ordenar por el texto del mensaje es
 * exactamente lo que no se puede hacer.
 *
 * El contrato publicado es `handoffs/5-E3-A2-contrato-cuenta.md §4`. **El nombre del código no cambia
 * nunca**: es la clave con la que el frontend decide.
 */
enum class AccountErrorCode(val estado: HttpStatus) {
    /** El token de verificación no existe, ya se usó, o pertenece a una cuenta que ya no está. */
    CUENTA_TOKEN_INVALIDO(HttpStatus.BAD_REQUEST),

    /** El token de verificación pasó de su ventana de validez. Se puede pedir otro. */
    CUENTA_TOKEN_CADUCADO(HttpStatus.BAD_REQUEST),

    /** La contraseña actual que acompaña un cambio de contraseña o de correo no coincide. */
    CUENTA_PASSWORD_INCORRECTA(HttpStatus.BAD_REQUEST),

    /**
     * Solo al **confirmar** un cambio de correo: entre la petición y la confirmación, esa dirección
     * quedó tomada. Nunca se devuelve al **pedir** el cambio, porque ahí sería un oráculo de
     * enumeración con la cuenta de cualquiera.
     */
    CUENTA_CORREO_NO_DISPONIBLE(HttpStatus.CONFLICT),

    /** El cuerpo no valida: campo ausente, contraseña débil, correo mal formado. */
    CUENTA_DATOS_INVALIDOS(HttpStatus.BAD_REQUEST),

    /** Límite de intentos de `AuthThrottleService`. Cuerpo constante: no dice cuánto falta. */
    CUENTA_DEMASIADOS_INTENTOS(HttpStatus.TOO_MANY_REQUESTS),

    /**
     * Red final del advice (R1-08). Algo se rompió por dentro y **el cuerpo no cuenta qué**: mensaje
     * constante y sin detalle. Existe porque sin ella una excepción inesperada —el choque contra el
     * índice único de `customer.email` al confirmar dos cambios de correo a la vez, por ejemplo— caía
     * en el manejo genérico del núcleo y, con `include-message: always` (S-02), el cuerpo podía llevar
     * el nombre de la restricción y el valor en conflicto: el correo de otra clienta.
     */
    CUENTA_ERROR_INTERNO(HttpStatus.INTERNAL_SERVER_ERROR),
}

/**
 * Error tipado de las rutas de cuenta. Lo traduce [ProductAccountExceptionHandler].
 *
 * El mensaje es para la persona, no para el programa: **el programa lee [code]**.
 */
class AccountException(
    val code: AccountErrorCode,
    message: String,
) : RuntimeException(message)

/**
 * Cuerpo de error de las rutas de cuenta. Conserva `timestamp` y `statusCode` del resto del backend
 * (`ErrorMessage.kt:3-8`) y añade el `code` estable, igual que hizo `templates2`
 * (`TplErrorResponse.kt:26-32`). No lleva `details`: aquí no hay nada útil que detallar y todo lo que
 * se añada a un cuerpo de error acaba contando algo de dentro.
 */
data class AccountErrorResponse(
    val timestamp: String,
    val statusCode: Int,
    val code: String,
    val message: String,
)
