package mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.InvitationData
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.InvitationDetailResponse
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.InvitationResponseItem

fun InvitationEntity.toInvitationResponseItem(): InvitationResponseItem =
        InvitationResponseItem(
                id = id,
                status = if (isPaid) {
                    "paid"
                } else {
                    "pending_payment"
                },
                eventId = template.eventType.id,
                event = template.eventType.name,
                planId = template.invitationPlan.id,
                plan = template.invitationPlan.name,
                price = totalAmount,
                currency = "MXN",
                date = this.date,
                time = this.time
        )

fun InvitationEntity.toInvitationDetailResponse(data: InvitationData? = null): InvitationDetailResponse =
        InvitationDetailResponse(
                id = id,
                status = if (isPaid) {
                    "paid"
                } else {
                    "pending_payment"
                },
                eventId = template.eventType.id,
                event = template.eventType.name,
                planId = template.invitationPlan.id,
                plan = template.invitationPlan.name,
                price = totalAmount,
                currency = "MXN",
                data = data
        )