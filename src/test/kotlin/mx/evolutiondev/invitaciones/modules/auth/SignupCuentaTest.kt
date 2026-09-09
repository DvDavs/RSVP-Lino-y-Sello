package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.product.account.EmailVerificationService
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder

/**
 * `POST /auth/signup` endurecido (`12-producto-completo.md §A2.1`, `ADR-5-E3-02` y `ADR-5-E3-05`).
 *
 * Dos cosas y ninguna más:
 *
 *  a. La cuenta nace **sin verificar** y con su token acuñado, **sin que el acceso se bloquee**: el
 *     alta sigue devolviendo la cuenta y quien se registra entra igual que antes.
 *  b. Un teléfono que ya está en otra cuenta **ya no rompe el alta**. Antes respondía «este número no
 *     se encuentra disponible», que le decía a cualquiera —sin autenticarse— si un número tenía cuenta.
 */
class SignupCuentaTest {

    private val encoder = BCryptPasswordEncoder()
    private val repositorio: CustomerRepository = mock()
    private val refreshTokens: RefreshTokenRepository = mock()
    private val emailService: EmailService = mock()
    private val jwtUtil: JwtUtil = mock()
    private val limitador = AuthThrottleService(
        passwordEncoder = encoder,
        maxFallosPorCuenta = 5,
        maxFallosPorIp = 20,
        ventanaMinutos = 15,
        maxEntradas = 50_000,
    )

    private val verificacion = EmailVerificationService(
        customerRepository = repositorio,
        refreshTokenRepository = refreshTokens,
        emailService = emailService,
        authThrottleService = limitador,
        jwtUtil = jwtUtil,
        mailProperties = ProductMailProperties(),
        frontendUrl = "https://linoysello.example",
        horasDeValidez = 24,
    )

    private val servicio = CustomerService(
        customerRepository = repositorio,
        passwordEncoder = encoder,
        hierarchyValidationService = mock<HierarchyValidationService>(),
        emailService = emailService,
        authThrottleService = limitador,
        emailVerificationService = verificacion,
        mailProperties = ProductMailProperties(),
    )

    private fun alta(email: String, telefono: String? = null) = UserRequest(
        name = "Ana",
        lastName = "Ruiz",
        email = email,
        phone = telefono,
        birthdate = null,
        address = null,
        city = null,
        postalCode = null,
        state = null,
        howKnow = null,
        password = "Demo1234!",
    )

    private fun repositorioVacio() {
        whenever(repositorio.findByEmailEvenIfDisabled(any())).thenReturn(null)
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-de-alta")
    }

    @Test
    @DisplayName("la cuenta nueva nace SIN verificar, con token, y el alta sigue funcionando")
    fun naceSinVerificar() {
        repositorioVacio()

        val creada = servicio.signUp(alta("ana@ejemplo.mx"))

        assertFalse(creada.emailVerified, "la cuenta nueva nace sin verificar")
        assertEquals("token-de-alta", creada.emailVerificationToken)
        assertNotNull(creada.emailVerificationExpiry)
        assertEquals("ana@ejemplo.mx", creada.email)
        assertEquals(Role.USER, creada.role)
    }

    @Test
    @DisplayName("un telefono que ya esta en otra cuenta NO impide el alta: se acabo el oraculo")
    fun elTelefonoRepetidoNoDelata() {
        repositorioVacio()
        // Así estaba el mundo cuando el alta gritaba «ese número ya existe».
        whenever(repositorio.existsByPhoneEvenIfDisabled(any())).thenReturn(true)
        whenever(repositorio.findByPhone(any())).thenReturn(
            CustomerEntity(id = 99, email = "otra@ejemplo.mx", phone = "+525512345678"),
        )

        val creada = servicio.signUp(alta("ana@ejemplo.mx", telefono = "+525512345678"))

        assertEquals("+525512345678", creada.phone)
        assertFalse(creada.emailVerified)
    }

    @Test
    @DisplayName("el mensaje del telefono dice el formato COMPLETO, con prefijo y ejemplo")
    fun elMensajeDelTelefonoEsUtil() {
        // El patrón exige `+52` (`Patterns.kt:56`) y el mensaje viejo hablaba solo de «10 dígitos».
        val mensaje = Patterns.PHONE_NUMBER_MESSAGE
        assert(mensaje.contains("+52")) { "el mensaje tiene que nombrar el prefijo: $mensaje" }
        assert(mensaje.contains("+525512345678")) { "el mensaje tiene que traer un ejemplo: $mensaje" }
        assert(Regex(Patterns.PHONE_NUMBER_PATTERN).matches("+525512345678")) {
            "el ejemplo del mensaje tiene que casar con el patrón real"
        }
    }
}
