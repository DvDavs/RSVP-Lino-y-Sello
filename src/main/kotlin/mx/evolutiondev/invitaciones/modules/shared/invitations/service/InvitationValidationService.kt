package mx.evolutiondev.invitaciones.modules.shared.invitations.service

import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.ExtraModulesRequest
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.PersonRequest
import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.PhraseRequest
import org.springframework.stereotype.Service

@Service
class InvitationValidationService {

    /**
     * Validates that template, eventType and plan are enabled.
     */
    fun validateEnabledComponents(template: InvitationTemplateEntity) {
        if (!template.isEnabled) {
            throw IllegalArgumentException("The selected template is disabled and cannot be used")
        }

        val eventType = template.eventType
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("The event type of this template is disabled")
        }

        val plan = template.invitationPlan
        if (!plan.isEnabled) {
            throw IllegalArgumentException("The plan of this template is disabled")
        }
    }

    /**
     * Validates people rules: weddings require exactly 2 people, other events max 2.
     */
    fun validatePeopleRules(event: EventTypeEntity, people: List<PersonRequest>) {
        if (event.isWedding && people.size != 2) {
            throw IllegalArgumentException("There must be exactly 2 person(s) for this event type")
        }
        if (!event.isWedding && people.size > 2) {
            throw IllegalArgumentException("Cannot exceed 2 person(s) for this event type")
        }
    }

    /**
     * Validates phrase rules: non-premium weddings max 1 phrase, others max 2.
     */
    fun validatePhraseRules(event: EventTypeEntity, plan: InvitationPlanEntity, phrases: List<PhraseRequest>) {
        val max = if (event.isWedding && !plan.isPremium) 1 else 2
        if (phrases.size > max) {
            throw IllegalArgumentException("Only up to $max phrases are allowed for this event type and plan")
        }
    }

    /**
     * Validates extra modules: non-wedding events may have dressCode and parentsAndGodparents.
     * If not provided, defaults will be used during persistence.
     */
    fun validateExtraModulesRules(event: EventTypeEntity, extra: ExtraModulesRequest?) {
        // Validation is now optional - defaults are applied during persistence if not provided
        // This allows the stepper to advance without requiring all fields to be filled
    }
}

