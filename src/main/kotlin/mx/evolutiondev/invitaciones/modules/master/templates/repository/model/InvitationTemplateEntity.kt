package mx.evolutiondev.invitaciones.modules.master.templates.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "invitation_template")
@SQLDelete(sql = "UPDATE invitation_template SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class InvitationTemplateEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        var id: Long = 0,

        var name: String = "",

        var url: String = "",

        var price: Double = 0.0,

        var image: String = "",

        @Column(name = "is_enabled")
        var isEnabled: Boolean = true,

        @ManyToOne
        @JoinColumn(name = "invitation_plan_id", nullable = false)
        var invitationPlan: InvitationPlanEntity,

        @ManyToOne
        @JoinColumn(name = "event_type_id", nullable = false)
        var eventType: EventTypeEntity,

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


