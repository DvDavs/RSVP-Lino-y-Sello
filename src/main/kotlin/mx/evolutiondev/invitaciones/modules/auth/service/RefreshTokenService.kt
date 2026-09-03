package mx.evolutiondev.invitaciones.modules.auth.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class RefreshTokenService(
        private val refreshTokenRepository: RefreshTokenRepository,
        private val jwtUtil: JwtUtil
) {
    private val refreshTokenValidityMillis: Long = 7 * 24 * 60 * 60 * 1000 // 1 week

    fun createOrUpdateRefreshToken(customer: CustomerEntity): RefreshTokenEntity {
        val existingToken = refreshTokenRepository.findByCustomer(customer)

        existingToken?.let { currentToken ->
            refreshTokenRepository.delete(currentToken)
        }

        val expiryDate = Instant.now().plusMillis(refreshTokenValidityMillis)
        val token = jwtUtil.generateSecureToken()

        val refreshToken = RefreshTokenEntity(
                token = token,
                expiryDate = expiryDate,
                customer = customer
        )

        return refreshTokenRepository.save(refreshToken)
    }

    fun validateRefreshToken(token: String): RefreshTokenEntity {
        val refreshToken = refreshTokenRepository.findByToken(token)
                ?: throw IllegalArgumentException("El token de refresco no es válido")

        if (refreshToken.expiryDate.isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken)
            throw IllegalArgumentException("El token de refresco ha expirado")
        }

        val customer = refreshToken.customer
        if (!customer.isEnabled) {
            refreshTokenRepository.delete(refreshToken)
            throw UnauthorizedException("Las credenciales no coinciden con nuestros registros")
        }
        if (customer.isBanned) {
            refreshTokenRepository.delete(refreshToken)
            throw UserBannedException("Su cuenta ha sido bloqueada. Contacte al administrador.")
        }

        return refreshToken
    }
}
