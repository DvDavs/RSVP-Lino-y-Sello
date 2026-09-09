package mx.evolutiondev.invitaciones.modules.user.profile.presentation.ktx

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import mx.evolutiondev.invitaciones.modules.user.profile.presentation.response.Profile

fun CustomerEntity.toProfile(
    avatarService: AvatarService? = null,
    s3Service: S3Service? = null
): Profile {
    val photoUrl = if (avatarId != null && avatarService != null && s3Service != null) {
        try {
            val avatar = avatarService.findAvatarById(avatarId!!)
            s3Service.generatePresignedUrl(S3Buckets.EDITOR, avatar.s3Key).toString()
        } catch (e: Exception) {
            null
        }
    } else {
        null
    }

    return Profile(
        name = name,
        lastName = lastName,
        email = email,
        phone = phone,
        birthdate = birthdate,
        address = address,
        city = city,
        postalCode = postalCode,
        state = state,
        photo = photoUrl,
        isSurveyAnswered = isSurveyAnswered,
        emailVerified = emailVerified
    )
}