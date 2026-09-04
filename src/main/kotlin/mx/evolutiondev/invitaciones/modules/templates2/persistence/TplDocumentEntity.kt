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
import org.hibernate.annotations.UpdateTimestamp
import org.hibernate.type.SqlTypes
import java.time.Instant

/**
 * `tpl_document` (`02 §2` V32). Una fila por invitación. **Solo dos caminos la crean** (decisión
 * X-07): `:choose-template` (vía [TplDocumentRepository.insertIfAbsent]) y el corte de la migración;
 * ningún `GET` la crea. `revision` es el contador de control optimista (ADR-014); el `UPDATE` que la
 * mueve es [TplDocumentRepository.applyRevision], **no** `save()` de Spring Data (evita perder el
 * `WHERE revision = ?` de la escritura optimista).
 *
 * El tipo del atributo `doc` es `JsonNode`, no `String` ni una clase de dominio (`02 §8.2`, motivo (a)
 * (b) (c) allí documentados). La conversión `JsonNode ⇄ InvitationDocument` es de la capa de servicio
 * (`Templates2Json`/`DomainJson`, de 2-0b), no de esta entidad.
 */
@Entity
@Table(name = "tpl_document")
class TplDocumentEntity(

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long = 0,

    @Column(name = "invitation_id", nullable = false, updatable = false)
    var invitationId: Long = 0,

    @Column(name = "template_version_id", nullable = false)
    var templateVersionId: Long = 0,

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "doc", columnDefinition = "jsonb", nullable = false)
    var doc: JsonNode = NullNode.instance,

    @Column(name = "revision", nullable = false)
    var revision: Long = 0,

    /** `PublicToken.value` (`pub_<ULID>`), estable de por vida de la invitación (`03 §3.10`). */
    @Column(name = "public_token", nullable = false, length = 30, updatable = false)
    var publicToken: String = "",

    @Column(name = "doc_bytes", nullable = false)
    var docBytes: Int = 0,

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,

    @Column(name = "updated_by")
    var updatedBy: Long? = null,
)
