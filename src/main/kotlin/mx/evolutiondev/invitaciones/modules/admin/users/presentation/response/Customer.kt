package mx.evolutiondev.invitaciones.modules.admin.users.presentation.response

import mx.evolutiondev.invitaciones.core.auth.model.Role

data class Customer(
        val id: Long,
        val name: String,
        val lastName: String,
        val email: String,
        val role: Role,
        val isEnabled: Boolean,
        val isBanned: Boolean,
        val phone: String?,
        val address: String?,
        val city: String?,
        val postalCode: String?,
        val state: String?,
        val birthdate: String?,
        val howKnow: String?,
        val photo: String?
)
