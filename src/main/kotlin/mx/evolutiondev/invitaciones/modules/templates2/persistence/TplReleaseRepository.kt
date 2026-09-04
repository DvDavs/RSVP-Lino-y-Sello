package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.time.Instant

/**
 * `tpl_release` (`02 §7.4`). `insertRelease` es `save()` (igual razón que en
 * `TplDocumentSnapshotRepository`: un `INSERT` plano no necesita SQL nativo). `deactivateActive` es la
 * mitad de "publicar de nuevo" (`02 §2` V34): la otra mitad es el `INSERT` de la fila nueva, en la
 * MISMA transacción, con el `SELECT … FOR UPDATE` de `TplDocumentRepository.lockByInvitationId`
 * abierto alrededor de las dos (`02 §11.2`).
 */
@Repository
interface TplReleaseRepository : JpaRepository<TplReleaseEntity, Long> {

    fun findByInvitationIdAndIsActiveTrue(invitationId: Long): TplReleaseEntity?

    /** Render público por `publicToken` (`03 §3.7`): el token vive en `tpl_document`, no en
     * `tpl_release`, así que hace falta la subconsulta — una invitación tiene como máximo un
     * `tpl_document` (`uq_tpl_document_invitation`). */
    @Query(
        "select r from TplReleaseEntity r where r.isActive = true and r.invitationId = " +
            "(select d.invitationId from TplDocumentEntity d where d.publicToken = :publicToken)",
    )
    fun findActiveByPublicToken(@Param("publicToken") publicToken: String): TplReleaseEntity?

    /** Despublicar (`03 §3.9`, ADR-1R-B-05) o el primer paso de "publicar de nuevo". Devuelve las
     * filas afectadas (0 o 1, por `ux_tpl_release_active_per_invitation`). */
    @Modifying(clearAutomatically = true)
    @Query(
        "update TplReleaseEntity r set r.isActive = false, r.unpublishedAt = :unpublishedAt " +
            "where r.invitationId = :invitationId and r.isActive = true",
    )
    fun deactivateActive(@Param("invitationId") invitationId: Long, @Param("unpublishedAt") unpublishedAt: Instant): Int

    fun findByInvitationIdOrderByPublishedAtDesc(invitationId: Long, pageable: Pageable): Page<TplReleaseEntity>
}
