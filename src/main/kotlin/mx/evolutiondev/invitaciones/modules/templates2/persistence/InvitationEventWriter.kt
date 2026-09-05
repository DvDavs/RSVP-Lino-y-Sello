package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.stereotype.Repository

/**
 * **Único** punto de escritura de `invitation.date` e `invitation.time` desde `templates2`
 * (`ADR-3B-I06-01`). Es el gemelo de escritura de [BusinessSnapshotReader]: mismo camino (SQL nativo
 * sobre `invitation` a través del `EntityManager` de la petición), mismas dos columnas, misma razón.
 *
 * **Por qué SQL nativo y no `InvitationEntity`.** `InvitationEntity` es del módulo de administración
 * (`modules/admin/invitations`), área prohibida para este módulo: importarla ataría `templates2` a su
 * grafo entero (cliente, plantilla, invitados, pagos) y un `save()` sobre ella escribiría **todas** sus
 * columnas, no las dos autorizadas. Tampoco se declara un `@Entity` propio como
 * [InvitationFlagRow]: esa clase existe porque Spring Data exige un tipo de entidad para declarar un
 * `Repository`, y aquí no hace falta ninguno — `createNativeQuery` basta y no añade una tercera
 * entidad mapeada sobre `invitation` que `ddl-auto: validate` tendría que validar en cada arranque.
 *
 * **Escribe DOS columnas y nada más.** Ni `updated_at` ni `updated_by`: la consecuencia (las columnas
 * de auditoría del módulo antiguo no reflejan este cambio) está anotada en la ADR y en
 * `preguntas-abiertas.md`; tocarlas sería escribir en `invitation` más allá de lo autorizado.
 *
 * La sentencia participa de la transacción JPA en curso (P6, `02 §1` decisión 1), igual que
 * [Templates2FlagRepository] y [BusinessSnapshotReader]: no se usa `JdbcTemplate`, que no comparte
 * conexión salvo configuración explícita que este proyecto no tiene.
 */
@Repository
class InvitationEventWriter(
    @PersistenceContext private val entityManager: EntityManager,
) {

    /**
     * Escribe la fecha y, si se pide, la hora. Devuelve las filas afectadas: `0` significa que la
     * invitación no existe (quien orquesta decide el código `TPL_*`; aquí no se lanza nada).
     *
     * `time = null` **no** borra la columna: deja la hora tal como está. Un `PUT` que no nombra la
     * hora no es un `PUT` que la vacíe — borrar por omisión es exactamente el descarte silencioso que
     * P1 prohíbe.
     */
    fun write(invitationId: Long, date: String, time: String?): Int {
        val sql = if (time == null) SQL_SOLO_FECHA else SQL_FECHA_Y_HORA
        val consulta = entityManager.createNativeQuery(sql)
            .setParameter("invitationId", invitationId)
            .setParameter("date", date)
        if (time != null) consulta.setParameter("time", time)
        return consulta.executeUpdate()
    }

    companion object {
        private const val SQL_FECHA_Y_HORA =
            "UPDATE invitation SET date = :date, time = :time WHERE id = :invitationId"
        private const val SQL_SOLO_FECHA =
            "UPDATE invitation SET date = :date WHERE id = :invitationId"
    }
}
