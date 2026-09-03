package mx.evolutiondev.invitaciones.modules.admin.invitations.service.model

import java.time.Instant

data class CreateInvitationResponse(
    val id: Long,
    val template: TemplateInfo,
    val customer: CustomerInfo,
    val date: String,
    val time: String,
    val childrenAllowed: Boolean,
    val youngAllowed: Boolean,
    val hashtag: String,
    val coverPhotoUrl: String,
    val isEnabled: Boolean,
    val isPaid: Boolean,
    val totalAmount: Double,
    val createdBy: Long?,
    val hasMusic: Boolean,
    val hasGallery: Boolean,
    val hasExtraModules: Boolean,
    val extraModulesIncluded: List<String>,
    val allEventsSameLocation: Boolean,
    val createdAt: Instant?,
    val updatedAt: Instant?
)

data class TemplateInfo(
    val id: Long,
    val name: String,
    val url: String,
    val price: Double,
    val image: String,
    val isEnabled: Boolean,
    val invitationPlan: PlanInfo,
    val eventType: EventTypeInfo,
    val createdAt: Instant?,
    val updatedAt: Instant?
)

data class PlanInfo(
    val id: Long,
    val name: String,
    val isEnabled: Boolean,
    val isPremium: Boolean,
    val createdAt: Instant?,
    val updatedAt: Instant?
)

data class EventTypeInfo(
    val id: Long,
    val name: String,
    val isWedding: Boolean,
    val isEnabled: Boolean,
    val createdAt: Instant?,
    val updatedAt: Instant?
)

data class CustomerInfo(
    val id: Long,
    val name: String,
    val lastName: String,
    val email: String,
    val role: String,
    val isEnabled: Boolean,
    val isBanned: Boolean,
    val createdBy: Long?,
    val phone: String?,
    val birthdate: String?,
    val address: String?,
    val city: String?,
    val postalCode: String?,
    val state: String?,
    val howKnow: String?
)
