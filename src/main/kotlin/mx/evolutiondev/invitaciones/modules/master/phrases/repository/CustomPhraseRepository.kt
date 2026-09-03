package mx.evolutiondev.invitaciones.modules.master.phrases.repository

import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.CustomPhraseEntity
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseGenre
import mx.evolutiondev.invitaciones.modules.master.phrases.repository.model.PhraseOrientation
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface CustomPhraseRepository : JpaRepository<CustomPhraseEntity, Long> {
    fun findAllByInvitationPlanIdAndEventTypeId(planId: Long, eventId: Long): List<CustomPhraseEntity>
    
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(planId: Long, eventId: Long): List<CustomPhraseEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<CustomPhraseEntity>
    
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean, pageable: Pageable): Page<CustomPhraseEntity>
    
    fun findAllByEventTypeIdAndIsEnabled(eventId: Long, isEnabled: Boolean, pageable: Pageable): Page<CustomPhraseEntity>
    
    fun findAllByGenreAndIsEnabled(genre: PhraseGenre, isEnabled: Boolean, pageable: Pageable): Page<CustomPhraseEntity>
    
    fun findAllByGenreOrientationAndIsEnabled(orientation: PhraseOrientation, isEnabled: Boolean, pageable: Pageable): Page<CustomPhraseEntity>
    
    @Query("SELECT cp FROM CustomPhraseEntity cp WHERE " +
           "(:planId IS NULL OR cp.invitationPlan.id = :planId) AND " +
           "(:eventId IS NULL OR cp.eventType.id = :eventId) AND " +
           "(:genre IS NULL OR cp.genre = :genre) AND " +
           "(:orientation IS NULL OR cp.genreOrientation = :orientation) AND " +
           "(:isEnabled IS NULL OR cp.isEnabled = :isEnabled)")
    fun findAllByFilters(
            @Param("planId") planId: Long?,
            @Param("eventId") eventId: Long?,
            @Param("genre") genre: PhraseGenre?,
            @Param("orientation") orientation: PhraseOrientation?,
            @Param("isEnabled") isEnabled: Boolean?,
            pageable: Pageable
    ): Page<CustomPhraseEntity>
    
    @Query("SELECT * FROM custom_phrase WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): CustomPhraseEntity?
    
    @Query("SELECT * FROM custom_phrase", 
           countQuery = "SELECT COUNT(*) FROM custom_phrase",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<CustomPhraseEntity>
}


