package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * El **único** traductor de errores de `/public/` + `r/{token}`.
 *
 * ### Por qué un advice propio y por qué acotado a este subpaquete
 * `server.error.include-message: always` está activo (`application.yml:6`, hallazgo S-02): sin este
 * advice, cualquier excepción que escapara saldría con su `message` dentro del cuerpo de la
 * respuesta. En una ruta pública eso es un oráculo directo —«el token de confirmación no es válido»
 * frente a «el invitado no existe o fue eliminado» son dos frases distintas para dos causas
 * distintas—, y además el `GeneralExceptionHandler` del núcleo llega a filtrar el `rootCause` al
 * cliente.
 *
 * Aquí **ninguna respuesta lleva el `message` de la excepción original**. Los textos son los que
 * [RsvpException] escribe en su propia clase, fijos y en es-MX.
 *
 * `basePackages` acotado a este subpaquete por dos razones: este advice declara un handler de
 * `Exception`, así que sin el acotado se convertiría en el manejador de errores de toda la
 * aplicación; y el territorio de esta sesión es este subpaquete, no el módulo entero. Es el mismo
 * criterio de `Templates2ExceptionHandler.kt:55`, y la parte C §3 ya anticipó que cada sesión
 * declararía el suyo.
 *
 * `@Order(HIGHEST_PRECEDENCE)`: los dos advices existentes del núcleo no declaran orden y quedan en
 * `LOWEST_PRECEDENCE`, así que sin esto una `IllegalArgumentException` podría resolverse allí, sin
 * `code` y con el mensaje dentro.
 *
 * ### Lo que este advice NO puede capturar
 * Nada de la cadena de filtros de Spring Security ni lo que Spring lanza antes de elegir controlador
 * (ruta inexistente, método no soportado). En esta superficie no importa: `/public/` + `**` es
 * `permitAll()` (`SecurityConfig.kt:38`), así que no hay `401` ni `403` que traducir.
 */
@RestControllerAdvice(basePackages = ["mx.evolutiondev.invitaciones.modules.product.guests.rsvp"])
@Order(Ordered.HIGHEST_PRECEDENCE)
class RsvpExceptionHandler {

    private val log = LoggerFactory.getLogger(RsvpExceptionHandler::class.java)

    /**
     * Los cinco errores esperados. El cuerpo se compone **solo** con [RsvpException.code] y
     * [RsvpException.publicMessage], los dos constantes de la propia clase de excepción.
     *
     * No se registra nada: un `WARN` por cada `404` de esta ruta sería un registro con un token de
     * invitado dentro en cuanto alguien añadiera el identificador «para depurar».
     */
    @ExceptionHandler(RsvpException::class)
    fun rsvp(e: RsvpException): ResponseEntity<RsvpErrorResponse> =
        ResponseEntity.status(e.status).body(RsvpErrorResponse(e.code.name, e.publicMessage))

    /**
     * Cuerpo que no es JSON, o cuyos tipos no encajan (`{"adults": "dos"}`). Sale por el mismo
     * `422 GUEST_INVALID` que cualquier otro cuerpo inatendible: qué parte concreta del JSON estaba
     * mal es información del servidor, no del invitado.
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun ilegible(e: HttpMessageNotReadableException): ResponseEntity<RsvpErrorResponse> =
        rsvp(RsvpException.Invalid())

    /**
     * Red de seguridad. Garantiza la regla dura de esta superficie: **ninguna respuesta sale sin
     * `code`, y ninguna lleva texto que no esté escrito aquí**.
     *
     * La traza se registra en el servidor —donde sí hace falta para arreglar el fallo— y nunca en la
     * respuesta. El mensaje del registro no lleva token, ni nombre, ni correo: solo el tipo de la
     * excepción.
     */
    @ExceptionHandler(Exception::class)
    fun inesperado(e: Exception): ResponseEntity<RsvpErrorResponse> {
        log.error("rsvp publico: fallo inesperado ({})", e.javaClass.simpleName, e)
        return rsvp(RsvpException.Internal())
    }
}
