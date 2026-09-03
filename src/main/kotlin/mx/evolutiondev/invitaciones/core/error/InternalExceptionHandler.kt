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
        appLogger.error("Argument error: {}", ex.message)
        val errors = mutableMapOf<String, String?>()
        ex.bindingResult.fieldErrors.forEach { error ->
            errors[error.field] = error.defaultMessage
        }
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