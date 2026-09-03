package mx.evolutiondev.invitaciones.core.email.exception

class EmailSendingException(
    message: String, 
    cause: Throwable? = null
) : RuntimeException(message, cause)

class TemplateNotFoundException(message: String) : RuntimeException(message)
