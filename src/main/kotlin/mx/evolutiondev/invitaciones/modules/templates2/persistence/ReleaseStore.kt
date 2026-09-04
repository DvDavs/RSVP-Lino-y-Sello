package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * Publicar, despublicar e historial de `tpl_release` (`02 §7.4`), con el bloqueo de `02 §11.2`.
 *
 * **Un release es inmutable.** Se inserta con `composed`, `report`, `business_snapshot` y
 * `content_hash` congelados y ya no se toca: los únicos campos mutables de la fila son `is_active` y
 * `unpublished_at` (`02 §2` V34). Un cambio posterior en `invitation.date` **no** reescribe nada — el
 * editor marca el release `stale` comparando el `business_snapshot` congelado contra el actual
 * (ADR-007), que es exactamente para lo que esa columna existe.
 *
 * **Como máximo un activo por invitación.** [publish] desactiva el anterior y añade el nuevo en la
 * misma transacción; `ux_tpl_release_active_per_invitation` (índice único parcial) es la red de
 * seguridad si alguien lo intentara de otra forma.
 */
@Service
class ReleaseStore(
    private val documents: TplDocumentRepository,
    private val releases: TplReleaseRepository,
) {

    /** `SELECT … FROM tpl_document WHERE invitation_id = ? FOR UPDATE` (`02 §11.2`, `03 §3.12` paso 1). */
    @Transactional
    fun lockDocument(invitationId: Long): TplDocumentEntity? = documents.lockByInvitationId(invitationId)

    @Transactional(readOnly = true)
    fun active(invitationId: Long): TplReleaseEntity? = releases.findByInvitationIdAndIsActiveTrue(invitationId)

    @Transactional(readOnly = true)
    fun activeByPublicToken(publicToken: String): TplReleaseEntity? = releases.findActiveByPublicToken(publicToken)

    /**
     * `03 §3.12` paso 7: desactivar el activo + insertar el nuevo, **en la misma transacción**. El
     * llamador ya tiene el documento bloqueado (`lockDocument`), compuso, calculó el `contentHash` y
     * pasó el preflight; aquí no se decide nada, solo se escribe.
     */
    @Transactional
    fun publish(
        invitationId: Long,
        templateVersionId: Long,
        documentRevision: Long,
        composed: JsonNode,
        report: JsonNode,
        businessSnapshot: JsonNode,
        contentHash: String,
        publishedBy: Long?,
        publishedAt: Instant = Instant.now(),
    ): TplReleaseEntity {
        releases.deactivateActive(invitationId, publishedAt)
        return releases.save(
            TplReleaseEntity(
                invitationId = invitationId,
                templateVersionId = templateVersionId,
                documentRevision = documentRevision,
                composed = composed,
                report = report,
                businessSnapshot = businessSnapshot,
                contentHash = contentHash,
                isActive = true,
                publishedBy = publishedBy,
                publishedAt = publishedAt,
            ),
        )
    }

    /**
     * Despublicar (`03 §3.13`, ADR-1R-B-05): la fila **no** se borra — sigue siendo auditable y
     * republicable. Devuelve las filas afectadas; 0 significa "no había release activo", que también
     * es un `204` (la ruta es idempotente por diseño).
     */
    @Transactional
    fun unpublish(invitationId: Long, unpublishedAt: Instant = Instant.now()): Int =
        releases.deactivateActive(invitationId, unpublishedAt)

    /** Historial de publicaciones (`03 §3.14`), descendente por `published_at`. */
    @Transactional(readOnly = true)
    fun history(invitationId: Long, limit: Int, offset: Int): List<TplReleaseEntity> =
        releases.findByInvitationIdOrderByPublishedAtDesc(
            invitationId,
            PageRequest.of(if (limit == 0) 0 else offset / limit, limit),
        ).content
}
