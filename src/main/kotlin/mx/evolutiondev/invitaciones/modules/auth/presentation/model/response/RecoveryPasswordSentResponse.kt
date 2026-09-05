package mx.evolutiondev.invitaciones.modules.auth.presentation.model.response

/**
 * Respuesta de `POST /auth/request-password-reset`.
 *
 * N-01 (`ADR-3C-N01-01`): este DTO llevaba también `resetToken`, y el extremo es `permitAll`
 * (`SecurityConfig.kt:37`). Cualquiera podía pedir el token de recuperación de cualquier correo y
 * usarlo acto seguido en `POST /auth/reset-password`: dos peticiones y la cuenta era suya, incluida
 * una MASTER. El token viaja —y siempre viajó— por correo, dentro del `resetUrl` que arma
 * `ResetPasswordService`; devolverlo aquí no le servía a nadie salvo a quien ataca.
 *
 * **Este `data class` no puede volver a tener un campo con el token.** Lo vigila
 * `RequestPasswordResetContractTest`, que afirma sobre el JSON SERIALIZADO, no sobre el tipo.
 */
data class RecoveryPasswordSentResponse(
        val message: String
)
