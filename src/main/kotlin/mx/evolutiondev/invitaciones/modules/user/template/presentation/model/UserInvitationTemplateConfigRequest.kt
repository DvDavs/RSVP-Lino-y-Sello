package mx.evolutiondev.invitaciones.modules.user.template.presentation.model

data class UserInvitationTemplateConfigRequest(
        val sections: Map<String, List<String>> = emptyMap()
)
