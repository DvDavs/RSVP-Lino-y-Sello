package mx.evolutiondev.invitaciones.modules.master.templates.service

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.templates.repository.InvitationTemplateRepository
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.InvitationTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.InvitationTemplateResponse
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.UpdateTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.CompleteTemplateRequest
import mx.evolutiondev.invitaciones.modules.master.templates.presentation.model.CompleteTemplateResponse
import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultVisualConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultVisualConfigRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.DefaultContentConfigRepository
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class MasterTemplatesService(
        private val invitationTemplateRepository: InvitationTemplateRepository,
        private val invitationPlanRepository: InvitationPlanRepository,
        private val eventTypeRepository: EventTypeRepository,
        private val defaultVisualConfigRepository: DefaultVisualConfigRepository,
        private val defaultContentConfigRepository: DefaultContentConfigRepository,
        private val objectMapper: ObjectMapper
) {

    fun createTemplate(request: InvitationTemplateRequest, userId: Long): InvitationTemplateResponse {
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { throw IllegalArgumentException("El event id proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }

        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { throw IllegalArgumentException("El plan id proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }

        val saved = invitationTemplateRepository.save(
                InvitationTemplateEntity(
                        price = request.price,
                        image = request.image,
                        url = request.url,
                        eventType = eventType,
                        invitationPlan = plan,
                        createdBy = userId
                )
        )

        return InvitationTemplateResponse(
                id = saved.id,
                event = saved.eventType.name,
                plan = saved.invitationPlan.name,
                image = saved.image,
                url = saved.url,
                eventId = saved.eventType.id,
                planId = saved.invitationPlan.id
        )
    }

    /**
     * Crea una plantilla completa con todas sus configuraciones en una sola operación.
     * Incluye:
     * - Registro en PostgreSQL (invitation_template)
     * - Configuración visual en MongoDB (default_visual_configs)
     * - Configuración de contenido en MongoDB (default_content_configs) - opcional, puede reutilizar existente
     *
     * @param request Datos completos de la plantilla
     * @param userId ID del usuario que crea la plantilla
     * @return Respuesta con IDs de todos los recursos creados
     * @throws IllegalArgumentException Si las validaciones fallan
     */
    @Transactional
    fun createCompleteTemplate(request: CompleteTemplateRequest, userId: Long): CompleteTemplateResponse {
        // 1. Validar event type
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El event id proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }

        // 2. Validar plan
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan id proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }

        // 3. Crear template en PostgreSQL
        val savedTemplate = invitationTemplateRepository.save(
                InvitationTemplateEntity(
                        name = request.name,
                        price = request.price,
                        image = request.image,
                        url = request.url,
                        eventType = eventType,
                        invitationPlan = plan,
                        createdBy = userId
                )
        )

        // 4. Convertir visualConfig a InvitationConfig y crear configuración visual en MongoDB
        val visualConfigPayload = request.visualConfig.toMutableMap().apply {
            put("invitationId", 0)
            put("templateId", savedTemplate.id)
            put("eventId", request.eventId)
            put("planId", request.planId)
        }

        val invitationConfig = try {
            objectMapper.convertValue(visualConfigPayload, InvitationConfig::class.java)
        } catch (ex: IllegalArgumentException) {
            throw IllegalArgumentException("La configuración visual es inválida: ${ex.message}")
        }

        val visualConfig = DefaultVisualConfig(
                templateId = savedTemplate.id,
                config = invitationConfig.copy(
                        templateId = savedTemplate.id,
                        eventId = request.eventId,
                        planId = request.planId,
                        invitationId = 0
                )
        )
        val savedVisualConfig = defaultVisualConfigRepository.save(visualConfig)

        // 5. Manejar configuración de contenido
        var contentConfigId: String? = null
        var contentReused = false
        var message = "Plantilla completa creada exitosamente."

        if (request.contentConfig != null) {
            // Guardar nueva configuración de contenido
            val contentConfigForTemplate = request.contentConfig.copy(templateId = savedTemplate.id)
            val savedContentConfig = defaultContentConfigRepository.save(contentConfigForTemplate)
            contentConfigId = savedContentConfig.id
            message += " Nueva configuración de contenido creada."
        } else if (request.reuseExistingContent) {
            // Intentar reutilizar configuración existente
            // val existingContent = defaultContentConfigRepository
            //         .findByEventTypeIdAndPlanId(request.eventId, request.planId)

            val existingContent = invitationTemplateRepository
                .findAllByEventTypeIdAndInvitationPlanIdAndIsEnabledTrue(
                    request.eventId, 
                    request.planId
                )
                .filter { it.id != savedTemplate.id } // excluir el recién creado
                .maxByOrNull { it.id }                // tomar el más reciente
                ?.let { previousTemplate ->
                    defaultContentConfigRepository.findByTemplateId(previousTemplate.id)
                }
                ?.orElse(null)

            if (existingContent != null) {
                contentConfigId = existingContent.id
            // if (existingContent.isPresent) {
            //     contentConfigId = existingContent.get().id
                contentReused = true
                message += " Se reutilizó configuración de contenido existente para (eventId=${request.eventId}, planId=${request.planId})."
            } else {
                throw IllegalArgumentException(
                    "No existe configuración de contenido para (eventId=${request.eventId}, planId=${request.planId}). " +
                    "Proporciona contentConfig o asegúrate de que exista una configuración para esa combinación."
                )
            }
        } else {
            throw IllegalArgumentException("Debes proporcionar contentConfig o habilitar reuseExistingContent=true")
        }

        return CompleteTemplateResponse(
                templateId = savedTemplate.id,
            name = savedTemplate.name,
                eventType = eventType.name,
                plan = plan.name,
            price = savedTemplate.price,
            image = savedTemplate.image,
            url = savedTemplate.url,
            visualConfigId = savedVisualConfig.id.orEmpty(),
                contentConfigId = contentConfigId,
                contentReused = contentReused,
                message = message
        )
    }

    fun listTemplates(page: Int, eventId: Long?, planId: Long?, isEnable: Boolean?): PaginatedResponse<InvitationTemplateEntity> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val resultPage: Page<InvitationTemplateEntity> = when {
            eventId != null && planId != null && isEnable != null -> {
                invitationTemplateRepository.findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(eventId, planId, isEnable, pageable)
            }
            eventId != null && planId != null -> {
                invitationTemplateRepository.findAllByEventTypeIdAndInvitationPlanId(eventId, planId, pageable)
            }
            eventId != null && isEnable != null -> {
                invitationTemplateRepository.findAllByEventTypeIdAndIsEnabled(eventId, isEnable, pageable)
            }
            planId != null && isEnable != null -> {
                invitationTemplateRepository.findAllByInvitationPlanIdAndIsEnabled(planId, isEnable, pageable)
            }
            eventId != null -> {
                invitationTemplateRepository.findAllByEventTypeId(eventId, pageable)
            }
            planId != null -> {
                invitationTemplateRepository.findAllByInvitationPlanId(planId, pageable)
            }
            isEnable != null -> {
                invitationTemplateRepository.findAllByIsEnabled(isEnable, pageable)
            }
            else -> {
                invitationTemplateRepository.findAll(pageable)
            }
        }
        
        return PaginatedResponse(
                content = resultPage.content,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getTemplateById(id: Long): InvitationTemplateEntity {
        return invitationTemplateRepository.findById(id)
                .orElseThrow { IllegalArgumentException("La plantilla con ID $id no existe") }
    }

    fun updateTemplate(id: Long, request: UpdateTemplateRequest, userId: Long): GeneralMessageResponse {
        val template = invitationTemplateRepository.findById(id)
                .orElseThrow { IllegalArgumentException("La plantilla con ID $id no existe") }
        
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }
        
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El tipo de evento proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }
        
        template.name = request.name
        template.url = request.url
        template.price = request.price
        template.image = request.image
        template.invitationPlan = plan
        template.eventType = eventType
        template.updatedBy = userId
        
        invitationTemplateRepository.save(template)
        
        return GeneralMessageResponse("Plantilla actualizada correctamente")
    }

    fun deactivateTemplate(id: Long, userId: Long): GeneralMessageResponse {
        val template = invitationTemplateRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("La plantilla con ID $id no existe")
        
        if (!template.isEnabled) {
            return GeneralMessageResponse("La plantilla ya está desactivada")
        }
        
        val activeInvitationsCount = invitationTemplateRepository.countActiveInvitationsUsingTemplate(id)
        
        template.isEnabled = false
        template.deletedBy = userId
        
        invitationTemplateRepository.save(template)
        
        val message = if (activeInvitationsCount > 0) {
            "Plantilla desactivada correctamente. Actualmente está siendo utilizada por $activeInvitationsCount invitaciones activas, pero ya no estará disponible para nuevas asignaciones"
        } else {
            "Plantilla desactivada correctamente. No está siendo utilizada por ninguna invitación"
        }
        
        return GeneralMessageResponse(message)
    }

    fun activateTemplate(id: Long, userId: Long): GeneralMessageResponse {
        val template = invitationTemplateRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("La plantilla con ID $id no existe")
        
        if (template.isEnabled) {
            return GeneralMessageResponse("La plantilla ya está activa")
        }
        
        template.isEnabled = true
        template.updatedBy = userId
        template.deletedBy = null
        
        invitationTemplateRepository.save(template)
        
        return GeneralMessageResponse("Plantilla activada correctamente")
    }

    fun listAllFiltered(eventId: Long?, planId: Long?): List<InvitationTemplateResponse> {
        val templates = when {
            eventId != null && planId != null ->
                invitationTemplateRepository.findAllByEventTypeIdAndInvitationPlanIdAndIsEnabledTrue(eventId, planId)

            eventId != null ->
                invitationTemplateRepository.findAllByEventTypeIdAndIsEnabledTrue(eventId)

            planId != null ->
                invitationTemplateRepository.findAllByInvitationPlanIdAndIsEnabledTrue(planId)

            else ->
                invitationTemplateRepository.findAllByIsEnabledTrue()
        }

        // Filtrar templates cuyo eventType o plan estén deshabilitados
        val filteredTemplates = templates.filter { template ->
            template.eventType.isEnabled && template.invitationPlan.isEnabled
        }

        return filteredTemplates.map { it.toResponse() }
    }

    private fun InvitationTemplateEntity.toResponse() = InvitationTemplateResponse(
            id = id,
            event = eventType.name,
            plan = invitationPlan.name,
            image = image,
            url = url,
            eventId = eventType.id,
            planId = invitationPlan.id
    )
}

