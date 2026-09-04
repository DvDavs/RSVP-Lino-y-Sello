package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/**
 * Consultas del **catálogo** y de la **administración MASTER** sobre `tpl_template_version`
 * (`03 §3.1`, `§3.18`, `§3.19`).
 *
 * Va en una interfaz aparte, y no como métodos nuevos de `TplTemplateVersionRepository`, para no tocar
 * un archivo de otro bloque (2-1) mientras 2-4 y 2-5 trabajan en paralelo sobre el mismo paquete:
 * Spring Data admite varias interfaces `JpaRepository` sobre la misma entidad y ambas comparten
 * `EntityManager` y transacción. Está declarado en `bitacora/2-3.md §2`.
 */
@Repository
interface TplTemplateVersionQueryRepository : JpaRepository<TplTemplateVersionEntity, Long> {

    /**
     * Catálogo **sin** filtro de tipo de evento (`GET /editor/templates2/catalog` sin `eventKind`).
     * El caso con `eventKind` lo cubre `TplTemplateVersionRepository.searchCatalog`, que usa `@>`
     * sobre `event_kinds` con el índice GIN (ADR-1R-B-09).
     */
    @Query(
        value = """
            SELECT * FROM tpl_template_version
            WHERE status = 'published'
              AND min_plan_tier <= :planTier
            ORDER BY template_id, version_major DESC, version_minor DESC, version_patch DESC
        """,
        nativeQuery = true,
    )
    fun searchCatalogAll(@Param("planTier") planTier: Int): List<TplTemplateVersionEntity>

    fun findAllByOrderByIdDesc(pageable: Pageable): List<TplTemplateVersionEntity>

    fun findByStatusOrderByIdDesc(status: String, pageable: Pageable): List<TplTemplateVersionEntity>

    fun findByTemplateIdOrderByIdDesc(templateId: Long, pageable: Pageable): List<TplTemplateVersionEntity>

    fun findByTemplateIdAndStatusOrderByIdDesc(
        templateId: Long,
        status: String,
        pageable: Pageable,
    ): List<TplTemplateVersionEntity>

    fun countByTemplateIdAndStatus(templateId: Long, status: String): Long

    /**
     * `documentsUsing` de `03 §3.18`: cuántos `tpl_document` dependen de esta versión. Es lo que
     * permite decidir si puede deprecarse sin dejar documentos colgados, y lo que hace cumplir
     * `409 TPL_VERSION_LAST_PUBLISHED` (`03 §3.19`). Nativa: cruza a otra tabla.
     */
    @Query(value = "SELECT count(*) FROM tpl_document WHERE template_version_id = :id", nativeQuery = true)
    fun countDocumentsUsing(@Param("id") id: Long): Long

    /**
     * El **único** `UPDATE` admitido sobre `tpl_template_version` (`02 §2` V30): `published →
     * deprecated`. Devuelve filas afectadas; `0` significa "ya estaba deprecada", que `03 §3.19`
     * define como `200` idempotente, no como error.
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = "UPDATE tpl_template_version SET status = 'deprecated' WHERE id = :id AND status = 'published'",
        nativeQuery = true,
    )
    fun deprecate(@Param("id") id: Long): Int
}
