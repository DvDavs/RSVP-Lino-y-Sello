package mx.evolutiondev.invitaciones.modules.master.templates.repository

import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface InvitationTemplateRepository : JpaRepository<InvitationTemplateEntity, Long> {
    fun findAllByEventTypeIdAndInvitationPlanId(eventTypeId: Long, planId: Long): List<InvitationTemplateEntity>
    fun findAllByEventTypeId(eventTypeId: Long): List<InvitationTemplateEntity>
    fun findAllByInvitationPlanId(planId: Long): List<InvitationTemplateEntity>
    
    fun findAllByIsEnabledTrue(): List<InvitationTemplateEntity>
    fun findAllByEventTypeIdAndIsEnabledTrue(eventTypeId: Long): List<InvitationTemplateEntity>
    fun findAllByInvitationPlanIdAndIsEnabledTrue(planId: Long): List<InvitationTemplateEntity>
    fun findAllByEventTypeIdAndInvitationPlanIdAndIsEnabledTrue(eventTypeId: Long, planId: Long): List<InvitationTemplateEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<InvitationTemplateEntity>
    
    fun findAllByEventTypeIdAndIsEnabled(eventTypeId: Long, isEnabled: Boolean, pageable: Pageable): Page<InvitationTemplateEntity>
    
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean, pageable: Pageable): Page<InvitationTemplateEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(
            eventTypeId: Long,
            planId: Long,
            isEnabled: Boolean,
            pageable: Pageable
    ): Page<InvitationTemplateEntity>
    
    fun findAllByEventTypeId(eventTypeId: Long, pageable: Pageable): Page<InvitationTemplateEntity>
    
    fun findAllByInvitationPlanId(planId: Long, pageable: Pageable): Page<InvitationTemplateEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanId(
            eventTypeId: Long,
            planId: Long,
            pageable: Pageable
    ): Page<InvitationTemplateEntity>
    
    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.template.id = :templateId AND i.isEnabled = true")
    fun countActiveInvitationsUsingTemplate(@Param("templateId") templateId: Long): Long
    
    @Query("SELECT * FROM invitation_template WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): InvitationTemplateEntity?
    
    @Query("SELECT * FROM invitation_template", 
           countQuery = "SELECT COUNT(*) FROM invitation_template",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<InvitationTemplateEntity>
}


