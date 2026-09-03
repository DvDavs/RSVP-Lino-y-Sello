package mx.evolutiondev.invitaciones.modules.all.invitations.presentation

import mx.evolutiondev.invitaciones.core.error.exception.InvitationDisabledException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import mx.evolutiondev.invitaciones.core.error.exception.UserDisabledException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus

import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationService

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController






data class GuestInfoResponse(
    val guestId: Long,
    val invitationId: Long,
    val fullName: String?,
    val email: String?,
    val isAlreadyConfirmed: Boolean,
    val attendanceStatus: AttendanceStatus,
    val passes: GuestPassesInfo,
    val eventRules: EventRulesInfo,
    val cancellationToken: String?,
    val invitationDetail: Any?,
)

data class GuestPassesInfo(
    val adults: Int,
    val young: Int,
    val children: Int,
    val tableNumber: Int?,  // ← nullable porque puede ser null en la entidad
    val graduatesName: String?, 
    val adultsConfirmed: Int,
    val youngConfirmed: Int,
    val childrenConfirmed: Int,
)

data class EventRulesInfo(val allowChildren: Boolean, val allowYoung: Boolean)

data class ErrorResponse(val error: String)

@RestController
@RequestMapping("/public/invitation")
class PublicGuestInfoController(
    private val invitationGuestsRepository: InvitationGuestsRepository,
    private val invitationService: InvitationService
) {

    @GetMapping("/guest-info/{token}")
    fun getGuestInfoForConfirmation(@PathVariable token: String): ResponseEntity<GuestInfoResponse> {
        val guest = invitationGuestsRepository.findByConfirmationToken(token)
            ?: throw GuestNotFoundException("La invitación no es válida o ya ha sido utilizada.")

        val invitation = guest.invitation

        if (!invitation.isEnabled) {
            throw InvitationDisabledException("La invitación ha sido desactivada y no está disponible.")
        }

        val customer = invitation.customer
        if (!customer.isEnabled) {
            throw UserDisabledException("El usuario propietario de la invitación está desactivado.")
        }
        if (customer.isBanned) {
            throw UserBannedException("El usuario propietario de la invitación está baneado.")
        }

        val invitationData = invitationService.findInvitation(userId = invitation.customer.id, invitationId = invitation.id)
        

        val response = GuestInfoResponse(
            guestId             = guest.id,
            invitationId        = invitation.id,
            fullName            = guest.fullName,
            email               = guest.email,
            isAlreadyConfirmed  = guest.attendanceStatus != AttendanceStatus.PENDING,
            attendanceStatus    = guest.attendanceStatus,
            passes = GuestPassesInfo(
                adults      = guest.adultsCount   ?: 0,
                young       = guest.youngCount    ?: 0,
                children    = guest.childrenCount ?: 0,
                tableNumber = guest.tableNumber ?: null,       // nullable, sin ?: 0
                graduatesName = guest.graduatesName ?: null,
                adultsConfirmed      = guest.adultsCountConfirmed   ?: 0,
                youngConfirmed       = guest.youngCountConfirmed   ?: 0,
                childrenConfirmed    = guest.childrenCountConfirmed ?: 0,
            ),
            eventRules = EventRulesInfo(
                allowChildren = invitation.childrenAllowed,
                allowYoung    = invitation.youngAllowed
            ),
            cancellationToken = guest.cancellationToken,
            invitationDetail = invitationData
        )

        return ResponseEntity.ok(response)
    }
}