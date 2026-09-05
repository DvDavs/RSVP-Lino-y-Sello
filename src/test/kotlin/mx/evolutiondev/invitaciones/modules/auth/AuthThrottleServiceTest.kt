package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedException
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.AuthRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AmbitoIntentos
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes

/**
 * I-02 (H-ADV-05): límite de intentos y hash señuelo de `POST /auth/token`.
 *
 * Pruebas de unidad puras (sin contexto de Spring, sin base de datos): el reloj del limitador se
 * inyecta para poder cruzar la ventana de 15 minutos sin dormir. La medida del oráculo de
 * temporización **no** se hace aquí —una prueba de tiempos en CI es inestable por definición— sino
 * contra el backend real, con 30 muestras por caso; la salida literal está en
 * `docs/rediseno-plantillas/memoria/bitacora/3b-i02.md`.
 */
class AuthThrottleServiceTest {

    private val encoder = BCryptPasswordEncoder()

    private fun limitador(): AuthThrottleService = AuthThrottleService(
            passwordEncoder = encoder,
            maxFallosPorCuenta = 5,
            maxFallosPorIp = 20,
            ventanaMinutos = 15,
            maxEntradas = 50_000
    )

    private fun cliente(email: String, password: String): CustomerEntity = CustomerEntity(
            name = "Demo",
            lastName = "Boda",
            email = email,
            password = encoder.encode(password),
            role = Role.USER,
            createdBy = null,
            birthdate = null,
            phone = null,
            address = null,
            postalCode = null,
            city = null,
            state = null,
            howKnow = null
    )

    private fun servicio(
            repositorio: CustomerRepository,
            limitador: AuthThrottleService
    ): CustomerService = CustomerService(
            customerRepository = repositorio,
            passwordEncoder = encoder,
            hierarchyValidationService = mock<HierarchyValidationService>(),
            emailService = mock<EmailService>(),
            authThrottleService = limitador
    )

    // =============================================================================================
    // (a) Límite de intentos
    // =============================================================================================

