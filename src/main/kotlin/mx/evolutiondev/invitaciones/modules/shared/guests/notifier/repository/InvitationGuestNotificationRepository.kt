package mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository

import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model.InvitationGuestNotification
import org.springframework.data.jpa.repository.JpaRepository

interface InvitationGuestNotificationRepository : JpaRepository<InvitationGuestNotification, Long> {
    fun findByInvitationId(invitationId: Long): List<InvitationGuestNotification>
}