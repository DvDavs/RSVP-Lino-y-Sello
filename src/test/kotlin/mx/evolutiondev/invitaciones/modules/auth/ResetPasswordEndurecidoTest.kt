package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.UpdatePasswordResetRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import mx.evolutiondev.invitaciones.modules.auth.service.ResetPasswordService
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import java.time.Instant

/**
 * `POST /auth/reset-password` endurecido (`12-producto-completo.md §A2.1`, `ADR-5-E3-01`).
 *
 * Los dos huecos que se cierran, uno por prueba:
 *
 *  a. **No tenía límite de intentos**, a diferencia de sus dos hermanos de `/auth/`.
 *  b. **No invalidaba los tokens de refresco vivos**: quien tuviera uno robado seguía dentro después
 *     del gesto que se hace justo para echarlo.
 */
class ResetPasswordEndurecidoTest {

    private val encoder = BCryptPasswordEncoder()
    private val jwtUtil: JwtUtil = mock()
    private val repositorio: CustomerRepository = mock()
    private val emailService: EmailService = mock()
    private val refreshTokens: RefreshTokenRepository = mock()
    private val limitador = AuthThrottleService(
        passwordEncoder = encoder,
        maxFallosPorCuenta = 5,
        maxFallosPorIp = 20,
        ventanaMinutos = 15,
        maxEntradas = 50_000,
    )

    private val servicio = ResetPasswordService(
        customerRepository = repositorio,
        passwordEncoder = encoder,
        jwtUtil = jwtUtil,
        emailService = emailService,
        authThrottleService = limitador,
        refreshTokenRepository = refreshTokens,
        frontendUrl = "https://linoysello.example",
    )

    private fun cliente(token: String, vive: Boolean = true) = CustomerEntity(
        id = 11,
        name = "Ana",
        lastName = "Ruiz",
        email = "ana@ejemplo.mx",
        password = encoder.encode("Vieja1234!"),
        role = Role.USER,
        resetToken = token,
        resetTokenExpiry = if (vive) Instant.now().plusSeconds(600) else Instant.now().minusSeconds(600),
    )

    @Test
    @DisplayName("al cambiar la contrasena se borran TODOS los tokens de refresco de la cuenta")
    fun revocaLasSesiones() {
        val cuenta = cliente("token-bueno")
        whenever(repositorio.findByResetToken("token-bueno")).thenReturn(cuenta)
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }

        val anterior = cuenta.password
        servicio.resetPassword(UpdatePasswordResetRequest("token-bueno", "Nueva1234!"))

        verify(refreshTokens).deleteAllByCustomerId(eq(11L))
        assertNotEquals(anterior, cuenta.password, "la contraseña tiene que haber cambiado")
        assertNull(cuenta.resetToken, "el token de recuperación se consume")
    }

    @Test
    @DisplayName("con token invalido no se toca ninguna sesion y el intento cuenta contra el limite")
    fun elTokenInvalidoCuenta() {
        whenever(repositorio.findByResetToken(any())).thenReturn(null)

        assertFailsWith<IllegalArgumentException> {
            servicio.resetPassword(UpdatePasswordResetRequest("token-inventado", "Nueva1234!"))
        }
        verify(refreshTokens, never()).deleteAllByCustomerId(any())
    }

    @Test
    @DisplayName("el sexto intento seguido con el mismo token responde 429")
    fun sextoIntentoEs429() {
        whenever(repositorio.findByResetToken(any())).thenReturn(null)

        repeat(5) {
            assertFailsWith<IllegalArgumentException> {
                servicio.resetPassword(UpdatePasswordResetRequest("token-inventado", "Nueva1234!"))
            }
        }

        // El sexto ya no llega al repositorio: el límite responde antes de consultar nada.
        assertFailsWith<DemasiadosIntentosException> {
            servicio.resetPassword(UpdatePasswordResetRequest("token-inventado", "Nueva1234!"))
        }
    }

    @Test
    @DisplayName("un token caducado no cambia la contrasena ni revoca sesiones")
    fun elCaducadoNoPasa() {
        val cuenta = cliente("token-viejo", vive = false)
        whenever(repositorio.findByResetToken("token-viejo")).thenReturn(cuenta)

        assertFailsWith<IllegalArgumentException> {
            servicio.resetPassword(UpdatePasswordResetRequest("token-viejo", "Nueva1234!"))
        }
        verify(refreshTokens, never()).deleteAllByCustomerId(any())
        verify(repositorio, never()).save(any<CustomerEntity>())
    }
}
