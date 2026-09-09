package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.GuestAttendanceService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.ConfirmAttendanceRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * Contrato HTTP de `/public/` + `r/{token}` (contrato 5-2 §2).
 *
 * Sin contexto de Spring y sin base de datos, como `CatalogControllerTest.kt:28-32`. El lector del
 * puente y el servicio compartido de asistencia van simulados; el **limitador es real**, porque la
 * uniformidad de su `429` es una de las cosas que hay que comprobar de verdad.
 */
class PublicRsvpControllerTest {

    private val lector: RsvpGuestReader = mock()
    private val asistencia: GuestAttendanceService = mock()
    private val limitador = RsvpThrottleService(maxPorToken = 4, maxPorIp = 1000)
    private val servicio = PublicRsvpService(lector, asistencia, limitador)
    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(PublicRsvpController(servicio))
        .setControllerAdvice(RsvpExceptionHandler())
        .build()

    // =============================================================================================
    // GET
    // =============================================================================================

    @Test
    fun `el GET devuelve el invitado, sus cupos y el publicToken de su invitacion`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        mvc.perform(get("/public/r/$TOKEN"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guest.fullName").value("María Fernanda Cruz"))
            .andExpect(jsonPath("$.guest.adults").value(2))
            .andExpect(jsonPath("$.guest.children").value(1))
            .andExpect(jsonPath("$.guest.young").value(0))
            .andExpect(jsonPath("$.guest.adultsConfirmed").value(0))
            .andExpect(jsonPath("$.guest.childrenConfirmed").value(0))
            .andExpect(jsonPath("$.guest.youngConfirmed").value(0))
            .andExpect(jsonPath("$.guest.status").value("PENDING"))
            .andExpect(jsonPath("$.guest.hasEmail").value(true))
            .andExpect(jsonPath("$.event.publicToken").value(PUBLIC_TOKEN))
            .andExpect(jsonPath("$.event.childrenAllowed").value(true))
            .andExpect(jsonPath("$.event.youngAllowed").value(false))
            .andExpect(jsonPath("$.event.closed").value(false))
    }

    /**
     * Se afirma **sobre el JSON serializado**, no sobre el DTO: un campo añadido a la entidad, o un
     * DTO que un día devolviera la entidad en vez de la proyección, se caza aquí y no en la revisión.
     */
    @Test
    fun `la respuesta no lleva token de cancelacion, correo, telefono ni dato de otro invitado`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        val json = mvc.perform(get("/public/r/$TOKEN"))
            .andExpect(status().isOk)
            .andReturn().response.contentAsString

        assertFalse(json.contains("cancellationToken"), "el cancellationToken no se expone nunca (§0.4)")
        assertFalse(json.contains("confirmationToken"), "el token del invitado no vuelve en el cuerpo")
        assertFalse(json.contains("@"), "ninguna direccion de correo sale de esta superficie")
        assertFalse(json.contains("maria@example.com"), "el correo del invitado no sale: solo hasEmail")
        assertFalse(json.contains("phone"), "el telefono no se expone")
        assertFalse(json.contains("5512345678"), "ningun fragmento de telefono se expone")
        assertFalse(json.contains("tableNumber"), "la mesa es dato del anfitrion, no del invitado")
        assertFalse(json.contains("invitationId"), "el id de la invitacion no se expone")
        assertFalse(json.contains("Familia Ruiz"), "ningun dato de otro invitado sale de aqui")
        assertTrue(json.contains("\"hasEmail\":true"), "hasEmail sustituye a la direccion")
    }

