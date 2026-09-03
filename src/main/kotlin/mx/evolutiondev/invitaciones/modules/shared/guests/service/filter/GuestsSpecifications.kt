package mx.evolutiondev.invitaciones.modules.shared.guests.service.filter

import jakarta.persistence.criteria.Predicate
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import org.springframework.data.jpa.domain.Specification

object GuestsSpecifications {

    fun prepare(
            appRole: AppRole,
            userId: Long,
            invitationId: Long,
            attendanceStatus: AttendanceStatus?,
            fullName: String?,
            email: String?,
            phone: String?
    ): Specification<InvitationGuestEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()

            predicates += cb.equal(root.get<InvitationGuestEntity>("invitation").get<Long>("id"), invitationId)

            if (appRole == AppRole.USER) {
                predicates += cb.isTrue(root.get("isEnabled"))
            }

            attendanceStatus?.let {
                predicates += cb.equal(root.get<AttendanceStatus>("attendanceStatus"), it)
            }

            fullName?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("fullName"), "%$it%")
            }

            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("email"), "%$it%")
            }

            phone?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("phone"), "%$it%")
            }

            cb.and(*predicates.toTypedArray())
        }
    }

    fun forMaster(
            invitationId: Long?,
            createdByUserId: Long?,
            createdByAdminId: Long?,
            usersCreatedByAdmin: List<Long>,
            attendanceStatus: AttendanceStatus?,
            fullName: String?,
            email: String?,
            phone: String?
    ): Specification<InvitationGuestEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()

            invitationId?.let {
                predicates += cb.equal(root.get<InvitationGuestEntity>("invitation").get<Long>("id"), it)
            }

            createdByUserId?.let {
                predicates += cb.equal(
                    root.get<InvitationGuestEntity>("invitation").get<Any>("customer").get<Long>("id"),
                    it
                )
            }

            createdByAdminId?.let {
                val allowedUserIds = mutableListOf(it).apply { addAll(usersCreatedByAdmin) }
                predicates += root.get<InvitationGuestEntity>("invitation")
                    .get<Any>("customer")
                    .get<Long>("id")
                    .`in`(allowedUserIds)
            }

            attendanceStatus?.let {
                predicates += cb.equal(root.get<AttendanceStatus>("attendanceStatus"), it)
            }

            fullName?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("fullName"), "%$it%")
            }

            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("email"), "%$it%")
            }

            phone?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get("phone"), "%$it%")
            }

            cb.and(*predicates.toTypedArray())
        }
    }
}