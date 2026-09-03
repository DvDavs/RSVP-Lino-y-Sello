package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.*
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity

fun InvitationTemplateEntity.toInvitationTemplateResponseItem(): InvitationTemplateResponseItem {
    return InvitationTemplateResponseItem(
            id = id,
            url = url
    )
}

fun InvitationPersonEntity.toInvitationPersonResponseItem(): InvitationPersonResponseItem {
    return InvitationPersonResponseItem(
            gender = gender,
            name = name,
            photoUrl = photoUrl
    )
}

fun InvitationEntity.toInvitationEventDetailsResponseItem(
        people: List<InvitationPersonResponseItem>
): InvitationEventDetailsResponseItem {
    return InvitationEventDetailsResponseItem(
            people = people,
            date = date,
            time = time,
            childrenAllowed = childrenAllowed,
            youngAllowed = youngAllowed,
            hashtag = hashtag,
            coverPhotoUrl = coverPhotoUrl,
            status = if (isPaid) {
                "paid"
            } else {
                "pending_payment"
            },
            price = totalAmount,
            extraModulesIncluded = extraModulesIncluded.map {
                it.moduleName
            }
    )
}

fun InvitationPhraseEntity.toInvitationPhraseResponseItem(): InvitationPhraseResponseItem =
        InvitationPhraseResponseItem(
                gender = gender,
                text = text
        )

fun InvitationItineraryEntity.toInvitationItineraryEventResponseItem(): InvitationItineraryEventResponseItem =
        InvitationItineraryEventResponseItem(
                eventName = eventName,
                eventLocation = eventLocation,
                eventMapsUrl = eventMapsUrl,
                startTime = startTime,
                endTime = endTime
        )

fun List<InvitationGiftRegistryEntity>.toInvitationGiftRegistryResponseItems(): List<InvitationGiftRegistryResponseItem> {
    return map { entity ->
        when (entity.type) {
            "digital" -> InvitationGiftRegistryResponseItem(
                    type = entity.type,
                    customName = if (entity.name == "otro") entity.customName else null,
                    name = entity.name,
                    giftRegistryUrl = entity.giftRegistryUrl,
                    photo = entity.photo,
                    urlText = entity.urlText,
                    message = entity.message
            )

            "bankAccount", "cuenta" -> InvitationGiftRegistryResponseItem(
                    type = entity.type,
                    name = entity.name,
                    accountHolder = entity.accountHolder,
                    accountNumber = entity.accountNumber,
                    bank = entity.bank,
                    message = entity.message,
                    photo = entity.photo
            )

            "physical", "fisico" -> InvitationGiftRegistryResponseItem(
                    type = entity.type,
                    message = entity.message,
                    photo = entity.photo,
                    title = entity.title
            )

            else -> InvitationGiftRegistryResponseItem(type = entity.type) // fallback genérico
        }
    }
}

fun InvitationMusicEntity.toInvitationMusicResponseItem(): InvitationMusicResponseItem =
        InvitationMusicResponseItem(
                type = type,
                enabled = true,
                url = url
        )
