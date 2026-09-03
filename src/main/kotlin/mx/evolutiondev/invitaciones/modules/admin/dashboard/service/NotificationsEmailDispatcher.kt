package mx.evolutiondev.invitaciones.modules.admin.dashboard.service

import kotlinx.coroutines.*
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.email.model.EmailRequest
import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.NotificationsRepository
import org.springframework.stereotype.Component

@Component
class NotificationsEmailDispatcher(
        private val notificationsRepository: NotificationsRepository,
        private val emailService: EmailService
) {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun sendToAll(subject: String, templateName: String, templateVariables: Map<String, Any> = emptyMap()) {
        val notifications = notificationsRepository.findAll()

        scope.launch {
            notifications.map { notification ->
                async {
                    emailService.sendEmail(
                        to = notification.email,
                        templateName = templateName,
                        variables = templateVariables
                    )
                }
            }.awaitAll()
        }
    }

}
