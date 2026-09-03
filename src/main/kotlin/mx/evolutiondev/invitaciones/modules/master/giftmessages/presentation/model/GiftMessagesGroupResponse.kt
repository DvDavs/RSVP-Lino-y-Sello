package mx.evolutiondev.invitaciones.modules.master.giftmessages.presentation.model

import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftImageCategory
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftImageEntity
import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftMessageEntity

data class GiftMessagesGroupResponse(
        val planId: Long,
        val eventTypeId: Long,
        val messages: List<GiftMessageItemResponse>,
        val images: List<GiftImageItemResponse>
)

data class GiftMessageItemResponse(
        val id: Long,
        val message: String,
        val isEnabled: Boolean,
        val createdBy: Long?,
        val updatedBy: Long?,
        val deletedBy: Long?
)

data class GiftImageItemResponse(
        val id: Long,
        val category: GiftImageCategory,
        val name: String,
        val imageUrl: String,
        val isEnabled: Boolean,
        val createdBy: Long?,
        val updatedBy: Long?,
        val deletedBy: Long?
)

fun List<GiftMessageEntity>.toMessageResponses(): List<GiftMessageItemResponse> {
    return this.map { entity ->
        GiftMessageItemResponse(
                id = entity.id,
                message = entity.message,
                isEnabled = entity.isEnabled,
                createdBy = entity.createdBy,
                updatedBy = entity.updatedBy,
                deletedBy = entity.deletedBy
        )
    }
}

fun List<GiftImageEntity>.toImageResponses(): List<GiftImageItemResponse> {
    return this.map { entity ->
        GiftImageItemResponse(
                id = entity.id,
                category = entity.category,
                name = entity.name,
                imageUrl = entity.imageUrl,
                isEnabled = entity.isEnabled,
                createdBy = entity.createdBy,
                updatedBy = entity.updatedBy,
                deletedBy = entity.deletedBy
        )
    }
}

