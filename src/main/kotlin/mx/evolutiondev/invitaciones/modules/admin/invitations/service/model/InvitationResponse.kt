package mx.evolutiondev.invitaciones.modules.admin.invitations.service.model

data class InvitationSummaryResponse(
        val id: Long,
        val user: UserResponse,
        val isPaid: Boolean,
        val eventId: Long,
        val event: String,
        val planId: Long,
        val plan: String,
        val price: Double,
        val currency: String,
        val eventDate: String,
        val eventTime: String,
        val createdAt: String
)

data class UserResponse(
        val id: Long,
        val name: String,
        val email: String
)
