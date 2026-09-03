package mx.evolutiondev.invitaciones.modules.admin.dashboard.service.model

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class NotificationsRequest(
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val fullName: String,
        @field:Email(message = "Debes proporcinar un correo electrónico válido")
        @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcinar un correo electrónico válido")
        val email: String,
        @field:NotBlank(message = "El phone es requerido")
        val phone: String
)