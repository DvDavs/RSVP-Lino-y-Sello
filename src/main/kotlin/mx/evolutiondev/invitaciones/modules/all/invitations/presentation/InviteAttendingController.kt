
package mx.evolutiondev.invitaciones.modules.all.invitations.presentation

import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationService

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.ConfirmAttendanceRequest
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestResponseItem
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.mapToResponseItem
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/public/invitation")
class InviteAttendingController(
        private val invitationGuestService: InvitationGuestsService,
        private val invitationService: InvitationService
) {

    @PutMapping("/{confirmationToken}/attend")
    fun attendInvite(
            @PathVariable confirmationToken: String,
            @RequestBody request: ConfirmAttendanceRequest
    ): AttendanceConfirmationResponse {
        val updatedGuest = invitationGuestService.attendInvite(confirmationToken, request)
        
        val message = if (request.isAttending) {
            "¡Gracias por confirmar tu asistencia! Te hemos enviado un correo con los detalles."
        } else {
            "Gracias por tu respuesta. Lamentamos que no puedas asistir."
        }
        
      val invitationData = invitationService.findInvitation(
        userId = updatedGuest.invitation.customer.id,
        invitationId = updatedGuest.invitation.id
    )
        return AttendanceConfirmationResponse(
                message = message,
                guest = updatedGuest.mapToResponseItem(),
                invitationDetail = invitationData
        )
    }

    @PutMapping("/cancel/{cancellationToken}")
    fun cancelAttendance(
            @PathVariable cancellationToken: String
    ): GeneralMessageResponse {
        invitationGuestService.cancelAttendance(cancellationToken)
        return GeneralMessageResponse("Tu asistencia ha sido cancelada correctamente")
    }
}

data class AttendanceConfirmationResponse(
        val message: String,
        val guest: GuestResponseItem,
        val invitationDetail: Any?,
)