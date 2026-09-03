package mx.evolutiondev.invitaciones.modules.user.invitations.repository.mongo

import mx.evolutiondev.invitaciones.modules.user.invitations.model.defaults.DefaultContentConfig
import org.springframework.data.mongodb.repository.MongoRepository
import org.springframework.stereotype.Repository
import java.util.Optional

/**
 * Repository for accessing content template configurations from MongoDB.
 */
@Repository
interface DefaultContentConfigRepository : MongoRepository<DefaultContentConfig, String> {

    /**
     * Finds a content template configuration by template ID.
     *
     * @param templateId The template ID from the relational database
     * @return An Optional containing the content configuration if found
     */
    fun findByTemplateId(templateId: Long): Optional<DefaultContentConfig>
    
    /**
     * Finds a content template configuration by event type ID and plan ID.
     * 
     * @param eventTypeId The event type ID from the relational database
     * @param planId The plan ID from the relational database
     * @return An Optional containing the content configuration if found
     */
    fun findByEventTypeIdAndPlanId(eventTypeId: Long, planId: Long): Optional<DefaultContentConfig>
    
    // ✅ Agregar este — retorna el primero sin explotar si hay múltiples
    fun findFirstByEventTypeIdAndPlanId(
        eventTypeId: Long,
        planId: Long
    ): Optional<DefaultContentConfig>

    fun findByEventTypeIdAndPlanIdAndTemplateId(
        eventTypeId: Long, 
        planId: Long, 
        templateId: Long
    ): Optional<DefaultContentConfig>
    
}

