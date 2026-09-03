package mx.evolutiondev.invitaciones.modules.shared.guests.service.model

import jakarta.validation.constraints.*
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class GuestsCreationRequest(
        @field:NotBlank(message = "El campo fullName es obligatorio")
        val fullName: String,
        
         @field:Email(message = "Debes proporcionar un email válido")
         @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcionar un email válido")
         val email: String,
        
         val graduatesName: String,

        //@field:NotBlank(message = "El teléfono es obligatorio")
        // @field:Pattern(regexp = "^\\d{10}$", message = "El teléfono debe tener 10 dígitos")
        val phone: String, 
        
        @field:PositiveOrZero(message = "El campo adultsCount no puede ser negativo")
        val adultsCount: Int?,
        
        @field:PositiveOrZero(message = "El campo childrenCount no puede ser negativo")
        val childrenCount: Int?,
        
        @field:PositiveOrZero(message = "El campo youngCount no puede ser negativo")
        val youngCount: Int?,

        @field:PositiveOrZero(message = "El número de mesa no puede ser negativo")
        val tableNumber: Int? = null,

        val whatsappSent: Boolean? = false,
)
