package mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.model.DressCodeEntity
import mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation.model.DressCodeRequest
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation.model.UpdateDressCodeRequest
import mx.evolutiondev.invitaciones.modules.master.dresscodes.service.MasterDressCodesService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/dress-codes")
@Validated
class MasterDressCodesController(
        private val masterDressCodesService: MasterDressCodesService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createDressCode(
            @Valid @RequestBody request: DressCodeRequest,
            authentication: Authentication
    ): DressCodeEntity {
        val userId = authentication.userId()
        return masterDressCodesService.createDressCode(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listDressCodes(
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) planId: Long?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<DressCodeEntity> {
        return masterDressCodesService.listDressCodes(page, eventId, planId, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getDressCodeById(
            @PathVariable id: Long
    ): DressCodeEntity {
        return masterDressCodesService.getDressCodeById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updateDressCode(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdateDressCodeRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterDressCodesService.updateDressCode(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivateDressCode(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterDressCodesService.deactivateDressCode(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activateDressCode(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterDressCodesService.activateDressCode(id, userId)
    }
}

