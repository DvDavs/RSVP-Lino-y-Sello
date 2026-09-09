package mx.evolutiondev.invitaciones.modules.auth

import com.fasterxml.jackson.databind.ObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.error.GeneralExceptionHandler
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.auth.presentation.AuthController
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.RecoveryPasswordSentResponse
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AmbitoIntentos
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.auth.service.DemasiadosIntentosException
import mx.evolutiondev.invitaciones.modules.auth.service.RefreshTokenService
import mx.evolutiondev.invitaciones.modules.auth.service.ResetPasswordService
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * N-01 (`ADR-3C-N01-01`) — contrato HTTP de `POST /auth/request-password-reset` y `POST /auth/signup`.
 *
 * Lo que esta clase vigila, punto por punto del hallazgo de la revisión adversarial de la fase 3-B
 * (`handoffs/3b-adv.md`, `bitacora/3b-adv.md §6.1`):
 *
 *  a. La respuesta de `request-password-reset` **no contiene el token**. Se afirma sobre el JSON
 *     SERIALIZADO, no sobre el tipo de Kotlin: añadir mañana un campo `resetToken` al DTO —o
 *     cualquier otro que se parezca a un token— pone esta clase en rojo.
 *  b. `200` y **el mismo cuerpo byte a byte** exista o no la cuenta: se acabó la enumeración por
 *     código de estado (`400` vs `200`).
 *  c. `429` al pasarse del límite, en `request-password-reset` **y** en `signup`, con el mismo
 *     cuerpo que el `429` de `/auth/token`.
 *  d. El recorrido de toma de cuenta de `bitacora/3b-adv.md §6.1` (pedir reset → usar el token que
 *     venía en la respuesta → entrar con la contraseña del atacante) ya no arranca: la respuesta HTTP
 *     no trae de dónde sacar el token.
 *
 * Pruebas de unidad puras: `MockMvcBuilders.standaloneSetup` con el `@RestControllerAdvice` real
 * enganchado (`GeneralExceptionHandler`), sin contexto de Spring y sin base de datos. La
 * reproducción contra el backend REAL, con la salida literal de antes y después, está en
 * `docs/rediseno-plantillas/evidencia/fase-3c/bloque-menos1/n01-antes-despues.txt`.
 */
class RequestPasswordResetContractTest {

    private val encoder = BCryptPasswordEncoder()
    private val jwtUtil: JwtUtil = mock()
    private val repositorio: CustomerRepository = mock()
    private val emailService: EmailService = mock()
    private val refreshTokenRepository: RefreshTokenRepository = mock()
    private val verificacion: mx.evolutiondev.invitaciones.modules.product.account.EmailVerificationService = mock()
    private val limitador = AuthThrottleService(
            passwordEncoder = encoder,
            maxFallosPorCuenta = 5,
            maxFallosPorIp = 20,
            ventanaMinutos = 15,
            maxEntradas = 50_000
    )

    private val servicioReset = ResetPasswordService(
            customerRepository = repositorio,
            passwordEncoder = encoder,
            jwtUtil = jwtUtil,
            emailService = emailService,
            authThrottleService = limitador,
            refreshTokenRepository = refreshTokenRepository,
            frontendUrl = "https://invitaciones.mx"
    )

    private val servicioClientes = CustomerService(
            customerRepository = repositorio,
            passwordEncoder = encoder,
            hierarchyValidationService = mock<HierarchyValidationService>(),
            emailService = emailService,
            authThrottleService = limitador,
            emailVerificationService = verificacion,
            mailProperties = mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties()
    )

    private val mvc: MockMvc = MockMvcBuilders
            .standaloneSetup(
                    AuthController(
                            customerService = servicioClientes,
                            refreshTokenService = mock<RefreshTokenService>(),
                            resetPasswordService = servicioReset,
                            jwtUtil = jwtUtil
                    )
            )
            .setControllerAdvice(GeneralExceptionHandler(DateFormatterImpl()))
            .build()

