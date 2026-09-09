package mx.evolutiondev.invitaciones.modules.admin.users.service.model

import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.validatedateformat.OptionalValidDateFormat

/**
 * Cuerpo de `PUT /user/profile`.
 *
 * **El campo `email` se sacó de aquí en la fase 5** (`12-producto-completo.md §A2.1`, `ADR-5-E3-06`):
 * cambiaba el correo de acceso sin verificar el nuevo ni avisar al antiguo, y su comprobación de
 * unicidad solo miraba las cuentas habilitadas, así que el correo de una cuenta deshabilitada
 * reventaba contra el índice único (`CustomerEntity.kt:23`) con un `500`. El cambio de correo vive
 * ahora en `POST /user/account/email`, con contraseña, verificación del buzón nuevo y aviso al viejo.
 */
data class UpdateProfileRequest(
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "Los apellidos solo pueden contener caracteres especiales como Ñ y acentos")
        val lastName: String,
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
        val state: String?
)
