package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository as SpringRepository

/**
 * Consultas y escrituras que el ciclo de vida del documento (bloque 2-4) necesita y que los
 * repositorios de 2-1/2-3 no declaran. **Interfaces nuevas sobre las mismas entidades**: `handoffs/2-1.md`
 * y el brief de este bloque prohíben modificar los archivos existentes de `persistence`, y Spring Data
 * admite varios repositorios sobre una misma entidad sin ambigüedad (mismo patrón que
 * `TplTemplateVersionQueryRepository`, de 2-3).
 *
 * Ninguna declara `@Transactional`: la transacción la abre la capa de servicio
 * (`DocumentStore`/`ReleaseStore`, `02 §1` decisión 1 y aviso de `handoffs/2-1.md`).
 */
@SpringRepository
interface TplDocumentEditorRepository : JpaRepository<TplDocumentEntity, Long> {

    /**
     * Igual que `TplDocumentRepository.applyRevision` **más `template_version_id`**: es lo que
     * `:choose-template` necesita cuando el documento ya existe (cambio de plantilla o de versión,
     * `03 §3.2`). Sin esta variante habría que hacer dos `UPDATE`, y el segundo quedaría fuera del
     * `WHERE revision = ?` de la escritura optimista (ADR-014) — una ventana en la que el documento
     * apunta a una versión y su contenido a otra.
     *
     * Devuelve las filas afectadas: **0 significa `409 TPL_REVISION_CONFLICT`**.
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = """
            UPDATE tpl_document
            SET doc = CAST(:doc AS jsonb), doc_bytes = :docBytes, template_version_id = :templateVersionId,
                revision = revision + 1, updated_at = now(), updated_by = :updatedBy
            WHERE id = :id AND revision = :expectedRevision
        """,
        nativeQuery = true,
    )
    fun applyRevisionWithVersion(
        @Param("id") id: Long,
        @Param("doc") doc: String,
        @Param("docBytes") docBytes: Int,
        @Param("templateVersionId") templateVersionId: Long,
        @Param("expectedRevision") expectedRevision: Long,
        @Param("updatedBy") updatedBy: Long?,
    ): Int
}

/** Historial paginado de snapshots (`03 §3.5`) y purga (`02 §5.1`). */
@SpringRepository
interface TplDocumentSnapshotQueryRepository : JpaRepository<TplDocumentSnapshotEntity, Long> {

    /** Página descendente desde `cursor` inclusive; `cursor` es una revisión (`03 §3.5`). */
    fun findByDocumentIdAndRevisionLessThanEqualOrderByRevisionDesc(
        documentId: Long,
        revision: Long,
        pageable: Pageable,
    ): List<TplDocumentSnapshotEntity>

    fun findByDocumentIdOrderByRevisionDesc(documentId: Long, pageable: Pageable): List<TplDocumentSnapshotEntity>

    /** `clientBatchId` como filtro del historial: "¿se aplicó mi lote?" (`03 §3.5`). */
    fun findByDocumentIdAndClientBatchIdOrderByRevisionDesc(
        documentId: Long,
        clientBatchId: String,
        pageable: Pageable,
    ): List<TplDocumentSnapshotEntity>

    fun countByDocumentId(documentId: Long): Long

    /**
     * Purga de `02 §5.1`, **literal**. Protege siempre (a) las últimas 200 revisiones de cada
     * documento —`revision <= max(revision) - 200`—, (b) todo lo escrito en los últimos 30 días y
     * (c) **cualquier revisión que respalde un `tpl_release`, activo o no** (ADR-011: un release
     * histórico sigue siendo auditable, así que su snapshot no se puede borrar).
     *
     * `LIMIT :lote` mantiene el bloqueo corto; el llamador itera hasta que devuelva 0.
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = """
            DELETE FROM tpl_document_snapshot s
            USING (
                SELECT s2.id
                FROM   tpl_document_snapshot s2
                JOIN   tpl_document d ON d.id = s2.document_id
                WHERE  s2.created_at < now() - CAST(:dias || ' days' AS interval)
                  AND  s2.revision <= (
                         SELECT max(s3.revision) - :retenidas
                         FROM   tpl_document_snapshot s3
                         WHERE  s3.document_id = s2.document_id)
                  AND  NOT EXISTS (
                         SELECT 1 FROM tpl_release r
                         WHERE  r.invitation_id = d.invitation_id
                           AND  r.document_revision = s2.revision)
                ORDER BY s2.id
                LIMIT :lote
            ) victim
            WHERE s.id = victim.id
        """,
        nativeQuery = true,
    )
    fun purgar(
        @Param("dias") dias: Int,
        @Param("retenidas") retenidas: Int,
        @Param("lote") lote: Int,
    ): Int
}

/** Assets de la invitación y de la versión de plantilla, para el `AssetIndex` y para `assetMeta`. */
@SpringRepository
interface TplAssetEditorRepository : JpaRepository<TplAssetEntity, Long> {

    fun findByInvitationId(invitationId: Long): List<TplAssetEntity>

    fun findByTemplateVersionId(templateVersionId: Long): List<TplAssetEntity>

    /** Comprobación de pertenencia **en bloque** de todos los `assetId` de un lote (`03 §3.4` punto 3). */
    fun findByPublicIdIn(publicIds: Collection<String>): List<TplAssetEntity>
}

/** Las tres banderas de disponibilidad de `03 §3.12` paso 3 / `03 §3.15`. */
data class InvitationAvailability(
    val invitationEnabled: Boolean,
    val customerEnabled: Boolean,
    val customerBanned: Boolean,
) {
    /** Las mismas tres comprobaciones que `PublicGuestInfoController.kt:65-75`, en un solo predicado. */
    val disponible: Boolean get() = invitationEnabled && customerEnabled && !customerBanned
}

/**
 * `invitation.is_enabled` + `customer.is_enabled` + `customer.is_banned` con **una** consulta nativa de
 * solo lectura, sin cargar `InvitationEntity` ni `CustomerEntity` (mismo criterio y misma técnica que
 * [BusinessSnapshotReader], de 2-1: `templates2` no monta el grafo del módulo antiguo, y una
 * proyección por interfaz sobre consulta nativa depende de cómo el driver etiquete los alias).
 *
 * Hace falta porque `validateInvitationAccess` usa `findByIdEvenIfDisabled`
 * (`HierarchyValidationService.kt:44`, riesgo residual verificado en `03 §9.1`): una invitación
 * deshabilitada sigue siendo accesible para su dueño, así que **publicar** tiene que comprobar la
 * disponibilidad por su cuenta. Editar una invitación deshabilitada sí se permite (`03 §9.1`).
 */
@SpringRepository
class InvitationAvailabilityReader(
    @PersistenceContext private val entityManager: EntityManager,
) {

    private val sql = """
        SELECT i.is_enabled, c.is_enabled, c.is_banned
        FROM invitation i JOIN customer c ON c.id = i.customer_id
        WHERE i.id = :invitationId
    """.trimIndent()

    /** `null` si la invitación no existe. Nunca lanza: quien orquesta decide el código `TPL_*`. */
    fun read(invitationId: Long): InvitationAvailability? {
        @Suppress("UNCHECKED_CAST")
        val filas = entityManager.createNativeQuery(sql)
            .setParameter("invitationId", invitationId)
            .resultList as List<Array<Any?>>
        val fila = filas.firstOrNull() ?: return null
        return InvitationAvailability(
            invitationEnabled = fila[0] as? Boolean ?: false,
            customerEnabled = fila[1] as? Boolean ?: false,
            customerBanned = fila[2] as? Boolean ?: false,
        )
    }
}
