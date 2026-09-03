package mx.evolutiondev.invitaciones.modules.master.eventtypes.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.eventtypes.presentation.model.ServiceTypeRequest
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.eventtypes.presentation.model.UpdateEventTypeRequest
import mx.evolutiondev.invitaciones.modules.master.eventtypes.service.MasterEventTypesService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/event-types")
@Validated
class MasterEventTypesController(
        private val masterEventTypesService: MasterEventTypesService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createEventType(
            @Valid @RequestBody request: ServiceTypeRequest,
            authentication: Authentication
    ): EventTypeEntity {
        val userId = authentication.userId()
        return masterEventTypesService.createEventType(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listEventTypes(
            @RequestParam(required = false) isWedding: Boolean?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<EventTypeEntity> {
        return masterEventTypesService.listEventTypes(page, isWedding, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getEventTypeById(
            @PathVariable id: Long
    ): EventTypeEntity {
        return masterEventTypesService.getEventTypeById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updateEventType(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdateEventTypeRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterEventTypesService.updateEventType(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivateEventType(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterEventTypesService.deactivateEventType(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activateEventType(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterEventTypesService.activateEventType(id, userId)
    }
}

