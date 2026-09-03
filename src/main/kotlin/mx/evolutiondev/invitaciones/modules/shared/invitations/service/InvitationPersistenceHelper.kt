package mx.evolutiondev.invitaciones.modules.shared.invitations.service

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.*
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ExtraModulesHandler
import mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx.addOrThrow
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.CreateInvitationRequest
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.*
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class InvitationPersistenceHelper(
    private val invitationPersonRepository: InvitationPersonRepository,
    private val invitationPhraseRepository: InvitationPhraseRepository,
    private val invitationItineraryRepository: InvitationItineraryRepository,
    private val invitationGalleryRepository: InvitationGalleryRepository,
    private val invitationMusicRepository: InvitationMusicRepository,
    private val invitationGiftRegistryRepository: InvitationGiftRegistryRepository,
    private val invitationRecommendationRepository: InvitationRecommendationRepository,
    private val invitationStoryRepository: InvitationStoryRepository,
    private val invitationActivityRepository: InvitationActivityRepository,
    private val invitationParentRepository: InvitationParentRepository,
    private val invitationGodparentRepository: InvitationGodparentRepository,
    private val invitationDressCodeRepository: InvitationDressCodeRepository,
    private val extraModulesHandler: ExtraModulesHandler,
    private val invitationGuestsService: InvitationGuestsService
) {

    @Transactional
    fun syncInvitationSubComponents(invitation: InvitationEntity, request: CreateInvitationRequest) {
        val invitationId = invitation.id
        
        invitationPersonRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationPhraseRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationItineraryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGalleryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationMusicRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGiftRegistryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationRecommendationRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationStoryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationActivityRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationParentRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGodparentRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationDressCodeRepository.deleteAllInBatchByInvitationId(invitationId)
        
        saveNewSubComponents(invitation, request)
    }

    @Transactional
    fun saveNewSubComponents(invitation: InvitationEntity, request: CreateInvitationRequest) {
        invitationPersonRepository.saveAll(
            request.eventDetails.people.map {
                InvitationPersonEntity(
                    invitation = invitation,
                    gender = it.gender,
                    name = it.name,
                    photoUrl = it.photoUrl
                )
            }
        )

        invitationPhraseRepository.saveAll(
            request.phrases.map {
                InvitationPhraseEntity(
                    invitation = invitation,
                    gender = it.gender,
                    text = it.text
                )
            } ?: emptyList() 
        )

        invitationItineraryRepository.saveAll(
            request.itinerary.map {
                InvitationItineraryEntity(
                    invitation = invitation,
                    eventName = it.eventName,
                    eventLocation = it.eventLocation,
                    eventMapsUrl = it.eventMapsUrl.orEmpty(),
                    startTime = it.startTime.orEmpty(),
                    endTime = it.endTime.orEmpty()
                )
            }
        )

        if (!request.gallery.isNullOrEmpty()) {
            invitationGalleryRepository.saveAll(
                request.gallery.map {
                    InvitationGalleryEntity(
                        invitation = invitation,
                        photoUrl = it
                    )
                }
            )
        }

        invitationGiftRegistryRepository.saveAll(
            request.giftRegistry.map {
                InvitationGiftRegistryEntity(
                    invitation = invitation,
                    type = it.type,
                    name = it.name,
                    accountHolder = it.accountHolder,
                    accountNumber = it.accountNumber,
                    bank = it.bank,
                    message = it.message.orEmpty(),
                    photo = it.photo,
                    giftRegistryUrl = it.giftRegistryUrl,
                    urlText = it.urlText,
                    title = it.title
                )
            }
        )

        if (request.music.addOrThrow()) {
            invitationMusicRepository.save(
                InvitationMusicEntity(
                    invitation = invitation,
                    type = request.music.type.orEmpty(),
                    url = request.music.url
                )
            )
        }

        request.extraModules?.let { extraModulesRequest ->
            extraModulesHandler.save(invitation, extraModulesRequest)
        }
    }

}
