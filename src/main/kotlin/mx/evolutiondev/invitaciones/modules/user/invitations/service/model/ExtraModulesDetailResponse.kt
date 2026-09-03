package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

data class InvitationDressCodeResponseItem(
        val type: String = "",
        val womanId: Long? = null,
        val manId: Long? = null,
        val name: String? = null,
        val womanDescription: String? = null,
        val womanPhotoUrl: String? = null,
        val manDescription: String? = null,
        val manPhotoUrl: String? = null,
        val url: String? = null,
        val description: String? = null
)

data class InvitationRecommendationResponseItem(
        val name: String = "",
        val address: String = "",
        val phone: String? = null,
        val url: String? = null,
        val description: String? = null,
        val photoUrl: String? = null,
)

data class InvitationStoryResponseItem(
        val title: String = "",
        val date: String = "",
        val description: String? = null,
        val photoUrl: String? = null
)

data class InvitationAmenityOrActivityResponseItem(
        val name: String = "",
        val address: String = "",
        val phone: String? = null,
        val url: String? = null,
        val description: String? = null,
        val photoUrl: String? = null
)

data class InvitationParentsResponseItem(
        val mother: InvitationParentResponseItem?,
        val father: InvitationParentResponseItem?
)

data class InvitationParentResponseItem(
        val name: String,
        val photoUrl: String
)

data class InvitationGodparentResponseItem(
        val type: String,
        val isCouple: Boolean,
        val gender: String,
        val names: String,
        val photoUrl: String?,
        val isPrimary: Boolean
)

data class InvitationParentsAndGodparentsIntroResponseItem(
        val id: String,
        val content: String
)

data class InvitationParentsAndGodparentsResponseItem(
        val intro: List<InvitationParentsAndGodparentsIntroResponseItem> = emptyList(),
        val parents: InvitationParentsResponseItem?,
        val brideParents: InvitationParentsResponseItem?,
        val groomParents: InvitationParentsResponseItem?,
        val godparents: List<InvitationGodparentResponseItem>
)

data class InvitationExtraModulesResponseItem(
        val dressCode: InvitationDressCodeResponseItem?,
        val recommendations: List<InvitationRecommendationResponseItem>?,
        val ourStory: List<InvitationStoryResponseItem>?,
        val amenitiesAndActivities: List<InvitationAmenityOrActivityResponseItem>?,
        val parentsAndGodparents: InvitationParentsAndGodparentsResponseItem?
)