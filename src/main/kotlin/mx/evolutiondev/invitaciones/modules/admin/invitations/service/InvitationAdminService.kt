package mx.evolutiondev.invitaciones.modules.admin.invitations.service

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.core.util.formatter.isValidDateFormat
import mx.evolutiondev.invitaciones.core.util.formatter.isValidEmail
import mx.evolutiondev.invitaciones.core.util.formatter.ktx.toEndInstantDate
import mx.evolutiondev.invitaciones.core.util.formatter.ktx.toStartInstantDate
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationSpecifications
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.InvitationSummaryResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.CreateInvitationResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx.toSummaryResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx.toCreateInvitationPageResponse
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx.toCreateInvitationResponse
import mx.evolutiondev.invitaciones.modules.master.templates.repository.InvitationTemplateRepository
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPersistenceHelper
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationValidationService
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ExtraModuleHelper
import mx.evolutiondev.invitaciones.modules.user.invitations.service.InvitationNotificationService
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.CreateInvitationRequest
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.InvitationGuestNotificationRepository
import mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo.InvitationConfigRepository
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class InvitationAdminService(
        private val invitationRepository: InvitationRepository,
        private val customerRepository: CustomerRepository,
        private val invitationTemplateRepository: InvitationTemplateRepository,
        private val hierarchyValidationService: HierarchyValidationService,
        private val invitationPersistenceHelper: InvitationPersistenceHelper,
        private val invitationNotificationService: InvitationNotificationService,
        private val priceCalculatorService: mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPriceCalculatorService,
        private val invitationValidationService: InvitationValidationService,
        private val invitationGuestNotificationRepository: InvitationGuestNotificationRepository,
        private val invitationConfigRepository: InvitationConfigRepository
) {

    fun getUnpaidInvitationsFiltered(
            requesterId: Long,
            email: String?,
            startDate: String?,
            endDate: String?,
            page: Int
    ): PaginatedResponse<InvitationSummaryResponse> {
        val requester = customerRepository.findById(requesterId)
            .orElseThrow { IllegalArgumentException("El usuario solicitante con id $requesterId no existe") }

        if (!requester.isEnabled) {
            throw IllegalArgumentException("El usuario solicitante con id $requesterId está deshabilitado")
        }

        if (email?.isValidEmail() == false) {
            throw IllegalArgumentException("El email proporcionado no es válido")
        }

        if (startDate?.isValidDateFormat() == false) {
            throw IllegalArgumentException("startDate debe tener un formato 'yyyy-MM-dd'")
        }

        if (endDate?.isValidDateFormat() == false) {
            throw IllegalArgumentException("endDate debe tener un formato 'yyyy-MM-dd'")
        }

        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }

        val startInstant = startDate?.toStartInstantDate()
        val endInstant = endDate?.toEndInstantDate()

        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))

        val spec = when (requester.role) {
            Role.MASTER -> {
                InvitationSpecifications.unpaidForMaster(email, startInstant, endInstant)
            }
            Role.ADMIN -> {
                val usersCreatedByAdmin = hierarchyValidationService.getUsersCreatedBy(requesterId)
                InvitationSpecifications.unpaidForAdmin(requesterId, usersCreatedByAdmin, email, startInstant, endInstant)
            }
            Role.USER -> {
                InvitationSpecifications.unpaidForUser(requesterId, email, startInstant, endInstant)
            }
        }

        val pageResult = invitationRepository.findAll(spec, pageable).toSummaryResponse()

        return PaginatedResponse(
                content = pageResult.content,
                totalPages = pageResult.totalPages,
                pageNumber = page
        )
    }

    /**
     * Hallazgo **S-03** (`12-producto-completo.md §A3`, severidad ALTA de negocio), cerrado por
     * **ADR-5-E5-01**: este método NO comprobaba jerarquía, así que cualquier cuenta con rol ADMIN
     * marcaba como pagada cualquier invitación del sistema —incluidas las de clientas de otros
     * administradores— recorriendo ids. Con la puerta de publicación de ADR-5-0B-01, eso equivale a
     * regalar el producto.
     *
     * El arreglo es la **misma llamada, en el mismo orden**, que ya hacen sus rutas hermanas de este
     * mismo servicio: `getInvitationById` (`:464-466`) y `toggleInvitationStatus` (`:479-481`).
     * `HierarchyValidationService.validateInvitationAccess`
     * (`core/auth/service/HierarchyValidationService.kt:42-71`) devuelve `true` siempre para MASTER,
     * y para ADMIN solo si la invitación es suya, de una clienta que él creó o creada por él: **un
     * MASTER sigue pudiendo todo**.
     */
    fun markAsPaid(id: Long, updatedBy: Long) {
        if (!hierarchyValidationService.validateInvitationAccess(updatedBy, id)) {
            throw UnauthorizedAccessException("No tienes permisos para modificar esta invitación")
        }

        val invitation = invitationRepository.findById(id)
                .orElseThrow { IllegalArgumentException("La invitación con id $id no existe") }

        if (invitation.isPaid) {
            throw IllegalArgumentException("La invitación con el id $id ya se encuentra pagada")
        }

        invitation.isPaid = true
        invitation.updatedBy = updatedBy
        invitationRepository.save(invitation)
    }
    
    @Transactional
    fun createInvitationForUser(creatorId: Long, targetUserId: Long, request: CreateInvitationRequest): InvitationEntity {
        val creator = customerRepository.findById(creatorId)
            .orElseThrow { IllegalArgumentException("El usuario creador con id $creatorId no existe") }

        if (!creator.isEnabled) {
            throw IllegalArgumentException("El usuario creador con id $creatorId está deshabilitado")
        }

        val targetUser = validateTargetUserExists(targetUserId)

        when (creator.role) {
            Role.MASTER -> {
            }
            Role.ADMIN -> {
                if (targetUser.createdBy != creatorId) {
                    throw UnauthorizedAccessException("El ADMIN con id $creatorId no tiene permisos para crear invitaciones para el usuario $targetUserId")
                }
            }
            else -> {
                throw UnauthorizedAccessException("No tienes permisos para crear invitaciones")
            }
        }

        val template = invitationTemplateRepository.findById(request.templateId)
            .orElseThrow { IllegalArgumentException("El template con id ${request.templateId} no existe") }

        invitationValidationService.validateEnabledComponents(template)

        val eventType = template.eventType
        val plan = template.invitationPlan

        invitationValidationService.validatePeopleRules(eventType, request.eventDetails.people)
        invitationValidationService.validatePhraseRules(eventType, plan, request.phrases)
        invitationValidationService.validateExtraModulesRules(eventType, request.extraModules)

        val includedModules = ExtraModuleHelper.resolveExtraModules(request.extraModules, template).toMutableList()
        val totalAmount = priceCalculatorService.calculateTotalPrice(template, includedModules)
        val priceBreakdown = priceCalculatorService.calculatePriceBreakdown(template, includedModules)

        val invitation = invitationRepository.save(
            InvitationEntity(
                template = template,
                customer = targetUser,
                date = request.eventDetails.date,
                time = request.eventDetails.time,
                childrenAllowed = request.eventDetails.childrenAllowed,
                youngAllowed = request.eventDetails.youngAllow,
                hashtag = request.eventDetails.hashtag,
                coverPhotoUrl = request.eventDetails.coverPhotoUrl,
                createdBy = creatorId,
                isPaid = true,
                isEnabled = true,
                totalAmount = totalAmount, 
                hasMusic = request.music.enabled,
                hasGallery = !request.gallery.isNullOrEmpty(),
                hasExtraModules = includedModules.isNotEmpty(),
                extraModulesIncluded = includedModules.toMutableList(),
                allEventsSameLocation = request.allEventsSameLocation
            )
        )

        invitationPersistenceHelper.saveNewSubComponents(invitation, request)
        
        invitationNotificationService.prepareInvitationNotification(
            targetUser,
            eventType,
            plan,
            request.extraModules,
            priceBreakdown,
            isPaid = true
        )
        
        return invitation
    }

    fun getFilteredInvitations(
        requesterId: Long, 
        createdByAdminId: Long?, 
        createdByUserId: Long?, 
        page: Int,
        searchText: String? = null,
        isPaid: Boolean? = null,
        status: String = "ACTIVE",
        createdDateFrom: String? = null,
        createdDateTo: String? = null,
        eventDateFrom: String? = null,
        eventDateTo: String? = null
    ): PaginatedResponse<CreateInvitationResponse> {
        val requester = customerRepository.findById(requesterId)
            .orElseThrow { IllegalArgumentException("El usuario solicitante con id $requesterId no existe") }

        if (!requester.isEnabled) {
            throw IllegalArgumentException("El usuario solicitante con id $requesterId está deshabilitado")
        }

        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val validatedStatus = when (requester.role) {
            Role.USER -> {
                if (status.uppercase() != "ACTIVE") {
                }
                "ACTIVE"
            }
            Role.ADMIN -> status.uppercase()
            Role.MASTER -> status.uppercase()
        }

        if (createdDateFrom?.isValidDateFormat() == false) {
            throw IllegalArgumentException("createdDateFrom debe tener un formato 'yyyy-MM-dd'")
        }

        if (createdDateTo?.isValidDateFormat() == false) {
            throw IllegalArgumentException("createdDateTo debe tener un formato 'yyyy-MM-dd'")
        }

        if (eventDateFrom?.isValidDateFormat() == false) {
            throw IllegalArgumentException("eventDateFrom debe tener un formato 'yyyy-MM-dd'")
        }

        if (eventDateTo?.isValidDateFormat() == false) {
            throw IllegalArgumentException("eventDateTo debe tener un formato 'yyyy-MM-dd'")
        }

        val createdStartInstant = createdDateFrom?.toStartInstantDate()
        val createdEndInstant = createdDateTo?.toEndInstantDate()
        val eventStartDate = eventDateFrom
        val eventEndDate = eventDateTo

        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))

        val spec = when (requester.role) {
            Role.MASTER -> {
                when {
                    createdByAdminId != null -> {
                        val usersCreatedByAdmin = hierarchyValidationService.getUsersCreatedBy(createdByAdminId)
                        val allowedCustomerIds = mutableListOf(createdByAdminId).apply { addAll(usersCreatedByAdmin) }
                        InvitationSpecifications.forMasterWithFilters(
                            creatorIds = allowedCustomerIds,
                            searchText = searchText,
                            isPaid = isPaid,
                            status = validatedStatus,
                            createdDateFrom = createdStartInstant,
                            createdDateTo = createdEndInstant,
                            eventDateFrom = eventStartDate,
                            eventDateTo = eventEndDate
                        )
                    }
                    createdByUserId != null -> {
                        InvitationSpecifications.forMasterWithFilters(
                            creatorIds = listOf(createdByUserId),
                            searchText = searchText,
                            isPaid = isPaid,
                            status = validatedStatus,
                            createdDateFrom = createdStartInstant,
                            createdDateTo = createdEndInstant,
                            eventDateFrom = eventStartDate,
                            eventDateTo = eventEndDate
                        )
                    }
                    else -> {
                        InvitationSpecifications.forMasterWithFilters(
                            creatorIds = null,
                            searchText = searchText,
                            isPaid = isPaid,
                            status = validatedStatus,
                            createdDateFrom = createdStartInstant,
                            createdDateTo = createdEndInstant,
                            eventDateFrom = eventStartDate,
                            eventDateTo = eventEndDate
                        )
                    }
                }
            }
            Role.ADMIN -> {
                val usersCreatedByAdmin = hierarchyValidationService.getUsersCreatedBy(requesterId)
                val allowedCustomerIds = mutableListOf(requesterId).apply { addAll(usersCreatedByAdmin) }
                InvitationSpecifications.forAdminWithFilters(
                    adminId = requesterId,
                    creatorIds = allowedCustomerIds,
                    searchText = searchText,
                    isPaid = isPaid,
                    status = validatedStatus,
                    createdDateFrom = createdStartInstant,
                    createdDateTo = createdEndInstant,
                    eventDateFrom = eventStartDate,
                    eventDateTo = eventEndDate
                )
            }
            Role.USER -> {
                InvitationSpecifications.forUserWithFilters(
                    userId = requesterId,
                    searchText = searchText,
                    isPaid = isPaid,
                    status = validatedStatus,
                    createdDateFrom = createdStartInstant,
                    createdDateTo = createdEndInstant,
                    eventDateFrom = eventStartDate,
                    eventDateTo = eventEndDate
                )
            }
        }

        val pageResult = invitationRepository.findAll(spec, pageable).toCreateInvitationPageResponse()

        return PaginatedResponse(
            content = pageResult.content,
            totalPages = pageResult.totalPages,
            pageNumber = page
        )
    }

    fun getInvitationsForAdmin(adminId: Long, page: Int = 1): PaginatedResponse<CreateInvitationResponse> {
        val admin = customerRepository.findById(adminId)
            .orElseThrow { IllegalArgumentException("El admin con id $adminId no existe") }

        if (!admin.isEnabled) {
            throw IllegalArgumentException("El admin con id $adminId está deshabilitado")
        }

        if (admin.role != Role.ADMIN) {
            throw UnauthorizedAccessException("El usuario con id $adminId no tiene rol ADMIN")
        }

        return getFilteredInvitations(adminId, null, null, page)
    }

    private fun validateTargetUserExists(targetUserId: Long): mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity {
        val targetUser = customerRepository.findById(targetUserId)
            .orElseThrow { IllegalArgumentException("El usuario objetivo con id $targetUserId no existe") }

        if (!targetUser.isEnabled) {
            throw IllegalArgumentException("El usuario objetivo con id $targetUserId está deshabilitado")
        }

        if (targetUser.isBanned) {
            throw IllegalArgumentException("El usuario objetivo con id $targetUserId está baneado")
        }

        return targetUser
    }

    @Transactional
    fun hardDeleteInvitation(invitationId: Long) {
        val invitation = invitationRepository.findByIdEvenIfDisabled(invitationId)
            ?: throw IllegalArgumentException("La invitación con id $invitationId no existe")
        
        // 1. Eliminar notificaciones de invitados (Esto corrige el error de FK constraint)
        val notifications = invitationGuestNotificationRepository.findByInvitationId(invitationId)
        if (notifications.isNotEmpty()) {
            invitationGuestNotificationRepository.deleteAllInBatch(notifications)
        }

        // 2. (Opcional pero recomendado) Eliminar la configuración de Mongo para no dejar basura
        invitationConfigRepository.findByInvitationId(invitationId).ifPresent {
            invitationConfigRepository.delete(it)
        }

        // 3. Eliminar la invitación (el resto de tablas SQL se borran por CASCADE definido en V9)
        invitationRepository.hardDeleteById(invitationId)
    }

    fun updateInvitation(
        invitationId: Long,
        request: CreateInvitationRequest,
        loggedInUserId: Long,
        appRole: AppRole
    ): InvitationEntity {
        val invitation = invitationRepository.findByIdEvenIfDisabled(invitationId)
            ?: throw IllegalArgumentException("La invitación con id $invitationId no existe o ha sido eliminada")

        if (!hierarchyValidationService.validateInvitationAccess(loggedInUserId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para modificar esta invitación")
        }

        val template = invitationTemplateRepository.findById(request.templateId)
            .orElseThrow { IllegalArgumentException("El template con id ${request.templateId} no existe") }

        invitationValidationService.validateEnabledComponents(template)

        val eventType = template.eventType
        val plan = template.invitationPlan

        invitationValidationService.validatePeopleRules(eventType, request.eventDetails.people)
        invitationValidationService.validatePhraseRules(eventType, plan, request.phrases)
        invitationValidationService.validateExtraModulesRules(eventType, request.extraModules)

        val includedModules = ExtraModuleHelper.resolveExtraModules(request.extraModules, template).toMutableList()
        val totalAmount = priceCalculatorService.calculateTotalPrice(template, includedModules)

        invitation.template = template
        invitation.date = request.eventDetails.date
        invitation.time = request.eventDetails.time
        invitation.childrenAllowed = request.eventDetails.childrenAllowed
        invitation.youngAllowed = request.eventDetails.youngAllow
        invitation.hashtag = request.eventDetails.hashtag
        invitation.coverPhotoUrl = request.eventDetails.coverPhotoUrl
        invitation.updatedBy = loggedInUserId
        invitation.hasMusic = request.music.enabled
        invitation.hasGallery = !request.gallery.isNullOrEmpty()
        invitation.hasExtraModules = includedModules.isNotEmpty()
        invitation.extraModulesIncluded = includedModules
        invitation.totalAmount = totalAmount
        invitation.allEventsSameLocation = request.allEventsSameLocation

        val savedInvitation = invitationRepository.save(invitation)

        invitationPersistenceHelper.syncInvitationSubComponents(savedInvitation, request)

        return savedInvitation
    }

    fun getInvitationById(requesterId: Long, invitationId: Long): CreateInvitationResponse {
        val requester = customerRepository.findById(requesterId)
            .orElseThrow { IllegalArgumentException("El usuario solicitante con id $requesterId no existe") }

        if (!requester.isEnabled) {
            throw IllegalArgumentException("El usuario solicitante con id $requesterId está deshabilitado")
        }

        val invitation = invitationRepository.findByIdEvenIfDisabled(invitationId)
            ?: throw IllegalArgumentException("La invitación con id $invitationId no existe")

        if (!hierarchyValidationService.validateInvitationAccess(requesterId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para ver esta invitación")
        }

        return invitation.toCreateInvitationResponse()
    }

    fun toggleInvitationStatus(invitationId: Long, loggedInUserId: Long): InvitationEntity {
        val invitation = invitationRepository.findByIdEvenIfDisabled(invitationId)
        
        if (invitation == null) {
            invitationRepository.findById(invitationId)
            throw IllegalArgumentException("La invitación con id $invitationId no existe")
        }

        if (!hierarchyValidationService.validateInvitationAccess(loggedInUserId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para modificar esta invitación")
        }

        invitation.isEnabled = !invitation.isEnabled
        
        if (!invitation.isEnabled) {
            invitation.deletedBy = loggedInUserId
        } else {
            invitation.deletedBy = null
            invitation.updatedBy = loggedInUserId
        }

        return invitationRepository.save(invitation)
    }
}