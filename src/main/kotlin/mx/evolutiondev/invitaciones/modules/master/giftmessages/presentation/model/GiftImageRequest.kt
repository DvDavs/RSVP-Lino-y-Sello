package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model

data class GiftImageRequest(
        val digital: Map<String, String> = emptyMap(), // ej: "amazon" -> "/img/amazon.png"
        val bank: Map<String, String> = emptyMap()     // ej: "bbva" -> "/img/bbva.png"
)


