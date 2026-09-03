package mx.evolutiondev.invitaciones.modules.master.plans.service

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.plans.presentation.model.InvitationPlanRequest
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.modules.master.plans.presentation.model.UpdatePlanRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterPlansService(
        private val invitationPlanRepository: InvitationPlanRepository
) {

    fun createPlan(request: InvitationPlanRequest, userId: Long): InvitationPlanEntity {
        invitationPlanRepository.findByName(request.name)?.let {
            throw IllegalArgumentException("Ya existe un plan con el nombre ${it.name}")
        }
        return invitationPlanRepository.save(
                InvitationPlanEntity(
                        name = request.name,
                        isPremium = request.isPremium,
                        createdBy = userId
                )
        )
    }

    fun listPlans(page: Int, isPremium: Boolean?, isEnable: Boolean?): PaginatedResponse<InvitationPlanEntity> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val resultPage: Page<InvitationPlanEntity> = when {
            isPremium != null && isEnable != null -> {
                invitationPlanRepository.findAllByIsPremiumAndIsEnabled(isPremium, isEnable, pageable)
            }
            isPremium != null -> {
                invitationPlanRepository.findAllByIsPremium(isPremium, pageable)
            }
            isEnable != null -> {
                invitationPlanRepository.findAllByIsEnabled(isEnable, pageable)
            }
            else -> {
                invitationPlanRepository.findAll(pageable)
            }
        }
        
        return PaginatedResponse(
                content = resultPage.content,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getPlanById(id: Long): InvitationPlanEntity {
        return invitationPlanRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El plan con ID $id no existe") }
    }

    fun updatePlan(id: Long, request: UpdatePlanRequest, userId: Long): GeneralMessageResponse {
        val plan = invitationPlanRepository.findById(id)
                .orElseThrow { IllegalArgumentException("El plan con ID $id no existe") }
        
        invitationPlanRepository.findByName(request.name)?.let { existingPlan ->
            if (existingPlan.id != id) {
                throw IllegalArgumentException("Ya existe otro plan con el nombre ${request.name}")
            }
        }
        
        plan.name = request.name
        plan.isPremium = request.isPremium
        plan.updatedBy = userId
        
        invitationPlanRepository.save(plan)
        
        return GeneralMessageResponse("Plan actualizado correctamente")
    }

    fun deactivatePlan(id: Long, userId: Long): GeneralMessageResponse {
        val plan = invitationPlanRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El plan con ID $id no existe")
        
        if (!plan.isEnabled) {
            return GeneralMessageResponse("El plan ya está desactivado")
        }
        
        val activeInvitationsCount = invitationPlanRepository.countActiveInvitationsUsingPlan(id)
        
        plan.isEnabled = false
        plan.deletedBy = userId
        
        invitationPlanRepository.save(plan)
        
        val message = if (activeInvitationsCount > 0) {
            "Plan desactivado correctamente. Actualmente está siendo utilizado por $activeInvitationsCount invitaciones activas, pero ya no estará disponible para nuevas asignaciones"
        } else {
            "Plan desactivado correctamente. No está siendo utilizado por ninguna invitación"
        }
        
        return GeneralMessageResponse(message)
    }

    fun activatePlan(id: Long, userId: Long): GeneralMessageResponse {
        val plan = invitationPlanRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("El plan con ID $id no existe")
        
        if (plan.isEnabled) {
            return GeneralMessageResponse("El plan ya está activo")
        }
        
        plan.isEnabled = true
        plan.updatedBy = userId
        plan.deletedBy = null
        
        invitationPlanRepository.save(plan)
        
        return GeneralMessageResponse("Plan activado correctamente")
    }

    fun listAllEnabledPlans(): List<InvitationPlanEntity> =
            invitationPlanRepository.findAllByIsEnabledTrue()
}

