package mx.evolutiondev.invitaciones.modules.master.phrases.presentation.model

data class PublicCustomPhraseResponse(
        val plan: String,
        val event: String,
        val genre: String,
        val orientation: String,
        val phrases: List<String>
)


