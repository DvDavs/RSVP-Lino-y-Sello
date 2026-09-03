package mx.evolutiondev.invitaciones.modules.auth.presentation.model.request

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword

data class AuthRequest(
        @field:Email(message = "Debes proporcinar un correo electrónico válido")
        @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcinar un correo electrónico válido")
        val email: String,
        @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
        val password: String
)