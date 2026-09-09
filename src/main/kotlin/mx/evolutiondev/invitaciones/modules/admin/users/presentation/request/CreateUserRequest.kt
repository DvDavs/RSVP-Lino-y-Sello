package mx.evolutiondev.invitaciones.modules.admin.users.presentation.request

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword
import mx.evolutiondev.invitaciones.core.util.validation.validatedateformat.OptionalValidDateFormat
import mx.evolutiondev.invitaciones.core.util.validation.valueofenum.ValueOfEnum

data class CreateUserRequest(
        @field:NotBlank(message = "El nombre es obligatorio")
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:NotBlank(message = "Los apellidos son obligatorios")
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "Los apellidos solo pueden contener caracteres especiales como Ñ y acentos")
        val lastName: String,
        @field:Email(message = "Debes proporcinar un correo electrónico válido")
        @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcinar un correo electrónico válido")
        val email: String,
        @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
        val password: String,
        @field:ValueOfEnum(enumClass = Role::class, acceptedValues = ["USER"], message = "Solo puedes crear usuarios con rol USER")
        val role: String = "USER",
        @field:Pattern(regexp = Patterns.PHONE_NUMBER_PATTERN, message = Patterns.PHONE_NUMBER_MESSAGE)
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
