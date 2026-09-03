package mx.evolutiondev.invitaciones.modules.master.extramodules.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.extramodules.presentation.model.UpdateAllModulesPriceRequest
import mx.evolutiondev.invitaciones.modules.master.extramodules.presentation.model.UpdateSingleModulePriceRequest
import mx.evolutiondev.invitaciones.modules.master.extramodules.repository.model.ExtraModuleConfigEntity
import mx.evolutiondev.invitaciones.modules.master.extramodules.service.MasterExtraModulesService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/extra-modules")
class MasterExtraModulesController(
    private val service: MasterExtraModulesService
) {

    @GetMapping
    fun getModuleConfigs(): ResponseEntity<List<ExtraModuleConfigEntity>> {
        return ResponseEntity.ok(service.getAllModuleConfigs())
    }

    @PutMapping("/prices")
    fun updateAllModulesPrices(
        @Valid @RequestBody request: UpdateAllModulesPriceRequest,
        authentication: Authentication
    ): ResponseEntity<List<ExtraModuleConfigEntity>> {
        val userId = authentication.userId()
        val updatedConfigs = service.updateAllModulesPrices(request.price, userId)
        return ResponseEntity.ok(updatedConfigs)
    }

    @PatchMapping("/{id}/price")
    fun updateSingleModulePrice(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateSingleModulePriceRequest,
        authentication: Authentication
    ): ResponseEntity<ExtraModuleConfigEntity> {
        val userId = authentication.userId()
        val updatedConfig = service.updateSingleModulePrice(
            id = id,
            price = request.price,
            userId = userId
        )
        return ResponseEntity.ok(updatedConfig)
    }
}

