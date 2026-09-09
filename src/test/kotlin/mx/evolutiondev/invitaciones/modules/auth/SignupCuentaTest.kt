package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.error.exception.DuplicatedEmailException
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AmbitoIntentos
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.product.account.EmailVerificationService
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
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

    // ---------------------------------------------------------------------------------------
    // R1-01 · el alta pública NO reactiva cuentas deshabilitadas
    // ---------------------------------------------------------------------------------------

    /** La cuenta que el atacante quiere robar: dada de baja, con su contraseña y su rastro. */
    private fun cuentaDeshabilitada() = CustomerEntity(
        id = 77,
        name = "Ana",
        lastName = "Ruiz",
        email = "ana@ejemplo.mx",
        password = encoder.encode("LaDeAna2024!"),
        role = Role.USER,
    ).apply {
        isEnabled = false
        deletedBy = 3L
        emailVerified = true
    }

    @Test
    @DisplayName("R1-01: el alta publica NO reactiva una cuenta deshabilitada ni le cambia la contrasena")
    fun elAltaPublicaNoReactivaNiCambiaLaContrasena() {
        val victima = cuentaDeshabilitada()
        whenever(repositorio.findByEmailEvenIfDisabled("ana@ejemplo.mx")).thenReturn(victima)
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-de-alta")

        // El atacante sólo sabe el correo y propone la contraseña que quiere.
        assertFailsWith<DuplicatedEmailException> {
            servicio.signUp(alta("ana@ejemplo.mx").copy(password = "DelAtacante1!"))
        }

        // Nada de la cuenta se movió...
        assertFalse(victima.isEnabled, "la cuenta sigue deshabilitada")
        assertEquals(3L, victima.deletedBy, "el rastro de la baja sigue ahí")
        assertTrue(
            encoder.matches("LaDeAna2024!", victima.password),
            "la contrasena de Ana tiene que seguir siendo la suya",
        )
        assertFalse(
            encoder.matches("DelAtacante1!", victima.password),
            "la contrasena del atacante NO puede haber quedado escrita",
        )
        // ...ni se escribió, ni se acuñó token, ni salió correo.
        verify(repositorio, never()).save(any<CustomerEntity>())
        verify(jwtUtil, never()).generateSecureToken()
    }

    @Test
    @DisplayName("R1-01: una cuenta deshabilitada responde EXACTAMENTE igual que una viva")
    fun laCuentaDeshabilitadaRespondeExactamenteIgualQueUnaViva() {
        val viva = CustomerEntity(id = 5, email = "ana@ejemplo.mx", password = encoder.encode("x"))
        whenever(repositorio.findByEmailEvenIfDisabled("ana@ejemplo.mx")).thenReturn(viva)
        val deUnaViva = assertFailsWith<DuplicatedEmailException> { servicio.signUp(alta("ana@ejemplo.mx")) }

        limitador.registrarExito(AmbitoIntentos.REGISTRO, "ana@ejemplo.mx")

        whenever(repositorio.findByEmailEvenIfDisabled("ana@ejemplo.mx")).thenReturn(cuentaDeshabilitada())
        val deUnaMuerta = assertFailsWith<DuplicatedEmailException> { servicio.signUp(alta("ana@ejemplo.mx")) }

        assertEquals(deUnaViva::class, deUnaMuerta::class, "el tipo de error tiene que ser el mismo")
        assertEquals(deUnaViva.message, deUnaMuerta.message, "el texto tiene que ser el mismo, letra por letra")
    }

    // ---------------------------------------------------------------------------------------
    // R2-02 · `/auth/signup` ya no es un amplificador de cuentas ni de correo
    // ---------------------------------------------------------------------------------------

    /** Un alta correcta, con su propio limitador y su propio servicio, para no gastar los de arriba. */
    private fun servicioConLimitador(
        limitadorPropio: AuthThrottleService,
        verificacion: EmailVerificationService = this.verificacion,
    ) = CustomerService(
        customerRepository = repositorio,
        passwordEncoder = encoder,
        hierarchyValidationService = mock<HierarchyValidationService>(),
        emailService = emailService,
        authThrottleService = limitadorPropio,
        emailVerificationService = verificacion,
        mailProperties = ProductMailProperties(),
    )

    /**
     * **R2-02, el hallazgo.** La revisora creó cinco cuentas seguidas desde una IP sin ver un solo
     * `429`, porque cada alta con éxito llamaba a `registrarExito`, que **borra el contador de IP**:
     * el techo no mordía nunca. Ahora el alta con éxito cuenta como cualquier otra petición.
     *
     * Correos distintos a propósito: así el cubo que tiene que frenar no puede ser el de cuenta, que
     * un guion de altas en cadena esquiva rotando la dirección. **Desde R3-01 el que frena es el tope
     * global del ámbito**, no el de IP: sin proxy declarado la IP es la del proxy para todo el mundo,
     * así que ese cubo no distinguía a la clienta del atacante (ver la prueba de abajo). Lo que esta
     * prueba fija es que las altas en cadena **siguen topando**: R2-02 no se reabre.
     */
    @Test
    @DisplayName("R2-02: N altas seguidas con correos distintos acaban en 429 (tope global del ámbito)")
    fun lasAltasSeguidasDesdeUnaIpTopan() {
        repositorioVacio()
        val limitadorPropio = AuthThrottleService(
            passwordEncoder = encoder,
            maxFallosPorCuenta = 5,
            maxFallosPorIp = 20,
            ventanaMinutos = 15,
            maxEntradas = 50_000,
            maxGlobalPorAmbito = 3,
        )
        val servicioPropio = servicioConLimitador(limitadorPropio)

        repeat(3) { i -> servicioPropio.signUp(alta("alta$i@ejemplo.mx")) }

        assertFailsWith<DemasiadosIntentosException> { servicioPropio.signUp(alta("alta3@ejemplo.mx")) }
    }

    /**
     * **R3-01, el hallazgo, contra el alta.** Es la prueba que la revisora reprodujo a mano: veinte
     * peticiones de alta desde una IP y, tras ellas, **otra clienta** que no puede registrarse. La
     * causa era que el cubo por IP contaba aunque nadie hubiera declarado un proxy delante, y sin
     * proxy `remoteAddr` es la dirección del proxy **para todo el mundo**: no era un freno por
     * cliente, era un interruptor de plataforma.
     *
     * Con la configuración por defecto —que es la que corre en cualquier despliegue que no haya
     * declarado su proxy— las veinte altas ya no dejan a nadie fuera.
     */
    @Test
    @DisplayName("R3-01: veinte altas seguidas NO dejan sin registrarse a la clienta siguiente")
    fun veinteAltasNoDejanSinRegistrarseALaSiguiente() {
        repositorioVacio()
        // Por defecto: sin `confiarEnXff`, con los topes reales del producto.
        val limitadorPropio = AuthThrottleService(passwordEncoder = encoder)
        val servicioPropio = servicioConLimitador(limitadorPropio)

        repeat(20) { i -> servicioPropio.signUp(alta("ruidosa$i@ejemplo.mx")) }

        val legitima = servicioPropio.signUp(alta("clienta.legitima@ejemplo.mx"))
        assertEquals("clienta.legitima@ejemplo.mx", legitima.email, "la clienta siguiente tiene que poder registrarse")
    }

    /**
     * **R2-02, la otra mitad.** El alta manda **dos** correos por el mismo canal SMTP que R1-14 vino
     * a proteger, y no pasaba por el presupuesto de envíos. Ahora sí, y cuando se agota el alta
     * sigue funcionando —la cuenta se crea— pero **en silencio**: sin correo y sin `429`, que sería
     * un oráculo nuevo.
     */
    @Test
    @DisplayName("R2-02: agotado el presupuesto de envios, el alta crea la cuenta pero NO manda correo")
    fun elAltaDejaDeMandarCorreoAlAgotarseElPresupuesto() {
        repositorioVacio()
        val verificacionSimulada: EmailVerificationService = mock()
        whenever(verificacionSimulada.prepararVerificacionDeAlta(any())).thenReturn("token-de-alta")
        val limitadorPropio = AuthThrottleService(
            passwordEncoder = encoder,
            maxFallosPorCuenta = 5,
            maxFallosPorIp = 20,
            ventanaMinutos = 15,
            maxEntradas = 50_000,
            // R3-01: el presupuesto que frena un guion de altas con correos distintos ya no es el de
            // IP —que sin proxy declarado no cuenta— sino el global del ámbito.
            maxEnviosGlobales = 2,
        )
        val servicioPropio = servicioConLimitador(limitadorPropio, verificacionSimulada)

        val creadas = (0 until 4).map { i -> servicioPropio.signUp(alta("envio$i@ejemplo.mx")) }

        assertEquals(4, creadas.size, "las cuatro cuentas se crean: el presupuesto no rompe el alta")
        verify(verificacionSimulada, times(2)).enviarCorreoDeVerificacion(any(), any(), any())
    }

    @Test
    @DisplayName("R1-01: el metodo que reactivaba desde el alta publica ya no existe")
    fun elAltaPublicaNoTocaLaCuentaDeshabilitada() {
        // Prueba estructural: mientras `reactivateDisabledUser` siga declarado, alguien lo volverá a
        // llamar desde `signUp`. La reactivación por ADMIN sí sigue viva, con otro nombre y otra ruta.
        val nombres = CustomerService::class.java.declaredMethods.map { it.name }
        assertFalse(
            nombres.any { it.startsWith("reactivateDisabledUser") && !it.contains("ByAdmin") },
            "reactivateDisabledUser tiene que haber desaparecido; quedan: $nombres",
        )
        assertTrue(
            nombres.any { it.contains("reactivateDisabledUserByAdmin") },
            "la reactivacion por ADMIN sigue siendo la unica via de vuelta y tiene que seguir ahi",
        )
    }
}
