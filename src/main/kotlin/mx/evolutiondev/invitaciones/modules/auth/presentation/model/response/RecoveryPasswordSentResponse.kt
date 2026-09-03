package mx.evolutiondev.invitaciones.modules.auth.presentation.model.response

data class RecoveryPasswordSentResponse(
        val message: String,
        val resetToken: String
)
