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

    /**
     * Canje del token de refresco **con rotación** (`12-producto-completo.md §A2.1`, `ADR-5-E3-01`).
     *
     * Antes, `POST /auth/token/refresh` validaba el token y devolvía **el mismo**
     * (`AuthController.kt:44-49`): un token robado servía los siete días completos
     * ([refreshTokenValidityMillis]) y el uso legítimo no lo delataba en ningún momento. Ahora cada
     * canje quema el token usado y emite uno nuevo, así que:
     *
     * - el token robado deja de valer en cuanto la persona legítima refresca, y
     * - el segundo canje del mismo token falla, que es la señal de que hubo copia.
     *
     * El contrato de la respuesta **no cambia**: mismos campos, con un `refreshToken` distinto.
     * El borrado y el alta van en dos transacciones distintas (cada método del repositorio abre la
     * suya), así que no hay riesgo de que Hibernate ordene el `insert` antes del `delete`; aun así
     * `refresh_tokens` solo tiene índice único por `token` (`V1__initial_schema.sql:1611`), nunca por
     * cuenta, de modo que un solapamiento tampoco chocaría.
     */
    fun rotateRefreshToken(token: String): RefreshTokenEntity {
        val actual = validateRefreshToken(token)
        val customer = actual.customer
        refreshTokenRepository.delete(actual)

        val nuevo = RefreshTokenEntity(
                token = jwtUtil.generateSecureToken(),
                expiryDate = Instant.now().plusMillis(refreshTokenValidityMillis),
                customer = customer
        )
        return refreshTokenRepository.save(nuevo)
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
