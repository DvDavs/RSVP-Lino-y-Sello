package mx.evolutiondev.invitaciones.modules.auth.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.UpdatePasswordResetRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.RecoveryPasswordSentResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import java.time.Instant

/**
 * N-01 (`ADR-3C-N01-01`). `POST /auth/request-password-reset` tenía tres defectos encadenados y los
 * tres se corrigen aquí:
 *
 * 1. **Devolvía el `resetToken` en el cuerpo**, sin autenticar y para cualquier correo. Con él,
 *    `POST /auth/reset-password` cambia la contraseña: dos peticiones y la cuenta es de quien las
 *    hace, incluida una MASTER. Reproducido contra el backend real en
 *    `evidencia/fase-3c/bloque-menos1/n01-antes-despues.txt`. El token ya viajaba por correo dentro
 *    del `resetUrl`, así que devolverlo no le servía a nadie salvo a quien ataca. Ahora la respuesta
 *    lleva **sólo** el mensaje.
 * 2. **Enumeraba cuentas**: `400` si el correo no existía, `200` si existía. Ahora responde siempre
 *    `200` con el mismo cuerpo.
 * 3. **No pasaba por ningún límite de intentos.** Ahora sí, en su propio ámbito
 *    (`AmbitoIntentos.RECUPERACION`), para que agotar la recuperación no cierre el acceso.
 */
@Service
class ResetPasswordService(
        private val customerRepository: CustomerRepository,
        private val passwordEncoder: PasswordEncoder,
        private val jwtUtil: JwtUtil,
        private val emailService: EmailService,
        private val authThrottleService: AuthThrottleService,
        @Value("\${app.frontend.url}") private val frontendUrl: String
) {
    private val resetTokenValidityMillis: Long = 15 * 60 * 1000 // 15 minutes validity

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        /**
         * Respuesta ÚNICA del extremo, exista o no la cuenta. Está redactada para ser cierta en los
         * dos casos: no afirma que se haya enviado nada «a tu cuenta», porque puede que no exista
         * ninguna. Cualquier variante por caso volvería a enumerar.
         */
        const val MENSAJE_RECUPERACION: String =
                "Si el correo corresponde a una cuenta, te enviamos un enlace para restablecer la contraseña"
    }

    fun generateResetToken(withEmail: String) : RecoveryPasswordSentResponse {
        // Antes de tocar la base: el 429 cuesta lo mismo exista o no la cuenta.
        authThrottleService.comprobar(AmbitoIntentos.RECUPERACION, withEmail)

        val customer = customerRepository.findByEmail(withEmail)

        // El token se acuña SIEMPRE, haya cuenta o no. Cuando no la hay se descarta sin guardarlo ni
        // enviarlo: es trabajo tirado a propósito, para que el camino «no existe» no salga gratis y
        // deje un oráculo de temporización tan claro como el `400` que acabamos de quitar.
        // Honestidad sobre su alcance: iguala la ACUÑACIÓN del token, no la escritura en la base que
        // sólo ocurre cuando la cuenta existe. Queda una diferencia residual —mucho menor que un
        // cambio de código de estado— anotada en `preguntas-abiertas.md`.
        val resetToken = jwtUtil.generateSecureToken()
        val expiryDate = Instant.now().plusMillis(resetTokenValidityMillis)

        if (customer != null) {
            customer.resetToken = resetToken
            customer.resetTokenExpiry = expiryDate
            customerRepository.save(customer)

            coroutineScope.launch {
                emailService.sendEmail(
                    to = withEmail,
                    templateName = "password-reset",
                    variables = mapOf(
                        "customerName" to customer.name,
                        "resetUrl" to "$frontendUrl/login/reset-password/ChangePass?token=$resetToken"
                    )
                )
            }
        }

        // Cuenta SIEMPRE, con o sin cuenta detrás: aquí no hay un «éxito» observable que distinguir,
        // y si sólo contaran los correos inexistentes el límite se esquivaría pidiendo el de una
        // cuenta real.
        authThrottleService.registrarIntento(AmbitoIntentos.RECUPERACION, withEmail)

        return RecoveryPasswordSentResponse(message = MENSAJE_RECUPERACION)
    }

    fun resetPassword(withRequest: UpdatePasswordResetRequest) : GeneralMessageResponse {
        val customer = customerRepository.findByResetToken(withRequest.resetToken)
                ?: throw IllegalArgumentException("El token proporcionado es inválido o ha expirado")

        if (customer.resetTokenExpiry?.isBefore(Instant.now()) == true) {
            throw IllegalArgumentException("El token proporcionado ha expirado")
        }

        customer.password = passwordEncoder.encode(withRequest.newPassword)
        customer.resetToken = null
        customer.resetTokenExpiry = null
        customerRepository.save(customer)

        return GeneralMessageResponse(
                message = "La contraseña se actualizo correctamente"
        )
    }

}