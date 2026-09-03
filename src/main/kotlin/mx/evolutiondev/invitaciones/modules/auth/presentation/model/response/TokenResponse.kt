package mx.evolutiondev.invitaciones.modules.auth.presentation.model.response

data class TokenResponse(
        val accessToken: String,
        val refreshToken: String,
        val role: String,
        val isSurveyAnswered: Boolean
)
