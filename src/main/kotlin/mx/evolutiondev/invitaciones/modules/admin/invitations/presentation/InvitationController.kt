package mx.evolutiondev.invitaciones.modules.admin.invitations.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.InvitationAdminService
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.CreateInvitationResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.InvitationSummaryResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx.toCreateInvitationResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx.toInvitationResponseItem
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.CreateInvitationRequest
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.InvitationResponse
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*


@RestController
@RequestMapping("/admin/invitations")
class InvitationController(
        private val invitationService: InvitationAdminService,
        private val invitationGuestsService: InvitationGuestsService
) {

    @GetMapping("/unpaid")
    fun getUnpaidFilteredInvitations(
            @RequestParam(required = false) email: String?,
            @RequestParam(required = false) startDate: String?,
            @RequestParam(required = false) endDate: String?,
            @RequestParam(defaultValue = "1") page: Int,
            authentication: Authentication
    ): PaginatedResponse<InvitationSummaryResponse> {
        val requesterId = authentication.userId()
        return invitationService.getUnpaidInvitationsFiltered(requesterId, email, startDate, endDate, page)
    }

    @PutMapping("/{id}/mark-as-paid")
    fun markInvitationAsPaid(
        @PathVariable id: Long,
        authentication: Authentication
    ): ResponseEntity<GeneralMessageResponse> {
        val updatedBy = authentication.userId()
        invitationService.markAsPaid(id, updatedBy)
        return ResponseEntity.ok(GeneralMessageResponse("La invitación ha sido marcada como pagada."))
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    fun createInvitationForUser(
        @RequestParam targetUserId: Long,
        @Valid @RequestBody request: CreateInvitationRequest,
        authentication: Authentication
    ): InvitationResponse {
        val creatorId = authentication.userId()
        val invitation = invitationService.createInvitationForUser(creatorId, targetUserId, request)
        return InvitationResponse(
            status = "success",
            message = "Invitación creada y activada correctamente",
            invitation = invitation.toInvitationResponseItem()
        )
    }

    @GetMapping("/all")
    @ResponseStatus(HttpStatus.OK)
    fun getFilteredInvitations(
            @RequestParam(required = false) createdByAdminId: Long?,
            @RequestParam(required = false) createdByUserId: Long?,
            @RequestParam(defaultValue = "1") page: Int,
            @RequestParam(required = false) searchText: String?,
            @RequestParam(required = false) isPaid: Boolean?,
            @RequestParam(defaultValue = "ACTIVE") status: String,
            @RequestParam(required = false) createdDateFrom: String?,
            @RequestParam(required = false) createdDateTo: String?,
            @RequestParam(required = false) eventDateFrom: String?,
            @RequestParam(required = false) eventDateTo: String?,
            authentication: Authentication
    ): PaginatedResponse<CreateInvitationResponse> {
        val requesterId = authentication.userId()
        return invitationService.getFilteredInvitations(
            requesterId = requesterId,
            createdByAdminId = createdByAdminId,
            createdByUserId = createdByUserId,
            page = page,
            searchText = searchText,
            isPaid = isPaid,
            status = status,
            createdDateFrom = createdDateFrom,
            createdDateTo = createdDateTo,
            eventDateFrom = eventDateFrom,
            eventDateTo = eventDateTo
        )
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getInvitationById(
        @PathVariable id: Long,
        authentication: Authentication
    ): CreateInvitationResponse {
        val requesterId = authentication.userId()
        return invitationService.getInvitationById(requesterId, id)
    }


    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updateInvitation(
        @PathVariable id: Long,
        @Valid @RequestBody request: CreateInvitationRequest,
        authentication: Authentication
    ): InvitationResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        val updatedInvitation = invitationService.updateInvitation(id, request, loggedInUserId, appRole)
        return InvitationResponse(
            status = "success",
            message = "Invitación actualizada correctamente",
            invitation = updatedInvitation.toInvitationResponseItem()
        )
    }

    @PutMapping("/{id}/toggle-status")
    @ResponseStatus(HttpStatus.OK)
    fun toggleInvitationStatus(
        @PathVariable id: Long,
        authentication: Authentication
    ): InvitationResponse {
        val loggedInUserId = authentication.userId()
        val updatedInvitation = invitationService.toggleInvitationStatus(id, loggedInUserId)
        val statusMessage = if (updatedInvitation.isEnabled) "habilitada" else "deshabilitada"
        return InvitationResponse(
            status = "success",
            message = "Invitación $statusMessage correctamente",
            invitation = updatedInvitation.toInvitationResponseItem()
        )
    }

    @GetMapping("/{id}/guests/notify")
    @ResponseStatus(HttpStatus.OK)
    fun notifyGuests(
        @PathVariable id: Long,
        authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        return invitationGuestsService.notifyGuests(
            userId = loggedInUserId,
            invitationId = id,
            appRole = appRole
        )
    }
}
