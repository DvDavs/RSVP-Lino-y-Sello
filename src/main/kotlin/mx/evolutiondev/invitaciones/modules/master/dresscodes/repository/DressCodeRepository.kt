package mx.evolutiondev.invitaciones.modules.master.dresscodes.repository

import mx.evolutiondev.invitaciones.modules.master.dresscodes.repository.model.DressCodeEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface DressCodeRepository : JpaRepository<DressCodeEntity, Long> {
    fun findByName(name: String): DressCodeEntity?

    fun findAllByIsEnabledTrue(): List<DressCodeEntity>

    fun findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(
            invitationPlanId: Long,
            eventTypeId: Long
    ): List<DressCodeEntity>
    
    fun findAllByIsEnabled(isEnabled: Boolean, pageable: Pageable): Page<DressCodeEntity>
    
    fun findAllByEventTypeIdAndIsEnabled(eventTypeId: Long, isEnabled: Boolean, pageable: Pageable): Page<DressCodeEntity>
    
    fun findAllByInvitationPlanIdAndIsEnabled(planId: Long, isEnabled: Boolean, pageable: Pageable): Page<DressCodeEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(
            eventTypeId: Long,
            planId: Long,
            isEnabled: Boolean,
            pageable: Pageable
    ): Page<DressCodeEntity>
    
    fun findAllByEventTypeId(eventTypeId: Long, pageable: Pageable): Page<DressCodeEntity>
    
    fun findAllByInvitationPlanId(planId: Long, pageable: Pageable): Page<DressCodeEntity>
    
    fun findAllByEventTypeIdAndInvitationPlanId(
            eventTypeId: Long,
            planId: Long,
            pageable: Pageable
    ): Page<DressCodeEntity>
    
    @Query("SELECT COUNT(DISTINCT idc.invitation.id) FROM invitation_dress_code idc WHERE (idc.womanId = :dressCodeId OR idc.manId = :dressCodeId) AND idc.invitation.isEnabled = true")
    fun countActiveInvitationsUsingDressCode(@Param("dressCodeId") dressCodeId: Long): Long
    
    @Query("SELECT * FROM dress_code WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): DressCodeEntity?
    
    @Query("SELECT * FROM dress_code", 
           countQuery = "SELECT COUNT(*) FROM dress_code",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<DressCodeEntity>
}


