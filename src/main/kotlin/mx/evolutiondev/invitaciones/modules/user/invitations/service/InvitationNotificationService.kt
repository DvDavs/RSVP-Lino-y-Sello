package mx.evolutiondev.invitaciones.modules.user.invitations.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.email.model.EmailRequest
import mx.evolutiondev.invitaciones.modules.admin.dashboard.service.NotificationsEmailDispatcher
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.ExtraModulesRequest
import org.springframework.stereotype.Service

@Service
class InvitationNotificationService(
        private val emailService: EmailService,
        private val notificationsEmailDispatcher: NotificationsEmailDispatcher
) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun prepareInvitationNotification(
            customer: CustomerEntity,
            event: EventTypeEntity,
            plan: InvitationPlanEntity,
            extra: ExtraModulesRequest?,
            priceBreakdown: mx.evolutiondev.invitaciones.modules.shared.invitations.service.PriceBreakdown,
            isPaid: Boolean = false
    ) {
        val extrasList = if (event.isWedding && plan.isPremium) {
            buildList {
                if (extra?.dressCode != null) add("Código de vestimenta")
                if (extra?.recommendations != null) add("Recomendaciones")
                if (extra?.ourStory != null) add("Nuestra historia")
                if (extra?.amenitiesAndActivities != null) add("Amenidades y actividades")
                if (extra?.parentsAndGodparents != null) add("Padres y padrinos")
            }
        } else {
            emptyList()
        }

        val adminTemplateVariables = mapOf(
            "userName" to "${customer.name} ${customer.lastName}",
            "userEmail" to customer.email,
            "eventName" to event.name,
            "planName" to plan.name,
            "extras" to extrasList.joinToString("\n") { "- $it" },
            "basePrice" to priceBreakdown.basePrice,
            "extraModulesPrice" to priceBreakdown.extraModules,
            "totalPrice" to priceBreakdown.totalPrice
        )

        notificationsEmailDispatcher.sendToAll(
            subject = "Nueva invitación creada por el usuario ${customer.name}",
            templateName = "admin-invitation-notification",
            templateVariables = adminTemplateVariables
        )

        sendUserConfirmationNotification(customer, event, plan, extrasList, priceBreakdown, isPaid)
    }

    private fun sendUserConfirmationNotification(
        customer: CustomerEntity,
        event: EventTypeEntity,
        plan: InvitationPlanEntity,
        extrasList: List<String>,
        priceBreakdown: mx.evolutiondev.invitaciones.modules.shared.invitations.service.PriceBreakdown,
        isPaid: Boolean
    ) {
        coroutineScope.launch {
            emailService.sendEmail(
                to = customer.email,
                templateName = "invitation",
                variables = mapOf(
                    "customerName" to customer.name,
                    "eventName" to event.name,
                    "planName" to plan.name,
                    "extraModules" to extrasList.joinToString(", "),
                    "hasExtras" to extrasList.isNotEmpty(),
                    "isPremium" to plan.isPremium,
                    "isWedding" to event.isWedding,
                    "basePrice" to priceBreakdown.basePrice,
                    "extraModulesPrice" to priceBreakdown.extraModules,
                    "totalPrice" to priceBreakdown.totalPrice,
                    "isPaid" to isPaid
                )
            )
        }
    }
}