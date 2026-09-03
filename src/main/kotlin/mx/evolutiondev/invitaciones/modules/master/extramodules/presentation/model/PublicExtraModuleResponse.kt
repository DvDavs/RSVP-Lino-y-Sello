package mx.evolutiondev.invitaciones.modules.master.extramodules.presentation.model

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.ExtraModuleType
import java.math.BigDecimal

data class PublicExtraModuleResponse(
    val id: Long,
    val module: ExtraModuleType,
    val price: BigDecimal,
    val isEnabled: Boolean
)