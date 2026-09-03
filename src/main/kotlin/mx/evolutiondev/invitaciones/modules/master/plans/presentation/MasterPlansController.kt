package mx.evolutiondev.invitaciones.modules.master.plans.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.plans.presentation.model.InvitationPlanRequest
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.plans.presentation.model.UpdatePlanRequest
import mx.evolutiondev.invitaciones.modules.master.plans.service.MasterPlansService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/plans")
@Validated
class MasterPlansController(
        private val masterPlansService: MasterPlansService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createPlan(
            @Valid @RequestBody request: InvitationPlanRequest,
            authentication: Authentication
    ): InvitationPlanEntity {
        val userId = authentication.userId()
        return masterPlansService.createPlan(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listPlans(
            @RequestParam(required = false) isPremium: Boolean?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<InvitationPlanEntity> {
        return masterPlansService.listPlans(page, isPremium, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getPlanById(
            @PathVariable id: Long
    ): InvitationPlanEntity {
        return masterPlansService.getPlanById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updatePlan(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdatePlanRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPlansService.updatePlan(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivatePlan(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPlansService.deactivatePlan(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activatePlan(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPlansService.activatePlan(id, userId)
    }
}

