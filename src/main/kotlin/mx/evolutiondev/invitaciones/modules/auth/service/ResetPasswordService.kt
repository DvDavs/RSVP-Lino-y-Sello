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

@Service
class ResetPasswordService(
        private val customerRepository: CustomerRepository,
        private val passwordEncoder: PasswordEncoder,
        private val jwtUtil: JwtUtil,
        private val emailService: EmailService,
        @Value("\${app.frontend.url}") private val frontendUrl: String
) {
    private val resetTokenValidityMillis: Long = 15 * 60 * 1000 // 15 minutes validity

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun generateResetToken(withEmail: String) : RecoveryPasswordSentResponse {
        val customer = customerRepository.findByEmail(withEmail)
                ?: throw IllegalArgumentException("No existe un usuario con el email proporcionado")

        val resetToken = jwtUtil.generateSecureToken()
        val expiryDate = Instant.now().plusMillis(resetTokenValidityMillis)

        customer.resetToken = resetToken
        customer.resetTokenExpiry = expiryDate
        val customerWithToken = customerRepository.save(customer)

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

        return RecoveryPasswordSentResponse(
                message = "Se ha enviado un correo de recuperación a tu cuenta",
                resetToken = customerWithToken.resetToken.orEmpty()
        )
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