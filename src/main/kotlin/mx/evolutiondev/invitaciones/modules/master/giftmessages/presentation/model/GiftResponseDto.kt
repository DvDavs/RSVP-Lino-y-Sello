package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model

data class GiftResponseDto(
        val messages: List<String>,
        val images: Map<String, Map<String, String>>
)


