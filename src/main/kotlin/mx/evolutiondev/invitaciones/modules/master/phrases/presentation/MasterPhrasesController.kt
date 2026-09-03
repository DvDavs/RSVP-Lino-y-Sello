package mx.evolutiondev.invitaciones.modules.master.phrases.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.CustomPhrasesSaveRequest
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.CustomPhraseResponse
import mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model.UpdateCustomPhrasesRequest
import mx.evolutiondev.invitaciones.modules.master.phrases.service.MasterPhrasesService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/phrases")
@Validated
class MasterPhrasesController(
        private val masterPhrasesService: MasterPhrasesService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createPhrase(
            @Valid @RequestBody request: CustomPhrasesSaveRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPhrasesService.createPhrase(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listPhrases(
            @RequestParam(required = false) planId: Long?,
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) genre: String?,
            @RequestParam(required = false) orientation: String?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<CustomPhraseResponse> {
        return masterPhrasesService.listPhrases(page, planId, eventId, genre, orientation, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getPhraseById(
            @PathVariable id: Long
    ): CustomPhraseResponse {
        return masterPhrasesService.getPhraseById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updatePhrase(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdateCustomPhrasesRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPhrasesService.updatePhrase(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivatePhrase(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPhrasesService.deactivatePhrase(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activatePhrase(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterPhrasesService.activatePhrase(id, userId)
    }
}

