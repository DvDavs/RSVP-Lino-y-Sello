package mx.evolutiondev.invitaciones.modules.admin.users.ktx

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.s3.S3Buckets
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService

fun List<CustomerEntity>.toCustomerList(
    avatarService: AvatarService? = null,
    s3Service: S3Service? = null
): List<Customer> {
    return this.map { it.toCustomer(avatarService, s3Service) }
}

fun CustomerEntity.toCustomer(
    avatarService: AvatarService? = null,
    s3Service: S3Service? = null
): Customer {
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

    return Customer(
            id = this.id,
            name = this.name,
            lastName = this.lastName,
            email = this.email,
            role = this.role,
            isBanned = this.isBanned,
            isEnabled = this.isEnabled,
            phone = this.phone,
            address = this.address,
            city = this.city,
            postalCode = this.postalCode,
            state = this.state,
            birthdate = this.birthdate,
            howKnow = this.howKnow,
            photo = photoUrl
    )
}