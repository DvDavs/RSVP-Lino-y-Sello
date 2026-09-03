package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Positive
import mx.evolutiondev.invitaciones.core.util.validation.validatedateformat.ValidDateFormat
import mx.evolutiondev.invitaciones.core.util.validation.validtimeformat.ValidTimeFormat

data class CreateInvitationRequest(
        @field:NotNull(message = "El campo templateId es obligatorio")
        @field:Positive(message = "El campo templateId debe ser un número positivo")
        val templateId: Long,
        @field:NotNull(message = "El campo eventDetails es obligatorio")
        val eventDetails: EventDetailsRequest,
        @field:NotNull(message = "El campo phrases es obligatorio")
        @field:NotEmpty(message = "Debes proporcionar al menos una frase")
        val phrases: List<PhraseRequest>,
        @field:NotNull(message = "El campo itinerary es obligatorio")
        val itinerary: List<ItineraryRequest>,
        val gallery: List<String>?,
        @field:NotNull(message = "El campo giftRegistry es obligatorio")
        val giftRegistry: List<GiftRegistryRequest>,
        @field:NotNull(message = "El campo music es obligatorio")
        val music: MusicRequest,
        val extraModules: ExtraModulesRequest?,
        val allEventsSameLocation: Boolean = false
)

data class EventDetailsRequest(
        @field:NotNull(message = "El campo people es obligatorio")
        val people: List<PersonRequest>,
        @field:ValidDateFormat(format = "yyyy-MM-dd", message = "Fecha inválida, debe estar en formato yyyy-MM-dd y ser válida")
        val date: String,
        @field:ValidTimeFormat(message = "La hora debe estar en formato HH:mm AM/PM o am/pm y ser válida")
        val time: String,
        @field:NotNull(message = "El campo childrenAllowed es obligatorio")
        val childrenAllowed: Boolean,
        @field:NotNull(message = "El campo youngAllow es obligatorio")
        val youngAllow: Boolean,
        @field:NotBlank(message = "El campo hashtag es obligatorio")
        val hashtag: String,
        @field:NotBlank(message = "El campo coverPhotoUrl es obligatorio")
        val coverPhotoUrl: String
)

data class PersonRequest(
        @field:NotBlank(message = "El campo gender es obligatorio")
        val gender: String,
        @field:NotBlank(message = "El campo name es obligatorio")
        val name: String,
        @field:NotBlank(message = "El campo photoUrl es obligatorio")
        val photoUrl: String
)

data class PhraseRequest(
        @field:NotBlank(message = "El campo gender es obligatorio")
        val gender: String,
        @field:NotBlank(message = "El campo text es obligatorio")
        val text: String
)

data class ItineraryRequest(
        @field:NotBlank(message = "El campo eventName es obligatorio")
        val eventName: String,
        @field:NotBlank(message = "El campo eventLocation es obligatorio")
        val eventLocation: String,
        val eventMapsUrl: String?,
        val startTime: String?,
        val endTime: String?
)

data class GiftRegistryRequest(
        @field:NotBlank(message = "El campo type es obligatorio")
        val type: String,
        val name: String? = null,
        val accountHolder: String? = null,
        val accountNumber: String? = null,
        val bank: String? = null,
        val message: String?,
        val photo: String? = null,
        val giftRegistryUrl: String? = null,
        val urlText: String? = null,
        val title: String? = null
)

data class MusicRequest(
        val type: String? = null,
        @field:NotNull(message = "El campo enabled es obligatorio")
        val enabled: Boolean,
        val url: String? = null
)

data class ExtraModulesRequest(
        val dressCode: DressCodeModule?,
        val recommendations: List<RecommendationRequest>?,
        val ourStory: List<StoryRequest>?,
        val amenitiesAndActivities: List<ActivityRequest>?,
        val parentsAndGodparents: ParentsAndGodparentsRequest?
)

data class DressCodeModule(
        @field:NotBlank(message = "El campo type es obligatorio")
        val type: String,
        @field:NotNull(message = "El campo data es obligatorio")
        val data: DressCodeData
)

data class DressCodeData(
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

data class RecommendationRequest(
        @field:NotBlank(message = "El campo name es obligatorio")
        val name: String,
        @field:NotBlank(message = "El campo address es obligatorio")
        val address: String,
        val phone: String?,
        val url: String?,
        val description: String?,
        val photoUrl: String?
)

data class StoryRequest(
        @field:NotBlank(message = "El campo title es obligatorio")
        val title: String,
        @field:NotBlank(message = "El campo date es obligatorio")
        val date: String,
        val description: String?,
        val photoUrl: String?
)

data class ActivityRequest(
        @field:NotBlank(message = "El campo name es obligatorio")
        val name: String,
        @field:NotBlank(message = "El campo address es obligatorio")
        val address: String,
        val phone: String?,
        val url: String?,
        val description: String?,
        val photoUrl: String?
)

data class ParentsAndGodparentsRequest(
        val intro: List<ParentsAndGodparentsIntroItem> = emptyList(),
        val parents: ParentsRequest?,
        val brideParents: ParentsRequest?,
        val groomParents: ParentsRequest?,
        @field:NotNull(message = "El campo godparents es obligatorio")
        val godparents: List<GodparentRequest>
)

data class ParentsAndGodparentsIntroItem(
        @field:NotBlank(message = "El campo id es obligatorio")
        val id: String,
        @field:NotBlank(message = "El campo content es obligatorio")
        val content: String
)

data class ParentsRequest(
        val mother: ParentInfo?,
        val father: ParentInfo?
)

data class ParentInfo(
        @field:NotBlank(message = "El campo name es obligatorio")
        val name: String,
        val photoUrl: String?
)

data class GodparentRequest(
        @field:NotBlank(message = "El campo type es obligatorio")
        val type: String,
        @field:NotNull(message = "El campo isCouple es obligatorio")
        val isCouple: Boolean,
        @field:NotBlank(message = "El campo gender es obligatorio")
        val gender: String,
        @field:NotBlank(message = "El campo names es obligatorio")
        val names: String,
        val photoUrl: String?,
        val isPrimary: Boolean = false
)
