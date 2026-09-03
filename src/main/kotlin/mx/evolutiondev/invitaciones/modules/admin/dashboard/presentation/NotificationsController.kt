package mx.evolutiondev.invitaciones.modules.admin.dashboard.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.DashboardNotificationEntity
import mx.evolutiondev.invitaciones.modules.admin.dashboard.service.NotificationsService
import mx.evolutiondev.invitaciones.modules.admin.dashboard.service.model.NotificationsRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin/dashboard/notifications/receivers")
class NotificationsController(
        private val service: NotificationsService
) {

    @PostMapping
    fun create(@RequestBody @Valid request: NotificationsRequest): ResponseEntity<DashboardNotificationEntity> {
        return ResponseEntity.ok(service.create(request))
    }

    @GetMapping
    fun listAll(): ResponseEntity<List<DashboardNotificationEntity>> =
            ResponseEntity.ok(service.listAll())

    @PutMapping("/{id}")
    fun update(
            @PathVariable id: Long,
            @RequestBody @Valid request: NotificationsRequest
    ): ResponseEntity<DashboardNotificationEntity> {
        return ResponseEntity.ok(service.update(id, request))
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long): ResponseEntity<Void> {
        service.delete(id)
        return ResponseEntity.noContent().build()
    }
}