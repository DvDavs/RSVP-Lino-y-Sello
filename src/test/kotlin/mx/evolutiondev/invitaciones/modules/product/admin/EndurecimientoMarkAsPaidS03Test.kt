package mx.evolutiondev.invitaciones.modules.product.admin

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.InvitationAdminService
import mx.evolutiondev.invitaciones.modules.master.templates.repository.InvitationTemplateRepository
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.InvitationGuestNotificationRepository
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPersistenceHelper
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPriceCalculatorService
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationValidationService
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.InvitationConfigRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationNotificationService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Optional

/**
 * **Hallazgo S-03 cerrado y con prueba** (`12-producto-completo.md §A3`, **ADR-5-E5-01**).
 *
 * `PUT /admin/invitations/{id}/mark-as-paid` no comprobaba jerarquía: cualquier cuenta con rol ADMIN
 * marcaba como pagada **cualquier** invitación del sistema recorriendo ids
 * (`modules/admin/invitations/service/InvitationAdminService.kt`, método `markAsPaid`). Con la puerta
 * de publicación de ADR-5-0B-01 —publicar exige plan pagado— eso equivale a regalar el producto.
 *
 * ### Por qué esta prueba vive en el paquete de E5 y no junto al servicio que arregla
 * `modules/admin` es módulo heredado y esta sesión tiene **un solo** cambio autorizado en él: la
 * llamada a `HierarchyValidationService`. La prueba que lo custodia es entregable de E5 y por eso está
 * en su carpeta, con el nombre del hallazgo delante para que buscar «S-03» la encuentre.
 *
 * ### Qué se afirma, y por qué así
 * No basta con «devuelve 403». Se afirma también que **no se toca la base**: que el repositorio de
 * invitaciones no recibe ni un `findById` ni un `save` cuando la jerarquía dice que no. Un arreglo que
 * comprobara después de leer y antes de guardar cerraría la escritura pero dejaría en pie el oráculo
 * de existencia de S-02 («no existe» vs. «no tienes permisos»). La comprobación va **primero**.
 */
class EndurecimientoMarkAsPaidS03Test {

    private val invitaciones: InvitationRepository = mock()
    private val clientes: CustomerRepository = mock()
    private val plantillas: InvitationTemplateRepository = mock()
    private val jerarquia: HierarchyValidationService = mock()
    private val persistencia: InvitationPersistenceHelper = mock()
    private val notificaciones: InvitationNotificationService = mock()
    private val precios: InvitationPriceCalculatorService = mock()
    private val validaciones: InvitationValidationService = mock()
    private val avisosDeInvitados: InvitationGuestNotificationRepository = mock()
    private val configuracion: InvitationConfigRepository = mock()

    private val servicio = InvitationAdminService(
        invitaciones, clientes, plantillas, jerarquia, persistencia, notificaciones,
        precios, validaciones, avisosDeInvitados, configuracion,
    )

    private val ID_INVITACION = 7L
    private val ID_ADMIN_AJENO = 99L
    private val ID_MASTER = 1L

    private fun invitacionSinPagar() = InvitationEntity(
        id = ID_INVITACION,
        template = mock<InvitationTemplateEntity>(),
        customer = CustomerEntity(id = 12),
        isPaid = false,
    )

    @Test
    fun `un ADMIN fuera de la jerarquia no puede marcar como pagada y no toca la base`() {
        whenever(jerarquia.validateInvitationAccess(eq(ID_ADMIN_AJENO), eq(ID_INVITACION))).thenReturn(false)

        val error = assertThrows<UnauthorizedAccessException> {
            servicio.markAsPaid(ID_INVITACION, ID_ADMIN_AJENO)
        }

        assertTrue(error.message.orEmpty().isNotBlank())
        assertFalse(
            error.message.orEmpty().contains("no existe"),
            "el mensaje no debe distinguir «no existe» de «no puedes»: sería el oráculo de S-02",
        )
        verify(invitaciones, never()).findById(any())
        verify(invitaciones, never()).save(any())
    }

    @Test
    fun `un MASTER sigue pudiendo marcar como pagada cualquier invitacion`() {
        whenever(jerarquia.validateInvitationAccess(eq(ID_MASTER), eq(ID_INVITACION))).thenReturn(true)
        val invitacion = invitacionSinPagar()
        whenever(invitaciones.findById(ID_INVITACION)).thenReturn(Optional.of(invitacion))

        servicio.markAsPaid(ID_INVITACION, ID_MASTER)

        assertTrue(invitacion.isPaid, "la invitación queda pagada")
        assertEquals(ID_MASTER, invitacion.updatedBy)
        verify(invitaciones).save(invitacion)
    }

    /** La comprobación es lo primero: se le pregunta a la jerarquía en toda llamada, no solo al fallar. */
    @Test
    fun `siempre se le pregunta a la jerarquia`() {
        whenever(jerarquia.validateInvitationAccess(any(), any())).thenReturn(true)
        whenever(invitaciones.findById(ID_INVITACION)).thenReturn(Optional.of(invitacionSinPagar()))

        servicio.markAsPaid(ID_INVITACION, ID_MASTER)

        verify(jerarquia).validateInvitationAccess(ID_MASTER, ID_INVITACION)
    }
}
