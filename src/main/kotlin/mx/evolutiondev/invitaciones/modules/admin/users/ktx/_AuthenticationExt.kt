package mx.evolutiondev.invitaciones.modules.admin.users.ktx

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import org.springframework.security.core.Authentication

fun Authentication.userId(): Long =
        (this.principal as CustomerDetails).id


fun Authentication.role(): AppRole =
        AppRole.values().firstOrNull { it.name == getFirstAuthority() }
                ?: AppRole.USER

private fun Authentication.getFirstAuthority(): String =
        (this.principal as CustomerDetails)
                .authorities
                .firstOrNull()
                ?.authority
                ?.split("_")
                ?.get(1)
                ?.uppercase() ?: AppRole.USER.name.uppercase()
