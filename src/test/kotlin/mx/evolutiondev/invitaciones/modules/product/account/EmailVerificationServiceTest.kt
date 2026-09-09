package mx.evolutiondev.invitaciones.modules.product.account

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
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
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import java.time.Instant

/**
 * Verificación del correo (fase 5, E3; `12-producto-completo.md §A2.1` y §A6.4, `ADR-5-E3-02`).
 *
 * Casos que vigila: alta feliz · token caducado · token inexistente · reenvío limitado · **respuesta
 * genérica del reenvío ante un correo que no existe**, que es la que impide enumerar cuentas.
 *
 * Pruebas de unidad puras, sin Spring y sin base de datos.
 */
class EmailVerificationServiceTest {

    private val repositorio: CustomerRepository = mock()
    private val refreshTokens: RefreshTokenRepository = mock()
    private val emailService: EmailService = mock()
    private val jwtUtil: JwtUtil = mock()
    private val limitador = AuthThrottleService(
        passwordEncoder = BCryptPasswordEncoder(),
        maxFallosPorCuenta = 5,
        maxFallosPorIp = 20,
        ventanaMinutos = 15,
        maxEntradas = 50_000,
    )

    private val servicio = EmailVerificationService(
        customerRepository = repositorio,
        refreshTokenRepository = refreshTokens,
        emailService = emailService,
        authThrottleService = limitador,
        jwtUtil = jwtUtil,
        mailProperties = ProductMailProperties(),
        frontendUrl = "https://linoysello.example",
        horasDeValidez = 24,
    )

    private fun cuenta(
        token: String? = null,
        vive: Boolean = true,
        verificada: Boolean = false,
        pendiente: String? = null,
    ) = CustomerEntity(
        id = 3,
        name = "Ana",
        lastName = "Ruiz",
        email = "ana@ejemplo.mx",
        password = "no-importa",
        role = Role.USER,
        emailVerified = verificada,
        emailVerificationToken = token,
        emailVerificationExpiry = if (vive) Instant.now().plusSeconds(3600) else Instant.now().minusSeconds(60),
        emailPending = pendiente,
    )

