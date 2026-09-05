package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.persistence.BusinessSnapshotReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.InvitationEventWriter
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DateTimeException
import java.time.LocalDate
import java.time.LocalTime

/**
 * `PUT /editor/invitations/{invitationId}/event` (I-06, `ADR-3B-I06-01`): **la única ruta de cliente
 * que escribe `invitation.date` / `invitation.time`**. Hasta esta issue solo existía la de
 * administración (`PUT /admin/invitations/{id}`, rol ADMIN, `InvitationAdminService.kt:414`) y la
 * clienta no podía cambiar la fecha de su boda por ninguna vía — el tercer verbo del criterio de
 * terminado (U-3, `handoffs/3-ux.md`).
 *
 * Tres decisiones, las tres registradas en la ADR:
 *
 * 1. **Autorización idéntica al resto del editor** (ADR-015, `contratos.md §4`):
 *    [HierarchyValidationService.validateInvitationAccess]. No hay una segunda idea de propiedad en
 *    este módulo, y una invitación inexistente responde igual que una ajena (`403`), sin filtrar
 *    cuáles existen.
 * 2. **Valida el formato; el módulo antiguo no.** Divergencia deliberada: ver
 *    [EventDateInvalidException].
 * 3. **No invalida el release activo.** Cambiar la fecha deja la invitación publicada
 *    *desactualizada*, y eso ya tiene mecanismo propio desde la fase 2
 *    (`EditorDocumentService.razonesDeStale` → `activeRelease.stale` + `staleReason`, `03 §3.3`). La
 *    clienta republica cuando quiera; el `composed` congelado del release **no** se toca. La
 *    respuesta devuelve ese cálculo para que el editor pueda decirlo sin una llamada más.
 *
 * **Nunca toca el documento de trabajo.** `tpl_document.revision` no cambia, los bloques `business`
 * no viven en `doc.content` (R4/I-21) y el `composed` se recalcula en cada lectura (ADR-007): la
 * fecha nueva aparece en el siguiente `GET …/document` sin escribir un byte en `tpl_*`.
 */
@Service
class EditorEventService(
    private val hierarchy: HierarchyValidationService,
    private val business: BusinessSnapshotReader,
    private val writer: InvitationEventWriter,
    private val releases: TplReleaseRepository,
    private val documentos: EditorDocumentService,
) {

    @Transactional
    fun setEvent(requesterId: Long, invitationId: Long, body: JsonNode): EventResponse {
        if (!hierarchy.validateInvitationAccess(requesterId, invitationId)) {
            throw ForbiddenException(
                "el usuario $requesterId no tiene acceso a la invitación $invitationId",
                mapOf("invitationId" to invitationId),
            )
        }
        val peticion = EditorRequests.event(body)
        exigirFecha(peticion.date)
        peticion.time?.let { exigirHora(it) }

        val filas = writer.write(invitationId, peticion.date, peticion.time)
        if (filas != 1) throw Templates2Exception.Internal(
            "el UPDATE de invitation.date/time afectó a $filas filas para la invitación $invitationId",
        )

        // Se relee: la respuesta es lo que Postgres tiene, no el eco del cuerpo (P1).
        val negocio = business.read(invitationId) ?: throw Templates2Exception.Internal(
            "no se pudo proyectar el BusinessSnapshot de la invitación $invitationId tras escribir la fecha",
        )
        val razones = razonesDeStale(invitationId, negocio)
        return EventResponse(
            invitationId = invitationId,
            date = negocio.date,
            time = negocio.time,
            releaseStale = razones.isNotEmpty(),
            staleReason = razones,
        )
    }

    /** Reusa el cálculo de `03 §3.3` tal cual; no hay una segunda definición de "desactualizado". */
    private fun razonesDeStale(invitationId: Long, negocio: BusinessSnapshot): List<String> {
        val release = releases.findByInvitationIdAndIsActiveTrue(invitationId) ?: return emptyList()
        return documentos.razonesDeStale(release, negocio)
    }

    // =============================================================================================
    // Formato
    // =============================================================================================

    /**
     * `YYYY-MM-DD`, con día real. El patrón lo impone el consumidor, no el gusto:
     * `DateFormatting.largo` parte por `-` y espera **tres** segmentos numéricos, y devuelve el valor
     * crudo si no encajan. La comprobación de calendario ([LocalDate.of]) va más allá porque
     * `2027-02-31` sí pasa el patrón y `DateFormatting` lo imprimiría como «31 de febrero de 2027».
     *
     * Se usa [LocalDate.of], no `java.time.format`: R6 de `01 §5.2` prohíbe el formateo con el locale
     * del sistema en este módulo, y `of` es aritmética de calendario, sin locale ni patrón.
     */
    private fun exigirFecha(valor: String) {
        if (!PATRON_FECHA.matches(valor)) throw EventDateInvalidException(
            "la fecha «$valor» no tiene el formato $FORMATO_FECHA",
            mapOf("field" to "date", "expected" to FORMATO_FECHA),
        )
        val (anio, mes, dia) = valor.split("-").map { it.toInt() }
        try {
            LocalDate.of(anio, mes, dia)
        } catch (fallo: DateTimeException) {
            throw EventDateInvalidException(
                "la fecha «$valor» no existe en el calendario",
                mapOf("field" to "date", "expected" to FORMATO_FECHA),
            )
        }
    }

    /** `HH:mm` de 24 h. `DateFormatting.h12` parte por `:` y espera **dos** segmentos numéricos. */
    private fun exigirHora(valor: String) {
        if (!PATRON_HORA.matches(valor)) throw EventDateInvalidException(
            "la hora «$valor» no tiene el formato $FORMATO_HORA",
            mapOf("field" to "time", "expected" to FORMATO_HORA),
        )
        val (hora, minuto) = valor.split(":").map { it.toInt() }
        try {
            LocalTime.of(hora, minuto)
        } catch (fallo: DateTimeException) {
            throw EventDateInvalidException(
                "la hora «$valor» no existe",
                mapOf("field" to "time", "expected" to FORMATO_HORA),
            )
        }
    }

    companion object {
        const val FORMATO_FECHA = "YYYY-MM-DD"
        const val FORMATO_HORA = "HH:mm"

        /** Con relleno de ceros: `2027-4-18` NO vale — el valor almacenado hoy es `2027-04-18`. */
        private val PATRON_FECHA = Regex("""^\d{4}-\d{2}-\d{2}$""")
        private val PATRON_HORA = Regex("""^\d{2}:\d{2}$""")
    }
}
