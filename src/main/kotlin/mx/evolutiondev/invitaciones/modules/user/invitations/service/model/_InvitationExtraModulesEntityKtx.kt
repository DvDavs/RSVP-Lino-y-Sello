package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationActivityEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationDressCodeEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationRecommendationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationStoryEntity

fun InvitationDressCodeEntity.toInvitationDressCodeResponseItem(): InvitationDressCodeResponseItem =
        InvitationDressCodeResponseItem(
                type,
                womanId,
                manId,
                name,
                womanDescription,
                womanPhotoUrl,
                manDescription,
                manPhotoUrl,
                url
        )

fun InvitationRecommendationEntity.toInvitationRecommendationResponseItem(): InvitationRecommendationResponseItem =
        InvitationRecommendationResponseItem(
                name,
                address,
                phone,
                url,
                description,
                photoUrl
        )

fun InvitationStoryEntity.toInvitationStoryResponseItem(): InvitationStoryResponseItem =
        InvitationStoryResponseItem(
                title,
                date,
                description,
                photoUrl
        )

fun InvitationActivityEntity
        .toInvitationAmenityOrActivityResponseItem(): InvitationAmenityOrActivityResponseItem =
        InvitationAmenityOrActivityResponseItem(
                name,
                address,
                phone,
                url,
                description,
                photoUrl
        )
