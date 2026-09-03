package mx.evolutiondev.invitaciones.modules.master.templates.presentation.model

import jakarta.validation.constraints.*

data class UpdateTemplateRequest(
        @field:NotBlank(message = "Debes proporcionar un nombre")
        val name: String,
        
        @field:NotBlank(message = "Debes proporcionar una URL")
        val url: String,
        
        @field:NotNull(message = "Debes proporcionar un precio")
        @field:PositiveOrZero(message = "El precio debe ser mayor o igual a 0")
        val price: Double,
        
        @field:NotBlank(message = "Debes proporcionar una imagen")
        val image: String,
        
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,
        
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long
)