    /**
     * §0.5 y regla 1 del encargo: **los seis** motivos dan el mismo `404` con el mismo cuerpo.
     *
     * Cinco de ellos son un `null` del lector, y eso no es casualidad ni pereza de la prueba: la
     * consulta del puente los resuelve con `JOIN` internos en **una** consulta, así que el código de
     * llamada no puede distinguirlos ni aunque quisiera (ver `RsvpPuenteSqlTest`). El sexto, el token
     * mal formado, ni siquiera llega a la base de datos.
     */
    @Test
    fun `los seis motivos de fallo devuelven byte a byte el mismo 404`() {
        val motivos = listOf(
            "token inexistente" to "AAAAAAAAAAAAAAAAAAAAAA",
            "invitado deshabilitado" to "BBBBBBBBBBBBBBBBBBBBBB",
            "invitacion sin release activo" to "CCCCCCCCCCCCCCCCCCCCCC",
            "anfitrion deshabilitado" to "DDDDDDDDDDDDDDDDDDDDDD",
            "anfitrion bloqueado" to "EEEEEEEEEEEEEEEEEEEEEE",
        )
        motivos.forEach { whenever(lector.read(it.second)).doReturn(null) }

        val cuerpos = motivos.map { (_, token) ->
            mvc.perform(get("/public/r/$token"))
                .andExpect(status().isNotFound)
                .andReturn().response.contentAsString
        }.toMutableList()

        // Sexto motivo: token mal formado. No es base64url, así que se descarta sin consultar.
        cuerpos += mvc.perform(get("/public/r/no-es-un-token-valido-porque-lleva-puntos..."))
            .andExpect(status().isNotFound)
            .andReturn().response.contentAsString

        assertEquals(6, cuerpos.size)
        assertEquals(1, cuerpos.toSet().size, "los seis motivos deben dar un cuerpo identico: $cuerpos")
        assertEquals(
            """{"code":"RSVP_LINK_NOT_FOUND","message":"Este enlace ya no funciona"}""",
            cuerpos.first(),
        )
    }

    /** Un token mal formado no debe costar una consulta a la base de datos. */
    @Test
    fun `un token mal formado no llega al lector`() {
        mvc.perform(get("/public/r/token.con.puntos")).andExpect(status().isNotFound)
        verify(lector, never()).read(any())
    }