    private fun guardaLoQueLeDen() {
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }
    }

    // --- alta ------------------------------------------------------------------------------------

    @Test
    @DisplayName("el alta deja la cuenta sin verificar, con token y con caducidad")
    fun elAltaPreparaLaVerificacion() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-de-alta")
        val nueva = cuenta(verificada = true)

        val token = servicio.prepararVerificacionDeAlta(nueva)

        assertEquals("token-de-alta", token)
        assertFalse(nueva.emailVerified, "la cuenta nueva nace SIN verificar")
        assertEquals("token-de-alta", nueva.emailVerificationToken)
        assertTrue(nueva.emailVerificationExpiry!!.isAfter(Instant.now()))
    }

    @Test
    @DisplayName("la url del correo se construye con app.frontend.url, nunca escrita en el codigo (S-08)")
    fun laUrlSaleDeLaConfiguracion() {
        assertEquals("https://linoysello.example/verificar-correo?token=abc", servicio.urlDeVerificacion("abc"))
    }

    // --- verificación ----------------------------------------------------------------------------

    @Test
    @DisplayName("camino feliz: el token marca la cuenta como verificada y se consume")
    fun verificacionFeliz() {
        val cliente = cuenta(token = "token-bueno")
        whenever(repositorio.findByEmailVerificationToken("token-bueno")).thenReturn(cliente)
        guardaLoQueLeDen()

        val respuesta = servicio.verificar("token-bueno")

        assertEquals(EmailVerificationService.MENSAJE_VERIFICADO, respuesta.message)
        assertTrue(cliente.emailVerified)
        assertNull(cliente.emailVerificationToken, "el token es de un solo uso")
        assertNull(cliente.emailVerificationExpiry)
        verify(refreshTokens, never()).deleteAllByCustomerId(any())
    }

    @Test
    @DisplayName("token caducado: CUENTA_TOKEN_CADUCADO y la cuenta NO queda verificada")
    fun tokenCaducado() {
        val cliente = cuenta(token = "token-viejo", vive = false)
        whenever(repositorio.findByEmailVerificationToken("token-viejo")).thenReturn(cliente)
        guardaLoQueLeDen()

        val error = assertFailsWith<AccountException> { servicio.verificar("token-viejo") }

        assertEquals(AccountErrorCode.CUENTA_TOKEN_CADUCADO, error.code)
        assertFalse(cliente.emailVerified, "un token caducado NUNCA verifica")
        // Desde R1-06 el token caducado se **borra** (y con él el pendiente), así que aquí sí se
        // escribe. Antes no se escribía y el pendiente sobrevivía para siempre.
        assertNull(cliente.emailVerificationToken)
    }

    @Test
    @DisplayName("token inexistente: CUENTA_TOKEN_INVALIDO")
    fun tokenInexistente() {
        whenever(repositorio.findByEmailVerificationToken(any())).thenReturn(null)

        val error = assertFailsWith<AccountException> { servicio.verificar("token-inventado") }

        assertEquals(AccountErrorCode.CUENTA_TOKEN_INVALIDO, error.code)
    }

    @Test
    @DisplayName("con cambio de correo pendiente: se aplica el correo nuevo y se cierran las sesiones")
    fun aplicaElCambioDeCorreo() {
        val cliente = cuenta(token = "token-bueno", pendiente = "nueva@ejemplo.mx")
        whenever(repositorio.findByEmailVerificationToken("token-bueno")).thenReturn(cliente)
        whenever(repositorio.findByEmailEvenIfDisabled("nueva@ejemplo.mx")).thenReturn(null)
        guardaLoQueLeDen()

        val respuesta = servicio.verificar("token-bueno")

        assertEquals("nueva@ejemplo.mx", cliente.email)
        assertNull(cliente.emailPending)
        assertEquals(EmailVerificationService.MENSAJE_CORREO_CAMBIADO, respuesta.message)
        verify(refreshTokens).deleteAllByCustomerId(3L)
    }

    @Test
    @DisplayName("si el correo pendiente lo tomo otra cuenta mientras tanto: 409, no un 500 del indice unico")
    fun elPendienteOcupadoNoRevienta() {
        val cliente = cuenta(token = "token-bueno", pendiente = "nueva@ejemplo.mx")
        val otra = cuenta().copy(id = 99, email = "nueva@ejemplo.mx")
        whenever(repositorio.findByEmailVerificationToken("token-bueno")).thenReturn(cliente)
        whenever(repositorio.findByEmailEvenIfDisabled("nueva@ejemplo.mx")).thenReturn(otra)

        val error = assertFailsWith<AccountException> { servicio.verificar("token-bueno") }

        assertEquals(AccountErrorCode.CUENTA_CORREO_NO_DISPONIBLE, error.code)
        assertEquals("ana@ejemplo.mx", cliente.email, "el correo de acceso no cambia")
    }

    // --- reenvío ---------------------------------------------------------------------------------

    @Test
    @DisplayName("el reenvio responde lo MISMO cuando el correo no existe: no enumera cuentas")
    fun reenvioGenericoSinCuenta() {
        whenever(repositorio.findByEmail("nadie@ejemplo.mx")).thenReturn(null)

        val respuesta = servicio.reenviar("nadie@ejemplo.mx")

        assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message)
        verify(repositorio, never()).save(any<CustomerEntity>())
    }

    @Test
    @DisplayName("el reenvio de una cuenta sin verificar acuna un token nuevo, con el mismo mensaje")
    fun reenvioConCuenta() {
        val cliente = cuenta(token = "token-viejo")
        whenever(repositorio.findByEmail("ana@ejemplo.mx")).thenReturn(cliente)
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-fresco")
        guardaLoQueLeDen()

        val respuesta = servicio.reenviar("ana@ejemplo.mx")

        assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message)
        assertEquals("token-fresco", cliente.emailVerificationToken)
    }

    @Test
    @DisplayName("una cuenta YA verificada no manda nada, y responde lo mismo igualmente")
    fun reenvioDeCuentaVerificada() {
        val cliente = cuenta(verificada = true)
        whenever(repositorio.findByEmail("ana@ejemplo.mx")).thenReturn(cliente)

        val respuesta = servicio.reenviar("ana@ejemplo.mx")

        assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message)
        verify(repositorio, never()).save(any<CustomerEntity>())
    }

    @Test
    @DisplayName("el sexto reenvio seguido responde 429: no es un amplificador de correo")
    fun reenvioLimitado() {
        whenever(repositorio.findByEmail(any())).thenReturn(null)

        repeat(5) { servicio.reenviar("nadie@ejemplo.mx") }

        assertFailsWith<DemasiadosIntentosException> { servicio.reenviar("nadie@ejemplo.mx") }
    }

    // ---------------------------------------------------------------------------------------
    // R1-06 · `email_pending` caduca y el reenvio no lo re-arma
    // ---------------------------------------------------------------------------------------

    @Test
    @DisplayName("R1-06: el reenvio SIN autenticar no re-arma un cambio de correo pendiente")
    fun elReenvioNoRearmaUnCambioDeCorreoPendiente() {
        // Ana pidió mudarse a una direccion con un dedazo y nunca confirmó. El token sigue vivo.
        val cliente = cuenta(token = "token-viejo", pendiente = "ana@gmial.example")
        whenever(repositorio.findByEmail("ana@ejemplo.mx")).thenReturn(cliente)
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-fresco")

        // Un tercero, sin autenticarse, pide el reenvio con el correo ACTUAL de Ana.
        val respuesta = servicio.reenviar("ana@ejemplo.mx")

        assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message, "la respuesta no cambia")
        assertEquals("token-viejo", cliente.emailVerificationToken, "NO se acuna token nuevo")
        assertEquals("ana@gmial.example", cliente.emailPending, "el pendiente no se toca")
        verify(repositorio, never()).save(any<CustomerEntity>())
        verify(jwtUtil, never()).generateSecureToken()
    }

    @Test
    @DisplayName("R1-06: el pendiente caducado se borra cuando alguien abre el enlace viejo")
    fun elPendienteCaducadoSeBorraCuandoSeUsaElEnlaceViejo() {
        val cliente = cuenta(token = "token-viejo", vive = false, pendiente = "ana@gmial.example")
        whenever(repositorio.findByEmailVerificationToken("token-viejo")).thenReturn(cliente)
        guardaLoQueLeDen()

        assertFailsWith<AccountException> { servicio.verificar("token-viejo") }

        assertNull(cliente.emailPending, "el cambio pendiente muere con su token")
        assertNull(cliente.emailVerificationToken)
        assertNull(cliente.emailVerificationExpiry)
        assertEquals("ana@ejemplo.mx", cliente.email, "el correo de acceso no se movio")
        verify(repositorio).save(cliente)
    }

    @Test
    @DisplayName("R1-06: el reenvio limpia el pendiente caducado y solo entonces vuelve a mandar")
    fun elReenvioLimpiaElPendienteCaducadoYVuelveAFuncionar() {
        // Cuenta sin verificar y con un cambio pendiente cuya ventana ya paso.
        val cliente = cuenta(token = "token-muerto", vive = false, pendiente = "ana@gmial.example")
        whenever(repositorio.findByEmail("ana@ejemplo.mx")).thenReturn(cliente)
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-fresco")
        guardaLoQueLeDen()

        val respuesta = servicio.reenviar("ana@ejemplo.mx")

        assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message)
        assertNull(cliente.emailPending, "el pendiente caducado se borro")
        assertEquals("token-fresco", cliente.emailVerificationToken, "y el reenvio vuelve a funcionar")
    }

    // ---------------------------------------------------------------------------------------
    // R1-08 · el choque contra el indice unico no se escapa
    // ---------------------------------------------------------------------------------------

    @Test
    @DisplayName("R1-08: el choque contra el indice unico de customer.email sale como error de dominio")
    fun elChoqueContraElIndiceUnicoSaleComoErrorDeDominio() {
        val cliente = cuenta(token = "token-bueno", pendiente = "nueva@ejemplo.mx")
        whenever(repositorio.findByEmailVerificationToken("token-bueno")).thenReturn(cliente)
        // La comprobacion de disponibilidad pasa: la carrera ocurre DESPUES de ella.
        whenever(repositorio.findByEmailEvenIfDisabled("nueva@ejemplo.mx")).thenReturn(null)
        whenever(repositorio.save(any<CustomerEntity>())).thenThrow(
            DataIntegrityViolationException(
                "ERROR: duplicate key value violates unique constraint \"customer_email_key\" " +
                    "Detail: Key (email)=(nueva@ejemplo.mx) already exists.",
            ),
        )

        val error = assertFailsWith<AccountException> { servicio.verificar("token-bueno") }

        assertEquals(AccountErrorCode.CUENTA_CORREO_NO_DISPONIBLE, error.code)
        assertFalse(
            error.message.orEmpty().contains("nueva@ejemplo.mx"),
            "el mensaje NO puede repetir el correo en conflicto: es el de otra clienta",
        )
        assertFalse(
            error.message.orEmpty().contains("customer_email_key"),
            "ni el nombre de la restriccion",
        )
    }

    // ---------------------------------------------------------------------------------------
    // R1-14 · el presupuesto de envios calla en vez de delatar
    // ---------------------------------------------------------------------------------------

    @Test
    @DisplayName("R1-14: agotado el presupuesto de envios, el reenvio calla y responde lo mismo")
    fun elReenvioCallaCuandoSeAgotaElPresupuestoDeEnvios() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-fresco")
        guardaLoQueLeDen()

        // Cinco direcciones DISTINTAS, todas reales y sin verificar: el cubo por cuenta no las frena,
        // porque cada correo tiene el suyo. El presupuesto por IP sí.
        val cuentas = (1..6).map { n ->
            cuenta().also {
                it.id = n.toLong()
                it.email = "sin-verificar-$n@ejemplo.mx"
                whenever(repositorio.findByEmail("sin-verificar-$n@ejemplo.mx")).thenReturn(it)
            }
        }

        cuentas.forEachIndexed { i, c ->
            val respuesta = servicio.reenviar("sin-verificar-${i + 1}@ejemplo.mx")
            // La respuesta es la MISMA siempre: el agotamiento no se nota desde fuera.
            assertEquals(EmailVerificationService.MENSAJE_REENVIO, respuesta.message)
        }

        assertEquals("token-fresco", cuentas[4].emailVerificationToken, "los cinco primeros sí salen")
        assertNull(
            cuentas[5].emailVerificationToken,
            "el sexto NO acuna token ni manda correo: el presupuesto por IP se agoto",
        )
    }
}
