package mx.evolutiondev.invitaciones.modules.user.profile.presentation.response

data class Profile(
        val name: String,
        val lastName: String,
        val email: String,
        var phone: String? = null,
        var birthdate: String? = null,
        var address: String? = null,
        var city: String? = null,
        var postalCode: String? = null,
        var state: String? = null,
        var photo: String? = null,
        val isSurveyAnswered: Boolean = false
)
