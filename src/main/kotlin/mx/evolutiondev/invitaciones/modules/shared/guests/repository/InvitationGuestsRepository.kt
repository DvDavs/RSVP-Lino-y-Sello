package mx.evolutiondev.invitaciones.modules.shared.guests.repository

import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface InvitationGuestsRepository : JpaRepository<InvitationGuestEntity, Long>,
        JpaSpecificationExecutor<InvitationGuestEntity> {
    fun findByConfirmationToken(confirmationToken: String): InvitationGuestEntity?
    fun findByCancellationToken(token: String): InvitationGuestEntity?
    fun findByEmail(email: String): InvitationGuestEntity?
    fun findByPhone(phone: String): InvitationGuestEntity?
    fun findByEmailAndPhoneAndIsEnabledFalse(email: String, phone: String): InvitationGuestEntity?
    fun findByEmailAndPhone(email: String, phone: String?): InvitationGuestEntity?
    fun findByInvitationIdAndIsEnabledTrue(invitationId: Long): List<InvitationGuestEntity>
    
    fun findByInvitationIdAndIsEnabledTrueAndAttendanceStatus(
        invitationId: Long, 
        attendanceStatus: AttendanceStatus
    ): List<InvitationGuestEntity>
    
    fun findByInvitationIdAndEmailAndIsEnabledTrue(invitationId: Long, email: String): InvitationGuestEntity?
    fun findByInvitationIdAndPhoneAndIsEnabledTrue(invitationId: Long, phone: String): InvitationGuestEntity?
    
    @Query("SELECT g.email FROM InvitationGuestEntity g WHERE g.invitation.id = :invitationId AND g.isEnabled = true AND g.email IS NOT NULL")
    fun findEmailsByInvitationId(invitationId: Long): List<String>
    
    @Query("SELECT g.phone FROM InvitationGuestEntity g WHERE g.invitation.id = :invitationId AND g.isEnabled = true AND g.phone IS NOT NULL")
    fun findPhonesByInvitationId(invitationId: Long): List<String>
    
    @Query("SELECT * FROM invitation_guest WHERE id = :id", nativeQuery = true)
    fun findByIdEvenIfDisabled(@Param("id") id: Long): InvitationGuestEntity?
    
    @Query("SELECT * FROM invitation_guest", 
           countQuery = "SELECT COUNT(*) FROM invitation_guest",
           nativeQuery = true)
    fun findAllWithAnyStatus(pageable: Pageable): Page<InvitationGuestEntity>
    
    @Query("SELECT * FROM invitation_guest WHERE invitation_id = :invitationId", nativeQuery = true)
    fun findAllByInvitationId(@Param("invitationId") invitationId: Long): List<InvitationGuestEntity>
    
    @Modifying
    @Query("DELETE FROM invitation_guest WHERE id = :id", nativeQuery = true)
    fun hardDeleteById(@Param("id") id: Long)
}