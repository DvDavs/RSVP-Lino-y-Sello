package mx.evolutiondev.invitaciones.modules.master.giftmessages.repository

import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftImageEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface GiftImageRepository : JpaRepository<GiftImageEntity, Long> {
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(
            invitationPlanId: Long,
            eventTypeId: Long
    ): List<GiftImageEntity>
    
    fun findAllByInvitationPlanIdAndEventTypeId(planId: Long, eventTypeId: Long): List<GiftImageEntity>
    
    @Modifying
    @Query("UPDATE GiftImageEntity gi SET gi.isEnabled = false, gi.deletedBy = :userId WHERE gi.invitationPlan.id = :planId AND gi.eventType.id = :eventTypeId")
    fun deactivateAllByPlanAndEventType(@Param("planId") planId: Long, @Param("eventTypeId") eventTypeId: Long, @Param("userId") userId: Long)
    
    @Modifying(clearAutomatically = true)
    @Query(value = "DELETE FROM gift_image WHERE invitation_plan_id = :planId AND event_type_id = :eventTypeId", nativeQuery = true)
    fun hardDeleteAllByPlanAndEventType(@Param("planId") planId: Long, @Param("eventTypeId") eventTypeId: Long)
    
    @Query("SELECT * FROM gift_image WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): GiftImageEntity?
    
    @Query("SELECT * FROM gift_image", 
           countQuery = "SELECT COUNT(*) FROM gift_image",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<GiftImageEntity>
}


