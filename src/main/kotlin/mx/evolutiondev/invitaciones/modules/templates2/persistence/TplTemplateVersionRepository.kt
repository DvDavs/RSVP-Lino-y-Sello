package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/**
 * `tpl_template_version` (`02 §7.4`). `searchCatalog` es **nativa** porque `@>` sobre `jsonb` no tiene
 * equivalente en JPQL (Hibernate 6.6 no traduce el operador de contención de PostgreSQL desde JPQL
 * estándar); se construye el array `["<eventKind>"]` con `jsonb_build_array` en la propia sentencia
 * para no concatenar texto en Kotlin (evita cualquier riesgo de inyección en el literal JSON).
 */
@Repository
interface TplTemplateVersionRepository : JpaRepository<TplTemplateVersionEntity, Long> {

    fun findByTemplateIdAndVersion(templateId: Long, version: String): TplTemplateVersionEntity?

    /** Clave real de idempotencia del registro (`02 §4` paso 4). */
    fun findByTemplateIdAndPackageHash(templateId: Long, packageHash: String): TplTemplateVersionEntity?

    /** La versión `published` de mayor `(major, minor, patch)` de una plantilla (`02 §4` paso 5). */
    @Query(
        "select v from TplTemplateVersionEntity v where v.templateId = :templateId and v.status = 'published' " +
            "order by v.versionMajor desc, v.versionMinor desc, v.versionPatch desc",
    )
    fun findLatestPublished(@Param("templateId") templateId: Long): List<TplTemplateVersionEntity>

    /** Catálogo para el cliente (`03 §3`, `GET /editor/templates2/catalog`): plantillas `published`
     * cuyo `min_plan_tier` el cliente cubre y cuyo `event_kinds` contiene el evento pedido. */
    @Query(
        value = """
            SELECT * FROM tpl_template_version
            WHERE status = 'published'
              AND min_plan_tier <= :planTier
              AND event_kinds @> jsonb_build_array(CAST(:eventKind AS text))
            ORDER BY template_id, version_major DESC, version_minor DESC, version_patch DESC
        """,
        nativeQuery = true,
    )
    fun searchCatalog(@Param("eventKind") eventKind: String, @Param("planTier") planTier: Int): List<TplTemplateVersionEntity>
}
