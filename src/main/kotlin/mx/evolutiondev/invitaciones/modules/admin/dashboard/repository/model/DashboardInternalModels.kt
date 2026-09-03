package mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model

import java.time.Instant

data class InvitationMetrics(
    val total: Long,
    val active: Long,
    val pending: Long,
    val pastEvents: Long
)

data class UserInvitationMetrics(
    val total: Long,
    val pending: Long,
    val paid: Long,
    val upcoming: Long
)

data class InvitationSummary(
    val id: Long,
    val customerName: String,
    val customerLastName: String,
    val isPaid: Boolean,
    val createdAt: Instant,
    val eventTypeName: String,
    val eventDate: String?,
    val totalAmount: Double,
    val planId: Long,
    val planName: String
)

data class EventSummary(
    val id: Long,
    val eventTypeName: String,
    val eventDate: String,
    val customerName: String?,
    val customerLastName: String?
)
