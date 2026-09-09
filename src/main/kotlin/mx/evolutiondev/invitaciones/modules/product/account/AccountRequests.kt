package mx.evolutiondev.invitaciones.modules.product.account

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.core.util.validation.password.StrongPassword

/**
 * Cuerpos de las rutas de cuenta (fase 5, E3). Contrato publicado:
 * `handoffs/5-E3-A2-contrato-cuenta.md §2`.
 *
 * Nombres de campo en inglés como el resto de los DTO del backend
 * (`UpdatePasswordResetRequest.kt`, `RefreshTokenRequest.kt`); mensajes en español, que son los que
 * lee la persona.
 *
 * **Los cuatro llevan `@JsonIgnoreProperties(ignoreUnknown = true)`** por la misma razón que
 * `UpdateProfileRequest` (R1-09): el `ObjectMapper` de la aplicación es el estricto de `templates2` y
 * una clave de más en el cuerpo —un `confirmPassword` del formulario, un `_csrf` de una librería— sería
 * un `400` que nadie sabría explicar. Aquí el cuerpo es un formulario de una persona, no un documento de
 * esquema cerrado; lo que sobra se descarta.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class VerifyEmailRequest(
    @field:NotBlank(message = "Falta el token del enlace de verificación")
    val token: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class ResendVerificationRequest(
    @field:Email(message = "Debes proporcionar un correo electrónico válido")
    @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcionar un correo electrónico válido")
    val email: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class ChangePasswordRequest(
    @field:NotBlank(message = "Debes escribir tu contraseña actual")
    val currentPassword: String,
    @field:StrongPassword(message = "Tu contraseña debe contener al menos 8 caracteres, una mayúscula, una minúscula y un caracter especial")
    val newPassword: String,
)

@JsonIgnoreProperties(ignoreUnknown = true)
data class ChangeEmailRequest(
    @field:Email(message = "Debes proporcionar un correo electrónico válido")
    @field:Pattern(regexp = Patterns.EMAIL_PATTERN, message = "Debes proporcionar un correo electrónico válido")
    val email: String,
    @field:NotBlank(message = "Debes escribir tu contraseña para confirmar el cambio")
    val password: String,
)
