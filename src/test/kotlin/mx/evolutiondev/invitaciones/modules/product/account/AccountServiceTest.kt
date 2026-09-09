package mx.evolutiondev.invitaciones.modules.product.account

import java.util.Optional
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder

/**
 * Cuenta propia: cierre de sesión global, cambio de contraseña con la actual y petición de cambio de
 * correo (fase 5, E3; `12-producto-completo.md §A2.1`, `ADR-5-E3-03`).
 *
 * Lo que vigila, en el orden del encargo: **sin la contraseña actual se rechaza**; **con ella, las
 * sesiones abiertas se invalidan**; el logout borra los tokens de refresco; y la petición de cambio de
 * correo **no revela** si la dirección estaba tomada.
 */
class AccountServiceTest {

    private val encoder = BCryptPasswordEncoder()
    private val repositorio: CustomerRepository = mock()
    private val refreshTokens: RefreshTokenRepository = mock()
    private val emailService: EmailService = mock()
    private val verificacion: EmailVerificationService = mock()
    private val jwtUtil: JwtUtil = mock()
    private val limitador = AuthThrottleService(
        passwordEncoder = encoder,
        maxFallosPorCuenta = 5,
        maxFallosPorIp = 20,
        ventanaMinutos = 15,
        maxEntradas = 50_000,
    )

    private val servicio = AccountService(
        customerRepository = repositorio,
        refreshTokenRepository = refreshTokens,
        passwordEncoder = encoder,
        authThrottleService = limitador,
        emailService = emailService,
        emailVerificationService = verificacion,
        jwtUtil = jwtUtil,
        mailProperties = ProductMailProperties(),
        contactProperties = ProductContactProperties(soporte = "soporte@linoysello.com"),
        horasDeValidez = 24,
    )

    private val cliente = CustomerEntity(
        id = 5,
        name = "Ana",
        lastName = "Ruiz",
        email = "ana@ejemplo.mx",
        password = encoder.encode("Vieja1234!"),
        role = Role.USER,
    )

    private fun cuentaEncontrada() {
        whenever(repositorio.findById(5L)).thenReturn(Optional.of(cliente))
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }
    }

    // --- logout ----------------------------------------------------------------------------------

    @Test
    @DisplayName("el logout borra todos los tokens de refresco de quien llama")
    fun logoutGlobal() {
        val respuesta = servicio.cerrarSesion(5L)

        verify(refreshTokens).deleteAllByCustomerId(5L)
        assertEquals(AccountService.MENSAJE_SESION_CERRADA, respuesta.message)
    }

    // --- contraseña ------------------------------------------------------------------------------

    @Test
    @DisplayName("sin la contrasena actual correcta se rechaza y NO se cambia nada")
    fun sinLaActualNoHayCambio() {
        cuentaEncontrada()
        val anterior = cliente.password

        val error = assertFailsWith<AccountException> {
            servicio.cambiarPassword(5L, actual = "MeLaInvento1!", nueva = "Nueva1234!")
        }

        assertEquals(AccountErrorCode.CUENTA_PASSWORD_INCORRECTA, error.code)
        assertEquals(anterior, cliente.password)
        verify(refreshTokens, never()).deleteAllByCustomerId(any())
        verify(repositorio, never()).save(any<CustomerEntity>())
    }

    @Test
    @DisplayName("con la contrasena actual se cambia Y se invalidan las sesiones abiertas")
    fun conLaActualSeCambiaYSeCierraSesion() {
        cuentaEncontrada()

        val respuesta = servicio.cambiarPassword(5L, actual = "Vieja1234!", nueva = "Nueva1234!")

        assertTrue(encoder.matches("Nueva1234!", cliente.password), "la contraseña nueva queda guardada")
        verify(refreshTokens).deleteAllByCustomerId(5L)
        assertEquals(AccountService.MENSAJE_PASSWORD_CAMBIADA, respuesta.message)
    }

    @Test
    @DisplayName("el sexto intento con la contrasena actual equivocada responde 429")
    fun elCambioTieneLimite() {
        cuentaEncontrada()

        repeat(5) {
            assertFailsWith<AccountException> {
                servicio.cambiarPassword(5L, actual = "MeLaInvento1!", nueva = "Nueva1234!")
            }
        }

        assertFailsWith<DemasiadosIntentosException> {
            servicio.cambiarPassword(5L, actual = "MeLaInvento1!", nueva = "Nueva1234!")
        }
    }

    // --- cambio de correo ------------------------------------------------------------------------

    @Test
    @DisplayName("el cambio de correo guarda el pendiente y NO cambia el correo de acceso")
    fun elCambioDejaElCorreoPendiente() {
        cuentaEncontrada()
        whenever(repositorio.findByEmailEvenIfDisabled("nueva@ejemplo.mx")).thenReturn(null)
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-de-cambio")

        val respuesta = servicio.pedirCambioDeCorreo(5L, "nueva@ejemplo.mx", "Vieja1234!")

        assertEquals("nueva@ejemplo.mx", cliente.emailPending)
        assertEquals("ana@ejemplo.mx", cliente.email, "el correo de acceso NO cambia hasta confirmar")
        assertEquals("token-de-cambio", cliente.emailVerificationToken)
        assertEquals(AccountService.MENSAJE_CAMBIO_DE_CORREO, respuesta.message)
        verify(verificacion).enviarCorreoDeVerificacion("Ana", "nueva@ejemplo.mx", "token-de-cambio")
    }

    @Test
    @DisplayName("si el correo esta tomado la respuesta es la MISMA: no dice si existe (ni con una cuenta deshabilitada)")
    fun elCorreoTomadoNoSeDelata() {
        cuentaEncontrada()
        val ajena = cliente.copy(id = 90, email = "ocupada@ejemplo.mx", isEnabled = false)
        whenever(repositorio.findByEmailEvenIfDisabled("ocupada@ejemplo.mx")).thenReturn(ajena)

        val respuesta = servicio.pedirCambioDeCorreo(5L, "ocupada@ejemplo.mx", "Vieja1234!")

        assertEquals(AccountService.MENSAJE_CAMBIO_DE_CORREO, respuesta.message)
        assertNull(cliente.emailPending, "no se guarda un pendiente que reventaría contra el índice único")
        verify(verificacion, never()).enviarCorreoDeVerificacion(any(), any(), any())
    }

    @Test
    @DisplayName("el cambio de correo tambien exige la contrasena")
    fun elCambioExigeLaPassword() {
        cuentaEncontrada()

        val error = assertFailsWith<AccountException> {
            servicio.pedirCambioDeCorreo(5L, "nueva@ejemplo.mx", "MeLaInvento1!")
        }

        assertEquals(AccountErrorCode.CUENTA_PASSWORD_INCORRECTA, error.code)
        assertNull(cliente.emailPending)
    }
}
