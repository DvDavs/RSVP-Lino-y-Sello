package mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.ktx

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.service.model.*
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl

fun InvitationEntity.toCreateInvitationResponse(): CreateInvitationResponse {
    return CreateInvitationResponse(
        id = id,
        template = template.toTemplateInfo(),
        customer = customer.toCustomerInfo(),
        date = date,
        time = time,
        childrenAllowed = childrenAllowed,
        youngAllowed = youngAllowed,
        hashtag = hashtag,
        coverPhotoUrl = coverPhotoUrl,
        isEnabled = isEnabled,
        isPaid = isPaid,
        totalAmount = totalAmount,
        createdBy = createdBy,
        hasMusic = hasMusic,
        hasGallery = hasGallery,
        hasExtraModules = hasExtraModules,
        extraModulesIncluded = extraModulesIncluded.map { it.name },
        allEventsSameLocation = allEventsSameLocation,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun InvitationTemplateEntity.toTemplateInfo(): TemplateInfo {
    return TemplateInfo(
        id = id,
        name = name,
        url = url,
        price = price,
        image = image,
        isEnabled = isEnabled,
        invitationPlan = invitationPlan.toPlanInfo(),
        eventType = eventType.toEventTypeInfo(),
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun InvitationPlanEntity.toPlanInfo(): PlanInfo {
    return PlanInfo(
        id = id,
        name = name,
        isEnabled = isEnabled,
        isPremium = isPremium,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun EventTypeEntity.toEventTypeInfo(): EventTypeInfo {
    return EventTypeInfo(
        id = id,
        name = name,
        isWedding = isWedding,
        isEnabled = isEnabled,
        createdAt = createdAt,
        updatedAt = updatedAt
    )
}

fun CustomerEntity.toCustomerInfo(): CustomerInfo {
    return CustomerInfo(
        id = id,
        name = name,
        lastName = lastName,
        email = email,
        role = role.name,
        isEnabled = isEnabled,
        isBanned = isBanned,
        createdBy = createdBy,
        phone = phone,
        birthdate = birthdate,
        address = address,
        city = city,
        postalCode = postalCode,
        state = state,
        howKnow = howKnow
    )
}

fun Page<InvitationEntity>.toCreateInvitationPageResponse(): Page<CreateInvitationResponse> {
    val responses = this.content.map { invitation ->
        invitation.toCreateInvitationResponse()
    }

    return PageImpl(responses, this.pageable, this.totalElements)
}