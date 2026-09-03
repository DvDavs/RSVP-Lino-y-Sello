package mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant

@Entity(name = "dashboard_notification")
data class DashboardNotificationEntity(
        @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
        val id: Long = 0,

        @Column(name = "full_name", nullable = false)
        val fullName: String,

        @Column(name = "email", nullable = false)
        val email: String,

        @Column(name = "phone", nullable = false)
        val phone: String,

        @CreationTimestamp
        @Column(name = "created_at", updatable = false)
        val createdAt: Instant? = null,

        @UpdateTimestamp
        @Column(name = "updated_at")
        val updatedAt: Instant? = null
)
