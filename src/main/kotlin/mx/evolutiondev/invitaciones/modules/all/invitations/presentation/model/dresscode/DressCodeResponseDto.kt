package mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.dresscode

data class DressCodeResponseDto(
        val id: Long,
        val name: String,
        val woman: GenderDressInfo,
        val man: GenderDressInfo
)
