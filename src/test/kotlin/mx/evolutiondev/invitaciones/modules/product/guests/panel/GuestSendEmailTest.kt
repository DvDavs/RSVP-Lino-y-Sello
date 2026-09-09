package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever
import java.time.Instant
import java.time.temporal.ChronoUnit

/** Lo que el doble del emisor guarda de cada envío, para poder afirmar sobre el mensaje. */
data class CorreoEnviado(val destinatario: String, val nombre: String?, val url: String)

/**
 * Doble de [GuestLinkMailer]: no manda nada y apunta lo que le pidieron mandar.
 *
 * Existe porque en este entorno `core/email` no puede entregar correo —el transporte está escrito en
 * el código con la cuenta de la empresa (`MailConfig.kt:23-30`, hallazgo S-01) y no hay salida SMTP—
 * y **inventar un envío falso sería peor que no tenerlo**: la ruta se ejercita entera contra la
 * interfaz, que es lo que en producción cambia de implementación y no de contrato.
 */
class MensajeroDePrueba : GuestLinkMailer {
    val enviados = mutableListOf<CorreoEnviado>()
    override fun enviar(destinatario: String, nombre: String?, url: String) {
        enviados += CorreoEnviado(destinatario, nombre, url)
    }
}

/**
 * `POST …/guests/{guestId}:send-email` (contrato `5-2` §1), la ruta que quedó declarada en `501` y
 * que esta sesión construye.
 *
 * Lo que se comprueba aquí es, en este orden, **quién puede** disparar el envío, **a dónde** va y
 * **qué dice**; el transporte se sustituye por [MensajeroDePrueba].
 */
class GuestSendEmailTest {

    private val motor: InvitationGuestsService = mock()
    private val repositorio: InvitationGuestsRepository = mock()
    private val mensajero = MensajeroDePrueba()
    private val releases: GuestReleaseReader = mock()
    private val limite = GuestEmailDailyLimit(maxPorDia = 2)

    private val servicio = GuestPanelService(
        motor,
        repositorio,
        GuestPasteReader(),
        GuestShareLinkBuilder("https://linoysello.test/"),
        GuestCsvWriter(),
        mensajero,
        releases,
        limite,
    )

    private val laInvitacion: InvitationEntity = mock()
    private val elInvitado = invitado()

    // =============================================================================================
    // Quién puede
    // =============================================================================================

    /**
     * La invitación se autoriza **antes** de cualquier otra cosa: una invitación ajena no llega ni a
     * consultar al invitado, y desde luego no manda correo.
     */
    @Test
    fun `una invitacion ajena no manda ningun correo`() {
        whenever(motor.validateInvitation(any(), any(), any()))
            .doThrow(IllegalArgumentException("No tienes permisos para acceder a esta invitación"))

        assertThrows<GuestPanelException> { servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO) }

