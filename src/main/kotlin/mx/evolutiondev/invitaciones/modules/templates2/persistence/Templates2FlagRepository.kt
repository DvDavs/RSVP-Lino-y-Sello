package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.Repository
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository as SpringRepository

/**
 * Mapeo mínimo de `invitation`, **solo** para servir de parámetro de tipo a
 * [Templates2FlagRepository] — Spring Data exige un `@Entity` para cualquier interfaz de repositorio,
 * y esta clase **no** es `InvitationEntity` (`02 §2` V36, objeción B-08: `InvitationEntity` es del
 * módulo antiguo y no se toca). Mapea únicamente las dos columnas que `templates2` necesita; el resto
 * de columnas de `invitation` es invisible aquí a propósito — este módulo no las lee ni las escribe.
 *
 * **Nunca se usa `save()`/`findById()` sobre esta entidad**: el repositorio extiende el marcador
 * `org.springframework.data.repository.Repository`, no `JpaRepository`, así que esos métodos de CRUD
 * genérico ni siquiera existen aquí — únicamente los dos `@Query` nativos declarados abajo.
 */
@Entity
@Table(name = "invitation")
class InvitationFlagRow(
    @Id
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "uses_templates2", nullable = false)
    var usesTemplates2: Boolean = false,
)

/**
 * **Único** acceso a `invitation.uses_templates2` (`02 §6`, `02 §2` V36). Dos `@Query` nativos, nunca
 * vía `InvitationEntity`. Ambos participan del `EntityManager`/transacción JPA de la petición (P6,
 * `02 §1` decisión 1): no se usa `JdbcTemplate`, que no comparte conexión salvo configuración explícita
 * que este proyecto no tiene.
 */
@SpringRepository
interface Templates2FlagRepository : Repository<InvitationFlagRow, Long> {

    @Query(value = "SELECT uses_templates2 FROM invitation WHERE id = :invitationId", nativeQuery = true)
    fun usesTemplates2(@Param("invitationId") invitationId: Long): Boolean?

    /** Único punto de escritura de la bandera de corte (ADR-023); lo llama la migración de cliente
     * (`05-migracion.md §4`) o el primer `:choose-template` de una invitación sin `invitation_configs`
     * en Mongo — nunca implícitamente (`02 §6`). Devuelve las filas afectadas. */
    @Modifying(clearAutomatically = true)
    @Query(value = "UPDATE invitation SET uses_templates2 = :value WHERE id = :invitationId", nativeQuery = true)
    fun setUsesTemplates2(@Param("invitationId") invitationId: Long, @Param("value") value: Boolean): Int
}
