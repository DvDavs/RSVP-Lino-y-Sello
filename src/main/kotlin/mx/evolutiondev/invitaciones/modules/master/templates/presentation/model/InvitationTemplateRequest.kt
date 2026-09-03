package mx.evolutiondev.invitaciones.modules.master.templates.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

data class InvitationTemplateRequest(

        @field:NotNull(message = "El precio es obligatorio")
        @field:Positive(message = "El precio debe ser un número positivo")
        val price: Double,

        @field:NotBlank(message = "La imagen es obligatoria")
        val image: String,

        @field:NotBlank(message = "La URL es obligatoria")
        val url: String,

        @field:NotNull(message = "El ID del evento es obligatorio")
        @field:Positive(message = "El ID del evento debe ser un número")
        val eventId: Long,

        @field:NotNull(message = "El ID del plan es obligatorio")
        @field:Positive(message = "El ID del plan debe ser un número")
        val planId: Long
)


