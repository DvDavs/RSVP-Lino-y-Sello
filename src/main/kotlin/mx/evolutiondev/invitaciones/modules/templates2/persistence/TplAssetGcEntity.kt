package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import java.time.Instant

/**
 * `tpl_asset_gc` (`02 §2` V37). Cola de borrado de objetos S3, alimentada por el trigger
 * `trg_tpl_asset_gc` en **cualquier** borrado de `tpl_asset` — incluida la cascada desde
 * `DELETE FROM invitation` del módulo antiguo (ADR-1R-B-03, objeción B-02). Ninguna ruta de la
 * aplicación hace `INSERT` sobre esta tabla directamente: siempre es el trigger. Las escrituras de la
 * aplicación son `UPDATE` (marcar borrado o fallo), vía [TplAssetGcRepository].
 */
@Entity
@Table(name = "tpl_asset_gc")
class TplAssetGcEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "bucket", nullable = false, length = 63, updatable = false)
    var bucket: String = "",

    @Column(name = "s3_key", nullable = false, length = 500, updatable = false)
    var s3Key: String = "",

    @Column(name = "public_id", nullable = false, length = 29, updatable = false)
    var publicId: String = "",

    @Column(name = "reason", nullable = false, length = 30, updatable = false)
    var reason: String = "row_deleted",

    @Column(name = "attempts", nullable = false)
    var attempts: Int = 0,

    @Column(name = "last_error", length = 500)
    var lastError: String? = null,

    @CreationTimestamp
    @Column(name = "enqueued_at", nullable = false, updatable = false)
    var enqueuedAt: Instant? = null,

    @Column(name = "deleted_at")
    var deletedAt: Instant? = null,
)
