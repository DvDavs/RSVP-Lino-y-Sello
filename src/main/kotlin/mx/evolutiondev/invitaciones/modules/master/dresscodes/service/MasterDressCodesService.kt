package mx.evolutiondev.invitaciones.modules.master.dresscodes.service

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.DressCodeRepository
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.model.DressCodeEntity
import mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation.model.DressCodeRequest
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation.model.UpdateDressCodeRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterDressCodesService(
        private val dressCodeRepository: DressCodeRepository,
        private val invitationPlanRepository: InvitationPlanRepository,
        private val eventTypeRepository: EventTypeRepository
) {

    fun createDressCode(request: DressCodeRequest, userId: Long): DressCodeEntity {
        val eventType = eventTypeRepository.findById(request.eventId).orElseThrow {
            throw IllegalArgumentException("El tipo de evento proporcionado no es válido")
        }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }
        
        val planType = invitationPlanRepository.findById(request.planId).orElseThrow {
            throw IllegalArgumentException("El tipo de plan proporcionado no es válido")
        }
        
        if (!planType.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }
        
        dressCodeRepository.findByName(request.name)?.let {
            throw IllegalArgumentException("Ya existe un código de vestimenta con el nombre ${it.name}")
        }
        return dressCodeRepository.save(
                DressCodeEntity(
                        name = request.name,
                        womanImage = request.womanImage,
                        womanDescription = request.womanDescription,
                        manImage = request.manImage,
                        manDescription = request.manDescription,
                        eventType = eventType,
                        invitationPlan = planType,
                        createdBy = userId
                )
        )
    }

    fun listDressCodes(page: Int, eventId: Long?, planId: Long?, isEnable: Boolean?): PaginatedResponse<DressCodeEntity> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val resultPage: Page<DressCodeEntity> = when {
            eventId != null && planId != null && isEnable != null -> {
                dressCodeRepository.findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(eventId, planId, isEnable, pageable)
            }
            eventId != null && planId != null -> {
                dressCodeRepository.findAllByEventTypeIdAndInvitationPlanId(eventId, planId, pageable)
            }
            eventId != null && isEnable != null -> {
                dressCodeRepository.findAllByEventTypeIdAndIsEnabled(eventId, isEnable, pageable)
            }
            planId != null && isEnable != null -> {
                dressCodeRepository.findAllByInvitationPlanIdAndIsEnabled(planId, isEnable, pageable)
            }
            eventId != null -> {
                dressCodeRepository.findAllByEventTypeId(eventId, pageable)
            }
            planId != null -> {
                dressCodeRepository.findAllByInvitationPlanId(planId, pageable)
            }
            isEnable != null -> {
                dressCodeRepository.findAllByIsEnabled(isEnable, pageable)
            }
            else -> {
                dressCodeRepository.findAll(pageable)
            }
        }
        
        return PaginatedResponse(
                content = resultPage.content,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getDressCodeById(id: Long): DressCodeEntity {
        return dressCodeRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El código de vestimenta con ID $id no existe") }
    }

    fun updateDressCode(id: Long, request: UpdateDressCodeRequest, userId: Long): GeneralMessageResponse {
        val dressCode = dressCodeRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El código de vestimenta con ID $id no existe") }
        
        dressCodeRepository.findByName(request.name)?.let { existingDressCode ->
            if (existingDressCode.id != id) {
                throw IllegalArgumentException("Ya existe otro código de vestimenta con el nombre ${request.name}")
            }
        }
        
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }
        
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El tipo de evento proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }
        
        dressCode.name = request.name
        dressCode.womanImage = request.womanImage
        dressCode.womanDescription = request.womanDescription
        dressCode.manImage = request.manImage
        dressCode.manDescription = request.manDescription
        dressCode.invitationPlan = plan
        dressCode.eventType = eventType
        dressCode.updatedBy = userId
        
        dressCodeRepository.save(dressCode)
        
        return GeneralMessageResponse("Código de vestimenta actualizado correctamente")
    }

    fun deactivateDressCode(id: Long, userId: Long): GeneralMessageResponse {
        val dressCode = dressCodeRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El código de vestimenta con ID $id no existe")
        
        if (!dressCode.isEnabled) {
            return GeneralMessageResponse("El código de vestimenta ya está desactivado")
        }
        
        val activeInvitationsCount = dressCodeRepository.countActiveInvitationsUsingDressCode(id)
        
        dressCode.isEnabled = false
        dressCode.deletedBy = userId
        
        dressCodeRepository.save(dressCode)
        
        
        val message = if (activeInvitationsCount > 0) {
            "Código de vestimenta desactivado correctamente. Actualmente está siendo utilizado por $activeInvitationsCount invitaciones activas, pero ya no estará disponible para nuevas asignaciones"
        } else {
            "Código de vestimenta desactivado correctamente. No está siendo utilizado por ninguna invitación"
        }
        
        return GeneralMessageResponse(message)
    }

    fun activateDressCode(id: Long, userId: Long): GeneralMessageResponse {
        val dressCode = dressCodeRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El código de vestimenta con ID $id no existe")
        
        if (dressCode.isEnabled) {
            return GeneralMessageResponse("El código de vestimenta ya está activo")
        }
        
        dressCode.isEnabled = true
        dressCode.updatedBy = userId
        dressCode.deletedBy = null
        
        dressCodeRepository.save(dressCode)
        
        
        return GeneralMessageResponse("Código de vestimenta activado correctamente")
    }

    fun getAllDressCode(eventId: Long, planId: Long): List<DressCodeEntity> {
        eventTypeRepository.findById(eventId).orElseThrow {
            throw IllegalArgumentException("El tipo de evento proporcionado no es válido")
        }
        invitationPlanRepository.findById(planId).orElseThrow {
            throw IllegalArgumentException("El tipo de plan proporcionado no es válido")
        }
        return dressCodeRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(planId, eventId)
    }
}

