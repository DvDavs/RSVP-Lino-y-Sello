package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import org.springframework.stereotype.Repository

/**
 * Construye [BusinessSnapshot] leyendo `invitation` + `invitation_template` + `event_type` +
 * `invitation_plan` con una consulta de proyección de solo lectura (`02 §7.4`): **no** carga el grafo
 * de `InvitationEntity` (ni la clase existe en esta dependencia) — una sola fila plana con exactamente
 * las columnas que `BusinessSnapshot` necesita, vía `EntityManager.createNativeQuery` (participa de la
 * transacción JPA en curso, igual razón que `Templates2FlagRepository`: `02 §1` decisión 1).
 *
 * **Dos mapeos que el diseño (`02`/`03`) no fija y que aquí se toman como supuesto conservador**
 * (anotado en `preguntas-abiertas.md`, ADR-2-1-04):
 * - `eventKind`: `event_type.is_wedding = true → WEDDING`; si no, se empareja `event_type.name` contra
 *   una tabla fija que refleja el catálogo sembrado (`Quince años→QUINCE`, `Bautizo→BAPTISM`, …);
 *   sin coincidencia, `GENERIC` — que es un valor de dominio legítimo para "evento fuera del catálogo
 *   específico", no un descarte silencioso (P1): el propio catálogo `EventKind` lo declara para eso.
 * - `planTier`: `invitation_plan.is_premium = false → 1`, `true → 2`. El esquema solo tiene dos planes
 *   sembrados hoy (`invitation_plan`: Básico/Premium); el tercer nivel que admite
 *   `tpl_template_version.min_plan_tier` (1..3) no tiene equivalente actual y queda sin usar.
 */
@Repository
class BusinessSnapshotReader(
    @PersistenceContext private val entityManager: EntityManager,
) {

    private val sql = """
        SELECT i.id, i.date, i.time, i.hashtag, i.cover_photo_url, i.children_allowed, i.young_allowed,
               et.name, et.is_wedding, ip.is_premium
        FROM invitation i
        JOIN invitation_template it2 ON it2.id = i.template_id
        JOIN event_type et ON et.id = it2.event_type_id
        JOIN invitation_plan ip ON ip.id = it2.invitation_plan_id
        WHERE i.id = :invitationId
    """.trimIndent()

    /** `null` si la invitación no existe o su plantilla/tipo de evento/plan de la administración
     * antigua está incompleto (nunca lanza: quien orquesta decide el código `TPL_*`). */
    fun read(invitationId: Long): BusinessSnapshot? {
        @Suppress("UNCHECKED_CAST")
        val rows = entityManager.createNativeQuery(sql)
            .setParameter("invitationId", invitationId)
            .resultList as List<Array<Any?>>
        val row = rows.firstOrNull() ?: return null

        val isWedding = row[8] as? Boolean ?: false
        val eventTypeName = row[7] as? String
        val isPremium = row[9] as? Boolean ?: false

        return BusinessSnapshot(
            invitationId = (row[0] as Number).toLong(),
            date = row[1] as? String,
            time = row[2] as? String,
            hashtag = row[3] as? String,
            coverPhotoUrl = row[4] as? String,
            childrenAllowed = row[5] as? Boolean ?: false,
            youngAllowed = row[6] as? Boolean ?: false,
            eventKind = mapEventKind(isWedding, eventTypeName),
            planTier = if (isPremium) 2 else 1,
        )
    }

    companion object {
        /** Catálogo fijo verificado contra el sembrado real (`V1__initial_schema.sql`,
         * `V24__add_new_event_types_and_xv_template.sql`): normaliza acentos/mayúsculas y compara. */
        private val NOMBRE_A_EVENT_KIND: Map<String, EventKind> = mapOf(
            "quince anos" to EventKind.QUINCE,
            "xv anos" to EventKind.QUINCE,
            "bautizo" to EventKind.BAPTISM,
            "comunion" to EventKind.COMMUNION,
            "confirmacion" to EventKind.CONFIRMATION,
            "cumpleanos" to EventKind.BIRTHDAY,
            "graduacion" to EventKind.GRADUATION,
            "boda" to EventKind.WEDDING,
        )

        internal fun mapEventKind(isWedding: Boolean, eventTypeName: String?): EventKind {
            if (isWedding) return EventKind.WEDDING
            val normalizado = normalizar(eventTypeName ?: return EventKind.GENERIC)
            return NOMBRE_A_EVENT_KIND.entries.firstOrNull { normalizado.contains(it.key) }?.value
                ?: EventKind.GENERIC
        }

        private fun normalizar(texto: String): String = java.text.Normalizer.normalize(texto, java.text.Normalizer.Form.NFD)
            .replace(Regex("\\p{M}"), "")
            .lowercase()
    }
}
