//
package mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults

import mx.evolutiondev.invitaciones.modules.user.invitations.model.editor.InvitationConfig
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.index.Indexed
import org.springframework.data.mongodb.core.mapping.Document

/**
 * Represents a visual template configuration stored in MongoDB.
 * Each visual template defines the complete structure with responsive properties (md, sm, xs)
 * for all sections of the invitation editor, with placeholder content.
 */
@Document(collection = "default_visual_configs")
data class DefaultVisualConfig(
    @Id
    val id: String? = null,
    
    /**
     * The template ID from the relational database.
     * This is used to match the visual template with the invitation template.
     */
    @Indexed(unique = true)
    val templateId: Long,
    
    /**
     * The complete invitation configuration with visual structure and responsive properties.
     * Content fields will have placeholder values that will be replaced during generation.
     */
    val config: InvitationConfig
)

