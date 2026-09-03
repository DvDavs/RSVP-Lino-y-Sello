package mx.evolutiondev.invitaciones.modules.user.invitations.service

import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
    import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationPersonEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationPhraseEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationItineraryEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationGalleryEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationGiftRegistryEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationMusicEntity
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.modules.master.templates.repository.InvitationTemplateRepository
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPersistenceHelper
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationValidationService
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx.addOrThrow
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx.toInvitationDetailResponse
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx.toInvitationResponseItem
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.*
import org.springframework.stereotype.Service 

@Service
class InvitationService(
        private val invitationRepository: InvitationRepository,
        private val customerRepository: CustomerRepository,
        private val invitationTemplateRepository: InvitationTemplateRepository,
        private val invitationPersonRepository: InvitationPersonRepository,
        private val invitationPhraseRepository: InvitationPhraseRepository,
        private val invitationItineraryRepository: InvitationItineraryRepository,
        private val invitationGalleryRepository: InvitationGalleryRepository,
        private val invitationGiftRegistryRepository: InvitationGiftRegistryRepository,
        private val invitationMusicRepository: InvitationMusicRepository,
        private val extraModulesHandler: ExtraModulesHandler,
        private val invitationNotificationService: InvitationNotificationService,
        private val invitationPersistenceHelper: InvitationPersistenceHelper,
        private val priceCalculatorService: mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPriceCalculatorService,
        private val hierarchyValidationService: HierarchyValidationService,
        private val invitationValidationService: InvitationValidationService
) {

    fun createInvitation(creatorId: Long, request: CreateInvitationRequest): InvitationResponse {
        val customer = customerRepository.findById(creatorId).orElseThrow {
            throw IllegalArgumentException("El usuario proporcionado no es válido")
        }

        val template = invitationTemplateRepository.findById(request.templateId).orElseThrow {
            throw IllegalArgumentException("La plantilla proporcionada no es válida")
        }
        
        invitationValidationService.validateEnabledComponents(template)

        val eventType = template.eventType
        val plan = template.invitationPlan

        invitationValidationService.validatePeopleRules(eventType, request.eventDetails.people)
        invitationValidationService.validatePhraseRules(eventType, plan, request.phrases)
        invitationValidationService.validateExtraModulesRules(eventType, request.extraModules)

        val includedModules = ExtraModuleHelper.resolveExtraModules(request.extraModules, template)
        val totalAmount = priceCalculatorService.calculateTotalPrice(template, includedModules)
        val priceBreakdown = priceCalculatorService.calculatePriceBreakdown(template, includedModules)

        val invitation = invitationRepository.save(
                InvitationEntity(
                        template = template,
                        customer = customer,
                        date = request.eventDetails.date,
                        time = request.eventDetails.time,
                        youngAllowed = request.eventDetails.youngAllow,
                        childrenAllowed = request.eventDetails.childrenAllowed,
                        hashtag = request.eventDetails.hashtag,
                        coverPhotoUrl = request.eventDetails.coverPhotoUrl,
                        isPaid = false,
                        totalAmount = totalAmount,
                        hasMusic = request.music.enabled,
                        hasGallery = !request.gallery.isNullOrEmpty(),
                        hasExtraModules = includedModules.isNotEmpty(),
                        extraModulesIncluded = includedModules.toMutableList(),
                        allEventsSameLocation = request.allEventsSameLocation,
                        createdBy = creatorId
                )
        )

        invitationPersistenceHelper.saveNewSubComponents(invitation, request)

        invitationNotificationService.prepareInvitationNotification(
                customer,
                eventType,
                plan,
                request.extraModules,
                priceBreakdown,
                isPaid = false
        )

        return InvitationResponse(
                status = "success",
                message = "Tu borrador de invitación ha sido guardado exitosamente. " +
                        "El siguiente paso es completar el pago para activarla.",
                invitation = invitation.toInvitationResponseItem()
        )
    }

    fun findAllInvitations(userId: Long): List<InvitationResponseItem> {
        return invitationRepository.findAll(InvitationSpecifications.forUser(userId)).map {
            it.toInvitationResponseItem()
        }
    }

    fun findInvitation(userId: Long, invitationId: Long): InvitationDetailResponse {
        val invitation = invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación solicitada no es válida") }

        if (!invitation.isEnabled) {
            throw IllegalArgumentException("La invitación solicitada no es válida")
        }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw UnauthorizedAccessException("No tienes permisos para acceder a esta invitación")
        }

        // if (!invitation.isPaid) {
        //     return invitation.toInvitationDetailResponse()
        // }

        val people = invitationPersonRepository.findAllByInvitationId(invitation.id).map {
            it.toInvitationPersonResponseItem()
        }

        val phrases = invitationPhraseRepository.findAllByInvitationId(invitation.id).map {
            it.toInvitationPhraseResponseItem()
        }

        val itinerary = invitationItineraryRepository.findAllByInvitationId(invitation.id).map {
            it.toInvitationItineraryEventResponseItem()
        }

        val gallery = invitationGalleryRepository.findGalleryOrEmpty(invitation)

        val giftRegistry = invitationGiftRegistryRepository.findAllByInvitationId(invitation.id)
                .toInvitationGiftRegistryResponseItems()

        val music = invitationMusicRepository.findMusicOrDefault(invitation)

        val invitationData = InvitationData(
                template = invitation.template.toInvitationTemplateResponseItem(),
                eventDetails = invitation.toInvitationEventDetailsResponseItem(people),
                phrases = phrases,
                itinerary = itinerary,
                gallery = gallery,
                giftRegistry = giftRegistry,
                music = music,
                extraModules = extraModulesHandler.getExtraModulesOrNull(invitation)
        )

        return invitation.toInvitationDetailResponse(
                data = invitationData
        )
    }
}