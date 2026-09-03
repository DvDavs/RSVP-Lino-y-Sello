package mx.evolutiondev.invitaciones.modules.user.template.presentation.model

data class UserInvitationTemplateConfigResponse(
        val sections: Map<String, List<String>> = emptyMap()
)
