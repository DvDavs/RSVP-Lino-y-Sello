package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * Contrato HTTP del panel de invitados (`5-2` §1).
 *
 * Estilo de `CatalogControllerTest.kt:28-32`: `standaloneSetup` con el servicio simulado, sin
 * contexto de Spring y sin base de datos, para que la suite siga siendo rápida y sin contención.
 * El advice se registra a mano porque en `standaloneSetup` no hay escaneo de `@RestControllerAdvice`.
 */
class GuestPanelControllerTest {

    private val servicio: GuestPanelService = mock()
    private val mvc: MockMvc = MockMvcBuilders.standaloneSetup(GuestPanelController(servicio))
        .setControllerAdvice(GuestPanelExceptionHandler())
        .build()

    private val clienta: Authentication = UsernamePasswordAuthenticationToken(
        CustomerDetails(7L, "correo", "clave", listOf(SimpleGrantedAuthority("ROLE_USER"))),
        null,
        listOf(SimpleGrantedAuthority("ROLE_USER")),
    )

    // =============================================================================================
    // Listado
    // =============================================================================================

    @Test
    fun `el listado responde la pagina del contrato`() {
        whenever(servicio.listar(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .doReturn(GuestPage(listOf(item()), page = 0, size = 25, totalElements = 49, totalPages = 2))

        mvc.perform(get("/product/invitations/4/guests").principal(clienta))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.content[0].id").value(12))
            .andExpect(jsonPath("$.content[0].fullName").value("Maria Fernanda Cruz"))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(25))
            .andExpect(jsonPath("$.totalElements").value(49))
            .andExpect(jsonPath("$.totalPages").value(2))
    }

    @Test
    fun `el listado pasa la busqueda y el estado tal como llegan`() {
        whenever(servicio.listar(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .doReturn(GuestPage(emptyList(), 1, 50, 0, 0))

        mvc.perform(
            get("/product/invitations/4/guests")
                .param("search", "maria")
                .param("status", "CONFIRMED")
                .param("page", "1")
                .param("size", "50")
                .principal(clienta),
        ).andExpect(status().isOk)

        verify(servicio).listar(eq(7L), any(), eq(4L), eq("maria"), eq("CONFIRMED"), eq(1), eq(50))
    }

    /**
     * **Cierre de S-13 en la superficie HTTP**: el JSON del listado no puede contener ninguna de las
     * dos palabras. Es una prueba de cadena a propósito: comprueba el JSON que sale por el cable, no
     * la forma de la clase, así que también fallaría si alguien añadiera el campo por otro camino.
     */
    @Test
    fun `el listado no publica ningun token de invitado`() {
        whenever(servicio.listar(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .doReturn(GuestPage(listOf(item()), 0, 25, 1, 1))

        val cuerpo = mvc.perform(get("/product/invitations/4/guests").principal(clienta))
            .andExpect(status().isOk)
            .andReturn().response.contentAsString

        assertFalse(cuerpo.contains("confirmationToken"), "el listado del panel no lleva confirmationToken (S-13)")
        assertFalse(cuerpo.contains("cancellationToken"), "el listado del panel no lleva cancellationToken (S-13)")
    }

    // =============================================================================================
    // Resumen, alta, edicion y baja
    // =============================================================================================

    @Test
    fun `el resumen responde personas, asientos y reglas`() {
        whenever(servicio.resumen(any(), any(), any())).doReturn(
            GuestSummaryResponse(
                guests = GuestCounts(total = 49, pending = 12, confirmed = 34, declined = 3),
                seats = SeatCounts(SeatPair(60, 48), SeatPair(15, 10), SeatPair(5, 3), 80, 61),
                rules = EventRules(childrenAllowed = true, youngAllowed = false),
            ),
        )

        mvc.perform(get("/product/invitations/4/guests/summary").principal(clienta))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.guests.total").value(49))
            .andExpect(jsonPath("$.seats.adults.invited").value(60))
            .andExpect(jsonPath("$.seats.totalConfirmed").value(61))
            .andExpect(jsonPath("$.rules.childrenAllowed").value(true))
            .andExpect(jsonPath("$.rules.youngAllowed").value(false))
    }

    @Test
    fun `el alta responde 201 con el invitado creado`() {
        whenever(servicio.crear(any(), any(), any(), any())).doReturn(item())

        mvc.perform(
            post("/product/invitations/4/guests")
                .contentType("application/json")
                .content("""{"fullName":"Maria Fernanda Cruz","adults":2}""")
                .principal(clienta),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(12))
    }

    @Test
    fun `la edicion responde el invitado ya actualizado`() {
        whenever(servicio.actualizar(any(), any(), any(), any(), any())).doReturn(item())

        mvc.perform(
            put("/product/invitations/4/guests/12")
                .contentType("application/json")
                .content("""{"fullName":"Maria Fernanda Cruz","adults":2}""")
                .principal(clienta),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.fullName").value("Maria Fernanda Cruz"))
    }

    @Test
    fun `la baja responde 204 sin cuerpo`() {
        mvc.perform(delete("/product/invitations/4/guests/12").principal(clienta))
            .andExpect(status().isNoContent)

        verify(servicio).eliminar(eq(7L), any(), eq(4L), eq(12L))
    }

    // =============================================================================================
    // Pegado
    // =============================================================================================

    @Test
    fun `la vista previa devuelve listos y problemas con su pista`() {
        whenever(servicio.analizar(any(), any(), any(), anyOrNull())).doReturn(
            GuestPasteResponse(
                ready = listOf(GuestDraft("Ana Ruiz", null, null, null, 1, 0, 0)),
                problems = listOf(
                    GuestProblem(3, ", 2", "GUEST_INVALID", "Falta el nombre.", "Escríbelo antes de la primera coma."),
                ),
            ),
        )

        mvc.perform(
            post("/product/invitations/4/guests:preview")
                .contentType("application/json")
                .content("""{"text":"Ana Ruiz\n, 2"}""")
                .principal(clienta),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ready[0].fullName").value("Ana Ruiz"))
            .andExpect(jsonPath("$.problems[0].line").value(3))
            .andExpect(jsonPath("$.problems[0].code").value("GUEST_INVALID"))
            .andExpect(jsonPath("$.problems[0].hint").value("Escríbelo antes de la primera coma."))
    }

    @Test
    fun `la importacion devuelve los creados y los renglones con problema`() {
        whenever(servicio.importar(any(), any(), any(), anyOrNull())).doReturn(
            GuestImportResponse(
                ready = listOf(item()),
                problems = listOf(GuestProblem(2, "x", "GUEST_DUPLICATE", "Ya tienes un invitado con este correo.", "Quita este renglón o escribe un correo distinto.")),
            ),
        )

        mvc.perform(
            post("/product/invitations/4/guests:import")
                .contentType("application/json")
                .content("""{"text":"Ana Ruiz"}""")
                .principal(clienta),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.ready[0].id").value(12))
            .andExpect(jsonPath("$.problems[0].code").value("GUEST_DUPLICATE"))
    }

    // =============================================================================================
    // Compartir y exportar
    // =============================================================================================

    @Test
    fun `el enlace es la unica ruta que devuelve el token, ya montado en la URL`() {
        whenever(servicio.enlace(any(), any(), any(), any())).doReturn(
            GuestLinkResponse(
                url = "https://linoysello.test/r/abc123",
                whatsappUrl = "https://wa.me/5215512345678?text=hola",
                shareText = "Maria, te compartimos tu invitación.",
            ),
        )

        mvc.perform(get("/product/invitations/4/guests/12/link").principal(clienta))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.url").value("https://linoysello.test/r/abc123"))
            .andExpect(jsonPath("$.whatsappUrl").value("https://wa.me/5215512345678?text=hola"))
            .andExpect(jsonPath("$.shareText").value("Maria, te compartimos tu invitación."))
    }

    @Test
    fun `sin telefono el enlace no incluye la clave whatsappUrl`() {
        whenever(servicio.enlace(any(), any(), any(), any())).doReturn(
            GuestLinkResponse("https://linoysello.test/r/abc123", null, "Maria, te compartimos tu invitación."),
        )

        val cuerpo = mvc.perform(get("/product/invitations/4/guests/12/link").principal(clienta))
            .andExpect(status().isOk)
            .andReturn().response.contentAsString

        assertFalse(cuerpo.contains("whatsappUrl"), "sin teléfono no se manda un wa.me roto")
    }

    @Test
    fun `el csv sale como texto csv con BOM y sin tokens`() {
        whenever(servicio.exportarCsv(any(), any(), any()))
            .doReturn(GuestCsvWriter().escribir(listOf(item())))

        val respuesta = mvc.perform(get("/product/invitations/4/guests/export.csv").principal(clienta))
            .andExpect(status().isOk)
            .andReturn().response

        val texto = String(respuesta.contentAsByteArray, Charsets.UTF_8)
        assertTrue(respuesta.contentType!!.startsWith("text/csv"), "el tipo debe ser text/csv")
        assertTrue(texto.startsWith("\uFEFF"), "el CSV lleva BOM UTF-8 para que Excel no rompa los acentos")
        assertTrue(texto.contains("Nombre,Correo,Teléfono"), "encabezados en es-MX")
        assertFalse(texto.contains("confirmationToken"), "el CSV no lleva tokens (S-13)")
    }

    // =============================================================================================
    // Errores
    // =============================================================================================

    /**
     * La ruta ya no está en `501`: se construyó en esta sesión. `202` porque el correo se encola y
     * sale en segundo plano — la respuesta promete que se aceptó, no que se entregó.
     */
    @Test
    fun `el envio por correo responde 202 y delega en el servicio`() {
        mvc.perform(post("/product/invitations/4/guests/12:send-email").principal(clienta))
            .andExpect(status().isAccepted)

        verify(servicio).enviarCorreo(7L, AppRole.USER, 4L, 12L)
    }

    /**
     * Y cuando no se puede mandar —sin publicar, sin correo del invitado, o agotada la cuota del
     * día— es `409 RSVP_CLOSED` con el motivo, como fija el contrato §1.
     */
    @Test
    fun `el envio imposible responde 409 RSVP_CLOSED con el motivo`() {
        whenever(servicio.enviarCorreo(any(), any(), any(), any()))
            .doThrow(GuestPanelException.RsvpClosed("Publica tu invitación antes de enviarla"))

        mvc.perform(post("/product/invitations/4/guests/12:send-email").principal(clienta))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("RSVP_CLOSED"))
            .andExpect(jsonPath("$.message").value("Publica tu invitación antes de enviarla"))
    }

    @Test
    fun `una invitacion ajena y una inexistente responden lo mismo`() {
        whenever(servicio.listar(any(), any(), any(), anyOrNull(), anyOrNull(), anyOrNull(), anyOrNull()))
            .doThrow(GuestPanelException.InvitationNotFound())

        mvc.perform(get("/product/invitations/999/guests").principal(clienta))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("INVITATION_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("No encontramos esta invitación"))
    }

    @Test
    fun `un invitado de otra invitacion responde el mismo 404 que uno inexistente`() {
        whenever(servicio.enlace(any(), any(), any(), any())).doThrow(GuestPanelException.GuestNotFound())

        mvc.perform(get("/product/invitations/4/guests/999/link").principal(clienta))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("GUEST_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("No encontramos a este invitado"))
    }

    /** Nada de nombres de clase, columnas ni trazas en el cuerpo de un fallo del servidor. */
    @Test
    fun `un fallo no previsto responde 500 tipado y sin detalle interno`() {
        whenever(servicio.resumen(any(), any(), any()))
            .doThrow(IllegalStateException("org.hibernate.LazyInitializationException en invitation_guest.email"))

        val cuerpo = mvc.perform(get("/product/invitations/4/guests/summary").principal(clienta))
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.code").value("GUEST_INTERNAL"))
            .andReturn().response.contentAsString

        assertFalse(cuerpo.contains("hibernate"), "el cuerpo no filtra detalle interno")
        assertFalse(cuerpo.contains("invitation_guest"), "el cuerpo no filtra nombres de tabla")
    }

    private fun item() = GuestItem(
        id = 12,
        fullName = "Maria Fernanda Cruz",
        email = "maria@correo.test",
        phone = "+52 55 1234 5678",
        tableNumber = 4,
        adults = 2,
        children = 1,
        young = 0,
        adultsConfirmed = 2,
        childrenConfirmed = 1,
        youngConfirmed = 0,
        status = "CONFIRMED",
        message = "Felicidades",
        updatedAt = "2026-03-01T18:22:10Z",
    )
}
