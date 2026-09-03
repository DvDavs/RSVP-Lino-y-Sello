package mx.evolutiondev.invitaciones.modules.shared.guests.service.model

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class ConfirmAttendanceRequest(
    val isAttending: Boolean,
    @field:Email(message = "Debes proporcionar un correo electrónico válido")
    @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcionar un correo electrónico válido")
    val email: String? = null,
    val adultsConfirmed: Int?,
    val childrenConfirmed: Int?,
    val youngConfirmed: Int?,
    @field:Size(max = 1000, message = "El mensaje no puede exceder 1000 caracteres")
    val message: String?
)

