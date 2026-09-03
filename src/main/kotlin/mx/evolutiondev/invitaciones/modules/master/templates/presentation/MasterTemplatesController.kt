package mx.evolutiondev.invitaciones.modules.master.templates.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.InvitationTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.InvitationTemplateResponse
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.CompleteTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.CompleteTemplateResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.UpdateTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.service.MasterTemplatesService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/templates")
@Validated
class MasterTemplatesController(
        private val masterTemplatesService: MasterTemplatesService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createTemplate(
            @Valid @RequestBody request: InvitationTemplateRequest,
            authentication: Authentication
    ): InvitationTemplateResponse {
        val userId = authentication.userId()
        return masterTemplatesService.createTemplate(request, userId)
    }

    /**
     * Crea una plantilla completa con todas sus configuraciones en una sola operación.
     * 
        * Endpoint: POST /master/templates/complete
     * 
     * Crea:
     * - Template en PostgreSQL
     * - Configuración visual en MongoDB
     * - Configuración de contenido en MongoDB (o reutiliza existente)
     * 
     * @param request Datos completos de la plantilla (template + visualConfig + contentConfig opcional)
     * @param authentication Usuario autenticado (debe tener rol MASTER)
     * @return Respuesta con IDs de todos los recursos creados
     */
    @PostMapping("/complete")
    @ResponseStatus(HttpStatus.CREATED)
    fun createCompleteTemplate(
            @Valid @RequestBody request: CompleteTemplateRequest,
            authentication: Authentication
    ): CompleteTemplateResponse {
        val userId = authentication.userId()
        return masterTemplatesService.createCompleteTemplate(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listTemplates(
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) planId: Long?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<InvitationTemplateEntity> {
        return masterTemplatesService.listTemplates(page, eventId, planId, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getTemplateById(
            @PathVariable id: Long
    ): InvitationTemplateEntity {
        return masterTemplatesService.getTemplateById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updateTemplate(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdateTemplateRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterTemplatesService.updateTemplate(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivateTemplate(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterTemplatesService.deactivateTemplate(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activateTemplate(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterTemplatesService.activateTemplate(id, userId)
    }
}

