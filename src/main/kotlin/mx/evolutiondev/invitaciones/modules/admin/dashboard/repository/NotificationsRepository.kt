package mx.evolutiondev.invitaciones.modules.admin.dashboard.repository

import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.DashboardNotificationEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface NotificationsRepository : JpaRepository<DashboardNotificationEntity, Long> {
    fun existsByEmail(email: String): Boolean
    fun findByEmail(email: String): DashboardNotificationEntity?
}
