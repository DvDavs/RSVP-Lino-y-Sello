package mx.evolutiondev.invitaciones.modules.user.invitations.service.model


data class InvitationTemplateResponseItem(
        val id: Long,
        val url: String
)

data class InvitationPersonResponseItem(
        val gender: String,
        val name: String,
        val photoUrl: String
)

data class InvitationEventDetailsResponseItem(
        val people: List<InvitationPersonResponseItem>,
        val date: String,
        val time: String,
        val childrenAllowed: Boolean,
        val youngAllowed: Boolean,
        val hashtag: String,
        val coverPhotoUrl: String,
        val status: String,
        val price: Double,
        val extraModulesIncluded: List<String>
)

data class InvitationPhraseResponseItem(
        val gender: String,
        val text: String
)

data class InvitationItineraryEventResponseItem(
        val eventName: String,
        val eventLocation: String,
        val eventMapsUrl: String,
        val startTime: String,
        val endTime: String
)

data class InvitationGiftRegistryResponseItem(
        val type: String,
        val name: String? = null,
        val customName: String? = null, 
        val giftRegistryUrl: String? = null,
        val urlText: String? = null,
        val message: String? = null,
        val photo: String? = null,
        val accountHolder: String? = null,
        val accountNumber: String? = null,
        val bank: String? = null,
        val title: String? = null
)

data class InvitationMusicResponseItem(
        val type: String? = null,
        val enabled: Boolean,
        val url: String? = null
)


data class InvitationData(
        val template: InvitationTemplateResponseItem,
        val eventDetails: InvitationEventDetailsResponseItem,
        val phrases: List<InvitationPhraseResponseItem>,
        val itinerary: List<InvitationItineraryEventResponseItem>,
        val gallery: List<String>,
        val giftRegistry: List<InvitationGiftRegistryResponseItem>,
        val music: InvitationMusicResponseItem,
        val extraModules: InvitationExtraModulesResponseItem?
)

data class InvitationDetailResponse(
        val id: Long,
        val status: String,
        val eventId: Long,
        val event: String,
        val planId: Long,
        val plan: String,
        val price: Double,
        val currency: String,
        val data: InvitationData? = null
)