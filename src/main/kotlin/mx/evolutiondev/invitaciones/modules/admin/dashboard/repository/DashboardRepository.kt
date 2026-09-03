package mx.evolutiondev.invitaciones.modules.admin.dashboard.repository

import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.EventSummary
import mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.InvitationSummary
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface DashboardRepository : JpaRepository<InvitationEntity, Long> {

    @Query("SELECT COUNT(i) FROM InvitationEntity i")
    fun countTotalInvitations(): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.isEnabled = true AND i.isPaid = true")
    fun countActiveInvitations(): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.isPaid = false")
    fun countPendingInvitations(): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.date < :currentDate AND i.isEnabled = true")
    fun countPastEvents(currentDate: String): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.date >= :currentDate AND i.isEnabled = true")
    fun countUpcomingEvents(currentDate: String): Long

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.InvitationSummary(
            i.id, i.customer.name, i.customer.lastName, i.isPaid, i.createdAt, i.template.eventType.name, i.date,
            i.totalAmount, i.template.invitationPlan.id, i.template.invitationPlan.name
        )
        FROM InvitationEntity i
        ORDER BY i.createdAt DESC
    """)
    fun findRecentInvitations(pageable: Pageable): List<InvitationSummary>

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.EventSummary(
            i.id, i.template.eventType.name, i.date, i.customer.name, i.customer.lastName
        )
        FROM InvitationEntity i
        WHERE i.date >= :currentDate AND i.isEnabled = true
        ORDER BY i.date ASC
    """)
    fun findUpcomingEvents(currentDate: String, pageable: Pageable): List<EventSummary>

    // Admin specific queries (Admin + their users)
    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.customer.id = :adminId OR i.customer.createdBy = :adminId")
    fun countAdminTotalInvitations(adminId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE (i.customer.id = :adminId OR i.customer.createdBy = :adminId) AND i.isEnabled = true AND i.isPaid = true")
    fun countAdminActiveInvitations(adminId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE (i.customer.id = :adminId OR i.customer.createdBy = :adminId) AND i.isPaid = false")
    fun countAdminPendingInvitations(adminId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE (i.customer.id = :adminId OR i.customer.createdBy = :adminId) AND i.date < :currentDate AND i.isEnabled = true")
    fun countAdminPastEvents(adminId: Long, currentDate: String): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE (i.customer.id = :adminId OR i.customer.createdBy = :adminId) AND i.date >= :currentDate AND i.isEnabled = true")
    fun countAdminUpcomingEvents(adminId: Long, currentDate: String): Long

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.InvitationSummary(
            i.id, i.customer.name, i.customer.lastName, i.isPaid, i.createdAt, i.template.eventType.name, i.date,
            i.totalAmount, i.template.invitationPlan.id, i.template.invitationPlan.name
        )
        FROM InvitationEntity i
        WHERE i.customer.id = :adminId OR i.customer.createdBy = :adminId
        ORDER BY i.createdAt DESC
    """)
    fun findAdminRecentInvitations(adminId: Long, pageable: Pageable): List<InvitationSummary>

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.EventSummary(
            i.id, i.template.eventType.name, i.date, i.customer.name, i.customer.lastName
        )
        FROM InvitationEntity i
        WHERE (i.customer.id = :adminId OR i.customer.createdBy = :adminId) AND i.date >= :currentDate AND i.isEnabled = true
        ORDER BY i.date ASC
    """)
    fun findAdminUpcomingEvents(adminId: Long, currentDate: String, pageable: Pageable): List<EventSummary>

    // User specific queries
    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.customer.id = :customerId")
    fun countUserTotalInvitations(customerId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.customer.id = :customerId AND i.isPaid = false")
    fun countUserPendingInvitations(customerId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.customer.id = :customerId AND i.isPaid = true")
    fun countUserPaidInvitations(customerId: Long): Long

    @Query("SELECT COUNT(i) FROM InvitationEntity i WHERE i.customer.id = :customerId AND i.date >= :currentDate")
    fun countUserUpcomingEvents(customerId: Long, currentDate: String): Long

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.InvitationSummary(
            i.id, i.customer.name, i.customer.lastName, i.isPaid, i.createdAt, i.template.eventType.name, i.date,
            i.totalAmount, i.template.invitationPlan.id, i.template.invitationPlan.name
        )
        FROM InvitationEntity i
        WHERE i.customer.id = :customerId
        ORDER BY i.createdAt DESC
    """)
    fun findUserRecentInvitations(customerId: Long, pageable: Pageable): List<InvitationSummary>

    @Query("""
        SELECT new mx.evolutiondev.invitaciones.modules.admin.dashboard.repository.model.EventSummary(
            i.id, i.template.eventType.name, i.date, null, null
        )
        FROM InvitationEntity i
        WHERE i.customer.id = :customerId AND i.date >= :currentDate
        ORDER BY i.date ASC
    """)
    fun findUserUpcomingEvents(customerId: Long, currentDate: String, pageable: Pageable): List<EventSummary>
}