        assertTrue(mensajero.enviados.isEmpty())
    }

    /**
     * **El IDOR con acuse de recibo**: sin el cruce de S-04, `:send-email` sería una forma de mandar
     * el enlace personal de un invitado ajeno a la dirección que ese invitado tenga. `getGuest` es
     * quien cruza `guest.invitation.id` con la ruta, y su fallo es el mismo que el de «no existe».
     */
    @Test
    fun `un invitado de otra invitacion no recibe nada`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doThrow(GuestNotFoundException("no existe"))

        val fallo = assertThrows<GuestPanelException> {
            servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        }

        assertEquals(GuestPanelErrorCode.GUEST_NOT_FOUND, fallo.code)
        assertTrue(mensajero.enviados.isEmpty())
    }

    // =============================================================================================
    // Cuándo tiene sentido
    // =============================================================================================

    /** Sin correo no hay a dónde mandarlo: `409 RSVP_CLOSED` con el motivo, como pide el contrato. */
    @Test
    fun `un invitado sin correo responde RSVP_CLOSED y no manda nada`() {
        preparar(invitado(correo = "  "))

        val fallo = assertThrows<GuestPanelException> {
            servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        }

        assertEquals(GuestPanelErrorCode.RSVP_CLOSED, fallo.code)
        assertEquals(409, fallo.code.httpStatus)
        assertTrue(mensajero.enviados.isEmpty())
    }

    /**
     * Sin `tpl_release` activo, `GET /public/` + `r/{token}` responde `404`: mandar el correo sería
     * mandar a la invitada a una puerta cerrada.
     */
    @Test
    fun `sin release activo no se manda el enlace`() {
        preparar(elInvitado, publicada = false)

        val fallo = assertThrows<GuestPanelException> {
            servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        }

        assertEquals(GuestPanelErrorCode.RSVP_CLOSED, fallo.code)
        assertTrue(mensajero.enviados.isEmpty())
    }

    /** El tope por invitación y día del contrato §1: el tercero del día ya no sale. */
    @Test
    fun `el tope por invitacion y dia corta los envios`() {
        preparar(elInvitado)

        servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        val fallo = assertThrows<GuestPanelException> {
            servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)
        }

        assertEquals(GuestPanelErrorCode.RSVP_CLOSED, fallo.code)
        assertEquals(2, mensajero.enviados.size)
    }

    /** Y mañana vuelve a haber cuota: el tope es por día, no un cierre permanente. */
    @Test
    fun `el tope se renueva al dia siguiente`() {
        preparar(elInvitado)
        var ahora = Instant.parse("2026-05-01T10:00:00Z")
        limite.reloj = { ahora }

        repeat(2) { servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO) }
        assertThrows<GuestPanelException> { servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO) }

        ahora = ahora.plus(2, ChronoUnit.DAYS)
        servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)

        assertEquals(3, mensajero.enviados.size)
    }

    // =============================================================================================
    // Qué se manda
    // =============================================================================================

    /**
     * El enlace es el mismo que devuelve la ruta de compartir, construido con `app.frontend.url`
     * (arreglo de **S-08**): `<frontendUrl>/r/<confirmationToken>`, sin ningún dominio en el código.
     */
    @Test
    fun `el correo lleva el enlace personal montado con la url del frontend`() {
        preparar(elInvitado)

        servicio.enviarCorreo(DUENA, AppRole.USER, INVITACION, INVITADO)

        val enviado = mensajero.enviados.single()
        assertEquals("ana@example.com", enviado.destinatario)
        assertEquals("https://linoysello.test/r/$TOKEN", enviado.url)
    }

    /**
     * El texto: es-MX, cálido, **sin emojis**, con la marca, y —lo que de verdad importa— **sin el
     * nombre ni el correo de ningún otro invitado**, que es lo único que un correo de este tipo
     * podría filtrar.
     */
    @Test
    fun `el texto del correo es es-MX, sin emojis y sin datos de terceros`() {
        val correo = GuestLinkEmailText.componer("Ana Sofía Ruiz", "https://linoysello.test/r/$TOKEN", "Lino & Sello")

        assertTrue(correo.asunto.contains("Lino & Sello"), "lleva la marca")
        assertTrue(correo.plano.startsWith("Hola, Ana:"), "saluda por el nombre de pila")
        assertTrue(correo.html.contains("https://linoysello.test/r/$TOKEN"), "y lleva el enlace")
        listOf("Diego", "otro@example.com", "cancellationToken").forEach {
            assertFalse(correo.html.contains(it) || correo.plano.contains(it), "no menciona $it")
        }
        listOf(correo.asunto, correo.html, correo.plano).forEach { texto ->
            assertFalse(
                texto.any { c -> c.code in 0x1F300..0x1FAFF || c.code in 0x2600..0x27BF },
                "sin emojis: la regla del producto",
            )
        }
    }

    // =============================================================================================
    // Ayudas
    // =============================================================================================

    private fun preparar(invitado: InvitationGuestEntity, publicada: Boolean = true) {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doReturn(invitado)
        whenever(releases.tieneReleaseActivo(INVITACION)).doReturn(publicada)
    }

    private fun invitado(correo: String? = "ana@example.com"): InvitationGuestEntity {
        val invitado: InvitationGuestEntity = mock()
        whenever(invitado.email).doReturn(correo)
        whenever(invitado.fullName).doReturn("Ana Sofía Ruiz")
        whenever(invitado.confirmationToken).doReturn(TOKEN)
        return invitado
    }

    private companion object {
        const val DUENA = 7L
        const val INVITACION = 40L
        const val INVITADO = 11L
        const val TOKEN = "muITKb2BiXWAU0Jt7JJiag"
    }
}
