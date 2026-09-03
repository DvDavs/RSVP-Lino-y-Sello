package mx.evolutiondev.invitaciones.modules.master.phrases.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "custom_phrase")
@SQLDelete(sql = "UPDATE custom_phrase SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class CustomPhraseEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        @Enumerated(EnumType.STRING)
        @Column(name = "genre", nullable = false)
        var genre: PhraseGenre,

        @Enumerated(EnumType.STRING)
        @Column(name = "genre_orientation", nullable = false)
        var genreOrientation: PhraseOrientation,

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "invitation_plan_id", nullable = false)
        var invitationPlan: InvitationPlanEntity,

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "event_type_id", nullable = false)
        var eventType: EventTypeEntity,

        @Column(name = "is_enabled")
        var isEnabled: Boolean = true,

        @Column(name = "created_by")
        var createdBy: Long? = null,

        @Column(name = "updated_by")
        var updatedBy: Long? = null,

        @Column(name = "deleted_by")
        var deletedBy: Long? = null,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)


