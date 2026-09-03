package mx.evolutiondev.invitaciones.modules.master.plans.repository

import mx.evolutiondev.invitaciones.modules.master.plans.repository.model.InvitationPlanEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface InvitationPlanRepository : JpaRepository<InvitationPlanEntity, Long> {
    fun findByName(name: String): InvitationPlanEntity?

    fun findAllByIsEnabledTrue(): List<InvitationPlanEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<InvitationPlanEntity>
    
    fun findAllByIsPremiumAndIsEnabled(isPremium: Boolean, isEnabled: Boolean, pageable: Pageable): Page<InvitationPlanEntity>
    
    fun findAllByIsPremium(isPremium: Boolean, pageable: Pageable): Page<InvitationPlanEntity>
    
    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.template.invitationPlan.id = :planId AND i.isEnabled = true")
    fun countActiveInvitationsUsingPlan(@Param("planId") planId: Long): Long
    
    @Query("SELECT * FROM invitation_plan WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): InvitationPlanEntity?
    
    @Query("SELECT * FROM invitation_plan", 
           countQuery = "SELECT COUNT(*) FROM invitation_plan",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<InvitationPlanEntity>
}


