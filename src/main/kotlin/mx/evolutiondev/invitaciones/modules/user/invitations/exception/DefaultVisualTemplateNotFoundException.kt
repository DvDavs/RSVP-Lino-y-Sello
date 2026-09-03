package mx.evolutiondev.invitaciones.modules.user.invitations.exception

/**
 * Exception thrown when a visual template is not found for a given templateId.
 * This indicates a system configuration issue as visual templates should exist for all templates.
 */
class DefaultVisualTemplateNotFoundException(message: String) : RuntimeException(message)

