package mx.evolutiondev.invitaciones.modules.all.invitations.presentation

import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftResponseDto
import mx.evolutiondev.invitaciones.modules.master.songs.presentation.model.SongResponseItem
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.ktx.toDressCodeMap
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.Plan
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.ServiceType
import mx.evolutiondev.invitaciones.modules.all.invitations.presentation.model.dresscode.DressCodeResponseDto
import mx.evolutiondev.invitaciones.modules.master.dresscodes.service.MasterDressCodesService
import mx.evolutiondev.invitaciones.modules.master.eventtypes.service.MasterEventTypesService
import mx.evolutiondev.invitaciones.modules.master.giftmessages.service.MasterGiftMessagesService
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.PublicCustomPhraseResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.service.MasterPhrasesService
import mx.evolutiondev.invitaciones.modules.master.plans.service.MasterPlansService
import mx.evolutiondev.invitaciones.modules.master.songs.service.MasterSongsService
import mx.evolutiondev.invitaciones.modules.master.extramodules.service.MasterExtraModulesService
import mx.evolutiondev.invitaciones.modules.master.extramodules.presentation.model.PublicExtraModuleResponse
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/public/invitations")
class PublicInvitationInfoController(
        private val dressCodeService: MasterDressCodesService,
        private val eventTypeService: MasterEventTypesService,
        private val invitationPlanService: MasterPlansService,
        private val giftService: MasterGiftMessagesService,
        private val songService: MasterSongsService,
        private val customPhraseService: MasterPhrasesService,
        private val extraModulesService: MasterExtraModulesService
) {

    @GetMapping("/dress-code/predefined")
    @ResponseStatus(HttpStatus.OK)
    fun getAllDressCode(
            @RequestParam eventId: Long,
            @RequestParam planId: Long
    ): Map<String, DressCodeResponseDto> {
        return dressCodeService.getAllDressCode(eventId, planId).toDressCodeMap()
    }

    @GetMapping("/event-type")
    @ResponseStatus(HttpStatus.OK)
    fun getAllEventTypes(): List<ServiceType> {
        return eventTypeService.getAllEvents().map {
            ServiceType(
                    id = it.id,
                    name = it.name
            )
        }
    }

    @GetMapping("/plan")
    @ResponseStatus(HttpStatus.OK)
    fun getAllPlans(): List<Plan> {
        return invitationPlanService.listAllEnabledPlans().map {
            Plan(
                    id = it.id,
                    name = it.name
            )
        }
    }

    @GetMapping("/gift-registry/predefined-data")
    @ResponseStatus(HttpStatus.OK)
    fun getGiftInfo(
            @RequestParam planId: Long,
            @RequestParam eventId: Long
    ): GiftResponseDto {
        return giftService.getGifts(planId, eventId)
    }

    @GetMapping("/music/recommendations")
    @ResponseStatus(HttpStatus.OK)
    fun getSongs(
            @RequestParam planId: Long,
            @RequestParam eventId: Long
    ): List<SongResponseItem> {
        return songService.listSongs(planId, eventId).map {
            SongResponseItem(
                    id = it.id,
                    name = it.name,
                    url = it.url
            )
        }
    }

    @GetMapping("/phrases/configuration")
    fun getPhrases(
            @RequestParam planId: Long,
            @RequestParam eventId: Long,
            @RequestParam(required = false) genreId: Long?,
            @RequestParam(required = false) orientationId: Long?
    ): List<PublicCustomPhraseResponse> {
        return customPhraseService.getPhrases(
                planId = planId,
                eventId = eventId,
                genreId = genreId,
                orientationId = orientationId
        )
    }

    @GetMapping("/extra-modules")
    @ResponseStatus(HttpStatus.OK)
    fun getExtraModules(): List<PublicExtraModuleResponse> {
        return extraModulesService.getAllModuleConfigs()
            .filter { it.isEnabled }
            .map { 
                PublicExtraModuleResponse(
                    id = it.id,
                    module = it.module,
                    price = it.price,
                    isEnabled = it.isEnabled
                )
            }
    }
}
