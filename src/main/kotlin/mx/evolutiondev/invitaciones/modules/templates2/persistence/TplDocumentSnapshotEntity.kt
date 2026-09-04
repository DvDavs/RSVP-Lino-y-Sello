package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.NullNode
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * `tpl_document_snapshot` (`02 §2` V33). Un snapshot por revisión aplicada, escrito en la MISMA
 * transacción que el `UPDATE` de `tpl_document`. `ux_tpl_document_snapshot_batch (document_id,
 * client_batch_id)` es la idempotencia **real** del `OperationBatch` (objeción B-03): el reintento de
 * un lote con el mismo `clientBatchId` choca contra ese índice; la capa de aplicación lo captura como
 * `DataIntegrityViolationException` y responde con la revisión ya producida, en vez de duplicar.
 */
@Entity
@Table(name = "tpl_document_snapshot")
class TplDocumentSnapshotEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "document_id", nullable = false, updatable = false)
    var documentId: Long = 0,

    @Column(name = "revision", nullable = false, updatable = false)
    var revision: Long = 0,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "doc", columnDefinition = "jsonb", nullable = false, updatable = false)
    var doc: JsonNode = NullNode.instance,

    /** Idempotencia real del `OperationBatch` (`ux_tpl_document_snapshot_batch`). `null` para
     * revisiones que no vienen de un lote de operaciones (`:choose-template`, `restore`). */
    @Column(name = "client_batch_id", length = 64, updatable = false)
    var clientBatchId: String? = null,

    /** `'operations' | 'choose_template' | 'restore' | 'import' | 'ai'` (`02 §2` V33). */
    @Column(name = "origin", nullable = false, length = 20, updatable = false)
    var origin: String = "operations",

    @Column(name = "created_by", updatable = false)
    var createdBy: Long? = null,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
)
