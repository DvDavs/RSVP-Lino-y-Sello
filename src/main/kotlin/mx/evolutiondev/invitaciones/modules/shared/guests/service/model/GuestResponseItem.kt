package mx.evolutiondev.invitaciones.modules.shared.guests.service.model

import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl


fun Page<InvitationGuestEntity>.mapToPageResponse(): Page<GuestResponseItem> {
    val responses = this.content.map { guest ->
        guest.mapToResponseItem()
    }

    return PageImpl(responses, this.pageable, this.totalElements)
}

fun InvitationGuestEntity.mapToResponseItem(): GuestResponseItem =
        GuestResponseItem(
                invitationId = this.invitation.id,
                guestId = this.id,
                fullName = this.fullName,
                email = this.email,
                phone = this.phone,
                adultsCount = this.adultsCount,
                childrenCount = this.childrenCount,
                youngCount = this.youngCount,
                adultsConfirmed = this.adultsCountConfirmed,
                childrenConfirmed = this.childrenCountConfirmed,
                youngConfirmed = this.youngCountConfirmed,
                attendanceStatus = this.attendanceStatus,
                isEnabled = this.isEnabled,
                tableNumber = this.tableNumber,
                graduatesName = this.graduatesName,
                whatsappSent = this.whatsappSent,
                congratulationsMessage = this.congratulationsMessage,
                confirmationToken = this.confirmationToken,
                cancellationToken = this.cancellationToken
        )

data class GuestResponseItem(
        val invitationId: Long,
        val guestId: Long,
        val fullName: String?,
        val graduatesName: String?,
        val email: String?,
        val phone: String?,
        val adultsCount: Int?,
        val childrenCount: Int,
        val youngCount: Int,
        val adultsConfirmed: Int,
        val childrenConfirmed: Int,
        val youngConfirmed: Int,
        val attendanceStatus: AttendanceStatus,
        val isEnabled: Boolean,
        val tableNumber: Int?,
        val whatsappSent: Boolean,
        val congratulationsMessage: String?,
        val confirmationToken: String?,
        val cancellationToken: String?
)
