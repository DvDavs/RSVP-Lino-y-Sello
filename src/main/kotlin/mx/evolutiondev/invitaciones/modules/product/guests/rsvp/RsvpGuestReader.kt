package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Repository

/**
 * Una fila del puente: el invitado, las reglas de su evento y el `public_token` con el que la página
 * pinta la invitación. Solo columnas, sin grafo de entidades.
 *
 * `eventDate` y `eventTime` son las cadenas crudas de `invitation.date` / `invitation."time"`
 * (`V1__initial_schema.sql:269`, `:275`) y salen de aquí **sin interpretar**: quien decide si el
 * evento está cerrado es `GuestAttendanceService.eventoCerrado`, la misma función que usa el rechazo
 * al confirmar, para que la regla viva en un solo sitio.
 */
data class RsvpGuestRow(
    val fullName: String,
    val adults: Int,
    val children: Int,
    val young: Int,
    val adultsConfirmed: Int,
    val childrenConfirmed: Int,
    val youngConfirmed: Int,
    val status: String,
    val hasEmail: Boolean,
    val publicToken: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val eventDate: String,
    val eventTime: String,
)

/**
 * **El puente de §A4.4, que hasta ahora no existía en el código.**
 *
 * `invitation_guest` y `tpl_document` cuelgan de la misma tabla `invitation`
 * (`V8__create_invitation_guest_table.sql:7`, `V32__create_tpl_document.sql:7`), así que traducir el
 * `confirmation_token` de un invitado a el `public_token` de su invitación es una unión. Lo que no
 * había era el código que la hiciera: `grep` sobre `modules/templates2` no devuelve ninguna
 * referencia a `invitation_guest`, y `grep` sobre `modules/shared/guests` ninguna a `tpl_document`.
 *
 * ### Por qué una consulta nativa de solo lectura y no `InvitationGuestsRepository`
 * Es la misma técnica y el mismo motivo de `InvitationAvailabilityReader`
 * (`Templates2EditorQueryRepositories.kt:149-172`) y de `Templates2FlagRepository`
 * (`Templates2FlagRepository.kt:44-51`): no se monta el grafo de `InvitationEntity` —que arrastra
 * `template`, `people` y `customer` del módulo antiguo— para responder a un invitado anónimo. Se
 * leen catorce columnas y se acabó. Además, `InvitationGuestsRepository` es territorio de otra
 * sesión: una consulta nueva del RSVP no se le añade, se declara aquí.
 *
 * ### Por qué **todo** son `JOIN` internos, y no comprobaciones en Kotlin
 * Los seis motivos de fallo del contrato §0.5 —token inexistente, invitado deshabilitado, invitación
 * deshabilitada, invitación **sin release activo**, anfitrión deshabilitado, anfitrión bloqueado—
 * hacen que la consulta devuelva **cero filas**. Uno solo. Así:
 *
 * 1. El código de llamada no puede equivocarse al distinguirlos, porque no puede distinguirlos.
 * 2. El coste observable es el mismo en los seis: una consulta indexada que no devuelve nada. No hay
 *    un camino que haga trabajo extra y se delate por el tiempo de respuesta.
 * 3. Un invitado de una invitación que todavía no se ha publicado es indistinguible de un token
 *    inventado, que es exactamente lo que §0.5 pide y lo que `/i/[publicToken]` ya resolvió con un
 *    solo código.
 *
 * El `JOIN` con `tpl_release` sobre `is_active` se apoya en `ux_tpl_release_active_per_invitation`
 * (`V34__create_tpl_release.sql:23-24`), que garantiza **como máximo un** release activo por
 * invitación: la unión no puede multiplicar filas.
 *
 * ### Sobre `COALESCE`
 * `invitation.is_enabled`, `customer.is_enabled`, `customer.is_banned`, `children_allowed` y
 * `young_allowed` son **anulables** en el esquema heredado (`V1__initial_schema.sql:264-283`). Los
 * valores nulos se normalizan al lado seguro: una fila antigua con `is_enabled` nulo se trata como
 * habilitada (que es el defecto de la entidad, `InvitationEntity.kt:44-45`) y un permiso nulo se
 * trata como **no** concedido.
 */
@Repository
class RsvpGuestReader(
    @PersistenceContext private val entityManager: EntityManager,
) {

    /**
     * `internal` para que `RsvpPuenteSqlTest` pueda afirmar que las condiciones de los seis motivos
     * de fallo siguen todas dentro de la **misma** consulta. Si una se sacara a Kotlin, dejaría de
     * ser un `null` indistinguible y volvería a haber oráculo; la prueba lo caza.
     */
    internal val sql = """
        SELECT g.full_name,
               g.adults_count,
               g.children_count,
               g.young_count,
               g.adults_count_confirmed,
               g.children_count_confirmed,
               g.young_count_confirmed,
               g.attendance_status,
               (g.email IS NOT NULL AND btrim(g.email) <> '') AS has_email,
               d.public_token,
               COALESCE(i.children_allowed, FALSE),
               COALESCE(i.young_allowed, FALSE),
               COALESCE(i.date, ''),
               COALESCE(i."time", '')
        FROM invitation_guest g
        JOIN invitation i  ON i.id = g.invitation_id
        JOIN customer c    ON c.id = i.customer_id
        JOIN tpl_document d ON d.invitation_id = i.id
        JOIN tpl_release r ON r.invitation_id = i.id AND r.is_active
        WHERE g.confirmation_token = :confirmationToken
          AND COALESCE(g.is_enabled, TRUE)
          AND COALESCE(i.is_enabled, TRUE)
          AND COALESCE(c.is_enabled, TRUE)
          AND NOT COALESCE(c.is_banned, FALSE)
    """.trimIndent()

    /**
     * `null` cuando no hay nada que servir, sea cual sea el motivo. **Nunca lanza y nunca registra el
     * token**: quien orquesta decide el código, que siempre es `RSVP_LINK_NOT_FOUND`.
     */
    fun read(confirmationToken: String): RsvpGuestRow? {
        @Suppress("UNCHECKED_CAST")
        val filas = entityManager.createNativeQuery(sql)
            .setParameter("confirmationToken", confirmationToken)
            .resultList as List<Array<Any?>>
        val fila = filas.firstOrNull() ?: return null
        return RsvpGuestRow(
            fullName = fila[0] as? String ?: "",
            adults = fila[1].entero(),
            children = fila[2].entero(),
            young = fila[3].entero(),
            adultsConfirmed = fila[4].entero(),
            childrenConfirmed = fila[5].entero(),
            youngConfirmed = fila[6].entero(),
            status = fila[7] as? String ?: ESTADO_POR_DEFECTO,
            hasEmail = fila[8] as? Boolean ?: false,
            publicToken = fila[9] as? String ?: "",
            childrenAllowed = fila[10] as? Boolean ?: false,
            youngAllowed = fila[11] as? Boolean ?: false,
            eventDate = fila[12] as? String ?: "",
            eventTime = fila[13] as? String ?: "",
        )
    }

    /** `adults_count` es anulable (V16:13) y el driver puede devolver cualquier `Number`. */
    private fun Any?.entero(): Int = (this as? Number)?.toInt() ?: 0

    private companion object {
        const val ESTADO_POR_DEFECTO = "PENDING"
    }
}
