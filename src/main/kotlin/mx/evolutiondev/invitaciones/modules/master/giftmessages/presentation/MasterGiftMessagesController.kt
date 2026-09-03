package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftMessageRequest
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftResponseDto
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.GiftMessagesGroupResponse
import mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model.UpdateGiftMessagesRequest
import mx.evolutiondev.invitaciones.modules.master.giftmessages.service.MasterGiftMessagesService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/gift-messages")
@Validated
class MasterGiftMessagesController(
        private val masterGiftMessagesService: MasterGiftMessagesService
) {

    @PostMapping("/group")
    @ResponseStatus(HttpStatus.OK)
    fun createGiftMessagesGroup(
            @Valid @RequestBody request: GiftMessageRequest,
            authentication: Authentication
    ): GiftResponseDto {
        val userId = authentication.userId()
        return masterGiftMessagesService.createGiftMessagesGroup(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listGiftMessages(
            @RequestParam(required = false) planId: Long?,
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<GiftMessagesGroupResponse> {
        return masterGiftMessagesService.listGiftMessages(page, planId, eventId, isEnable)
    }

    @GetMapping("/group")
    @ResponseStatus(HttpStatus.OK)
    fun getGiftMessagesByGroup(
            @RequestParam planId: Long,
            @RequestParam eventId: Long
    ): GiftMessagesGroupResponse {
        return masterGiftMessagesService.getGiftMessagesByGroup(planId, eventId)
    }

    @PutMapping("/group")
    @ResponseStatus(HttpStatus.OK)
    fun updateGiftMessagesGroup(
            @Valid @RequestBody request: UpdateGiftMessagesRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterGiftMessagesService.updateGiftMessagesGroup(request, userId)
    }

    @DeleteMapping("/group")
    @ResponseStatus(HttpStatus.OK)
    fun deactivateGiftMessagesGroup(
            @RequestParam planId: Long,
            @RequestParam eventId: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterGiftMessagesService.deactivateGiftMessagesGroup(planId, eventId, userId)
    }

    @PatchMapping("/group/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activateGiftMessagesGroup(
            @RequestParam planId: Long,
            @RequestParam eventId: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterGiftMessagesService.activateGiftMessagesGroup(planId, eventId, userId)
    }
}

