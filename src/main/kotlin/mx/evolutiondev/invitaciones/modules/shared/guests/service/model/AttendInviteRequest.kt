package mx.evolutiondev.invitaciones.modules.shared.guests.service.model

import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive

data class AttendInviteRequest(
        @field:NotNull(message = "El campo adults no puede ser nulo")
        @field:Positive(message = "El campo adults debe ser un número positivo")
        val adults: Int?,
        @field:Positive(message = "El campo children debe ser un número positivo")
        val children: Int?,
        @field:Positive(message = "El campo young debe ser un número positivo")
        val young: Int?
)
