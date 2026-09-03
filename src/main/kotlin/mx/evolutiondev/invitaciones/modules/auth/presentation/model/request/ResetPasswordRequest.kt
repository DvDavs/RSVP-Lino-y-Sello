package mx.evolutiondev.invitaciones.modules.auth.presentation.model.request

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class ResetPasswordRequest(
        @field:Email(message = "Debes proporcinar un correo electrónico válido")
        @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcinar un correo electrónico válido")
        val email: String
)
