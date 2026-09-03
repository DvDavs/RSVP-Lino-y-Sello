package mx.evolutiondev.invitaciones.core.email.model

data class EmailRequest(
    val to: String,
    val subject: String,
    val htmlBody: String,
    val textBody: String
) {
    init {
        require(to.isNotBlank()) { "Recipient email cannot be blank" }
        require(subject.isNotBlank()) { "Subject cannot be blank" }
    }
}
