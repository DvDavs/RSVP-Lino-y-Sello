package mx.evolutiondev.invitaciones.modules.admin.users.presentation.request

import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword

data class UpdatePasswordAdministratorRequest(
        @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
        val password: String
)