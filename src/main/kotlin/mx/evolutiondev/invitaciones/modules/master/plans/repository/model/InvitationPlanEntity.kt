package mx.evolutiondev.invitaciones.modules.master.plans.repository.model

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(name = "invitation_plan")
@SQLDelete(sql = "UPDATE invitation_plan SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class InvitationPlanEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        var id: Long = 0,

        var name: String = "",

        @Column(name = "is_enabled")
        var isEnabled: Boolean = true,

        @Column(name = "is_premium")
        var isPremium: Boolean = false,

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
