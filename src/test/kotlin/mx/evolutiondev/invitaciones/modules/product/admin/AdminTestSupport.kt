package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority

/**
 * Ayudantes compartidos por las pruebas de `/product/admin/` + `**`.
 *
 * El `Authentication` se fabrica **igual que lo fabrica el backend en producción**:
 * `core/auth/security/JwtTokenFilter.kt:63-68` monta un `UsernamePasswordAuthenticationToken` con un
 * `CustomerDetails` como principal y **una sola** autoridad `ROLE_<rol>`. Copiarlo importa: si la
 * prueba usara `@WithMockUser`, el principal sería un `String` y
 * `modules/admin/users/ktx/_AuthenticationExt.kt:7` reventaría con `ClassCastException` — es decir, la
 * prueba mediría otra cosa que la ruta real.
 */
object Identidades {

    const val MASTER = "MASTER"
    const val ADMIN = "ADMIN"
    const val USER = "USER"

    fun como(rol: String, id: Long = 1L): Authentication {
        val autoridades = listOf(SimpleGrantedAuthority("ROLE_$rol"))
        return UsernamePasswordAuthenticationToken(
            CustomerDetails(id, "$rol@example.test", "", autoridades),
            null,
            autoridades,
        )
    }
}
