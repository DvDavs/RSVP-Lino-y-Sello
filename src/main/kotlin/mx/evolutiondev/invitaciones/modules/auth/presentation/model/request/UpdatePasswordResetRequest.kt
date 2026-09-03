package mx.evolutiondev.invitaciones.modules.auth.presentation.model.request

import jakarta.validation.constraints.NotBlank
import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword

class UpdatePasswordResetRequest(
        @field:NotBlank(message = "Debes proporcionar un token de para reestablecer tu contraseña")
        val resetToken: String,
        @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
        val newPassword: String
)