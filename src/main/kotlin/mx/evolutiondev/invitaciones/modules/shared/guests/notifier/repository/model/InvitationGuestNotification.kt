package mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(
        name = "invitation_guest_notification"
)
data class InvitationGuestNotification(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "invitation_id", nullable = false)
        val invitation: InvitationEntity,

        @Column(name = "notified_by")
        val notifiedBy: Long? = null,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)
