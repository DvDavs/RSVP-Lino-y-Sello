package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import org.springframework.security.core.Authentication

/**
 * **La regla de alcance por rol de la consola nueva, en un solo objeto** (contrato `/product/admin` §0).
 *
 * - `MASTER` ve todo el sistema.
 * - `ADMIN` ve **solo** las clientas que él creó y a sí mismo, y las invitaciones de esas clientas.
 *   Es literalmente el predicado que ya usan las consultas `countAdmin*` del panel heredado
 *   (`modules/admin/dashboard/repository/DashboardRepository.kt:50`, `:53`, `:56`, `:71`):
 *   `customer.id = :yo OR customer.created_by = :yo`.
 * - `USER` y anónimo no llegan aquí: los para la cadena de filtros antes
 *   (`core/auth/security/SecurityConfig.kt:47` deja `/product/` + `**` en `authenticated()` y el
 *   `@PreAuthorize` de clase de [ProductAdminConsolaController] exige `ADMIN` o `MASTER`).
 *
 * El rol y el id salen del `Authentication` que puso `core/auth/security/JwtTokenFilter.kt:62-68`:
 * el principal es un `CustomerDetails` con una única autoridad `ROLE_<rol>`, y las dos extensiones de
 * `modules/admin/users/ktx/_AuthenticationExt.kt:7` y `:11` son las que el backend heredado ya usa
 * para leerlos (`modules/admin/invitations/presentation/InvitationController.kt:38`, `:118`). No se
 * inventa una segunda forma de resolver el rol: una discrepancia entre dos lectores del mismo token
 * es exactamente cómo nacen los agujeros de autorización.
 *
 * [todo] es `1` para `MASTER` y `0` para el resto **porque el predicado viaja a SQL como entero**:
 * con un booleano ligado a `?` PostgreSQL no siempre puede inferir el tipo del parámetro en una
 * comparación suelta, y `:todo = 1` lo infiere del literal sin necesidad de un `CAST` en cada consulta.
 */
data class AlcanceDeAdministracion(
    /** Id del solicitante (`CustomerDetails.id`). */
    val yo: Long,
    /** `1` = sin restricción (MASTER); `0` = solo lo suyo y lo de sus clientas (ADMIN). */
    val todo: Int,
) {
    val esMaster: Boolean get() = todo == 1

    companion object {

        /**
         * Predicado de alcance para SQL nativo. El alias de `customer` **tiene que llamarse `c`**.
         * Se escribe una sola vez y se interpola en todas las consultas: si mañana cambia la regla,
         * cambia aquí y no en siete sitios que se pueden desincronizar.
         */
        const val PREDICADO = "(:todo = 1 OR c.id = :yo OR c.created_by = :yo)"

        fun de(authentication: Authentication): AlcanceDeAdministracion =
            AlcanceDeAdministracion(
                yo = authentication.userId(),
                todo = if (authentication.role() == AppRole.MASTER) 1 else 0,
            )
    }
}
