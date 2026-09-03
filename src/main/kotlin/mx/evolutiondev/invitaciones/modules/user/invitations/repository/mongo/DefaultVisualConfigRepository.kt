package mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo

import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultVisualConfig
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.stereotype.Repository
import java.util.Optional

/**
 * Repository for accessing visual template configurations from MongoDB.
 */
@Repository
interface DefaultVisualConfigRepository : MongoRepository<DefaultVisualConfig, String> {
    
    /**
     * Finds a visual template configuration by template ID.
     * 
     * @param templateId The template ID from the relational database
     * @return An Optional containing the visual configuration if found
     */
    fun findByTemplateId(templateId: Long): Optional<DefaultVisualConfig>
}

