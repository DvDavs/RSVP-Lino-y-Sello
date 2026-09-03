package mx.evolutiondev.invitaciones.modules.master.extramodules.presentation.model

import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.PositiveOrZero
import java.math.BigDecimal

data class UpdateAllModulesPriceRequest(
    @field:NotNull(message = "El precio no puede ser nulo")
    @field:PositiveOrZero(message = "El precio debe ser cero o un número positivo")
    val price: BigDecimal
)

