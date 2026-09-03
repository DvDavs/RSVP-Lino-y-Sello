package mx.evolutiondev.invitaciones.modules.master.songs.repository

import mx.evolutiondev.invitaciones.modules.master.songs.repository.model.SongEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface SongRepository : JpaRepository<SongEntity, Long> {
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(
            invitationPlanId: Long,
            eventTypeId: Long
    ): List<SongEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<SongEntity>
    
    fun findAllByEventTypeIdAndIsEnabled(eventTypeId: Long, isEnabled: Boolean, pageable: Pageable): Page<SongEntity>
    
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean, pageable: Pageable): Page<SongEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(
            eventTypeId: Long,
            planId: Long,
            isEnabled: Boolean,
            pageable: Pageable
    ): Page<SongEntity>
    
    fun findAllByEventTypeId(eventTypeId: Long, pageable: Pageable): Page<SongEntity>
    
    fun findAllByInvitationPlanId(planId: Long, pageable: Pageable): Page<SongEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanId(
            eventTypeId: Long,
            planId: Long,
            pageable: Pageable
    ): Page<SongEntity>
    
    @Query("SELECT * FROM invitation_song WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): SongEntity?
    
    @Query("SELECT * FROM invitation_song", 
           countQuery = "SELECT COUNT(*) FROM invitation_song",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<SongEntity>
}
