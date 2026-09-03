package mx.evolutiondev.invitaciones.modules.admin.users.presentation.request

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword
import mx.evolutiondev.invitaciones.core.util.validation.validatedateformat.OptionalValidDateFormat
import mx.evolutiondev.invitaciones.core.util.validation.valueofenum.ValueOfEnum

data class AdministratorRequest(
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo pueden contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "Los apellidos solo pueden contener caracteres especiales como Ñ y acentos")
        val lastName: String,
        @field:Email(message = "Debes proporcinar un correo electrónico válido")
        @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcinar un correo electrónico válido")
        val email: String,
        @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
        val password: String,
        @field:ValueOfEnum(enumClass = Role::class, acceptedValues = ["ADMIN", "MASTER"], message = "Únicamente puedes crear nuevos administradores con el rol de MASTER o ADMIN")
        val role: String,
        @field:Pattern(regexp = Patterns.PHONE_NUMBER_PATTERN, message = "Debes proporcinar un número telefónico válido de 10 digitos numéricos")
        val phone: String?,
        // @field:OptionalValidDateFormat(
        //         format = "yyyy-MM-dd",
        //         message = "Fecha inválida, debe estar en formato yyyy-MM-dd y ser válida"
        // )
        val birthdate: String?,
        val address: String?,
        val city: String?,
        val postalCode: String?,
        val state: String?,
        val howKnow: String?
)
