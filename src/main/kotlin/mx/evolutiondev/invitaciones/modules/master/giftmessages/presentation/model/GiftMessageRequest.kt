package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

data class GiftMessageRequest(
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long,

        @field:NotEmpty(message = "Debes proporcionar los mensajes")
        val messages: List<@NotBlank String>,

        val images: GiftImageRequest
)


