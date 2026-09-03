package mx.evolutiondev.invitaciones.modules.user.invitations.exception

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

/**
 * Exception thrown when an invitation configuration is not found.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
class InvitationConfigNotFoundException(message: String) : RuntimeException(message)

