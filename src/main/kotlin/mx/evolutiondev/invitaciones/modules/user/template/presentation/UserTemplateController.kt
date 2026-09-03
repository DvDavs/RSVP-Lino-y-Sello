package mx.evolutiondev.invitaciones.modules.user.template.presentation

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.user.template.presentation.model.UserInvitationTemplateConfigRequest
import mx.evolutiondev.invitaciones.modules.user.template.presentation.model.UserInvitationTemplateConfigResponse
import mx.evolutiondev.invitaciones.modules.user.template.service.UserTemplateService
import org.springframework.http.MediaType
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/user/template")
class UserTemplateController(
        private val userTemplateService: UserTemplateService
) {

    @GetMapping("/{invitationId}")
    fun renderTemplate(
            authentication: Authentication,
            @PathVariable invitationId: Long
    ): UserInvitationTemplateConfigResponse {
        return userTemplateService.recoverInvitationTemplateConfig(
                authentication.userId(),
                invitationId
        )
    }

    @PutMapping("/file/{invitationId}/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadUserTemplate(
            authentication: Authentication,
            @PathVariable invitationId: Long,
            @RequestPart("file") file: MultipartFile
    ): Map<String, String> {
        val userId = authentication.userId()
        val publicUrl = userTemplateService.uploadInvitationTemplate(userId, invitationId, file)
        return mapOf("url" to publicUrl.toString())
    }

    @PutMapping("/{invitationId}")
    fun updateInvitationTemplateConfig(
            authentication: Authentication,
            @PathVariable invitationId: Long,
            @RequestBody config: UserInvitationTemplateConfigRequest
    ): UserInvitationTemplateConfigResponse {
        return userTemplateService.updateInvitationTemplateConfig(
                authentication.userId(),
                invitationId,
                config
        )
    }

    @GetMapping("/preview/{invitationId}/signed-url")
    fun getTemplateSignedUrl(
            authentication: Authentication,
            @PathVariable invitationId: Long
    ): Map<String, String> {
        val userId = authentication.userId()
        val url = userTemplateService.generateSignedUrl(userId, invitationId)
        return mapOf("url" to url.toString())
    }
}
