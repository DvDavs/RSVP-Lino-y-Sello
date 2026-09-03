package mx.evolutiondev.invitaciones.modules.admin.users.presentation

import mx.evolutiondev.invitaciones.modules.admin.invitations.service.InvitationAdminService
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.CreateInvitationResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx.toCreateInvitationResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toCustomerList
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.admin.users.service.AdminUsersService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.error.exception.HierarchyViolationException
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

/**
 * Controller for MASTER role operations with advanced filtering capabilities.
 * Provides comprehensive access to all system users and invitations with optional filters.
 * 
 * This controller implements requirement 1 from the hierarchical permissions system:
 * - MASTER can view all users without restrictions
 * - MASTER can filter users by their creator (createdByAdminId)
 * - MASTER can view all invitations without restrictions
 * - MASTER can filter invitations by creator admin or specific user
 */
@RestController
@RequestMapping("/master")
class MasterController(
    private val customerService: CustomerService,
    private val adminUsersService: AdminUsersService,
    private val invitationAdminService: InvitationAdminService
) {

    /**
     * Retrieves all users in the system with optional filtering by creator admin, status, and role.
     * 
     * When no filter is provided, returns all users (ADMIN, USER, and MASTER roles).
     * When createdByAdminId is provided, returns only users created by that specific ADMIN.
     * Status filter options: "ACTIVE", "DELETED", "ALL" (defaults to "ACTIVE")
     * Role filter options: "USER", "ADMIN", "MASTER"
     * 
     * @param createdByAdminId Optional filter to show only users created by a specific ADMIN
     * @param page Page number for pagination (1-based, defaults to 1)
     * @param status Filter by user status: "ACTIVE", "DELETED", "ALL"
     * @param role Optional filter to show only users with a specific role: "USER", "ADMIN", "MASTER"
     * @return Paginated response with all users or filtered users based on the provided criteria
     */
    @GetMapping("/users")
    @ResponseStatus(HttpStatus.OK)
    fun getAllUsers(
        @RequestParam(required = false) createdByAdminId: Long?,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) role: String?
    ): ResponseEntity<PaginatedResponse<Customer>> {
        
        if (createdByAdminId != null) {
            val creator = customerService.findCustomerById(createdByAdminId)
            if (creator.role !in listOf(Role.ADMIN, Role.MASTER)) {
                throw HierarchyViolationException("ID de usuario no válido para esta operación.")
            }
        }
        
        val users = adminUsersService.getUsersForMaster(createdByAdminId, page, status, role)
        return ResponseEntity.ok(users)
    }

    /**
     * Retrieves all invitations in the system with optional filtering capabilities.
     * 
     * MASTER users can:
     * - View all invitations when no filters are provided
     * - Filter by createdByAdminId to see invitations created by specific ADMIN and their users
     * - Filter by createdByUserId to see invitations created by specific USER
     * - Filter by searchText to search in event name, user name, or email
     * - Filter by payment status (isPaid)
     * - Filter by status (ACTIVE, INACTIVE, ALL)
     * - Filter by creation date range
     * - Filter by event date range
     * 
     * @param createdByAdminId Optional filter to show invitations created by specific ADMIN and their users
     * @param createdByUserId Optional filter to show invitations created by specific USER
     * @param page Page number for pagination (1-based, defaults to 1)
     * @param searchText Optional text search across event name, user name, and email
     * @param isPaid Optional filter by payment status
     * @param status Filter by status (ACTIVE, INACTIVE, ALL) - defaults to ACTIVE
     * @param createdDateFrom Optional filter for creation date from (YYYY-MM-DD)
     * @param createdDateTo Optional filter for creation date to (YYYY-MM-DD)
     * @param eventDateFrom Optional filter for event date from (YYYY-MM-DD)
     * @param eventDateTo Optional filter for event date to (YYYY-MM-DD)
     * @param authentication Authentication object containing logged-in MASTER user details
     * @return Paginated response with invitations based on the provided criteria
     */
    @GetMapping("/invitations/all")
    @ResponseStatus(HttpStatus.OK)
    fun getAllInvitations(
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
    ): ResponseEntity<PaginatedResponse<CreateInvitationResponse>> {
        
        if (createdByAdminId != null) {
            val creator = customerService.findCustomerById(createdByAdminId)
            if (creator.role !in listOf(Role.ADMIN, Role.MASTER)) {
                throw HierarchyViolationException("ID de usuario no válido para esta operación.")
            }
        }
        
        val masterId = authentication.userId()
        
        val invitations = invitationAdminService.getFilteredInvitations(
            requesterId = masterId,
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
        
        return ResponseEntity.ok(invitations)
    }

    /**
     * Hard delete (physical deletion) of an invitation from the database.
     * This operation is irreversible and only available to MASTER users.
     * 
     * @param id The ID of the invitation to permanently delete
     */
    @DeleteMapping("/invitations/{id}/force")
    @ResponseStatus(HttpStatus.OK)
    fun hardDeleteInvitation(
        @PathVariable id: Long
    ): GeneralMessageResponse {
        invitationAdminService.hardDeleteInvitation(id)
        return GeneralMessageResponse("Invitación eliminada permanentemente.")
    }
}
