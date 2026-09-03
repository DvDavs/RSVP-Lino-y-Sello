package mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.InvitationSummaryResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.UserResponse
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import java.time.ZoneId
import java.time.format.DateTimeFormatter

fun Page<InvitationEntity>.toSummaryResponse(dateFormat: String = "yyyy-MM-dd"): Page<InvitationSummaryResponse> {
    val formatter = DateTimeFormatter.ofPattern(dateFormat).withZone(ZoneId.systemDefault())

    val responses = this.content.map { invitation ->
        InvitationSummaryResponse(
                id = invitation.id,
                user = UserResponse(
                        id = invitation.customer.id,
                        name = "${invitation.customer.name} ${invitation.customer.lastName}",
                        email = invitation.customer.email
                ),
                isPaid = invitation.isPaid,
                eventId = invitation.template.eventType.id,
                event = invitation.template.eventType.name,
                planId = invitation.template.invitationPlan.id,
                plan = invitation.template.invitationPlan.name,
                price = invitation.totalAmount,
                currency = "MXN",
                eventDate = invitation.date,
                eventTime = invitation.time,
                createdAt = formatter.format(invitation.createdAt)
        )
    }

    return PageImpl(responses, this.pageable, this.totalElements)
}
