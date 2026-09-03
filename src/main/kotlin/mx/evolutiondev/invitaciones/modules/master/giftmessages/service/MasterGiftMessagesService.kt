package mx.evolutiondev.invitaciones.modules.master.giftmessages.service

import jakarta.transaction.Transactional
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.GiftImageRepository
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.GiftMessageRepository
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftImageCategory
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftImageEntity
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftMessageEntity
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftMessageRequest
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftResponseDto
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftMessagesGroupResponse
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.UpdateGiftMessagesRequest
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.toImageResponses
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.toMessageResponses
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterGiftMessagesService(
        private val giftMessageRepository: GiftMessageRepository,
        private val giftImageRepository: GiftImageRepository,
        private val invitationPlanRepository: InvitationPlanRepository,
        private val eventTypeRepository: EventTypeRepository
) {

    fun createGiftMessagesGroup(request: GiftMessageRequest, userId: Long): GiftResponseDto {
        val invitationPlan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { throw IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!invitationPlan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }

        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { throw IllegalArgumentException("El evento proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }

        val savedMessages = request.messages.map { msg ->
            giftMessageRepository.save(
                    GiftMessageEntity(
                            message = msg,
                            invitationPlan = invitationPlan,
                            eventType = eventType,
                            createdBy = userId
                    )
            ).message
        }

        val savedDigitalImages = request.images.digital.map { (name, path) ->
            name to giftImageRepository.save(
                    GiftImageEntity(
                            name = name,
                            imageUrl = path,
                            category = GiftImageCategory.DIGITAL,
                            invitationPlan = invitationPlan,
                            eventType = eventType,
                            createdBy = userId
                    )
            ).imageUrl
        }.toMap()

        val savedBankImages = request.images.bank.map { (name, path) ->
            name to giftImageRepository.save(
                    GiftImageEntity(
                            name = name,
                            imageUrl = path,
                            category = GiftImageCategory.BANK,
                            invitationPlan = invitationPlan,
                            eventType = eventType,
                            createdBy = userId
                    )
            ).imageUrl
        }.toMap()

        return GiftResponseDto(
                messages = savedMessages,
                images = mapOf(
                        "digital" to savedDigitalImages,
                        "bank" to savedBankImages
                )
        )
    }

    fun listGiftMessages(
            page: Int,
            planId: Long?,
            eventId: Long?,
            isEnable: Boolean?
    ): PaginatedResponse<GiftMessagesGroupResponse> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val filterEnabled = isEnable ?: true
        
        val allMessages = when {
            planId != null && eventId != null ->
                giftMessageRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabled(planId, eventId, filterEnabled)
            planId != null ->
                giftMessageRepository.findAllByInvitationPlanIdAndIsEnabled(planId, filterEnabled)
            eventId != null ->
                giftMessageRepository.findAllByEventTypeIdAndIsEnabled(eventId, filterEnabled)
            else ->
                giftMessageRepository.findAllByIsEnabled(filterEnabled)
        }
        
        val groupedMessages = allMessages.groupBy { 
            Pair(it.invitationPlan.id, it.eventType.id) 
        }
        
        val allGroups = groupedMessages.map { (planEventPair, messages) ->
            val (pId, eId) = planEventPair
            val images = if (filterEnabled) {
                giftImageRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(pId, eId)
            } else {
                giftImageRepository.findAllByInvitationPlanIdAndEventTypeId(pId, eId).filter { !it.isEnabled }
            }
            
            val mostRecentCreatedAt = messages.mapNotNull { it.createdAt }.maxOrNull()
            
            Triple(
                mostRecentCreatedAt,
                GiftMessagesGroupResponse(
                    planId = pId,
                    eventTypeId = eId,
                    messages = messages.toMessageResponses(),
                    images = images.toImageResponses()
                ),
                messages
            )
        }
        
        val sortedGroups = allGroups.sortedByDescending { it.first }
        
        val pageSize = 20
        val totalGroups = sortedGroups.size
        val totalPages = (totalGroups + pageSize - 1) / pageSize
        val pageIndex = (page - 1).coerceAtLeast(0)
        val startIndex = pageIndex * pageSize
        val endIndex = minOf(startIndex + pageSize, totalGroups)
        
        val pagedGroups = if (startIndex < totalGroups) {
            sortedGroups.subList(startIndex, endIndex).map { it.second }
        } else {
            emptyList()
        }
        
        return PaginatedResponse(
                content = pagedGroups,
                totalPages = totalPages,
                pageNumber = page
        )
    }

    fun getGiftMessagesByGroup(planId: Long, eventId: Long): GiftMessagesGroupResponse {
        val messages = giftMessageRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabled(planId, eventId, true)
        val images = giftImageRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(planId, eventId)
        
        if (messages.isEmpty() && images.isEmpty()) {
            throw IllegalArgumentException("No se encontraron mensajes de regalo para el plan $planId y evento $eventId")
        }
        
        return GiftMessagesGroupResponse(
                planId = planId,
                eventTypeId = eventId,
                messages = messages.toMessageResponses(),
                images = images.toImageResponses()
        )
    }

    @Transactional
    fun updateGiftMessagesGroup(request: UpdateGiftMessagesRequest, userId: Long): GeneralMessageResponse {
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
        
        val allExistingMessages = giftMessageRepository.findAllByInvitationPlanIdAndEventTypeId(
                request.planId, request.eventId
        )
        val allExistingImages = giftImageRepository.findAllByInvitationPlanIdAndEventTypeId(
                request.planId, request.eventId
        )
        
        val enabledMessages = allExistingMessages.filter { it.isEnabled }
        val disabledMessages = allExistingMessages.filter { !it.isEnabled }
        
        val enabledMessagesMap = enabledMessages.associateBy { it.message }
        val disabledMessagesMap = disabledMessages.associateBy { it.message }
        val newMessagesSet = request.messages.toSet()
        
        request.messages.forEach { messageText ->
            val enabledMessage = enabledMessagesMap[messageText]
            if (enabledMessage != null) {
                enabledMessage.updatedBy = userId
                giftMessageRepository.save(enabledMessage)
            } else {
                val disabledMessage = disabledMessagesMap[messageText]
                if (disabledMessage != null) {
                    disabledMessage.isEnabled = true
                    disabledMessage.updatedBy = userId
                    disabledMessage.deletedBy = null
                    giftMessageRepository.save(disabledMessage)
                } else {
                    giftMessageRepository.save(
                            GiftMessageEntity(
                                    message = messageText,
                                    invitationPlan = plan,
                                    eventType = eventType,
                                    createdBy = userId
                            )
                    )
                }
            }
        }
        
        enabledMessages.forEach { existingMessage ->
            if (!newMessagesSet.contains(existingMessage.message)) {
                existingMessage.isEnabled = false
                existingMessage.deletedBy = userId
                existingMessage.updatedBy = userId
                giftMessageRepository.save(existingMessage)
            }
        }
        
        val enabledImages = allExistingImages.filter { it.isEnabled }
        val disabledImages = allExistingImages.filter { !it.isEnabled }
        
        val enabledImagesMap = enabledImages.associateBy { Pair(it.name, it.category) }
        val disabledImagesMap = disabledImages.associateBy { Pair(it.name, it.category) }
        val newDigitalImagesSet = request.images.digital.keys.toSet()
        val newBankImagesSet = request.images.bank.keys.toSet()
        
        request.images.digital.forEach { (name, imageUrl) ->
            val key = Pair(name, GiftImageCategory.DIGITAL)
            val enabledImage = enabledImagesMap[key]
            if (enabledImage != null) {
                enabledImage.imageUrl = imageUrl
                enabledImage.updatedBy = userId
                giftImageRepository.save(enabledImage)
            } else {
                val disabledImage = disabledImagesMap[key]
                if (disabledImage != null) {
                    disabledImage.imageUrl = imageUrl
                    disabledImage.isEnabled = true
                    disabledImage.updatedBy = userId
                    disabledImage.deletedBy = null
                    giftImageRepository.save(disabledImage)
                } else {
                    giftImageRepository.save(
                            GiftImageEntity(
                                    category = GiftImageCategory.DIGITAL,
                                    name = name,
                                    imageUrl = imageUrl,
                                    invitationPlan = plan,
                                    eventType = eventType,
                                    createdBy = userId
                            )
                    )
                }
            }
        }
        
        request.images.bank.forEach { (name, imageUrl) ->
            val key = Pair(name, GiftImageCategory.BANK)
            val enabledImage = enabledImagesMap[key]
            if (enabledImage != null) {
                enabledImage.imageUrl = imageUrl
                enabledImage.updatedBy = userId
                giftImageRepository.save(enabledImage)
            } else {
                val disabledImage = disabledImagesMap[key]
                if (disabledImage != null) {
                    disabledImage.imageUrl = imageUrl
                    disabledImage.isEnabled = true
                    disabledImage.updatedBy = userId
                    disabledImage.deletedBy = null
                    giftImageRepository.save(disabledImage)
                } else {
                    giftImageRepository.save(
                            GiftImageEntity(
                                    category = GiftImageCategory.BANK,
                                    name = name,
                                    imageUrl = imageUrl,
                                    invitationPlan = plan,
                                    eventType = eventType,
                                    createdBy = userId
                            )
                    )
                }
            }
        }
        
        enabledImages.forEach { existingImage ->
            val shouldKeep = when (existingImage.category) {
                GiftImageCategory.DIGITAL -> newDigitalImagesSet.contains(existingImage.name)
                GiftImageCategory.BANK -> newBankImagesSet.contains(existingImage.name)
            }
            
            if (!shouldKeep) {
                existingImage.isEnabled = false
                existingImage.deletedBy = userId
                existingImage.updatedBy = userId
                giftImageRepository.save(existingImage)
            }
        }
        
        return GeneralMessageResponse("Mensajes de regalo actualizados correctamente")
    }

    @Transactional
    fun deactivateGiftMessagesGroup(planId: Long, eventId: Long, userId: Long): GeneralMessageResponse {
        val messages = giftMessageRepository.findAllByInvitationPlanIdAndEventTypeId(planId, eventId)
        val images = giftImageRepository.findAllByInvitationPlanIdAndEventTypeId(planId, eventId)
        
        if (messages.isEmpty() && images.isEmpty()) {
            throw IllegalArgumentException("No se encontraron mensajes de regalo para el plan $planId y evento $eventId")
        }
        
        giftMessageRepository.deactivateAllByPlanAndEventType(planId, eventId, userId)
        giftImageRepository.deactivateAllByPlanAndEventType(planId, eventId, userId)
        
        return GeneralMessageResponse("Mensajes de regalo desactivados correctamente")
    }

    @Transactional
    fun activateGiftMessagesGroup(planId: Long, eventId: Long, userId: Long): GeneralMessageResponse {
        val messages = giftMessageRepository.findAllByInvitationPlanIdAndEventTypeId(planId, eventId)
        val images = giftImageRepository.findAllByInvitationPlanIdAndEventTypeId(planId, eventId)
        
        if (messages.isEmpty() && images.isEmpty()) {
            throw IllegalArgumentException("No se encontraron mensajes de regalo para el plan $planId y evento $eventId")
        }
        
        messages.forEach { 
            it.isEnabled = true
            it.updatedBy = userId
            it.deletedBy = null
        }
        giftMessageRepository.saveAll(messages)
        
        images.forEach { 
            it.isEnabled = true
            it.updatedBy = userId
            it.deletedBy = null
        }
        giftImageRepository.saveAll(images)
        
        return GeneralMessageResponse("Mensajes de regalo activados correctamente")
    }

    fun getGifts(invitationPlanId: Long, eventTypeId: Long): GiftResponseDto {
        val messages = giftMessageRepository
                .findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(invitationPlanId, eventTypeId)
                .map { it.message }

        val images = giftImageRepository
                .findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(invitationPlanId, eventTypeId)
                .groupBy { it.category.name.lowercase() }
                .mapValues { (_, imagesByCategory) ->
                    imagesByCategory.associate { it.name to it.imageUrl }
                }

        return GiftResponseDto(messages, images)
    }
}

