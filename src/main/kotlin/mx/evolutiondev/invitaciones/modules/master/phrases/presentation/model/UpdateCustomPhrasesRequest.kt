package mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model

import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseGenre
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOrientation

data class UpdateCustomPhrasesRequest(
        @field:NotNull(message = "El género es obligatorio")
        val genre: PhraseGenre,
        
        @field:NotNull(message = "La orientación es obligatoria")
        val genreOrientation: PhraseOrientation,
        
        @field:NotNull(message = "El planId es obligatorio")
        @field:Positive(message = "El planId debe ser numérico")
        val planId: Long,
        
        @field:NotNull(message = "El eventId es obligatorio")
        @field:Positive(message = "El eventId debe ser numérico")
        val eventId: Long,
        
        @field:NotEmpty(message = "Debes proporcionar al menos una frase")
        val phraseTexts: List<String>
)

