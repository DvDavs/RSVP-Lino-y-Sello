package mx.evolutiondev.invitaciones.modules.master.giftmessages.repository

import mx.evolutiondev.invitaciones.modules.master.giftmessages.repository.model.GiftMessageEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface GiftMessageRepository : JpaRepository<GiftMessageEntity, Long> {
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(
            invitationPlanId: Long,
            eventTypeId: Long
    ): List<GiftMessageEntity>
    
    fun findAllByInvitationPlanIdAndEventTypeId(planId: Long, eventTypeId: Long): List<GiftMessageEntity>
    
    fun findFirstByInvitationPlanIdAndEventTypeId(planId: Long, eventTypeId: Long): GiftMessageEntity?
    
    fun findAllByInvitationPlanIdAndEventTypeId(planId: Long, eventTypeId: Long, pageable: Pageable): Page<GiftMessageEntity>
    fun findAllByInvitationPlanId(planId: Long, pageable: Pageable): Page<GiftMessageEntity>
    fun findAllByEventTypeId(eventTypeId: Long, pageable: Pageable): Page<GiftMessageEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<GiftMessageEntity>
    
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean, pageable: Pageable): Page<GiftMessageEntity>
    
    fun findAllByEventTypeIdAndIsEnabled(eventTypeId: Long, isEnabled: Boolean, pageable: Pageable): Page<GiftMessageEntity>
    
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabled(
            planId: Long,
            eventTypeId: Long,
            isEnabled: Boolean,
            pageable: Pageable
    ): Page<GiftMessageEntity>
    
    fun findAllByInvitationPlanId(planId: Long): List<GiftMessageEntity>
    fun findAllByEventTypeId(eventTypeId: Long): List<GiftMessageEntity>
    fun findAllByIsEnabled(isEnabled: Boolean): List<GiftMessageEntity>
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean): List<GiftMessageEntity>
    fun findAllByEventTypeIdAndIsEnabled(eventTypeId: Long, isEnabled: Boolean): List<GiftMessageEntity>
    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabled(planId: Long, eventTypeId: Long, isEnabled: Boolean): List<GiftMessageEntity>
    
    @Modifying
    @Query("UPDATE GiftMessageEntity gm SET gm.isEnabled = false, gm.deletedBy = :userId WHERE gm.invitationPlan.id = :planId AND gm.eventType.id = :eventTypeId")
    fun deactivateAllByPlanAndEventType(@Param("planId") planId: Long, @Param("eventTypeId") eventTypeId: Long, @Param("userId") userId: Long)
    
    @Modifying(clearAutomatically = true)
    @Query(value = "DELETE FROM gift_message WHERE invitation_plan_id = :planId AND event_type_id = :eventTypeId", nativeQuery = true)
    fun hardDeleteAllByPlanAndEventType(@Param("planId") planId: Long, @Param("eventTypeId") eventTypeId: Long)
    
    @Query("SELECT * FROM gift_message WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): GiftMessageEntity?
    
    @Query("SELECT * FROM gift_message", 
           countQuery = "SELECT COUNT(*) FROM gift_message",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<GiftMessageEntity>
}


