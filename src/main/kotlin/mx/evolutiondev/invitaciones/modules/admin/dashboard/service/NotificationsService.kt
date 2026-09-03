package mx.evolutiondev.invitaciones.modules.admin.dashboard.service

import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.NotificationsRepository
import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.DashboardNotificationEntity
import mx.evolutiondev.invitaciones.modules.admin.dashboard.service.model.NotificationsRequest
import org.springframework.stereotype.Service

@Service
class NotificationsService(
        private val repository: NotificationsRepository
) {
    fun create(request: NotificationsRequest): DashboardNotificationEntity {
        if (repository.existsByEmail(request.email)) {
            throw IllegalArgumentException("Ya existe un receptor con ese correo electrónico")
        }
        return repository.save(
                DashboardNotificationEntity(
                        fullName = request.fullName,
                        email = request.email,
                        phone = request.phone
                )
        )
    }

    fun listAll(): List<DashboardNotificationEntity> = repository.findAll()

    fun update(id: Long, request: NotificationsRequest): DashboardNotificationEntity {
        val entity = repository.findById(id).orElseThrow { IllegalArgumentException("Notification not found") }

        val existing = repository.findByEmail(request.email)
        if (existing != null && existing.id != id) {
            throw IllegalArgumentException("Ya existe otro receptor con ese correo electrónico")
        }

        val updated = entity.copy(
                fullName = request.fullName,
                email = request.email,
                phone = request.phone
        )
        return repository.save(updated)
    }

    fun delete(id: Long) {
        if (!repository.existsById(id)) throw IllegalArgumentException("Notification not found")
        repository.deleteById(id)
    }
}