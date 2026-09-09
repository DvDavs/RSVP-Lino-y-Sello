package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
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
import org.mockito.kotlin.eq
import org.mockito.kotlin.inOrder
import org.mockito.kotlin.mock
import org.mockito.kotlin.argThat
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever

/**
 * La lógica del panel por encima del motor compartido: propiedad de la invitación primero, traducción
 * de fallos después.
 *
 * Todo con dobles: aquí no se comprueba el SQL, se comprueba **quién decide** y **qué se le cuenta al
 * cliente cuando algo falla**.
 */
class GuestPanelServiceTest {

    private val motor: InvitationGuestsService = mock()
    private val repositorio: InvitationGuestsRepository = mock()
    private val servicio = GuestPanelService(
        motor,
        repositorio,
        GuestPasteReader(),
        GuestShareLinkBuilder("https://linoysello.test"),
        GuestCsvWriter(),
    )

    // Los dobles se arman **antes** de cualquier `whenever`: construir un mock dentro de la
    // llamada a `doReturn` deja el stub anterior sin terminar y Mockito lo rechaza.
    private val laInvitacion: InvitationEntity = invitacion()
    private val elInvitado: InvitationGuestEntity = invitado()
    private val invitadoSinToken: InvitationGuestEntity = invitado(token = null)

    // =============================================================================================
    // Propiedad de la invitación
    // =============================================================================================

    /** Ninguna ruta consulta nada antes de que la puerta de propiedad haya dicho que sí. */
    @Test
    fun `una invitacion ajena no llega ni a consultar invitados`() {
        whenever(motor.validateInvitation(any(), any(), any()))
            .doThrow(IllegalArgumentException("No tienes permisos para acceder a esta invitación"))

        val fallo = assertThrows<GuestPanelException> {
            servicio.listar(INTRUSA, AppRole.USER, INVITACION, null, null, null, null)
        }

        assertEquals(GuestPanelErrorCode.INVITATION_NOT_FOUND, fallo.code)
        verifyNoInteractions(repositorio)
    }

    /** «No existe» y «no es tuya» responden lo mismo: distinguirlas sería un oráculo. */
    @Test
    fun `invitacion inexistente e invitacion ajena responden el mismo cuerpo`() {
        whenever(motor.validateInvitation(any(), any(), eq(1L)))
            .doThrow(IllegalArgumentException("La invitación con el id: 1 no existe"))
        whenever(motor.validateInvitation(any(), any(), eq(2L)))
            .doThrow(IllegalArgumentException("No tienes permisos para acceder a esta invitación"))

        val inexistente = assertThrows<GuestPanelException> {
            servicio.resumen(INTRUSA, AppRole.USER, 1L)
        }
        val ajena = assertThrows<GuestPanelException> {
            servicio.resumen(INTRUSA, AppRole.USER, 2L)
        }

        assertEquals(inexistente.code, ajena.code)
        assertEquals(inexistente.message, ajena.message)
    }

    /**
     * La baja pasa antes por `getGuest`, que desde el arreglo de S-04 exige que el invitado sea de
     * **esta** invitación; `deleteGuest` no recibe la invitación en su firma.
     */
    @Test
    fun `la baja comprueba la pertenencia del invitado antes de borrar`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doThrow(GuestNotFoundException("no existe"))

        val fallo = assertThrows<GuestPanelException> {
            servicio.eliminar(DUENA, AppRole.USER, INVITACION, GUEST_AJENO)
        }

