package mx.evolutiondev.invitaciones.modules.master.songs.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

data class CreateSongRequest(
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long,
        @field:NotBlank(message = "Debes proporcionar el nombre de la canción")
        val name: String,
        @field:NotBlank(message = "Debes proporcionar la url de la canción")
        val url: String
)
