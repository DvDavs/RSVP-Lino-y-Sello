package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/**
 * `tpl_template` (`02 §7.4`). `insertIgnoreConflict` + `lockBySlug` son las dos piezas del paso 3 del
 * registro de plantillas (`02 §4`): `INSERT … ON CONFLICT (slug) DO NOTHING` seguido de
 * `SELECT … FOR UPDATE`, para serializar dos registros concurrentes del mismo `slug` (`02 §11.4`).
 */
@Repository
interface TplTemplateRepository : JpaRepository<TplTemplateEntity, Long> {

    fun findBySlug(slug: String): TplTemplateEntity?

    /** `INSERT INTO tpl_template (slug) VALUES (?) ON CONFLICT (slug) DO NOTHING` — nativa: la
     * semántica `ON CONFLICT` no es expresable en JPQL. Devuelve las filas insertadas (0 o 1). */
    @Modifying(clearAutomatically = true)
    @Query(value = "INSERT INTO tpl_template (slug) VALUES (:slug) ON CONFLICT (slug) DO NOTHING", nativeQuery = true)
    fun insertIgnoreConflict(@Param("slug") slug: String): Int

    /** `SELECT … FOR UPDATE` — serializa el registro concurrente del mismo slug (`02 §4` paso 3,
     * `02 §11.4`). JPQL con `@Lock`, no nativa: el dialecto de Hibernate ya traduce a `FOR UPDATE`. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TplTemplateEntity t where t.slug = :slug")
    fun lockBySlug(@Param("slug") slug: String): TplTemplateEntity?
}