    @Test
    fun `closed es true cuando la fecha del evento ya paso`() {
        whenever(lector.read(TOKEN)).doReturn(fila(eventDate = "2020-01-01"))

        mvc.perform(get("/public/r/$TOKEN"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.event.closed").value(true))
    }

    // =============================================================================================
    // PUT
    // =============================================================================================

    @Test
    fun `confirmar, declinar y volver a confirmar deja los contadores correctos en cada paso`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        whenever(asistencia.confirmAttendance(any(), any()))
            .doReturn(guest(AttendanceStatus.CONFIRMED, 2, 1, 0))
        mvc.perform(cuerpo("""{"attending":true,"adults":2,"children":1,"young":0}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guest.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.guest.adultsConfirmed").value(2))
            .andExpect(jsonPath("$.guest.childrenConfirmed").value(1))
            .andExpect(jsonPath("$.guest.youngConfirmed").value(0))

        whenever(asistencia.confirmAttendance(any(), any()))
            .doReturn(guest(AttendanceStatus.DECLINED, 0, 0, 0))
        mvc.perform(cuerpo("""{"attending":false}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guest.status").value("DECLINED"))
            .andExpect(jsonPath("$.guest.adultsConfirmed").value(0))
            .andExpect(jsonPath("$.guest.childrenConfirmed").value(0))
            .andExpect(jsonPath("$.guest.youngConfirmed").value(0))

        whenever(asistencia.confirmAttendance(any(), any()))
            .doReturn(guest(AttendanceStatus.CONFIRMED, 1, 0, 0))
        mvc.perform(cuerpo("""{"attending":true,"adults":1}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guest.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.guest.adultsConfirmed").value(1))
            // Los cupos asignados no cambian nunca desde esta superficie.
            .andExpect(jsonPath("$.guest.adults").value(2))
            .andExpect(jsonPath("$.guest.children").value(1))
    }

    /**
     * S-07 visto desde la superficie nueva: el cuerpo trae `email` y **no** pasa nada con él. Ni
     * error (el contrato dice «se ignora sin error»), ni cambio: lo que llega al servicio compartido
     * lleva `email = null`.
     */
    @Test
    fun `un email en el cuerpo del PUT no cambia el correo del invitado`() {
        whenever(lector.read(TOKEN)).doReturn(fila())
        whenever(asistencia.confirmAttendance(any(), any()))
            .doReturn(guest(AttendanceStatus.CONFIRMED, 1, 0, 0))

        val json = mvc.perform(
            cuerpo("""{"attending":true,"adults":1,"email":"atacante@example.com"}"""),
        ).andExpect(status().isOk).andReturn().response.contentAsString

        val capturado = argumentCaptor<ConfirmAttendanceRequest>()
        verify(asistencia).confirmAttendance(any(), capturado.capture())
        assertEquals(null, capturado.firstValue.email, "el RSVP publico jamas propone un correo (S-07)")
        assertFalse(json.contains("atacante@example.com"), "el correo del cuerpo no se refleja ni se guarda")
        assertFalse(json.contains("maria@example.com"), "el correo guardado tampoco sale en el PUT")
        assertFalse(json.contains("cancellationToken"), "el cancellationToken recien acunado no se expone (§0.4)")
        assertFalse(json.contains("un-token-de-cancelacion-recien-acunado"), "ni su valor")
        assertFalse(json.contains("+525512345678"), "el telefono tampoco sale en el PUT")
    }

    /**
     * El mismo caso, pero con el `ObjectMapper` **estricto** que esta aplicación usa de verdad.
     *
     * Verificado contra el backend vivo: `Templates2JsonConfig.kt:35-36` declara un bean
     * `ObjectMapper` con `FAIL_ON_UNKNOWN_PROPERTIES` activado (`Templates2Json.kt:29`), lo que
     * desactiva por `@ConditionalOnMissingBean` el que Spring Boot habría creado y deja al estricto de
     * convertidor HTTP de toda la aplicación. Sin el `@JsonIgnoreProperties` de
     * [RsvpUpdateRequest], un cuerpo con `email` respondería `422` en vez de ignorarlo — lo contrario
     * de lo que manda el contrato §2, y una regresión que el `MockMvc` por defecto **no** ve porque su
     * mapper es tolerante. Por eso esta prueba monta el estricto a mano.
     */
    @Test
    fun `con el ObjectMapper estricto de la aplicacion, el email del cuerpo se sigue ignorando sin error`() {
        val estricto = ObjectMapper().registerKotlinModule()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        val mvcEstricto = MockMvcBuilders
            .standaloneSetup(PublicRsvpController(servicio))
            .setControllerAdvice(RsvpExceptionHandler())
            .setMessageConverters(MappingJackson2HttpMessageConverter(estricto))
            .build()

        whenever(lector.read(TOKEN)).doReturn(fila())
        whenever(asistencia.confirmAttendance(any(), any()))
            .doReturn(guest(AttendanceStatus.CONFIRMED, 1, 0, 0))

        mvcEstricto.perform(cuerpo("""{"attending":true,"adults":1,"email":"atacante@example.com"}"""))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guest.status").value("CONFIRMED"))

        val capturado = argumentCaptor<ConfirmAttendanceRequest>()
        verify(asistencia).confirmAttendance(any(), capturado.capture())
        assertEquals(null, capturado.firstValue.email)
    }

    @Test
    fun `cupos por encima de lo asignado devuelven 422 GUEST_QUOTA_EXCEEDED`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        mvc.perform(cuerpo("""{"attending":true,"adults":3,"children":0,"young":0}"""))
            .andExpect(status().isUnprocessableEntity)
            .andExpect(jsonPath("$.code").value("GUEST_QUOTA_EXCEEDED"))
        verify(asistencia, never()).confirmAttendance(any(), any())
    }

    @Test
    fun `un tipo de cupo que el evento no permite devuelve 422 GUEST_QUOTA_EXCEEDED`() {
        whenever(lector.read(TOKEN)).doReturn(fila(young = 3, youngAllowed = false))

        mvc.perform(cuerpo("""{"attending":true,"adults":1,"young":1}"""))
            .andExpect(status().isUnprocessableEntity)
            .andExpect(jsonPath("$.code").value("GUEST_QUOTA_EXCEEDED"))
    }

    @Test
    fun `los tres cupos en cero con attending true devuelven 422 GUEST_INVALID`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        mvc.perform(cuerpo("""{"attending":true,"adults":0,"children":0,"young":0}"""))
            .andExpect(status().isUnprocessableEntity)
            .andExpect(jsonPath("$.code").value("GUEST_INVALID"))
            .andExpect(jsonPath("$.message").value("Revisa los datos de tu confirmación"))
        verify(asistencia, never()).confirmAttendance(any(), any())
    }

    @Test
    fun `un cuerpo sin attending, con cifras negativas o ilegible devuelve 422 GUEST_INVALID`() {
        whenever(lector.read(TOKEN)).doReturn(fila())

        listOf(
            """{"adults":1}""",
            """{"attending":true,"adults":-1}""",
            """{"attending":true,"adults":"dos"}""",
            """no es json""",
        ).forEach { malo ->
            mvc.perform(cuerpo(malo))
                .andExpect(status().isUnprocessableEntity)
                .andExpect(jsonPath("$.code").value("GUEST_INVALID"))
        }
        verify(asistencia, never()).confirmAttendance(any(), any())
    }

    @Test
    fun `el PUT sobre un evento que ya paso devuelve 409 RSVP_CLOSED y no escribe`() {
        whenever(lector.read(TOKEN)).doReturn(fila(eventDate = "2020-01-01"))

        mvc.perform(cuerpo("""{"attending":true,"adults":1}"""))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("RSVP_CLOSED"))
        verify(asistencia, never()).confirmAttendance(any(), any())
    }

    @Test
    fun `el PUT con token desconocido devuelve el mismo 404 que el GET`() {
        whenever(lector.read(TOKEN)).doReturn(null)

        val cuerpoPut = mvc.perform(cuerpo("""{"attending":true,"adults":1}"""))
            .andExpect(status().isNotFound).andReturn().response.contentAsString
        val cuerpoGet = mvc.perform(get("/public/r/$TOKEN"))
            .andExpect(status().isNotFound).andReturn().response.contentAsString

        assertEquals(cuerpoGet, cuerpoPut)
    }

    /**
     * El servicio compartido sigue siendo el que manda. Si rechaza algo que estas validaciones no
     * anticiparon, el invitado ve `422 GUEST_INVALID` con el texto fijo — **nunca** el mensaje
     * original, que con `include-message: always` (S-02) sería un oráculo.
     */
    @Test
    fun `un rechazo del servicio compartido no filtra su mensaje`() {
        whenever(lector.read(TOKEN)).doReturn(fila())
        whenever(asistencia.confirmAttendance(any(), any()))
            .doThrow(IllegalArgumentException("La fecha del evento ya pasó, no puedes confirmar tu asistencia"))

        val json = mvc.perform(cuerpo("""{"attending":true,"adults":1}"""))
            .andExpect(status().isUnprocessableEntity)
            .andReturn().response.contentAsString

        assertEquals("""{"code":"GUEST_INVALID","message":"Revisa los datos de tu confirmación"}""", json)
    }

    @Test
    fun `si el invitado desaparece entre la lectura y la escritura sale el 404 uniforme`() {
        whenever(lector.read(TOKEN)).doReturn(fila())
        whenever(asistencia.confirmAttendance(any(), any()))
            .doThrow(GuestNotFoundException("El invitado no existe o fue eliminado"))

        mvc.perform(cuerpo("""{"attending":true,"adults":1}"""))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("RSVP_LINK_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("Este enlace ya no funciona"))
    }

    // =============================================================================================
    // Límite de intentos
    // =============================================================================================

    /**
     * El `429` **no puede ser un oráculo**: si el cuerpo o el código cambiaran según el token,
     * bastaría con agotar el límite para saber qué enlaces existen, y el `404` uniforme habría sido
     * en vano.
     */
    @Test
    fun `el limitador devuelve 429 con cuerpo identico para un token valido y uno inventado`() {
        val valido = "VVVVVVVVVVVVVVVVVVVVVV"
        val inventado = "XXXXXXXXXXXXXXXXXXXXXX"
        whenever(lector.read(valido)).doReturn(fila())
        whenever(lector.read(inventado)).doReturn(null)

        repeat(4) { mvc.perform(get("/public/r/$valido")) }
        repeat(4) { mvc.perform(get("/public/r/$inventado")) }

        val cuerpoValido = mvc.perform(get("/public/r/$valido"))
            .andExpect(status().isTooManyRequests).andReturn().response.contentAsString
        val cuerpoInventado = mvc.perform(get("/public/r/$inventado"))
            .andExpect(status().isTooManyRequests).andReturn().response.contentAsString

        assertEquals(cuerpoValido, cuerpoInventado)
        assertEquals(
            """{"code":"RSVP_TOO_MANY_ATTEMPTS","message":"Demasiados intentos. Espera unos minutos e inténtalo de nuevo"}""",
            cuerpoValido,
        )
    }

    /** El `429` se decide antes de la consulta: agotado el cubo, el lector ya no se toca. */
    @Test
    fun `el 429 no gasta una consulta`() {
        whenever(lector.read(TOKEN)).doReturn(fila())
        repeat(4) { mvc.perform(get("/public/r/$TOKEN")) }
        mvc.perform(get("/public/r/$TOKEN")).andExpect(status().isTooManyRequests)

        verify(lector, times(4)).read(TOKEN)
    }

    // =============================================================================================

    private fun cuerpo(json: String) = put("/public/r/$TOKEN")
        .contentType(MediaType.APPLICATION_JSON)
        .content(json)

    private fun fila(
        eventDate: String = FECHA_FUTURA,
        young: Int = 0,
        youngAllowed: Boolean = false,
    ) = RsvpGuestRow(
        fullName = "María Fernanda Cruz",
        adults = 2,
        children = 1,
        young = young,
        adultsConfirmed = 0,
        childrenConfirmed = 0,
        youngConfirmed = 0,
        status = "PENDING",
        hasEmail = true,
        publicToken = PUBLIC_TOKEN,
        childrenAllowed = true,
        youngAllowed = youngAllowed,
        eventDate = eventDate,
        eventTime = "17:00",
    )

    /** Entidad tal y como la devuelve `GuestAttendanceService.confirmAttendance`, con PII dentro. */
    private fun guest(estado: AttendanceStatus, adultos: Int, ninos: Int, jovenes: Int) =
        InvitationGuestEntity(
            id = 12,
            invitation = InvitationEntity(
                id = 7,
                template = mock(),
                customer = mock(),
            ),
            fullName = "María Fernanda Cruz",
            email = "maria@example.com",
            phone = "+525512345678",
            adultsCount = 2,
            childrenCount = 1,
            youngCount = 0,
            adultsCountConfirmed = adultos,
            childrenCountConfirmed = ninos,
            youngCountConfirmed = jovenes,
            attendanceStatus = estado,
            confirmationToken = TOKEN,
            cancellationToken = "un-token-de-cancelacion-recien-acunado",
            tableNumber = 4,
        )

    private companion object {
        const val TOKEN = "aB3dEfGhIjKlMnOpQrStUv"
        const val PUBLIC_TOKEN = "pub_01J5ZQK8N4T2R7VWXY3ABCDEFG"

        /** Lejos, para que `closed` no dependa del día en que se ejecute la prueba. */
        const val FECHA_FUTURA = "2099-12-31"
    }
}
