package mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model

import mx.evolutiondev.invitaciones.core.util.formatter.toDate
import java.util.*


fun InvitationEntity.eventDate(format: String = "yyyy-MM-dd HH:mm"): Date {
    return "$date $time".toDate(format)
}
