package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import java.text.SimpleDateFormat
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.EmailGuestNotifier
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.GuestAttendanceService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.ConfirmAttendanceRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * Las dos cosas que esta sesión endureció en `modules/shared/guests`, comprobadas desde fuera.
 *
 * Viven en el paquete del RSVP porque son **su** invariante: si `GuestAttendanceService` volviera a
 * escribir el correo, la superficie pública nueva volvería a ser tomable con solo interceptar un
 * enlace, aunque su propio DTO no tenga el campo.
 */
class GuestAttendanceEndurecidoTest {

    private val repositorio: InvitationGuestsRepository = mock()
    private val notificador: EmailGuestNotifier = mock()
    private val jwt: JwtUtil = mock()
    private val servicio = GuestAttendanceService(repositorio, notificador, jwt)

    /**
     * **S-07 (severidad MEDIA), cerrado.**
     *
     * Antes, `GuestAttendanceService.kt:35-49` guardaba el correo del cuerpo si era distinto, sin
     * confirmarlo y sin avisar al anterior: quien interceptara el enlace redirigía a su buzón todos
     * los avisos posteriores, incluido el que lleva el `cancellationToken`, y con eso se quedaba con
     * el RSVP. Ahora el campo se ignora, **y sin error**, que es lo que el contrato §2 pide.
     *
     * Se comprueba sobre lo que se **guarda**, no sobre lo que se devuelve: es el `save` lo que
     * cambiaba el destino de las notificaciones.
     */
    @Test
    fun `un correo en el cuerpo no cambia el correo guardado del invitado`() {
        val invitado = invitado()
        whenever(repositorio.findByConfirmationToken(TOKEN)).doReturn(invitado)
        whenever(repositorio.save(any<InvitationGuestEntity>())).doAnswer { it.arguments[0] as InvitationGuestEntity }
        whenever(jwt.generateSecureToken()).doReturn("token-de-cancelacion")

        val resultado = servicio.confirmAttendance(
            TOKEN,
            ConfirmAttendanceRequest(
                isAttending = true,
                email = "atacante@example.com",
                adultsConfirmed = 2,
                childrenConfirmed = 0,
                youngConfirmed = 0,
                message = null,
            ),
        )

        val guardados = argumentCaptor<InvitationGuestEntity>()
        verify(repositorio, org.mockito.kotlin.atLeastOnce()).save(guardados.capture())
        guardados.allValues.forEach {
            assertEquals(CORREO_ORIGINAL, it.email, "el RSVP no puede reescribir el correo del invitado (S-07)")
        }
        assertEquals(CORREO_ORIGINAL, resultado.email)
        assertEquals(AttendanceStatus.CONFIRMED, resultado.attendanceStatus, "y la confirmacion si se procesa")
    }

    /** El camino que se borró tampoco debe consultar por correo: ya no hay nada que comprobar. */
    @Test
    fun `el correo del cuerpo ni siquiera se consulta`() {
        val invitado = invitado()
        whenever(repositorio.findByConfirmationToken(TOKEN)).doReturn(invitado)
        whenever(repositorio.save(any<InvitationGuestEntity>())).doAnswer { it.arguments[0] as InvitationGuestEntity }
        whenever(jwt.generateSecureToken()).doReturn("token-de-cancelacion")

        servicio.confirmAttendance(
            TOKEN,
            ConfirmAttendanceRequest(true, "atacante@example.com", 1, 0, 0, null),
        )

        verify(repositorio, never()).findByInvitationIdAndEmailAndIsEnabledTrue(any(), anyOrNull())
    }

    /**
     * `event.closed` del `GET` y el rechazo del `PUT` tienen que ser **la misma** regla. Lo son
     * porque los dos llaman a `GuestAttendanceService.eventoCerrado`, y esta prueba fija su
     * semántica: el día del evento ya cuenta como cerrado, porque `isAtLeastOneDayBefore` compara por
     * día natural (`StringUtilsKtx.kt:34-38`).
     */
    @Test
    fun `eventoCerrado es la unica definicion y cierra el mismo dia del evento`() {
        val ahora = SimpleDateFormat("yyyy-MM-dd HH:mm").parse("2026-05-10 09:00")

        assertFalse(GuestAttendanceService.eventoCerrado("2026-05-11", "17:00", ahora), "manana: abierto")
        assertTrue(GuestAttendanceService.eventoCerrado("2026-05-10", "23:00", ahora), "hoy: cerrado")
        assertTrue(GuestAttendanceService.eventoCerrado("2026-05-09", "17:00", ahora), "ayer: cerrado")
    }

    /** Una fecha ilegible no puede abrir el formulario: `toDate` cae a «ahora», que es hoy. */
    @Test
    fun `una fecha ilegible se trata como cerrada`() {
        assertTrue(GuestAttendanceService.eventoCerrado("", ""))
        assertTrue(GuestAttendanceService.eventoCerrado("no-es-una-fecha", "ni-una-hora"))
    }

    private fun invitado() = InvitationGuestEntity(
        id = 12,
        invitation = InvitationEntity(
            id = 7,
            template = mock(),
            customer = mock(),
            date = "2099-12-31",
            time = "17:00",
            childrenAllowed = true,
            youngAllowed = true,
        ),
        fullName = "María Fernanda Cruz",
        email = CORREO_ORIGINAL,
        adultsCount = 2,
        childrenCount = 1,
        youngCount = 0,
        confirmationToken = TOKEN,
    )

    private companion object {
        const val TOKEN = "aB3dEfGhIjKlMnOpQrStUv"
        const val CORREO_ORIGINAL = "maria@example.com"
    }
}
