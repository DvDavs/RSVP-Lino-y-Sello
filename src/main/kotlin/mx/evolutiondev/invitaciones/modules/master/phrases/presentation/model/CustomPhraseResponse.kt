package mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model

import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.CustomPhraseEntity
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseGenre
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOrientation
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOptionEntity

data class CustomPhraseResponse(
        val id: Long,
        val genre: PhraseGenre,
        val genreOrientation: PhraseOrientation,
        val planId: Long,
        val eventTypeId: Long,
        val isEnabled: Boolean,
        val phraseTexts: List<PhraseTextResponse>,
        val createdBy: Long?,
        val updatedBy: Long?,
        val deletedBy: Long?
)

data class PhraseTextResponse(
        val id: Long,
        val text: String,
        val isEnabled: Boolean
)

fun CustomPhraseEntity.toResponse(phraseOptions: List<PhraseOptionEntity>): CustomPhraseResponse {
    return CustomPhraseResponse(
            id = this.id,
            genre = this.genre,
            genreOrientation = this.genreOrientation,
            planId = this.invitationPlan.id,
            eventTypeId = this.eventType.id,
            isEnabled = this.isEnabled,
            phraseTexts = phraseOptions.map { option ->
                PhraseTextResponse(
                        id = option.id,
                        text = option.text,
                        isEnabled = option.isEnabled
                )
            },
            createdBy = this.createdBy,
            updatedBy = this.updatedBy,
            deletedBy = this.deletedBy
    )
}

