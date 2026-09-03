package mx.evolutiondev.invitaciones.modules.master.templates.presentation.model

data class InvitationTemplateResponse(
        val id: Long,
        val event: String,
        val plan: String,
        val image: String,
        val url: String,
        val eventId: Long,
        val planId: Long
)


