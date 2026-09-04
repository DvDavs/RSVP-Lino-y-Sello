package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
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
 * `tpl_template_registration` (`02 §2` V35). Auditoría **append-only** de cada intento de registrar
 * una plantilla, éxito o fallo (mata H-16/H-17 en su forma silenciosa). `detail` es `nullable`
 * (`JsonNode?`, no `NullNode.instance`) porque un registro `created`/`noop_same_hash` no lleva detalle.
 *
 * **Advertencia de uso (objeción B-04, `02 §4` paso 2/4):** una fila `result = 'rejected'` solo
 * sobrevive si se escribe con `Propagation.REQUIRES_NEW` — responsabilidad de `TemplateRegistrationAuditor`
 * (bloque posterior), no de este repositorio ni de esta entidad.
 */
@Entity
@Table(name = "tpl_template_registration")
class TplTemplateRegistrationEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "template_slug", nullable = false, length = 40, updatable = false)
    var templateSlug: String = "",

    @Column(name = "version", nullable = false, length = 20, updatable = false)
    var version: String = "",

    @Column(name = "requested_hash", nullable = false, length = 71, updatable = false)
    var requestedHash: String = "",

    /** `'created' | 'noop_same_hash' | 'rejected'` (`RegistrationResult`, `domain`). */
    @Column(name = "result", nullable = false, length = 20, updatable = false)
    var result: String = "",

    @Column(name = "error_code", length = 60, updatable = false)
    var errorCode: String? = null,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail", columnDefinition = "jsonb", updatable = false)
    var detail: JsonNode? = null,

    @Column(name = "template_version_id", updatable = false)
    var templateVersionId: Long? = null,

    @Column(name = "requested_by", updatable = false)
    var requestedBy: Long? = null,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
)
