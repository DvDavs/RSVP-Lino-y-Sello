package mx.evolutiondev.invitaciones.modules.all.templates.presentation

import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.InvitationTemplateResponse
import mx.evolutiondev.invitaciones.modules.master.templates.service.MasterTemplatesService
import mx.evolutiondev.invitaciones.modules.user.template.service.UserTemplateService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/public/invitations/templates")
class PublicInvitationTemplateController(
        private val invitationTemplateService: MasterTemplatesService,
        private val userTemplateService: UserTemplateService
) {

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listAll(
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) planId: Long?
    ): List<InvitationTemplateResponse> {
        return invitationTemplateService.listAllFiltered(eventId, planId)
    }

    /**
     * Public endpoint to get the signed URL for a guest to view their invitation template.
     * This endpoint does not require authentication as it's intended for guests
     * accessing their invitation via a shared link.
     *
     * @param invitationId The ID of the invitation
     * @return A map containing the signed URL to access the template
     */
    @GetMapping("/preview/{invitationId}/signed-url")
    @ResponseStatus(HttpStatus.OK)
    fun getPublicTemplateSignedUrl(
            @PathVariable invitationId: Long
    ): Map<String, String> {
        val url = userTemplateService.generatePublicSignedUrl(invitationId)
        return mapOf("url" to url.toString())
    }
}