    @Test
    @DisplayName("el sexto intento fallido seguido responde 429 y ya no consulta el repositorio")
    fun sextoIntentoEs429() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("victima@example.com")).thenReturn(null)
        val limitador = limitador()
        val servicio = servicio(repositorio, limitador)
        val peticion = AuthRequest("victima@example.com", "ContrasenaIncorrecta1!")

        repeat(5) { i ->
            assertFailsWith<UnauthorizedException>("el intento ${i + 1} debía ser 401") {
                servicio.validateUser(peticion)
            }
        }
        assertFailsWith<DemasiadosIntentosException> { servicio.validateUser(peticion) }

        // El 429 se decide antes de tocar la base de datos: exactamente 5 consultas, no 6.
        verify(repositorio, org.mockito.kotlin.times(5)).findByEmailEvenIfDisabled("victima@example.com")
    }

    @Test
    @DisplayName("la cuenta bloqueada se desbloquea al caducar la ventana de 15 minutos")
    fun laVentanaCaduca() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("victima@example.com")).thenReturn(null)
        val limitador = limitador()
        var ahora = 1_000_000L
        limitador.reloj = { ahora }
        val servicio = servicio(repositorio, limitador)
        val peticion = AuthRequest("victima@example.com", "ContrasenaIncorrecta1!")

        repeat(5) { assertFailsWith<UnauthorizedException> { servicio.validateUser(peticion) } }
        assertFailsWith<DemasiadosIntentosException> { servicio.validateUser(peticion) }

        ahora += 15 * 60_000L + 1
        assertFailsWith<UnauthorizedException> { servicio.validateUser(peticion) }
    }

    @Test
    @DisplayName("un acceso correcto limpia el contador: el usuario legítimo no queda bloqueado")
    fun elExitoLimpiaElContador() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("demo@example.com")).thenReturn(cliente("demo@example.com", "Demo1234!"))
        val limitador = limitador()
        val servicio = servicio(repositorio, limitador)
        val mala = AuthRequest("demo@example.com", "ContrasenaIncorrecta1!")
        val buena = AuthRequest("demo@example.com", "Demo1234!")

        repeat(4) { assertFailsWith<UnauthorizedException> { servicio.validateUser(mala) } }
        assertEquals("demo@example.com", servicio.validateUser(buena).email)

        // Tras el acceso correcto vuelve a haber cinco oportunidades, no una.
        repeat(5) { assertFailsWith<UnauthorizedException> { servicio.validateUser(mala) } }
        assertFailsWith<DemasiadosIntentosException> { servicio.validateUser(mala) }
    }

    @Test
    @DisplayName("cambiar la caja del correo no esquiva el contador")
    fun laClaveDeCuentaSeNormaliza() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled(org.mockito.kotlin.any())).thenReturn(null)
        val limitador = limitador()
        val servicio = servicio(repositorio, limitador)

        repeat(5) { assertFailsWith<UnauthorizedException> { servicio.validateUser(AuthRequest("victima@example.com", "ContrasenaIncorrecta1!")) } }
        assertFailsWith<DemasiadosIntentosException> {
            servicio.validateUser(AuthRequest("  VICTIMA@Example.COM ", "ContrasenaIncorrecta1!"))
        }
    }

    @Test
    @DisplayName("el 429 no distingue si la cuenta existe: mismo tipo y mismo mensaje")
    fun el429NoFiltraSiLaCuentaExiste() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("existe@example.com")).thenReturn(cliente("existe@example.com", "Demo1234!"))
        whenever(repositorio.findByEmailEvenIfDisabled("no.existe@example.com")).thenReturn(null)
        val limitador = limitador()
        val servicio = servicio(repositorio, limitador)

        repeat(5) { assertFailsWith<UnauthorizedException> { servicio.validateUser(AuthRequest("existe@example.com", "ContrasenaIncorrecta1!")) } }
        repeat(5) { assertFailsWith<UnauthorizedException> { servicio.validateUser(AuthRequest("no.existe@example.com", "ContrasenaIncorrecta1!")) } }

        val bloqueoExistente = assertFailsWith<DemasiadosIntentosException> {
            servicio.validateUser(AuthRequest("existe@example.com", "ContrasenaIncorrecta1!"))
        }
        val bloqueoInexistente = assertFailsWith<DemasiadosIntentosException> {
            servicio.validateUser(AuthRequest("no.existe@example.com", "ContrasenaIncorrecta1!"))
        }
        assertEquals(bloqueoExistente.message, bloqueoInexistente.message)
    }

    @Test
    @DisplayName("el bloqueo por IP corta la pulverización sobre muchas cuentas distintas")
    fun elLimitePorIpCortaLaPulverizacion() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled(org.mockito.kotlin.any())).thenReturn(null)
        val limitador = limitador()
        val servicio = servicio(repositorio, limitador)

        // 20 correos distintos: ninguno llega a 5 fallos, pero la IP sí llega a 20.
        repeat(20) { i ->
            assertFailsWith<UnauthorizedException> { servicio.validateUser(AuthRequest("cuenta$i@example.com", "ContrasenaIncorrecta1!")) }
        }
        assertFailsWith<DemasiadosIntentosException> {
            servicio.validateUser(AuthRequest("cuenta999@example.com", "ContrasenaIncorrecta1!"))
        }
    }

    // =============================================================================================
    // (b) Hash señuelo
    // =============================================================================================

    @Test
    @DisplayName("el camino «el correo no existe» ejecuta un bcrypt contra el hash señuelo")
    fun elCorreoInexistenteGastaBcrypt() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("no.existe@example.com")).thenReturn(null)
        val limitador = mock<AuthThrottleService>()
        val servicio = servicio(repositorio, limitador)

        assertFailsWith<UnauthorizedException> {
            servicio.validateUser(AuthRequest("no.existe@example.com", "ContrasenaIncorrecta1!"))
        }
        verify(limitador).gastarHashSenuelo("ContrasenaIncorrecta1!")
        verify(limitador).registrarFallo("no.existe@example.com")
        verify(limitador, never()).registrarExito(org.mockito.kotlin.any())
    }

    @Test
    @DisplayName("el hash señuelo es un bcrypt válido, del mismo coste, y jamás casa")
    fun elHashSenueloEsValido() {
        val limitador = limitador()
        assertTrue(limitador.hashSenuelo.startsWith("\$2a\$10\$"), "coste distinto al de las contraseñas reales: ${limitador.hashSenuelo}")
        assertFalse(limitador.gastarHashSenuelo("ContrasenaIncorrecta1!"))
        assertFalse(limitador.gastarHashSenuelo("Demo1234!"))
        assertFalse(limitador.gastarHashSenuelo(""))
        // Dos instancias no comparten el señuelo: no hay constante que filtrar.
        assertNotEquals(limitador.hashSenuelo, limitador().hashSenuelo)
    }

    @Test
    @DisplayName("el mensaje del 401 es idéntico existan o no la cuenta y la contraseña")
    fun elMensajeDel401EsIdentico() {
        val repositorio = mock<CustomerRepository>()
        whenever(repositorio.findByEmailEvenIfDisabled("no.existe@example.com")).thenReturn(null)
        whenever(repositorio.findByEmailEvenIfDisabled("existe@example.com")).thenReturn(cliente("existe@example.com", "Demo1234!"))
        val deshabilitado = cliente("apagado@example.com", "Demo1234!").apply { isEnabled = false }
        whenever(repositorio.findByEmailEvenIfDisabled("apagado@example.com")).thenReturn(deshabilitado)
        val servicio = servicio(repositorio, limitador())

        val inexistente = assertFailsWith<UnauthorizedException> {
            servicio.validateUser(AuthRequest("no.existe@example.com", "ContrasenaIncorrecta1!"))
        }
        val existente = assertFailsWith<UnauthorizedException> {
            servicio.validateUser(AuthRequest("existe@example.com", "ContrasenaIncorrecta1!"))
        }
        val apagado = assertFailsWith<UnauthorizedException> {
            servicio.validateUser(AuthRequest("apagado@example.com", "Demo1234!"))
        }
        assertEquals("Las credenciales no coinciden con nuestros registros", inexistente.message)
        assertEquals(inexistente.message, existente.message)
        assertEquals(inexistente.message, apagado.message)
    }

    /**
     * Hallazgo N-03 de la revisión adversarial de la fase 3-B: el límite por IP se saltaba entero
     * rotando `X-Forwarded-For`, una cabecera que pone el CLIENTE. Medido contra el backend real:
     * 25 intentos fallidos con la cabecera rotando dieron 25 `401` y **ningún** `429`; sin rotarla,
     * el `429` llegaba en el 21.º. Con esto, el límite por IP que pidió el dueño no limitaba nada.
     */
    @Test
    @DisplayName("N-03 · rotar X-Forwarded-For NO salta el límite por IP: la cabecera no se cree por defecto")
    fun xffNoSeCree() {
        val peticion = MockHttpServletRequest()
        peticion.remoteAddr = "203.0.113.7"
        RequestContextHolder.setRequestAttributes(ServletRequestAttributes(peticion))
        try {
            val limitador = limitador()
            // Veinte fallos, cada uno afirmando venir de una IP distinta. Antes del arreglo cada uno
            // estrenaba contador; ahora los veinte caen en la dirección real del socket.
            repeat(20) { i ->
                peticion.addHeader("X-Forwarded-For", "198.51.100.$i")
                limitador.registrarFallo("cuenta$i@example.test")
            }
            val bloqueo = assertFailsWith<DemasiadosIntentosException> {
                limitador.comprobar("otra.cuenta@example.test")
            }
            assertEquals("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", bloqueo.message)
        } finally {
            RequestContextHolder.resetRequestAttributes()
        }
    }

    // =============================================================================================
    // (c) Ámbitos — N-01 (`ADR-3C-N01-01`)
    // =============================================================================================

    /**
     * La razón de ser del prefijo de ámbito, dicha como prueba: si los tres extremos compartieran
     * contador, cinco peticiones de recuperación sobre la cuenta de otra persona la dejarían sin
     * poder ENTRAR durante quince minutos. El arreglo de N-01 habría creado una denegación de
     * servicio nueva mientras cerraba la toma de cuenta.
     */
    @Test
    @DisplayName("N-01 · agotar la recuperación NO bloquea el acceso de la misma cuenta")
    fun losAmbitosNoCompartenContador() {
        val limitador = limitador()

        repeat(5) { limitador.registrarIntento(AmbitoIntentos.RECUPERACION, "victima@example.com") }
        assertFailsWith<DemasiadosIntentosException> {
            limitador.comprobar(AmbitoIntentos.RECUPERACION, "victima@example.com")
        }

        // La víctima puede seguir entrando: su contador de ACCESO está intacto.
        limitador.comprobar(AmbitoIntentos.ACCESO, "victima@example.com")
        limitador.comprobar(AmbitoIntentos.REGISTRO, "victima@example.com")
    }

    @Test
    @DisplayName("N-01 · agotar el registro NO bloquea ni el acceso ni la recuperación")
    fun elRegistroNoDerramaEnLosOtrosAmbitos() {
        val limitador = limitador()

        repeat(5) { limitador.registrarIntento(AmbitoIntentos.REGISTRO, "tomado@example.com") }
        assertFailsWith<DemasiadosIntentosException> {
            limitador.comprobar(AmbitoIntentos.REGISTRO, "tomado@example.com")
        }
        limitador.comprobar(AmbitoIntentos.ACCESO, "tomado@example.com")
        limitador.comprobar(AmbitoIntentos.RECUPERACION, "tomado@example.com")
    }

    @Test
    @DisplayName("N-01 · el límite por IP tampoco se comparte entre ámbitos")
    fun elLimitePorIpTambienLlevaAmbito() {
        val peticion = MockHttpServletRequest()
        peticion.remoteAddr = "203.0.113.9"
        RequestContextHolder.setRequestAttributes(ServletRequestAttributes(peticion))
        try {
            val limitador = limitador()
            // 20 cuentas distintas: ninguna llega a 5, pero la IP llega a 20 en RECUPERACION.
            repeat(20) { i -> limitador.registrarIntento(AmbitoIntentos.RECUPERACION, "cuenta$i@example.test") }
            assertFailsWith<DemasiadosIntentosException> {
                limitador.comprobar(AmbitoIntentos.RECUPERACION, "otra@example.test")
            }
            // La misma IP sigue pudiendo intentar entrar: el cubo de ACCESO está vacío.
            limitador.comprobar(AmbitoIntentos.ACCESO, "otra@example.test")
        } finally {
            RequestContextHolder.resetRequestAttributes()
        }
    }

    @Test
    @DisplayName("N-01 · el 429 es el MISMO mensaje en los tres ámbitos: no dice cuál se agotó")
    fun elMensajeDel429EsElMismoEnLosTresAmbitos() {
        val mensajes = AmbitoIntentos.entries.map { ambito ->
            val limitador = limitador()
            repeat(5) { limitador.registrarIntento(ambito, "victima@example.com") }
            assertFailsWith<DemasiadosIntentosException> { limitador.comprobar(ambito, "victima@example.com") }.message
        }
        assertEquals(1, mensajes.toSet().size, "el 429 delata el ámbito: $mensajes")
        assertEquals("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.", mensajes.first())
    }

    @Test
    @DisplayName("N-01 · registrarExito de un ámbito no limpia el contador de otro")
    fun elExitoDeUnAmbitoNoLimpiaOtro() {
        val limitador = limitador()
        repeat(5) { limitador.registrarIntento(AmbitoIntentos.RECUPERACION, "ana@example.com") }
        limitador.registrarExito(AmbitoIntentos.REGISTRO, "ana@example.com")

        assertFailsWith<DemasiadosIntentosException> {
            limitador.comprobar(AmbitoIntentos.RECUPERACION, "ana@example.com")
        }
    }

    /** Con un proxy de confianza declarado, la cabecera SÍ se usa: es el caso para el que existe. */
    @Test
    @DisplayName("N-03 · con confiar-en-x-forwarded-for=true la cabecera vuelve a mandar")
    fun xffSeCreeSiSeDeclara() {
        val peticion = MockHttpServletRequest()
        peticion.remoteAddr = "203.0.113.7"
        peticion.addHeader("X-Forwarded-For", "198.51.100.42")
        RequestContextHolder.setRequestAttributes(ServletRequestAttributes(peticion))
        try {
            val limitador = AuthThrottleService(
                    passwordEncoder = encoder,
                    maxFallosPorCuenta = 5,
                    maxFallosPorIp = 2,
                    ventanaMinutos = 15,
                    maxEntradas = 50_000,
                    confiarEnXff = true
            )
            limitador.registrarFallo("a@example.test")
            limitador.registrarFallo("b@example.test")
            assertFailsWith<DemasiadosIntentosException> { limitador.comprobar("c@example.test") }
        } finally {
            RequestContextHolder.resetRequestAttributes()
        }
    }
}
