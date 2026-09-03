package mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model

import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import mx.evolutiondev.invitaciones.core.util.validation.valueofenum.ValueOfEnum
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseGenre
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOrientation

data class CustomPhrasesSaveRequest(
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,

        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long,

        @field:ValueOfEnum(enumClass = PhraseGenre::class, message = "Debes proporcionar un género válido")
        val genre: String,

        @field:ValueOfEnum(enumClass = PhraseOrientation::class, message = "Debes proporcionar una orientación válida")
        val orientation: String,

        @field:NotEmpty(message = "Debes proporcionar al menos una frase")
        val phrases: List<String>
)


