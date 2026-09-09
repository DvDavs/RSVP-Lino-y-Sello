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
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2FlagRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class EmailGuestNotifier(
        private val emailService: EmailService,
        private val invitationGuestsNotificationRepository: InvitationGuestNotificationRepository,
        private val invitationRepository: InvitationRepository,
        /** Solo lectura de `invitation.uses_templates2` para S-08; ver [buildInvitationUrl]. */
        private val templates2FlagRepository: Templates2FlagRepository,
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

    /**
     * Enlace personal que viaja en el correo del invitado.
     *
     * ### S-08 (severidad ALTA, funcional), cerrado
     * Esta función devolvía una URL **escrita en el código** apuntando al producto antiguo
     * (`https://invitaciones-digitales-agape.cloud/...`), con la línea que usaba `frontendUrl`
     * comentada justo debajo. Consecuencia: **todo** correo que el backend mandaba a un invitado lo
     * llevaba al producto viejo, no al nuevo. Además la URL se componía con
     * `invitation.template.eventType.name` y `invitation.people`, datos del módulo antiguo que una
     * invitación de `templates2` puede no tener.
     *
     * Ahora: cuando `invitation.uses_templates2` es `true`, el enlace es
     * `<frontendUrl>/r/<confirmationToken>` — la ruta del invitado que fijó §0.3, con **un solo**
     * token, construida con `app.frontend.url`, que ya estaba inyectada. Fíjese que ese camino
     * **retorna antes** de tocar `template` y `people`: son asociaciones del módulo antiguo que una
     * invitación nueva no tiene por qué poder resolver.
     *
     * Para el resto (invitaciones que no son de `templates2`) se conserva el comportamiento actual,
     * salvo que el origen deja de estar escrito en el código y sale de `frontendUrl`. **Ningún
     * dominio literal queda en este fichero.**
     *
     * La bandera se lee con `Templates2FlagRepository` (`Templates2FlagRepository.kt:44-45`), que es
     * el **único** acceso a esa columna en todo el repositorio; `InvitationEntity` no la mapea. Es
     * una consulta nativa de solo lectura, no se toca `modules/templates2`.
     */
    private fun buildInvitationUrl(
        frontendUrl: String,
        invitation: InvitationEntity,
        token: String
    ): String {
        val base = frontendUrl.trimEnd('/')

        if (templates2FlagRepository.usesTemplates2(invitation.id) == true) {
            return "$base/r/$token"
        }

        val eventTypeSlug = invitation.template.eventType.name.slugify()
            .let { if (it == "quince-anos") "xv" else it }
        val peopleNamesSlug = formatPeopleNames(invitation.people)

        return "$base/invitaciones/${invitation.id}/$eventTypeSlug/$peopleNamesSlug?token=$token"
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