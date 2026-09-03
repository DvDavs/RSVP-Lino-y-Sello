package mx.evolutiondev.invitaciones.modules.user.invitations.presentation

import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationConfigService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/user/invitations/{invitationId}/config")
class InvitationConfigController(
    private val invitationConfigService: InvitationConfigService
) {

    /**
     * Endpoint to save or update the complete editor configuration for an invitation.
     * Accepts a complex JSON object from the frontend and persists it to MongoDB.
     *
     * @param invitationId The invitation's ID.
     * @param configRequest The full editor configuration.
     * @param authentication The authenticated user performing the operation.
     * @return ResponseEntity with the saved configuration (including MongoDB ID).
     */
    @PutMapping
    fun saveOrUpdateInvitationConfig(
        @PathVariable invitationId: Long,
        @RequestBody configRequest: InvitationConfig,
        authentication: Authentication
    ): ResponseEntity<InvitationConfig> {
        val userId = authentication.userId()
        val savedConfig = invitationConfigService.saveOrUpdateConfig(userId, invitationId, configRequest)
        return ResponseEntity.ok(savedConfig)
    }

    /**
     * Endpoint to retrieve the saved invitation configuration.
     * Returns the complete JSON object for the frontend to rebuild the editor state.
     *
     * @param invitationId The ID of the invitation.
     * @param authentication The authenticated user requesting the configuration.
     * @return ResponseEntity containing the full editor configuration.
     */
    @GetMapping
    fun getInvitationConfig(
        @PathVariable invitationId: Long,
        authentication: Authentication
    ): ResponseEntity<InvitationConfig> {
        val userId = authentication.userId()
        val config = invitationConfigService.getConfig(userId, invitationId)
        return ResponseEntity.ok(config)
    }
}

