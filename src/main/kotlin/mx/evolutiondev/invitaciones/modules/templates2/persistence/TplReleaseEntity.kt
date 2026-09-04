package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.NullNode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * `tpl_release` (`02 §2` V34). `composed`/`report`/`businessSnapshot`/`contentHash` son inmutables
 * desde el momento en que se insertan (nunca `UPDATE`). Los únicos campos mutables de la fila son
 * `isActive` y `unpublishedAt` — publicar de nuevo inserta una fila y, en la misma transacción, pone
 * `isActive = false` en la anterior (`ux_tpl_release_active_per_invitation` en la migración garantiza
 * como máximo un release activo por invitación).
 */
@Entity
@Table(name = "tpl_release")
class TplReleaseEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "invitation_id", nullable = false, updatable = false)
    var invitationId: Long = 0,

    @Column(name = "template_version_id", nullable = false, updatable = false)
    var templateVersionId: Long = 0,

    @Column(name = "document_revision", nullable = false, updatable = false)
    var documentRevision: Long = 0,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "composed", columnDefinition = "jsonb", nullable = false, updatable = false)
    var composed: JsonNode = NullNode.instance,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "report", columnDefinition = "jsonb", nullable = false, updatable = false)
    var report: JsonNode = NullNode.instance,

    /** `BusinessSnapshot` congelado en el momento de publicar; base del cálculo de `stale` (ADR-007). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "business_snapshot", columnDefinition = "jsonb", nullable = false, updatable = false)
    var businessSnapshot: JsonNode = NullNode.instance,

    /** `"sha256:" + 64 hex` sobre `{composed, report}` canónico (ADR-1R-D-02). ETag del render público. */
    @Column(name = "content_hash", nullable = false, length = 71, updatable = false)
    var contentHash: String = "",

    @Column(name = "is_active", nullable = false)
    var isActive: Boolean = true,

    @Column(name = "published_by", updatable = false)
    var publishedBy: Long? = null,

    @Column(name = "published_at", nullable = false, updatable = false)
    var publishedAt: Instant = Instant.now(),

    @Column(name = "unpublished_at")
    var unpublishedAt: Instant? = null,
)
