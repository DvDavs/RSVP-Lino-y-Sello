package mx.evolutiondev.invitaciones.modules.shared.guests.notifier

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model.NotificationTemplate
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity

interface GuestAppNotifier {
    fun notifyAll(
            invitationId: Long,
            requesterId: Long,
            appRole: AppRole,
            guests: List<InvitationGuestEntity>,
            template: NotificationTemplate
    )
}