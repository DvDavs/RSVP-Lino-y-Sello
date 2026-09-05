package mx.evolutiondev.invitaciones.core.error

import jakarta.validation.ConstraintViolationException
import mx.evolutiondev.invitaciones.core.error.exception.DuplicatedEmailException
import mx.evolutiondev.invitaciones.core.error.exception.HierarchyViolationException
import mx.evolutiondev.invitaciones.core.error.exception.InvitationDisabledException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import mx.evolutiondev.invitaciones.core.error.exception.UserDisabledException
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.DuplicateGuestException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.InvalidFileFormatException
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.InvitationConfigNotFoundException 
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.DefaultVisualTemplateNotFoundException
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.DefaultContentTemplateNotFoundException
import mx.evolutiondev.invitaciones.core.error.model.ErrorMessage
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatter
import org.springframework.http.HttpStatus
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.servlet.NoHandlerFoundException

@RestControllerAdvice
class GeneralExceptionHandler(
        private val dateFormatter: DateFormatter
) {
    @ExceptionHandler(UnauthorizedException::class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    fun handleUnauthorizedException(ex: UnauthorizedException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.UNAUTHORIZED.value(),
                errors = mutableMapOf(
                        "username" to ex.message
                )
        )
    }

    /**
     * I-02 (H-ADV-05): `429` de `POST /auth/token`.
     *
     * La excepcion ya lleva `@ResponseStatus(TOO_MANY_REQUESTS)` y ningun advice la capturaba, asi
     * que este handler NO hace falta para que el estado salga bien. Se anade por el **cuerpo**: sin
     * el, la respuesta la fabrica `BasicErrorController`, cuyo contenido depende de la
     * configuracion del entorno -con `spring-boot-devtools` en el classpath
     * (`server.error.include-stacktrace=ALWAYS`) el `429` devolvia la **traza de pila completa**,
     * con nombres de clase, la cadena de filtros de seguridad y `path`. Un `429` de seguridad tiene
     * que ser identico y mudo siempre, y con la misma forma que el `401` de al lado.
     *
     * El cuerpo es **constante**: no dice si el bloqueo fue por cuenta o por IP, ni si la cuenta
     * existe, ni cuanto falta para que caduque la ventana.
     */
    @ExceptionHandler(DemasiadosIntentosException::class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    fun handleDemasiadosIntentos(ex: DemasiadosIntentosException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.TOO_MANY_REQUESTS.value(),
                errors = mutableMapOf(
                        "error" to ex.message
                )
        )
    }

    @ExceptionHandler(IllegalArgumentException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleIllegalArgumentException(ex: IllegalArgumentException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errors = mutableMapOf(
                        "error" to ex.message
                )
        )
    }

    @ExceptionHandler(ConstraintViolationException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleConstraintViolationException(ex: ConstraintViolationException): ErrorMessage {
        val errors = ex.constraintViolations.groupBy { it.propertyPath.toString() }
                .mapValues { entry ->
                    entry.value.map { violation ->
                        mapOf(
                                "field" to entry.key,
                                "rejectedValue" to violation.invalidValue,
                                "message" to violation.message
                        )
                    }
                }

        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errorsListed = errors
        )
    }

    @ExceptionHandler(HttpMessageNotReadableException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleEmptyRequestBody(exception: HttpMessageNotReadableException): ErrorMessage {
        val errorMessage = exception.message ?: "Error al procesar el request"
        val rootCause = exception.rootCause?.message ?: exception.cause?.message
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errors = mutableMapOf(
                        "error" to "Error al procesar el request JSON",
                        "message" to errorMessage,
                        "rootCause" to (rootCause ?: "No disponible")
                )
        )
    }

    @ExceptionHandler(NoHandlerFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleNotFound(exception: NoHandlerFoundException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.NOT_FOUND.value(),
                errors = mutableMapOf(
                        "error" to "El recurso al que intentas acceder no existe"
                )
        )
    }

    @ExceptionHandler(DuplicatedEmailException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleDuplicatedEmail(exception: DuplicatedEmailException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errors = mutableMapOf(
                        "error" to exception.message
                )
        )
    }

    @ExceptionHandler(HierarchyViolationException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun handleHierarchyViolation(exception: HierarchyViolationException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.FORBIDDEN.value(),
                errors = mutableMapOf(
                        "hierarchy" to exception.message
                )
        )
    }

    @ExceptionHandler(DuplicateGuestException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleDuplicateGuest(exception: DuplicateGuestException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errors = mutableMapOf(
                        "error" to exception.message
                )
        )
    }

    @ExceptionHandler(GuestNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleGuestNotFound(exception: GuestNotFoundException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.NOT_FOUND.value(),
                errors = mutableMapOf(
                        "error" to exception.message
                )
        )
    }

    @ExceptionHandler(UnauthorizedAccessException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun handleUnauthorizedAccess(exception: UnauthorizedAccessException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.FORBIDDEN.value(),
                errors = mutableMapOf(
                        "access" to exception.message
                )
        )
    }

    @ExceptionHandler(InvalidFileFormatException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun handleInvalidFileFormat(exception: InvalidFileFormatException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.BAD_REQUEST.value(),
                errors = mutableMapOf(
                        "message" to exception.message
                )
        )
    }

    @ExceptionHandler(InvitationConfigNotFoundException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun handleInvitationConfigNotFound(exception: InvitationConfigNotFoundException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.NOT_FOUND.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "No se encontró configuración para esta invitación")
                )
        )
    }

    @ExceptionHandler(DefaultVisualTemplateNotFoundException::class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    fun handleDefaultVisualTemplateNotFound(exception: DefaultVisualTemplateNotFoundException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "No se encontró la plantilla visual necesaria para generar la configuración")
                )
        )
    }

    @ExceptionHandler(DefaultContentTemplateNotFoundException::class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    fun handleDefaultContentTemplateNotFound(exception: DefaultContentTemplateNotFoundException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "No se encontró la plantilla de contenido necesaria para generar la configuración")
                )
        )
    }

    @ExceptionHandler(InvitationDisabledException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun handleInvitationDisabled(exception: InvitationDisabledException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.FORBIDDEN.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "La invitación ha sido desactivada y no está disponible."),
                        "type" to "INVITATION_DISABLED"
                )
        )
    }

    @ExceptionHandler(UserDisabledException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun handleUserDisabled(exception: UserDisabledException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.FORBIDDEN.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "El usuario propietario de la invitación está desactivado."),
                        "type" to "USER_DISABLED"
                )
        )
    }

    @ExceptionHandler(UserBannedException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun handleUserBanned(exception: UserBannedException): ErrorMessage {
        return ErrorMessage(
                timestamp = dateFormatter.parseCurrentDate("dd/MM/yyyy HH:mm:ss"),
                statusCode = HttpStatus.FORBIDDEN.value(),
                errors = mutableMapOf(
                        "error" to (exception.message ?: "El usuario propietario de la invitación está baneado."),
                        "type" to "USER_BANNED"
                )
        )
    }
}