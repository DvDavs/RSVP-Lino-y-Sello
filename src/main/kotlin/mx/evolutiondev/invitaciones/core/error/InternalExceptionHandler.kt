package mx.evolutiondev.invitaciones.core.error

import mx.evolutiondev.invitaciones.core.error.model.ErrorMessage
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.HttpStatusCode
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

@RestControllerAdvice
class InternalExceptionHandler(
        private val dateFormatter: DateFormatter
) : ResponseEntityExceptionHandler() {
    private val appLogger: Logger = LoggerFactory.getLogger(InternalExceptionHandler::class.java)

    override fun handleMethodArgumentNotValid(
            ex: MethodArgumentNotValidException,
            headers: HttpHeaders,
            status: HttpStatusCode,
            request: WebRequest
    ): ResponseEntity<Any>? {
        val errors = mutableMapOf<String, String?>()
        ex.bindingResult.fieldErrors.forEach { error ->
            errors[error.field] = error.defaultMessage
        }
        // R4-01 (`bitacora/5-E3-R4-cierre.md`; ADR-5-E3-C6-01). Aqui se registraba `ex.message`, y ese
        // mensaje lleva DENTRO el valor que fallo: `rejected value [...]`. Un alta con una contrasena
        // que no pasa `@StrongPassword` dejaba la contrasena entera en el registro de cualquier
        // despliegue, sin que nadie atacara nada. Se registran los NOMBRES de los campos: es lo que
        // hace falta para diagnosticar («fallo password, fallo email») y es lo unico que no puede
        // traer un valor pegado. El texto de cada regla ya viaja en la respuesta, a quien la pidio.
        appLogger.warn("Validacion rechazada en {}: campos {}", ex.bindingResult.objectName, errors.keys.sorted())
        return ResponseEntity(
                ErrorMessage(
                        timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                        statusCode = HttpStatus.BAD_REQUEST.value(),
                        errors = errors
                ),
                headers,
                status
        )
    }
}