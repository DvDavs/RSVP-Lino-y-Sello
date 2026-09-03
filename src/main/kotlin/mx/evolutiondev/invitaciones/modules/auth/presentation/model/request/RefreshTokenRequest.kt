package mx.evolutiondev.invitaciones.modules.auth.presentation.model.request

import jakarta.validation.constraints.NotBlank

data class RefreshTokenRequest(
        @field:NotBlank(message = "Debes proporcionar un token de refresco")
        val refreshToken: String
)
