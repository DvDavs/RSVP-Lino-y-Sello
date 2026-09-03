package mx.evolutiondev.invitaciones.modules.master.eventtypes.service

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.eventtypes.presentation.model.ServiceTypeRequest
import mx.evolutiondev.invitaciones.modules.master.eventtypes.presentation.model.UpdateEventTypeRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterEventTypesService(
        private val eventTypeRepository: EventTypeRepository
) {

    fun createEventType(request: ServiceTypeRequest, userId: Long): EventTypeEntity {
        eventTypeRepository.findByName(request.name)?.let {
            throw IllegalArgumentException("Ya existe un tipo de servicio con el nombre ${request.name}")
        }
        return eventTypeRepository.save(
                EventTypeEntity(
                        name = request.name,
                        isWedding = request.isWedding,
                        createdBy = userId
                )
        )
    }

    fun listEventTypes(page: Int, isWedding: Boolean?, isEnable: Boolean?): PaginatedResponse<EventTypeEntity> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val resultPage: Page<EventTypeEntity> = when {
            isWedding != null && isEnable != null -> {
                eventTypeRepository.findAllByIsWeddingAndIsEnabled(isWedding, isEnable, pageable)
            }
            isWedding != null -> {
                eventTypeRepository.findAllByIsWedding(isWedding, pageable)
            }
            isEnable != null -> {
                eventTypeRepository.findAllByIsEnabled(isEnable, pageable)
            }
            else -> {
                eventTypeRepository.findAll(pageable)
            }
        }
        
        return PaginatedResponse(
                content = resultPage.content,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getEventTypeById(id: Long): EventTypeEntity {
        return eventTypeRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El tipo de evento con ID $id no existe") }
    }

    fun updateEventType(id: Long, request: UpdateEventTypeRequest, userId: Long): GeneralMessageResponse {
        val eventType = eventTypeRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El tipo de evento con ID $id no existe") }
        
        // Check if another event type with the same name exists (excluding current one)
        eventTypeRepository.findByName(request.name)?.let { existingEventType ->
            if (existingEventType.id != id) {
                throw IllegalArgumentException("Ya existe otro tipo de evento con el nombre ${request.name}")
            }
        }
        
        eventType.name = request.name
        eventType.isWedding = request.isWedding
        eventType.updatedBy = userId
        
        eventTypeRepository.save(eventType)
        
        return GeneralMessageResponse("Tipo de evento actualizado correctamente")
    }

    fun deactivateEventType(id: Long, userId: Long): GeneralMessageResponse {
        val eventType = eventTypeRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El tipo de evento con ID $id no existe")
        
        if (!eventType.isEnabled) {
            return GeneralMessageResponse("El tipo de evento ya está desactivado")
        }
        
        // Check how many active invitations are using this event type
        val activeInvitationsCount = eventTypeRepository.countActiveInvitationsUsingEventType(id)
        
        eventType.isEnabled = false
        eventType.deletedBy = userId
        
        eventTypeRepository.save(eventType)
        
        val message = if (activeInvitationsCount > 0) {
            "Tipo de evento desactivado correctamente. Actualmente está siendo utilizado por $activeInvitationsCount invitaciones activas, pero ya no estará disponible para nuevas asignaciones"
        } else {
            "Tipo de evento desactivado correctamente. No está siendo utilizado por ninguna invitación"
        }
        
        return GeneralMessageResponse(message)
    }

    fun activateEventType(id: Long, userId: Long): GeneralMessageResponse {
        val eventType = eventTypeRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El tipo de evento con ID $id no existe")
        
        if (eventType.isEnabled) {
            return GeneralMessageResponse("El tipo de evento ya está activo")
        }
        
        eventType.isEnabled = true
        eventType.updatedBy = userId
        eventType.deletedBy = null
        
        eventTypeRepository.save(eventType)
        
        return GeneralMessageResponse("Tipo de evento activado correctamente")
    }

    fun getAllEvents(): List<EventTypeEntity> {
        return eventTypeRepository.findAllByIsEnabledTrue()
    }
}

