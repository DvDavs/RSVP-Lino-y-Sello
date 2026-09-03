package mx.evolutiondev.invitaciones.core.auth.service

import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Service

@Service
class HierarchyValidationService(
    private val customerRepository: CustomerRepository,
    private val invitationRepository: InvitationRepository
) {

    fun validateUserCreationHierarchy(creatorRole: Role, targetRole: Role): Boolean {
        return when (creatorRole) {
            Role.MASTER -> targetRole in listOf(Role.MASTER, Role.ADMIN, Role.USER)
            Role.ADMIN -> targetRole == Role.USER
            Role.USER -> false
        }
    }

    fun validateUserAccess(requesterId: Long, targetUserId: Long): Boolean {
        if (requesterId == targetUserId) {
            return true
        }

        val requester = customerRepository.findByIdEvenIfDisabled(requesterId) ?: return false
        val targetUser = customerRepository.findByIdEvenIfDisabled(targetUserId) ?: return false

        if (!requester.isEnabled) {
            return false
        }

        return when (requester.role) {
            Role.MASTER -> true
            Role.ADMIN -> targetUser.createdBy == requesterId
            Role.USER -> false
        }
    }

    fun validateInvitationAccess(requesterId: Long, invitationId: Long): Boolean {
        val requester = customerRepository.findByIdEvenIfDisabled(requesterId) ?: return false
        val invitation = invitationRepository.findByIdEvenIfDisabled(invitationId) ?: return false

        if (!requester.isEnabled) {
            return false
        }

        return when (requester.role) {
            Role.MASTER -> true
            Role.ADMIN -> {
                val customerId = invitation.customer.id
                if (customerId == requesterId) {
                    return true
                }
                
                val customer = customerRepository.findByIdEvenIfDisabled(customerId)
                if (customer?.createdBy == requesterId) {
                    return true
                }
                
                if (invitation.createdBy == requesterId) {
                    return true
                }
                
                false
            }
            Role.USER -> invitation.customer.id == requesterId
        }
    }

    fun getUsersCreatedBy(adminId: Long): List<Long> {
        val admin = customerRepository.findByIdEvenIfDisabled(adminId) ?: return emptyList()
        
        if (admin.role !in listOf(Role.ADMIN, Role.MASTER)) {
            return emptyList()
        }

        val createdUsers = customerRepository.findAllByCreatedByWithAnyStatus(adminId, Pageable.unpaged())
        return createdUsers.content.map { it.id }
    }
}