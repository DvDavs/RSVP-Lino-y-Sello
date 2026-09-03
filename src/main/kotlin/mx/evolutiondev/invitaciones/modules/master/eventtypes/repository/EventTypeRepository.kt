package mx.evolutiondev.invitaciones.modules.master.eventtypes.repository

import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface EventTypeRepository : JpaRepository<EventTypeEntity, Long> {
    fun findByName(name: String): EventTypeEntity?

    fun findAllByIsEnabledTrue(): List<EventTypeEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<EventTypeEntity>
    
    fun findAllByIsWeddingAndIsEnabled(isWedding: Boolean, isEnabled: Boolean, pageable: Pageable): Page<EventTypeEntity>
    
    fun findAllByIsWedding(isWedding: Boolean, pageable: Pageable): Page<EventTypeEntity>
    
    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.template.eventType.id = :eventTypeId AND i.isEnabled = true")
    fun countActiveInvitationsUsingEventType(@Param("eventTypeId") eventTypeId: Long): Long
    
    @Query("SELECT * FROM event_type WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): EventTypeEntity?
    
    @Query("SELECT * FROM event_type", 
           countQuery = "SELECT COUNT(*) FROM event_type",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<EventTypeEntity>
}


