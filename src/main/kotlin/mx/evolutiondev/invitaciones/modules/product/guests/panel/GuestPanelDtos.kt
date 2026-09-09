package mx.evolutiondev.invitaciones.modules.product.guests.panel

import com.fasterxml.jackson.annotation.JsonInclude
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity

/**
 * Cuerpos de las rutas del panel de invitados de la clienta (contrato `5-2` §1).
 *
 * **La regla que manda en este fichero**: ningún DTO de aquí lleva `confirmationToken` ni
 * `cancellationToken`. Es el cierre del hallazgo **S-13** (`12-producto-completo.md §A3`), que por sí
 * solo era de severidad BAJA pero, combinado con el IDOR de S-04, convertía una lectura ajena en una
 * toma de control del RSVP de otra persona. Por eso **no** se reutiliza
 * `shared/guests/service/model/GuestResponseItem.kt:206-207`, que sí los expone: se declara aquí un
 * [GuestItem] propio, y el único sitio del backend nuevo donde un token vuelve a aparecer es
 * [GuestLinkResponse], ya montado dentro de la URL que la clienta va a compartir.
 *
 * Nombres de clase y campos en inglés como todo el repositorio; los textos que ve la clienta, en
 * es-MX.
 */
data class GuestItem(
    val id: Long,
    val fullName: String?,
    val email: String?,
    val phone: String?,
    val tableNumber: Int?,
    val adults: Int,
    val children: Int,
    val young: Int,
    val adultsConfirmed: Int,
    val childrenConfirmed: Int,
    val youngConfirmed: Int,
    val status: String,
    val message: String?,
    val updatedAt: String?,
)

/** Traduce la entidad al DTO del panel **dejando fuera los dos tokens** (S-13). */
fun InvitationGuestEntity.toPanelItem(): GuestItem = GuestItem(
    id = this.id,
    fullName = this.fullName,
    email = this.email,
    phone = this.phone,
    tableNumber = this.tableNumber,
    adults = this.adultsCount ?: 0,
    children = this.childrenCount,
    young = this.youngCount,
    adultsConfirmed = this.adultsCountConfirmed,
    childrenConfirmed = this.childrenCountConfirmed,
    youngConfirmed = this.youngCountConfirmed,
    status = this.attendanceStatus.name,
    message = this.congratulationsMessage,
    updatedAt = this.updatedAt?.toString(),
)

/** Página del listado (contrato §1, `GET …/guests`). `page` es base 0, como pide el contrato. */
data class GuestPage(
    val content: List<GuestItem>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
)

/** Alta y edición unitarias. Solo `fullName` es obligatorio; los cupos vacíos valen cero. */
data class GuestUpsertRequest(
    val fullName: String?,
    val email: String?,
    val phone: String?,
    val tableNumber: Int?,
    val adults: Int?,
    val children: Int?,
    val young: Int?,
)

/** Texto pegado por la clienta: un invitado por renglón. */
data class GuestPasteRequest(val text: String?)

/**
 * Renglón entendido y listo para dar de alta: el [GuestItem] sin `id`, `status` ni `updatedAt`
 * (contrato §1). Tampoco lleva los tres contadores de confirmados, que en un borrador siempre
 * valdrían cero y solo serían ruido.
 */
data class GuestDraft(
    val fullName: String,
    val email: String?,
    val phone: String?,
    val tableNumber: Int?,
    val adults: Int,
    val children: Int,
    val young: Int,
)

/**
 * Renglón que no se pudo usar. `message` dice **qué** pasa y `hint` dice **cómo** arreglarlo: un
 * «formato inválido» a secas deja a la clienta sin saber qué tocar, que es justo lo que el contrato
 * §1 prohíbe.
 */
data class GuestProblem(
    val line: Int,
    val raw: String,
    val code: String,
    val message: String,
    val hint: String,
)

/** Respuesta de `:preview` (no escribe nada) y de `:import` (ya con los invitados creados). */
data class GuestPasteResponse(
    val ready: List<GuestDraft>,
    val problems: List<GuestProblem>,
)

/** Respuesta de `:import`: misma forma que `:preview`, con los renglones creados como [GuestItem]. */
data class GuestImportResponse(
    val ready: List<GuestItem>,
    val problems: List<GuestProblem>,
)

/** Contadores en vivo (contrato §1, `GET …/guests/summary`). */
data class GuestSummaryResponse(
    val guests: GuestCounts,
    val seats: SeatCounts,
    val rules: EventRules,
)

data class GuestCounts(
    val total: Int,
    val pending: Int,
    val confirmed: Int,
    val declined: Int,
)

data class SeatCounts(
    val adults: SeatPair,
    val children: SeatPair,
    val young: SeatPair,
    val totalInvited: Int,
    val totalConfirmed: Int,
)

data class SeatPair(val invited: Int, val confirmed: Int)

data class EventRules(val childrenAllowed: Boolean, val youngAllowed: Boolean)

/**
 * La **única** respuesta del backend nuevo en la que aparece un token de invitado, y aparece ya
 * montado en la URL final que la clienta va a compartir (contrato §0.3 y §1).
 *
 * `whatsappUrl` se omite cuando el invitado no tiene teléfono: un `wa.me` sin número no lleva a
 * ninguna parte.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class GuestLinkResponse(
    val url: String,
    val whatsappUrl: String?,
    val shareText: String,
)
