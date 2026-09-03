package mx.evolutiondev.invitaciones.modules.master.dresscodes.presentation.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Positive
import mx.evolutiondev.invitaciones.core.util.patterns.Patterns

data class DressCodeRequest(
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numerico")
        val eventId: Long,
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numerico")
        val planId: Long,
        @field:NotBlank(message = "Debes proporcionar un nombre")
        @field:Pattern(regexp = Patterns.ALPHABETIC_SPECIAL_CHARACTERS, message = "El nombre solo puede contener caracteres especiales como Ñ y acentos")
        val name: String,
        @field:NotBlank(message = "Debes proporcionar una imagen para la vestimenta de la mujer")
        val womanImage: String,
        @field:NotBlank(message = "Debes proporcionar una descripción para la vestimenta de la mujer")
        val womanDescription: String,
        @field:NotBlank(message = "Debes proporcionar una imagen para la vestimenta del hombre")
        val manImage: String,
        @field:NotBlank(message = "Debes proporcionar una descripción para la vestimenta del hombre")
        val manDescription: String
)
