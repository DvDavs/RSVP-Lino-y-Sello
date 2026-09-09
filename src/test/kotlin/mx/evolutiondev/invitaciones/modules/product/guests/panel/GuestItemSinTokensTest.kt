package mx.evolutiondev.invitaciones.modules.product.guests.panel

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

/**
 * **Cierre del hallazgo S-13**: ningún DTO del panel puede llevar `confirmationToken` ni
 * `cancellationToken`.
 *
 * La comprobación es sobre el **JSON serializado**, no sobre la firma de la clase, porque lo que hay
 * que garantizar es lo que sale por el cable: si mañana alguien reutilizara `GuestResponseItem`
 * —que sí los expone (`GuestResponseItem.kt:206-207`)— o añadiera el campo por herencia, esta prueba
 * seguiría fallando.
 *
 * Por sí solo S-13 era de severidad BAJA: son datos de la dueña de la invitación. Lo que lo hacía
 * grave era la combinación con S-04, porque convertía una lectura ajena en la capacidad de contestar
 * y cancelar el RSVP de otra persona.
 */
class GuestItemSinTokensTest {

    private val json = ObjectMapper().registerKotlinModule()

    @Test
    fun `el invitado del panel no serializa ningun token`() {
        val texto = json.writeValueAsString(item())

        assertFalse(texto.contains("confirmationToken"), "S-13: el DTO del panel no lleva confirmationToken")
        assertFalse(texto.contains("cancellationToken"), "S-13: el DTO del panel no lleva cancellationToken")
        assertFalse(texto.contains("token"), "ni ningún otro campo que se llame token")
    }

    /** La lista de campos es la del contrato `5-2` §1, ni uno más. */
    @Test
    fun `el invitado del panel tiene exactamente los campos del contrato`() {
        val campos = json.readTree(json.writeValueAsString(item())).fieldNames().asSequence().toList()

        assertEquals(
            listOf(
                "id", "fullName", "email", "phone", "tableNumber",
                "adults", "children", "young",
                "adultsConfirmed", "childrenConfirmed", "youngConfirmed",
                "status", "message", "updatedAt",
            ),
            campos,
        )
    }

    /** El traductor de la entidad tampoco puede colar un token: se comprueba con la entidad real. */
    @Test
    fun `la traduccion de la entidad deja los tokens fuera`() {
        val entidad: InvitationGuestEntity = mock()
        whenever(entidad.id).doReturn(12L)
        whenever(entidad.fullName).doReturn("María Fernanda Cruz")
        whenever(entidad.email).doReturn("maria@correo.test")
        whenever(entidad.phone).doReturn("+525512345678")
        whenever(entidad.adultsCount).doReturn(2)
        whenever(entidad.childrenCount).doReturn(1)
        whenever(entidad.youngCount).doReturn(0)
        whenever(entidad.adultsCountConfirmed).doReturn(2)
        whenever(entidad.childrenCountConfirmed).doReturn(1)
        whenever(entidad.youngCountConfirmed).doReturn(0)
        whenever(entidad.attendanceStatus).doReturn(AttendanceStatus.CONFIRMED)
        whenever(entidad.confirmationToken).doReturn("token-de-confirmacion-secreto")
        whenever(entidad.cancellationToken).doReturn("token-de-cancelacion-secreto")

        val texto = json.writeValueAsString(entidad.toPanelItem())

        assertFalse(texto.contains("token-de-confirmacion-secreto"), "S-13: el token no puede viajar en el panel")
        assertFalse(texto.contains("token-de-cancelacion-secreto"), "S-13: el token no puede viajar en el panel")
    }

    /** El borrador de la vista previa tampoco: es el mismo invitado antes de existir. */
    @Test
    fun `el borrador del pegado tampoco lleva tokens`() {
        val texto = json.writeValueAsString(GuestDraft("Ana Ruiz", null, null, null, 1, 0, 0))

        assertFalse(texto.contains("token"))
    }

    private fun item() = GuestItem(
        id = 12,
        fullName = "María Fernanda Cruz",
        email = "maria@correo.test",
        phone = "+525512345678",
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
