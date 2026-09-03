package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

data class InvitationResponseItem(
        val id: Long,
        val status: String,
        val eventId: Long,
        val event: String,
        val planId: Long,
        val plan: String,
        val price: Double,
        val currency: String,
        val date: String,
        val time: String
)

data class InvitationResponse(
        val status: String = "",
        val message: String = "",
        val invitation: InvitationResponseItem
)
