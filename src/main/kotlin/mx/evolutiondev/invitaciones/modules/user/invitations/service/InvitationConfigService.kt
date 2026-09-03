package mx.evolutiondev.invitaciones.modules.user.invitations.service

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.error.exception.InvitationDisabledException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import mx.evolutiondev.invitaciones.core.error.exception.UserDisabledException
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationGiftRegistryRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationGiftRegistryEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.exception.InvitationConfigNotFoundException
import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig
import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.SuggestionItem
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.InvitationConfigRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock

@Service
class InvitationConfigService(
    private val invitationConfigRepository: InvitationConfigRepository,
    private val invitationRepository: InvitationRepository,
    private val invitationGiftRegistryRepository: InvitationGiftRegistryRepository,
    private val hierarchyValidationService: HierarchyValidationService,
    private val defaultConfigGeneratorService: DefaultConfigGeneratorService
) {
    
    private val logger = LoggerFactory.getLogger(InvitationConfigService::class.java)
    
    private val locks = ConcurrentHashMap<Long, ReentrantLock>()

    /**
     * Save or update the entire editor configuration for an invitation.
     *
     * @param userId The ID of the user performing the operation.
     * @param invitationId The ID of the invitation to be configured.
     * @param configRequest The full editor configuration.
     * @return The saved configuration with its MongoDB ID.
     * @throws IllegalArgumentException If the invitation does not exist.
     * @throws UnauthorizedAccessException If the user does not have permission for this invitation.
     */
    @Transactional
    fun saveOrUpdateConfig(userId: Long, invitationId: Long, configRequest: InvitationConfig): InvitationConfig {
        val invitation = invitationRepository.findById(invitationId)
            .orElseThrow { IllegalArgumentException("La invitación con ID $invitationId no existe") }
        
        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permiso para modificar la configuración de esta invitación.")
        }

        val existingConfig = invitationConfigRepository.findByInvitationId(invitationId)

        val configToSave = if (existingConfig.isPresent) {
            val currentConfig = existingConfig.get()
            currentConfig.copy(
                settings = configRequest.settings,
                sectionCover = configRequest.sectionCover,
                sectionCouple = configRequest.sectionCouple,
                sectionEvent = configRequest.sectionEvent,
                sectionGallery = configRequest.sectionGallery,
                sectionGiftTable = configRequest.sectionGiftTable,
                sectionSuggestions = configRequest.sectionSuggestions,
                sectionAmenities = configRequest.sectionAmenities,
                sectionStarted = configRequest.sectionStarted,
                sectionFamily = configRequest.sectionFamily,
                sectionStory = configRequest.sectionStory,
                sectionDressCode = configRequest.sectionDressCode,
                sectionFooter = configRequest.sectionFooter,
                templateId = invitation.template.id,
                eventId = invitation.template.eventType.id,
                planId = invitation.template.invitationPlan.id
            )
        } else {
            configRequest.copy(
                invitationId = invitationId,
                templateId = invitation.template.id,
                eventId = invitation.template.eventType.id,
                planId = invitation.template.invitationPlan.id
            )
        }

        val savedConfig = invitationConfigRepository.save(configToSave)
        
        // Sincronizar el título de sectionGiftTable con giftRegistry en PostgreSQL
        syncGiftRegistryTitles(invitationId, configRequest.sectionGiftTable)
        
        return savedConfig
    }

    /**
     * Retrieves the saved configuration of an invitation.
     * Implements lazy generation pattern: if the configuration doesn't exist,
     * it will be automatically generated from templates and user data.
     * 
     * Validates that:
     * - The invitation is enabled
     * - The owner user is enabled (not disabled)
     * - The owner user is not banned
     * 
     * @param userId The ID of the user requesting the configuration.
     * @param invitationId The ID of the invitation.
     * @return The complete editor configuration.
     * @throws IllegalArgumentException If the invitation does not exist.
     * @throws UnauthorizedAccessException If the user does not have permission to access the configuration.
     * @throws InvitationDisabledException if the invitation is disabled
     * @throws UserDisabledException if the owner user is disabled
     * @throws UserBannedException if the owner user is banned
     */
    @Transactional
    fun getConfig(userId: Long, invitationId: Long): InvitationConfig {
        val invitation = invitationRepository.findById(invitationId)
            .orElseThrow { IllegalArgumentException("La invitación con ID $invitationId no existe") }
        
        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permiso para acceder a la configuración de esta invitación.")
        }

        if (!invitation.isEnabled) {
            throw InvitationDisabledException("La invitación ha sido desactivada y no puede ser editada.")
        }

        val customer = invitation.customer
        if (!customer.isEnabled) {
            throw UserDisabledException("Tu cuenta está desactivada. Contacta al administrador.")
        }
        if (customer.isBanned) {
            throw UserBannedException("Tu cuenta ha sido suspendida. Contacta al administrador.")
        }

        val lock = locks.computeIfAbsent(invitationId) { ReentrantLock() }
        
        lock.lock()
        try {
            val existingConfig = invitationConfigRepository.findByInvitationId(invitationId)
            
            return if (existingConfig.isPresent) {
                val config = existingConfig.get()
                // Lazy migration: Populate templateId, eventId and planId if missing
                if (config.templateId == null || config.eventId == null || config.planId == null) {
                    val updatedConfig = config.copy(
                        templateId = invitation.template.id,
                        eventId = invitation.template.eventType.id,
                        planId = invitation.template.invitationPlan.id
                    )
                    invitationConfigRepository.save(updatedConfig)
                } else {
                    config
                }
            } else {
                
                try {
                    val initialConfig = defaultConfigGeneratorService.generateInitialConfig(invitationId)
                    val savedConfig = invitationConfigRepository.save(initialConfig)
                    
                    savedConfig
                } catch (e: Exception) {
                    logger.error("Fallo al generar/guardar config inicial para invitation $invitationId", e)
                    invitationConfigRepository.findByInvitationId(invitationId)
                        .orElseThrow { 
                            IllegalStateException("Failed to create or retrieve config for invitation $invitationId", e) 
                        }
                }
            }
        } finally {
            lock.unlock()
            
            if (!lock.hasQueuedThreads()) {
                locks.remove(invitationId, lock)
            }
        }
    }
    
    @Transactional
    private fun syncGiftRegistryTitles(invitationId: Long, sectionGiftTable: mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.SectionGifttableData?) {
        if (sectionGiftTable == null || sectionGiftTable.items.isEmpty()) {
            return
        }
        
        val existingGiftRegistry = invitationGiftRegistryRepository.findAllByInvitationId(invitationId)
        if (existingGiftRegistry.isEmpty()) {
            return
        }
        
        sectionGiftTable.items.forEachIndexed { index, item ->
            if (index < existingGiftRegistry.size) {
                val giftRegistryEntity = existingGiftRegistry[index]
                
                if (giftRegistryEntity.type == "physical" || giftRegistryEntity.type == "fisico") {
                    val title = item.title.content?.trim()?.takeIf { it.isNotBlank() }
                    val currentTitle = giftRegistryEntity.title
                    
                    if (title != null && title != currentTitle) {
                        giftRegistryEntity.title = title
                        invitationGiftRegistryRepository.save(giftRegistryEntity)
                        logger.debug("Título actualizado para giftRegistry ${giftRegistryEntity.id}: '$currentTitle' -> '$title'")
                    }
                    
                    val firstBodyMessage = item.body.firstOrNull()?.content?.trim()?.takeIf { it.isNotBlank() }
                    val currentMessage = giftRegistryEntity.message
                    
                    if (firstBodyMessage != null && firstBodyMessage != currentMessage) {
                        giftRegistryEntity.message = firstBodyMessage
                        invitationGiftRegistryRepository.save(giftRegistryEntity)
                        logger.debug("Mensaje actualizado para giftRegistry ${giftRegistryEntity.id}: '$currentMessage' -> '$firstBodyMessage'")
                    }
                }
            }
        }
    }
}