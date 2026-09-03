package mx.evolutiondev.invitaciones.modules.user.profile.presentation.request

import jakarta.validation.constraints.NotBlank

data class SurveyRequest(
    @field:NotBlank(message = "La fuente es requerida")
    val source: String,
    val otherText: String? = null
)
