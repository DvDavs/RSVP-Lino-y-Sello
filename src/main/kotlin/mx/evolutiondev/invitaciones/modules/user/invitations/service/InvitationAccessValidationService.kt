package mx.evolutiondev.invitaciones.modules.user.invitations.service

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import org.springframework.stereotype.Service

@Service
class InvitationAccessValidationService(
    private val invitationRepository: InvitationRepository,
    private val hierarchyValidationService: HierarchyValidationService
) {

    /**
     * Validates that the invitation exists and the user has access to it.
     * Uses hierarchical validation to allow MASTER users to access any invitation,
     * ADMIN users to access invitations of their created users, and regular users
     * to access only their own invitations.
     * 
     * @param userId The authenticated user ID
     * @param invitationId The invitation ID to validate
     * @throws IllegalArgumentException if the invitation doesn't exist or the user doesn't have permission
     */
    fun validateInvitationAccess(userId: Long, invitationId: Long) {
        invitationRepository.findByIdEvenIfDisabled(invitationId)
            ?: throw IllegalArgumentException("La invitación no existe")
        
        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw IllegalArgumentException("No tienes permiso para acceder a esta invitación")
        }
    }
}

