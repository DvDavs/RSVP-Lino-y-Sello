package mx.evolutiondev.invitaciones.modules.shared.whatsapp

data class GuestWhatsAppDTO(
    val phone: String,
    val fullName: String,
    val invitationUrl: String
)

data class MasivoRequest(
    val guests: List<GuestWhatsAppDTO>
)