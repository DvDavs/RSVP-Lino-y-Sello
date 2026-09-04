package mx.evolutiondev.invitaciones.modules.templates2.persistence

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
 * `tpl_asset` (`02 §2` V31). Un asset pertenece **exactamente** a una plantilla (`templateVersionId`)
 * o a una invitación (`invitationId`), nunca a ambas — el `ck_tpl_asset_owner` de la base lo hace
 * estructuralmente imposible; esta entidad no repite esa regla en Kotlin (P1: una sola fuente).
 * `publicId` (`AssetId.value`, `as_<ULID>`) es lo único que aparece en `tpl_document.doc`/
 * `tpl_release.composed` (ADR-021) — nunca la URL ni `s3_key`.
 */
@Entity
@Table(name = "tpl_asset")
class TplAssetEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "public_id", nullable = false, length = 29, updatable = false)
    var publicId: String = "",

    @Column(name = "template_version_id", updatable = false)
    var templateVersionId: Long? = null,

    @Column(name = "invitation_id", updatable = false)
    var invitationId: Long? = null,

    @Column(name = "bucket", nullable = false, length = 63, updatable = false)
    var bucket: String = "",

    @Column(name = "s3_key", nullable = false, length = 500, updatable = false)
    var s3Key: String = "",

    /** Digesto de archivo suelto, **sin** prefijo de algoritmo (`Patterns.SHA256_HEX`, `02 §2`).
     * `@JdbcTypeCode(SqlTypes.CHAR)` es imprescindible (hallazgo de esta sesión): `columnDefinition`
     * por sí solo **no** basta — solo cambia el DDL que Hibernate generaría, no el tipo JDBC que usa
     * para comparar en `ddl-auto: validate`, que por defecto es `VARCHAR` para cualquier `String`. Sin
     * esta anotación, `validate` rechaza el `CHAR(64)` real de la migración con
     * "found bpchar, but expecting char(64) (Types#VARCHAR)". */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "sha256", columnDefinition = "char(64)", nullable = false, updatable = false)
    var sha256: String = "",

    @Column(name = "content_type", nullable = false, length = 60, updatable = false)
    var contentType: String = "",

    @Column(name = "bytes", nullable = false, updatable = false)
    var bytes: Long = 0,

    @Column(name = "width", updatable = false)
    var width: Int? = null,

    @Column(name = "height", updatable = false)
    var height: Int? = null,

    @Column(name = "created_by", updatable = false)
    var createdBy: Long? = null,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
)
