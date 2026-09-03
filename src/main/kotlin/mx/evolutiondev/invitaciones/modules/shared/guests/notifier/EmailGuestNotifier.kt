package mx.evolutiondev.invitaciones.modules.shared.guests.notifier

import kotlinx.coroutines.*
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.util.formatter.isToday
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationPersonEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.InvitationGuestNotificationRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model.InvitationGuestNotification
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model.NotificationTemplate
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class EmailGuestNotifier(
        private val emailService: EmailService,
        private val invitationGuestsNotificationRepository: InvitationGuestNotificationRepository,
        private val invitationRepository: InvitationRepository,
        @Value("\${app.frontend.url}") private val frontendUrl: String
) : GuestAppNotifier {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Converts a string to slug format (lowercase, spaces replaced with hyphens).
     * Example: "XV Años" -> "xv-anos"
     */
    private fun String.slugify(): String {
        return this.trim()
            .lowercase()
            .replace(Regex("\\s+"), "-")
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
            .replace("ñ", "n")
            .replace(Regex("[^a-z0-9-]"), "")
    }

    /**
     * Formats people names according to the number of people:
     * - 0 people: "evento"
     * - 1 person: "nombre-persona"
     * - 2+ people: "nombre1-y-nombre2-y-nombre3"
     */
    private fun formatPeopleNames(people: List<InvitationPersonEntity>): String {
        return when {
            people.isEmpty() -> "evento"
            people.size == 1 -> people[0].name.slugify()
            else -> people.joinToString("-y-") { it.name.slugify() }
        }
    }

    private fun buildInvitationUrl(
        frontendUrl: String,
        invitation: InvitationEntity,
        token: String
    ): String {
        val eventTypeSlug = invitation.template.eventType.name.slugify()
            .let { if (it == "quince-anos") "xv" else it } 
        val templateId = invitation.template.id
        val peopleNamesSlug = formatPeopleNames(invitation.people)
        
        return "https://invitaciones-digitales-agape.cloud/invitaciones/${invitation.id}/$eventTypeSlug/$peopleNamesSlug?token=$token"
        //return "$frontendUrl/invitaciones/${invitation.id}/$eventTypeSlug/$peopleNamesSlug?token=$token"
    }

    override fun notifyAll(
            invitationId: Long,
            requesterId: Long,
            appRole: AppRole,
            guests: List<InvitationGuestEntity>,
            template: NotificationTemplate
    ) {
        val notifications = invitationGuestsNotificationRepository.findByInvitationId(invitationId).filter {
            it.createdAt?.isToday() == true
        }

        if (appRole == AppRole.USER && notifications.isNotEmpty()) {
            throw IllegalArgumentException("Ya se ha notificado a los invitados el día de hoy")
        }

        val invitation = invitationRepository.findByIdWithPeopleAndTemplate(invitationId).orElseThrow {
            throw IllegalArgumentException("La invitación no existe")
        }

        scope.launch {
            guests
                .filter { !it.email.isNullOrBlank() }
                .map { guest ->
                    async {
                        val confirmationUrl = guest.confirmationToken?.let { token ->
                            buildInvitationUrl(frontendUrl, invitation, token)
                        } ?: "#"

                        emailService.sendEmail(
                            to = guest.email!!,  
                            templateName = "guest-notification",
                            variables = mapOf(
                                "guestName" to (guest.fullName ?: "Invitado"),
                                "graduatesName" to (guest.graduatesName ?: ""),
                                "eventName" to (invitation.template.eventType.name),
                                "eventDate" to invitation.date,
                                "eventTime" to invitation.time,
                                "confirmationUrl" to confirmationUrl
                            )
                        )
                    }
                }.awaitAll()

            invitationGuestsNotificationRepository.save(
                    InvitationGuestNotification(
                            invitation = invitation,
                            notifiedBy = if (appRole == AppRole.USER) null else requesterId,
                    )
            )
        }
    }

    /**
     * Send invitation notification to a single guest after they are created.
     * 
     * @param guest The newly created guest
     */
    fun notifySingle(guest: InvitationGuestEntity) {
        scope.launch {
            try {
                val invitation = invitationRepository.findByIdWithPeopleAndTemplate(guest.invitation.id).orElseThrow {
                    throw IllegalArgumentException("La invitación no existe")
                }
                
                val confirmationUrl = guest.confirmationToken?.let { token ->
                    buildInvitationUrl(frontendUrl, invitation, token)
                } ?: "#"

                if (!guest.email.isNullOrBlank()) {
                    emailService.sendEmail(
                        to = guest.email,
                        templateName = "guest-notification",
                        variables = mapOf(
                            "guestName" to (guest.fullName ?: "Invitado"),
                            "graduatesName" to (guest.graduatesName ?: ""),
                            "eventName" to invitation.template.eventType.name,
                            "eventDate" to invitation.date,
                            "eventTime" to invitation.time,
                            "confirmationUrl" to confirmationUrl
                        )
                    )
                }
            } catch (e: Exception) {
                println("Error sending invitation notification to guest ${guest.email}: ${e.message}")
            }
        }
    }

    /**
     * Send decline notifications to both guest and host when attendance is declined.
     * 
     * @param guest The guest who declined attendance
     * @param wasConfirmed Whether the guest had previously confirmed (true = cancellation, false = initial decline)
     */
    fun notifyDecline(guest: InvitationGuestEntity, wasConfirmed: Boolean) {
        scope.launch {
            try {
                val invitation = guest.invitation
                val host = invitation.customer

                val messageType = if (wasConfirmed) "cancelado" else "declinado"

                // Send email to guest
                if (!guest.email.isNullOrBlank()) {
                    async {
                        emailService.sendEmail(
                            to = guest.email,
                            templateName = "guest-decline-confirmation",
                            variables = mapOf(
                                "guestName" to (guest.fullName ?: "Invitado"),
                                "graduatesName" to (guest.graduatesName ?: ""),
                                "eventName" to invitation.template.eventType.name,
                                "eventDate" to invitation.date,
                                "wasConfirmed" to wasConfirmed
                            )
                        )
                    }.await()
                }

                // Send email to host
                async {
                    emailService.sendEmail(
                        to = host.email,
                        templateName = "host-guest-declined-notification",
                        variables = mapOf(
                            "hostName" to host.name,
                            "guestName" to (guest.fullName ?: "Invitado"),
                            "graduatesName" to (guest.graduatesName ?: ""),
                            "eventName" to invitation.template.eventType.name,
                            "messageType" to messageType
                        )
                    )
                }.await()
            } catch (e: Exception) {
                println("Error sending decline notifications: ${e.message}")
            }
        }
    }

    /**
     * Send confirmation notifications to both guest and host when attendance is confirmed.
     * 
     * @param guest The guest who confirmed attendance
     */
    fun notifyConfirmation(guest: InvitationGuestEntity) {
        scope.launch {
            try {
                // Reload invitation with pople and template to avoid LazyInitializationException
                val invitation = invitationRepository.findByIdWithPeopleAndTemplate(guest.invitation.id).orElseThrow {
                    throw IllegalArgumentException("La invitación no existe")
                }
                val host = invitation.customer

                val confirmationUrl = guest.confirmationToken?.let { token ->
                    buildInvitationUrl(frontendUrl, invitation, token)
                } ?: "#"

                // Build cancellation URL (same as confirmation URL per requirements)
                val cancellationUrl = if (confirmationUrl == "#") {
                    "#"
                } else {
                    "$confirmationUrl#started"
                }

                // Send email to guest
                if (!guest.email.isNullOrBlank()) {
                    async {
                        emailService.sendEmail(
                            to = guest.email,
                            templateName = "guest-confirmation-success",
                            variables = mapOf(
                                "guestName" to (guest.fullName ?: "Invitado"),
                                "graduatesName" to (guest.graduatesName ?: ""),
                                "eventName" to invitation.template.eventType.name,
                                "eventDate" to invitation.date,
                                "eventTime" to invitation.time,
                                "adultsConfirmed" to guest.adultsCountConfirmed,
                                "childrenConfirmed" to guest.childrenCountConfirmed,
                                "youngConfirmed" to guest.youngCountConfirmed,
                                "confirmationUrl" to confirmationUrl,
                                "cancellationUrl" to cancellationUrl
                            )
                        )
                    }.await()
                }

                async {
                    emailService.sendEmail(
                        to = host.email,
                        templateName = "host-guest-confirmed-notification",
                        variables = mapOf(
                            "hostName" to host.name,
                            "guestName" to (guest.fullName ?: "Invitado"),
                            "graduatesName" to (guest.graduatesName ?: ""),
                            "eventName" to invitation.template.eventType.name,
                            "adultsConfirmed" to guest.adultsCountConfirmed,
                            "childrenConfirmed" to guest.childrenCountConfirmed,
                            "youngConfirmed" to guest.youngCountConfirmed,
                            "congratulationsMessage" to (guest.congratulationsMessage ?: "")
                        )
                    )
                }.await()
            } catch (e: Exception) {
                println("Error sending confirmation notifications: ${e.message}")
            }
        }
    }
}