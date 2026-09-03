package mx.evolutiondev.invitaciones.modules.user.invitations.service.model

import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationGalleryRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationMusicRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity

fun InvitationGalleryRepository.findGalleryOrEmpty(invitation: InvitationEntity): List<String> {
    if (invitation.hasGallery) {
        return findAllByInvitationId(invitation.id).map { it.photoUrl }
    }
    return emptyList()
}

fun InvitationMusicRepository.findMusicOrDefault(invitation: InvitationEntity): InvitationMusicResponseItem {
    if (invitation.hasMusic) {
        return findAllByInvitationId(invitation.id).first().toInvitationMusicResponseItem()
    }
    return InvitationMusicResponseItem(enabled = false)
}
