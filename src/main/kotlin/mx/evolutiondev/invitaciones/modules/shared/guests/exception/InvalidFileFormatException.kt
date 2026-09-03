package mx.evolutiondev.invitaciones.modules.shared.guests.exception

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

@ResponseStatus(HttpStatus.BAD_REQUEST)
class InvalidFileFormatException(message: String) : RuntimeException(message)

