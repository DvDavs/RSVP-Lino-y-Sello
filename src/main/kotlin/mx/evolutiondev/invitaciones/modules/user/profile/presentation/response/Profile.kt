package mx.evolutiondev.invitaciones.modules.user.profile.presentation.response

/**
 * Cuerpo de `GET /user/profile` y de `PUT /user/profile`.
 *
 * Fase 5, E3: gana [emailVerified] y **no** se creó ninguna ruta nueva de lectura para `/perfil`
 * (`12-producto-completo.md §A2.1`). `GET /user/profile` ya daba todo lo que la pantalla necesita
 * —nombre, apellidos, correo— y lee siempre `authentication.userId()` (`ProfileController.kt:33`),
 * así que extenderlo con un campo es menos superficie que estrenar una ruta gemela. El campo es
 * **aditivo**: ningún cliente que ya lea este JSON se rompe.
 */
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
        val isSurveyAnswered: Boolean = false,
        /**
         * `false` solo en cuentas nuevas sin confirmar y en cuentas con un cambio de correo a medias.
         * Las cuentas anteriores a la migración `V41` nacen verificadas (§A6.4). **Hoy no bloquea
         * nada**: la pantalla lo enseña y ofrece reenviar el enlace.
         */
        val emailVerified: Boolean = true
)