    private fun cliente(email: String): CustomerEntity = CustomerEntity(
            name = "Demo",
            lastName = "Boda",
            email = email,
            password = encoder.encode("Demo1234!"),
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

    private fun pedirReset(email: String) =
            mvc.perform(
                    post("/auth/request-password-reset")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""{"email":"$email"}""")
            )

    private fun registrar(email: String) =
            mvc.perform(
                    post("/auth/signup")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(
                                    """
                                    {"name":"Demo","lastName":"Boda","email":"$email","phone":null,
                                     "birthdate":null,"address":null,"city":null,"postalCode":null,
                                     "state":null,"howKnow":null,"password":"Demo1234!"}
                                    """.trimIndent()
                            )
            )

    // =============================================================================================
    // (a) El token NO sale por HTTP
    // =============================================================================================

    @Test
    @DisplayName("(a) la respuesta de request-password-reset NO lleva resetToken: afirmado sobre el JSON servido")
    fun laRespuestaNoLlevaElToken() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("TOKEN-SECRETO-QUE-JAMAS-DEBE-SALIR")
        whenever(repositorio.findByEmail("existe@example.com")).thenReturn(cliente("existe@example.com"))
        whenever(repositorio.save(any<CustomerEntity>())).thenAnswer { it.arguments[0] }

        val cuerpo = pedirReset("existe@example.com")
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.resetToken").doesNotExist())
                .andReturn().response.contentAsString

        // Sobre el JSON crudo, no sobre el tipo: ni el nombre del campo ni el valor del token.
        assertFalse(cuerpo.contains("resetToken"), "el cuerpo servido menciona resetToken: $cuerpo")
        assertFalse(cuerpo.contains("TOKEN-SECRETO"), "el cuerpo servido lleva el token: $cuerpo")
        assertEquals("""{"message":"${ResetPasswordService.MENSAJE_RECUPERACION}"}""", cuerpo)

        // Y el token SÍ se acuñó y se guardó: viaja por correo, que es su único camino legítimo.
        verify(repositorio).save(any<CustomerEntity>())
    }

    @Test
    @DisplayName("(a) el DTO serializado tiene exactamente un campo, `message`")
    fun elDtoNoTieneMasCampos() {
        val json = ObjectMapper().writeValueAsString(RecoveryPasswordSentResponse(message = "hola"))
        assertEquals("""{"message":"hola"}""", json)
        val claves = ObjectMapper().readTree(json).fieldNames().asSequence().toList()
        assertEquals(listOf("message"), claves, "el DTO ganó campos nuevos: $claves")
    }

    // =============================================================================================
    // (b) 200 y mismo cuerpo exista o no la cuenta
    // =============================================================================================

    @Test
    @DisplayName("(b) 200 y cuerpo idéntico para un correo que existe y para uno que no")
    fun mismoCuerpoExistaONo() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-descartable")
        whenever(repositorio.findByEmail("existe@example.com")).thenReturn(cliente("existe@example.com"))
        whenever(repositorio.findByEmail("no.existe@example.com")).thenReturn(null)
        whenever(repositorio.save(any<CustomerEntity>())).thenAnswer { it.arguments[0] }

        val existente = pedirReset("existe@example.com").andExpect(status().isOk).andReturn().response
        val inexistente = pedirReset("no.existe@example.com").andExpect(status().isOk).andReturn().response

        assertEquals(200, existente.status)
        assertEquals(200, inexistente.status)
        assertEquals(existente.contentAsString, inexistente.contentAsString)
        assertEquals(ResetPasswordService.MENSAJE_RECUPERACION, ObjectMapper().readTree(inexistente.contentAsString)["message"].asText())
    }

    @Test
    @DisplayName("(b) el correo inexistente acuña igualmente un token —que se tira— y no escribe en la base")
    fun elCaminoInexistenteGastaLoMismoSinEscribir() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-descartable")
        whenever(repositorio.findByEmail("no.existe@example.com")).thenReturn(null)

        pedirReset("no.existe@example.com").andExpect(status().isOk)

        // El trabajo caro que SÍ se puede igualar, se iguala: se acuña el token igual que si la
        // cuenta existiera. Lo que no se puede fabricar es una escritura sobre una fila que no hay.
        verify(jwtUtil).generateSecureToken()
        verify(repositorio, never()).save(any<CustomerEntity>())
    }

    // =============================================================================================
    // (c) 429 en los dos extremos
    // =============================================================================================

    @Test
    @DisplayName("(c) el sexto request-password-reset seguido responde 429 con el cuerpo mudo de siempre")
    fun sextaRecuperacionEs429() {
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-descartable")
        whenever(repositorio.findByEmail("victima@example.com")).thenReturn(null)

        repeat(5) { i -> pedirReset("victima@example.com").andExpect(status().isOk).andReturn().also { assertEquals(200, it.response.status, "la petición ${i + 1} debía ser 200") } }

        val bloqueada = pedirReset("victima@example.com").andExpect(status().isTooManyRequests).andReturn().response
        assertEquals(429, bloqueada.status)
        assertEquals(
                "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
                ObjectMapper().readTree(bloqueada.contentAsString)["errors"]["error"].asText()
        )
        // El `429` se decide ANTES de tocar la base: exactamente 5 consultas, no 6.
        verify(repositorio, org.mockito.kotlin.times(5)).findByEmail("victima@example.com")
    }

    @Test
    @DisplayName("(c) el sexto signup rechazado seguido responde 429")
    fun sextoRegistroEs429() {
        whenever(repositorio.findByEmailEvenIfDisabled("tomado@example.com")).thenReturn(cliente("tomado@example.com"))

        repeat(5) { registrar("tomado@example.com").andExpect(status().isBadRequest) }
        registrar("tomado@example.com").andExpect(status().isTooManyRequests)

        verify(repositorio, org.mockito.kotlin.times(5)).findByEmailEvenIfDisabled("tomado@example.com")
    }

    @Test
    @DisplayName("(c) un alta correcta limpia el contador de registro: quien se registra de verdad no se autobloquea")
    fun elAltaCorrectaLimpiaElContador() {
        whenever(repositorio.findByEmailEvenIfDisabled("nueva@example.com")).thenReturn(null)
        whenever(repositorio.save(any<CustomerEntity>())).thenAnswer { it.arguments[0] }
        limitador.registrarIntento(AmbitoIntentos.REGISTRO, "nueva@example.com")
        limitador.registrarIntento(AmbitoIntentos.REGISTRO, "nueva@example.com")
        limitador.registrarIntento(AmbitoIntentos.REGISTRO, "nueva@example.com")
        limitador.registrarIntento(AmbitoIntentos.REGISTRO, "nueva@example.com")

        servicioClientes.signUp(
                UserRequest(
                        name = "Nueva", lastName = "Clienta", email = "nueva@example.com", phone = null,
                        birthdate = null, address = null, city = null, postalCode = null, state = null,
                        howKnow = null, password = "Demo1234!"
                )
        )

        // Tras el alta correcta vuelve a haber cinco oportunidades, no una.
        repeat(5) { limitador.registrarIntento(AmbitoIntentos.REGISTRO, "nueva@example.com") }
        assertFailsWith<DemasiadosIntentosException> { limitador.comprobar(AmbitoIntentos.REGISTRO, "nueva@example.com") }
    }

    // =============================================================================================
    // (d) el recorrido de toma de cuenta ya no arranca desde HTTP
    // =============================================================================================

    @Test
    @DisplayName("(d) el recorrido de toma de cuenta de bitacora/3b-adv.md §6.1 se queda sin primer paso")
    fun elRecorridoDeTomaDeCuentaNoArranca() {
        val tokenReal = "TOKEN-171-CHARS-QUE-ABRE-LA-CUENTA"
        whenever(jwtUtil.generateSecureToken()).thenReturn(tokenReal)
        val victima = cliente("victima@example.com")
        whenever(repositorio.findByEmail("victima@example.com")).thenReturn(victima)
        whenever(repositorio.save(any<CustomerEntity>())).thenAnswer { it.arguments[0] }

        // Paso 1 del recorrido: pedir el restablecimiento sin autenticar. Sigue respondiendo 200…
        val cuerpo = pedirReset("victima@example.com").andExpect(status().isOk).andReturn().response.contentAsString

        // …pero de esta respuesta ya no se puede extraer NADA con lo que dar el paso 2. Se comprueba
        // sobre todos los valores de cadena del JSON, no sólo sobre una clave concreta.
        val arbol = ObjectMapper().readTree(cuerpo)
        val valores = arbol.fieldNames().asSequence().map { arbol.get(it).asText() }.toList()
        assertTrue(valores.none { it.contains(tokenReal) }, "algún campo de la respuesta lleva el token: $cuerpo")
        assertNull(arbol.get("resetToken"))
        assertEquals(1, arbol.size(), "la respuesta ganó campos: $cuerpo")

        // El token existe —está guardado en la fila y viaja en el correo—, pero por HTTP no sale.
        assertEquals(tokenReal, victima.resetToken)
    }
}
