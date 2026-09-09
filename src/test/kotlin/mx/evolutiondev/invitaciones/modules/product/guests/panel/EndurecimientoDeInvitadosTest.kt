package mx.evolutiondev.invitaciones.modules.product.guests.panel

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestsCreationRequest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

/**
 * Los dos endurecimientos del motor compartido que exige el contrato `5-2` §0.1, comprobados desde
 * el subpaquete que los necesita.
 *
 * - **S-04** (IDOR, severidad ALTA): `updateGuest`, `getGuest` y `cancelAttendanceFromDashboard`
 *   validaban la invitación y después cargaban el invitado **por id suelto**. Quien tuviera una
 *   invitación propia leía y modificaba invitados de cualquier otra recorriendo ids, incluidos sus
 *   dos tokens (`GuestResponseItem.kt:206-207`), es decir, podía contestar y cancelar el RSVP ajeno.
 * - **S-05** (severidad MEDIA): `deleteGuest` solo comprobaba pertenencia cuando el rol era `USER`;
 *   para `ADMIN` no comprobaba nada y acto seguido hacía **borrado físico**.
 *
 * El arreglo vive en el servicio compartido, así que cubre a la vez `/admin/` + `**` y el panel
 * nuevo. La prueba se escribe aquí porque este subpaquete es el territorio de esta sesión.
 */
class EndurecimientoDeInvitadosTest {

    private val invitados: InvitationGuestsRepository = mock()
    private val invitaciones: InvitationRepository = mock()
    private val jerarquia: HierarchyValidationService = mock()

    private val servicio = InvitationGuestsService(
        invitados,
        invitaciones,
        mock(),
        mock(),
        jerarquia,
        mock(),
        mock(),
    )

    // =============================================================================================
    // S-04
    // =============================================================================================

    /**
     * El literal tiene que ser **el mismo** que el del «no existe» (`InvitationGuestsService.kt`,
     * `findGuestById`): si el mensaje delatara la diferencia entre «no es tuyo» y «no existe»,
     * el arreglo habría cambiado un IDOR por un oráculo de enumeración.
     */
    @Test
    fun `getGuest con un invitado de otra invitacion falla igual que con uno inexistente`() {
        conInvitacionPropia(MIA)
        invitadoAjeno()
        invitadoInexistente()

        val ajeno = assertThrows<GuestNotFoundException> {
            servicio.getGuest(DUENA, AppRole.USER, ID_AJENO, MIA)
        }
        val inexistente = assertThrows<GuestNotFoundException> {
            servicio.getGuest(DUENA, AppRole.USER, ID_INEXISTENTE, MIA)
        }

        assertEquals("El invitado con el id: $ID_AJENO no existe", ajeno.message)
        assertEquals("El invitado con el id: $ID_INEXISTENTE no existe", inexistente.message)
        assertEquals(
            plantilla(ajeno.message, ID_AJENO),
            plantilla(inexistente.message, ID_INEXISTENTE),
            "los dos fallos tienen que ser indistinguibles salvo por el id que pidió el cliente",
        )
    }

    @Test
    fun `updateGuest no toca a un invitado de otra invitacion`() {
        conInvitacionPropia(MIA)
        invitadoAjeno()

        val fallo = assertThrows<GuestNotFoundException> {
            servicio.updateGuest(DUENA, AppRole.USER, ID_AJENO, MIA, peticion())
        }

        assertEquals("El invitado con el id: $ID_AJENO no existe", fallo.message)
        verify(invitados, never()).save(any())
    }

    @Test
    fun `cancelAttendanceFromDashboard no cancela a un invitado de otra invitacion`() {
        conInvitacionPropia(MIA)
        invitadoAjeno(AttendanceStatus.CONFIRMED)

        val fallo = assertThrows<GuestNotFoundException> {
            servicio.cancelAttendanceFromDashboard(DUENA, AppRole.USER, MIA, ID_AJENO)
        }

        assertEquals("El invitado con el id: $ID_AJENO no existe", fallo.message)
        verify(invitados, never()).save(any())
    }

    // =============================================================================================
    // S-05
    // =============================================================================================

