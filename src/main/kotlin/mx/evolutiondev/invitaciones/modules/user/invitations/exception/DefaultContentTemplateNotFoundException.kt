package mx.evolutiondev.invitaciones.modules.user.invitations.exception

/**
 * Exception thrown when a content template is not found for a given eventTypeId and planId combination.
 * This indicates a system configuration issue as content templates should exist for all event type and plan combinations.
 */
class DefaultContentTemplateNotFoundException(message: String) : RuntimeException(message)