        assertEquals(GuestPanelErrorCode.GUEST_NOT_FOUND, fallo.code)
        verify(motor, never()).deleteGuest(any(), any(), any())
    }

    @Test
    fun `la baja legitima llama al motor en el orden correcto`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doReturn(elInvitado)

        servicio.eliminar(DUENA, AppRole.USER, INVITACION, GUEST_PROPIO)

        inOrder(motor) {
            verify(motor).validateInvitation(DUENA, AppRole.USER, INVITACION)
            verify(motor).getGuest(DUENA, AppRole.USER, GUEST_PROPIO, INVITACION)
            verify(motor).deleteGuest(DUENA, AppRole.USER, GUEST_PROPIO)
        }
    }

    // =============================================================================================
    // Traducción de fallos: nada de detalle interno
    // =============================================================================================

    @Test
    fun `un cupo no permitido se traduce a GUEST_QUOTA_EXCEEDED sin copiar el mensaje del motor`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.appendGuest(any(), any(), any(), any()))
            .doThrow(IllegalArgumentException("No se permiten agregar invitados con niños a esta invitación"))

        val fallo = assertThrows<GuestPanelException> {
            servicio.crear(DUENA, AppRole.USER, INVITACION, alta(children = 1))
        }

        assertEquals(GuestPanelErrorCode.GUEST_QUOTA_EXCEEDED, fallo.code)
        assertFalse(fallo.message.orEmpty().contains("agregar invitados"), "no se reenvía el texto del motor")
    }

    @Test
    fun `un estado de filtro desconocido se rechaza en vez de ignorarse`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)

        val fallo = assertThrows<GuestPanelException> {
            servicio.listar(DUENA, AppRole.USER, INVITACION, null, "CANCELADO", null, null)
        }

        assertEquals(GuestPanelErrorCode.GUEST_INVALID, fallo.code)
    }

    @Test
    fun `un alta sin nombre no llega al motor`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)

        val fallo = assertThrows<GuestPanelException> {
            servicio.crear(DUENA, AppRole.USER, INVITACION, alta(nombre = "   "))
        }

        assertEquals(GuestPanelErrorCode.GUEST_INVALID, fallo.code)
        verify(motor, never()).appendGuest(any(), any(), any(), any())
    }

    // =============================================================================================
    // Pegado
    // =============================================================================================

    /** La vista previa **no escribe nada**: es la promesa que hace su nombre. */
    @Test
    fun `la vista previa no da de alta a nadie`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)

        val respuesta = servicio.analizar(DUENA, AppRole.USER, INVITACION, "Ana Ruiz, 2, 0, 0\n, 1")

        assertEquals(1, respuesta.ready.size)
        assertEquals(1, respuesta.problems.size)
        verify(motor, never()).appendGuest(any(), any(), any(), any())
    }

    /** Un renglón que el motor rechaza no tumba la importación entera. */
    @Test
    fun `la importacion sigue adelante cuando un renglon falla`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.appendGuest(any(), any(), eq(INVITACION), argThat { childrenCount == 1 }))
            .doThrow(IllegalArgumentException("No se permiten agregar invitados con niños a esta invitación"))
        whenever(repositorio.findByInvitationIdAndIsEnabledTrue(INVITACION)).doReturn(emptyList())

        val respuesta = servicio.importar(
            DUENA,
            AppRole.USER,
            INVITACION,
            "Con Ninos, 1, 1, 0\nAna Ruiz, 1, 0, 0",
        )

        assertEquals(1, respuesta.problems.size)
        assertEquals("GUEST_QUOTA_EXCEEDED", respuesta.problems.single().code)
        assertTrue(respuesta.problems.single().hint.isNotBlank(), "también los fallos del motor traen pista")
        verify(motor, times(2)).appendGuest(any(), any(), any(), any())
    }

    // =============================================================================================
    // Compartir
    // =============================================================================================

    @Test
    fun `el enlace monta el token en la url del origen configurado`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doReturn(elInvitado)

        val respuesta = servicio.enlace(DUENA, AppRole.USER, INVITACION, GUEST_PROPIO)

        assertEquals("https://linoysello.test/r/token-de-confirmacion", respuesta.url)
        assertTrue(respuesta.whatsappUrl!!.startsWith("https://wa.me/525512345678?text="))
        assertTrue(respuesta.shareText.startsWith("Ana, "))
    }

    @Test
    fun `un invitado sin token no devuelve una url a medias`() {
        whenever(motor.validateInvitation(any(), any(), any())).doReturn(laInvitacion)
        whenever(motor.getGuest(any(), any(), any(), any())).doReturn(invitadoSinToken)

        val fallo = assertThrows<GuestPanelException> {
            servicio.enlace(DUENA, AppRole.USER, INVITACION, GUEST_PROPIO)
        }

        assertEquals(GuestPanelErrorCode.GUEST_INVALID, fallo.code)
    }

    // =============================================================================================
    // Ayudas
    // =============================================================================================

    private fun alta(nombre: String = "Ana Ruiz", children: Int = 0) = GuestUpsertRequest(
        fullName = nombre,
        email = null,
        phone = null,
        tableNumber = null,
        adults = 1,
        children = children,
        young = 0,
    )

    private fun invitacion(): InvitationEntity {
        val invitacion: InvitationEntity = mock()
        whenever(invitacion.id).doReturn(INVITACION)
        whenever(invitacion.childrenAllowed).doReturn(false)
        whenever(invitacion.youngAllowed).doReturn(false)
        return invitacion
    }

    private fun invitado(token: String? = "token-de-confirmacion"): InvitationGuestEntity {
        val invitado: InvitationGuestEntity = mock()
        whenever(invitado.id).doReturn(GUEST_PROPIO)
        whenever(invitado.fullName).doReturn("Ana Ruiz")
        whenever(invitado.phone).doReturn("+52 55 1234 5678")
        whenever(invitado.attendanceStatus).doReturn(AttendanceStatus.PENDING)
        whenever(invitado.confirmationToken).doReturn(token)
        return invitado
    }

    companion object {
        const val DUENA = 7L
        const val INTRUSA = 8L
        const val INVITACION = 40L
        const val GUEST_PROPIO = 11L
        const val GUEST_AJENO = 55L
    }
}