    /** El borrado es **físico** (`hardDeleteById`), así que un fallo aquí es irreversible. */
    @Test
    fun `deleteGuest con rol ADMIN no borra un invitado fuera de su jerarquia`() {
        val invitado = invitadoDe(ID_AJENO, AJENA)
        val laAjena = invitacion(AJENA)
        whenever(invitados.findById(ID_AJENO)).doReturn(Optional.of(invitado))
        whenever(invitaciones.findById(AJENA)).doReturn(Optional.of(laAjena))
        whenever(jerarquia.validateInvitationAccess(ADMINISTRADORA, AJENA)).doReturn(false)

        assertThrows<IllegalArgumentException> {
            servicio.deleteGuest(ADMINISTRADORA, AppRole.ADMIN, ID_AJENO)
        }

        verify(invitados, never()).hardDeleteById(any())
    }

    @Test
    fun `deleteGuest sigue borrando lo que si es de la jerarquia`() {
        val invitado = invitadoDe(ID_PROPIO, MIA)
        val laMia = invitacion(MIA)
        whenever(invitados.findById(ID_PROPIO)).doReturn(Optional.of(invitado))
        whenever(invitaciones.findById(MIA)).doReturn(Optional.of(laMia))
        whenever(jerarquia.validateInvitationAccess(ADMINISTRADORA, MIA)).doReturn(true)

        servicio.deleteGuest(ADMINISTRADORA, AppRole.ADMIN, ID_PROPIO)

        verify(invitados).hardDeleteById(ID_PROPIO)
    }

    // =============================================================================================
    // Ayudas
    // =============================================================================================

    private fun conInvitacionPropia(invitationId: Long) {
        val propia = invitacion(invitationId)
        whenever(invitaciones.findById(invitationId)).doReturn(Optional.of(propia))
        whenever(jerarquia.validateInvitationAccess(DUENA, invitationId)).doReturn(true)
    }

    private fun invitadoAjeno(estado: AttendanceStatus = AttendanceStatus.PENDING) {
        val ajeno = invitadoDe(ID_AJENO, AJENA, estado)
        whenever(invitados.findById(ID_AJENO)).doReturn(Optional.of(ajeno))
    }

    private fun invitadoInexistente() {
        whenever(invitados.findById(ID_INEXISTENTE)).doReturn(Optional.empty())
    }

    private fun invitacion(id: Long): InvitationEntity {
        val invitacion: InvitationEntity = mock()
        whenever(invitacion.id).doReturn(id)
        whenever(invitacion.isEnabled).doReturn(true)
        whenever(invitacion.childrenAllowed).doReturn(true)
        whenever(invitacion.youngAllowed).doReturn(true)
        return invitacion
    }

    private fun invitadoDe(
        guestId: Long,
        invitationId: Long,
        estado: AttendanceStatus = AttendanceStatus.PENDING,
    ): InvitationGuestEntity {
        // La invitación se arma **antes**: encadenar dos `whenever` anidados es un stub sin
        // terminar y Mockito lo rechaza.
        val suInvitacion = invitacion(invitationId)
        val invitado: InvitationGuestEntity = mock()
        whenever(invitado.id).doReturn(guestId)
        whenever(invitado.invitation).doReturn(suInvitacion)
        whenever(invitado.isEnabled).doReturn(true)
        whenever(invitado.attendanceStatus).doReturn(estado)
        return invitado
    }

    private fun peticion() = GuestsCreationRequest(
        fullName = "Quien Sea",
        email = "",
        graduatesName = "",
        phone = "",
        adultsCount = 1,
        childrenCount = 0,
        youngCount = 0,
    )

    /** Deja el mensaje sin el id que pidió el cliente, para comparar las dos plantillas. */
    private fun plantilla(mensaje: String?, id: Long) = mensaje.orEmpty().replace(id.toString(), "#")

    companion object {
        const val DUENA = 7L
        const val ADMINISTRADORA = 3L
        const val MIA = 40L
        const val AJENA = 99L
        const val ID_PROPIO = 11L
        const val ID_AJENO = 55L
        const val ID_INEXISTENTE = 56L
    }
}
