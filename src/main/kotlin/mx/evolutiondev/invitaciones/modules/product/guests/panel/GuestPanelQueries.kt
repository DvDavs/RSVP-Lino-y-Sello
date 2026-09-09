package mx.evolutiondev.invitaciones.modules.product.guests.panel

import jakarta.persistence.criteria.Predicate
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.springframework.data.jpa.domain.Specification

/**
 * El filtro del listado del panel (contrato `5-2` §1, `GET …/guests`).
 *
 * **Por qué no se reutiliza `GuestsSpecifications.prepare`** (`shared/guests/service/filter/`): aquel
 * filtro busca con `cb.like(root.get("fullName"), "%$it%")`
 * (`GuestsSpecifications.kt:33-35`), es decir **sensible a mayúsculas y a acentos**, así que buscar
 * «maria» no encuentra a «María» — inservible para una lista de invitados en español. Aquí se
 * normaliza el nombre en la propia consulta con `translate(lower(full_name), …)`, la función estándar
 * de Postgres, sin depender de la extensión `unaccent`, que no está instalada.
 *
 * La pertenencia a la invitación **no** se decide aquí: la decide
 * `InvitationGuestsService.validateInvitation` antes de llegar a esta consulta. Este filtro solo
 * acota el conjunto que ya se autorizó.
 */
object GuestPanelQueries {

    /** Vocales acentuadas, diéresis y eñe tal como se teclean en es-MX. */
    const val CON_ACENTO = "áéíóúüñÁÉÍÓÚÜÑ"

    /** Sus equivalentes sin acento, en el mismo orden. `lower()` ya bajó las mayúsculas. */
    const val SIN_ACENTO = "aeiouunaeiouun"

    fun delPanel(
        invitationId: Long,
        estado: AttendanceStatus?,
        busqueda: String?,
    ): Specification<InvitationGuestEntity> = Specification { root, _, cb ->
        val predicados = mutableListOf<Predicate>()

        predicados += cb.equal(root.get<InvitationGuestEntity>("invitation").get<Long>("id"), invitationId)
        predicados += cb.isTrue(root.get("isEnabled"))

        estado?.let { predicados += cb.equal(root.get<AttendanceStatus>("attendanceStatus"), it) }

        busqueda?.trim()?.takeIf { it.isNotEmpty() }?.let { termino ->
            val nombreNormalizado = cb.function(
                "translate",
                String::class.java,
                cb.lower(root.get("fullName")),
                cb.literal(CON_ACENTO),
                cb.literal(SIN_ACENTO),
            )
            predicados += cb.like(nombreNormalizado, "%${normalizar(termino)}%")
        }

        cb.and(*predicados.toTypedArray())
    }

    /** La misma normalización que aplica la consulta, para el término que escribe la clienta. */
    fun normalizar(texto: String): String {
        val minusculas = texto.lowercase()
        val salida = StringBuilder(minusculas.length)
        minusculas.forEach { caracter ->
            val indice = CON_ACENTO.indexOf(caracter)
            salida.append(if (indice >= 0) SIN_ACENTO[indice] else caracter)
        }
        return salida.toString()
    }
}
