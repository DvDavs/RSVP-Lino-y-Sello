package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model

import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

data class UpdateGiftMessagesRequest(
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,
        
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long,
        
        @field:NotEmpty(message = "Debes proporcionar al menos un mensaje")
        val messages: List<String>,
        
        val images: GiftImagesRequest
)

data class GiftImagesRequest(
        val digital: Map<String, String> = emptyMap(),
        val bank: Map<String, String> = emptyMap()
)

