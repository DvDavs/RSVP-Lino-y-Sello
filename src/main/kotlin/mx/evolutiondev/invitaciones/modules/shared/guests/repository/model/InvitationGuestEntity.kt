package mx.evolutiondev.invitaciones.modules.shared.guests.repository.model

import jakarta.persistence.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.Filter
import org.hibernate.annotations.SQLDelete
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity
@Table(
        name = "invitation_guest"
)
@SQLDelete(sql = "UPDATE invitation_guest SET is_enabled = false, updated_at = NOW() WHERE id = ?")
@Filter(name = "enabledFilter")
data class InvitationGuestEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        @ManyToOne(fetch = FetchType.LAZY)
        @JoinColumn(name = "invitation_id", nullable = false)
        val invitation: InvitationEntity,

        @Column(name = "full_name", nullable = true)
        val fullName: String? = null,

        @Column(name = "graduates_name", nullable = true)
        val graduatesName: String? = null,
        
        val phone: String? = null,

        @Column(name = "email", nullable = true)
        val email: String? = null,

        @Column(name = "adults_count", nullable = true)
        val adultsCount: Int? = null,

        @Column(name = "children_count", nullable = false)
        val childrenCount: Int = 0,

        @Column(name = "young_count", nullable = false)
        val youngCount: Int = 0,

        @Column(name = "adults_count_confirmed", nullable = false)
        val adultsCountConfirmed: Int = 0,

        @Column(name = "children_count_confirmed", nullable = false)
        val childrenCountConfirmed: Int = 0,

        @Column(name = "young_count_confirmed", nullable = false)
        val youngCountConfirmed: Int = 0,

        @Enumerated(EnumType.STRING)
        @Column(name = "attendance_status", nullable = false)
        val attendanceStatus: AttendanceStatus = AttendanceStatus.PENDING,

        @Column(name = "confirmation_token", nullable = true)
        val confirmationToken: String? = null,

        @Column(name = "cancellation_token", nullable = true)
        val cancellationToken: String? = null,

        @Column(name = "table_number", nullable = true)
        val tableNumber: Int? = null,

        @Column(name = "whatsapp_sent")
        val whatsappSent: Boolean = false,

        @Column(name = "congratulations_message", nullable = true)
        val congratulationsMessage: String? = null,

        @Column(name = "is_enabled", nullable = false)
        var isEnabled: Boolean = true,

        @Column(name = "notification_date_sent", nullable = true)
        val notificationDateSent: String? = null,

        @Column(name = "created_by", nullable = true)
        val createdBy: Long? = null,

        @Column(name = "updated_by", nullable = true)
        var updatedBy: Long? = null,

        @Column(name = "deleted_by", nullable = true)
        var deletedBy: Long? = null,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        var createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        var updatedAt: Instant? = null
)

