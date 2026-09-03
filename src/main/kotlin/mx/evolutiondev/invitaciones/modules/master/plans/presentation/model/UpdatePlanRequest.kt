package mx.evolutiondev.invitaciones.modules.master.plans.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class UpdatePlanRequest(
        @field:NotBlank(message = "Debes proporcionar un nombre")
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:NotNull(message = "Debes indicar si el plan es premium o no")
        val isPremium: Boolean
)

