package mx.evolutiondev.invitaciones.modules.admin.invitations.repository

import jakarta.persistence.criteria.Predicate
import jakarta.persistence.criteria.JoinType
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.master.templates.repository.model.InvitationTemplateEntity
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.model.EventTypeEntity
import org.springframework.data.jpa.domain.Specification
import java.time.Instant

object InvitationSpecifications {

    fun prepare(email: String?, startDate: Instant?, endDate: Instant?): Specification<InvitationEntity> {
        return Specification { root, _, cb ->

            val predicates = mutableListOf<Predicate>()

            predicates += cb.isFalse(root.get("isPaid"))

            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get<InvitationEntity>("customer").get("email"), "%$it%")
            }

            startDate?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }

            endDate?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }

            cb.and(*predicates.toTypedArray())
        }
    }

    fun forAdmin(adminId: Long, usersCreatedByAdmin: List<Long>): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            val allowedCreatorIds = mutableListOf(adminId).apply { addAll(usersCreatedByAdmin) }
            
            val accessPredicate = cb.or(
                root.get<Long>("createdBy").`in`(allowedCreatorIds),
                cb.equal(root.get<CustomerEntity>("customer").get<Long>("createdBy"), adminId)
            )
            predicates += accessPredicate
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forUser(userId: Long): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.equal(root.get<CustomerEntity>("customer").get<Long>("id"), userId)
            
            predicates += cb.equal(root.get<Boolean>("isEnabled"), true)
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forMasterWithAdminFilter(adminId: Long, usersCreatedByAdmin: List<Long>): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            val allowedCreatorIds = mutableListOf(adminId).apply { addAll(usersCreatedByAdmin) }
            
            // Invitaciones creadas por el admin o sus usuarios, O cuyo customer fue creado por el admin
            val accessPredicate = cb.or(
                root.get<Long>("createdBy").`in`(allowedCreatorIds),
                cb.equal(root.get<CustomerEntity>("customer").get<Long>("createdBy"), adminId)
            )
            predicates += accessPredicate
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forMasterWithUserFilter(userId: Long): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.equal(root.get<Long>("createdBy"), userId)
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forMasterWithoutFilters(): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            cb.conjunction()
        }
    }

    fun unpaidForAdmin(adminId: Long, usersCreatedByAdmin: List<Long>, email: String?, startDate: Instant?, endDate: Instant?): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.isFalse(root.get("isPaid"))
            
            val allowedCreatorIds = mutableListOf(adminId).apply { addAll(usersCreatedByAdmin) }
            
            // Invitaciones creadas por el admin o sus usuarios, O cuyo customer fue creado por el admin
            val accessPredicate = cb.or(
                root.get<Long>("createdBy").`in`(allowedCreatorIds),
                cb.equal(root.get<CustomerEntity>("customer").get<Long>("createdBy"), adminId)
            )
            predicates += accessPredicate
            
            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get<InvitationEntity>("customer").get("email"), "%$it%")
            }
            
            startDate?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            endDate?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun unpaidForUser(userId: Long, email: String?, startDate: Instant?, endDate: Instant?): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.isFalse(root.get("isPaid"))
            
            predicates += cb.equal(root.get<CustomerEntity>("customer").get<Long>("id"), userId)
            
            predicates += cb.equal(root.get<Boolean>("isEnabled"), true)
            
            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get<InvitationEntity>("customer").get("email"), "%$it%")
            }
            
            startDate?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            endDate?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun unpaidForMaster(email: String?, startDate: Instant?, endDate: Instant?): Specification<InvitationEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.isFalse(root.get("isPaid"))
            
            email?.takeIf { it.isNotBlank() }?.let {
                predicates += cb.like(root.get<InvitationEntity>("customer").get("email"), "%$it%")
            }
            
            startDate?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            endDate?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forMasterWithFilters(
        creatorIds: List<Long>?,
        searchText: String?,
        isPaid: Boolean?,
        status: String,
        createdDateFrom: Instant?,
        createdDateTo: Instant?,
        eventDateFrom: String?,
        eventDateTo: String?
    ): Specification<InvitationEntity> {
        return Specification { root, query, cb ->
            val predicates = mutableListOf<Predicate>()
            
            creatorIds?.takeIf { it.isNotEmpty() }?.let {
                predicates += root.get<Long>("createdBy").`in`(it)
            }
            
            searchText?.takeIf { it.isNotBlank() }?.let { search ->
                val customerJoin = root.join<InvitationEntity, CustomerEntity>("customer", JoinType.LEFT)
                val templateJoin = root.join<InvitationEntity, InvitationTemplateEntity>("template", JoinType.LEFT)
                val eventTypeJoin = templateJoin.join<InvitationTemplateEntity, EventTypeEntity>("eventType", JoinType.LEFT)
                
                val searchPattern = "%${search.lowercase()}%"
                val searchPredicates = cb.or(
                    cb.like(cb.lower(customerJoin.get("name")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("lastName")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("email")), searchPattern),
                    cb.like(cb.lower(templateJoin.get("name")), searchPattern),
                    cb.like(cb.lower(eventTypeJoin.get("name")), searchPattern)
                )
                predicates += searchPredicates
            }
            
            isPaid?.let {
                predicates += cb.equal(root.get<Boolean>("isPaid"), it)
            }
            
            when (status.uppercase()) {
                "INACTIVE" -> predicates += cb.isFalse(root.get("isEnabled"))
                "ALL" -> { }
                else -> predicates += cb.isTrue(root.get("isEnabled"))
            }
            
            createdDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            createdDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            eventDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("date"), it)
            }
            
            eventDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("date"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forAdminWithFilters(
        adminId: Long,
        creatorIds: List<Long>,
        searchText: String?,
        isPaid: Boolean?,
        status: String,
        createdDateFrom: Instant?,
        createdDateTo: Instant?,
        eventDateFrom: String?,
        eventDateTo: String?
    ): Specification<InvitationEntity> {
        return Specification { root, query, cb ->
            val predicates = mutableListOf<Predicate>()
            
            val accessPredicate = cb.or(
                root.get<Long>("createdBy").`in`(creatorIds),
                cb.equal(root.get<CustomerEntity>("customer").get<Long>("createdBy"), adminId)
            )
            predicates += accessPredicate
            
            searchText?.takeIf { it.isNotBlank() }?.let { search ->
                val customerJoin = root.join<InvitationEntity, CustomerEntity>("customer", JoinType.LEFT)
                val templateJoin = root.join<InvitationEntity, InvitationTemplateEntity>("template", JoinType.LEFT)
                val eventTypeJoin = templateJoin.join<InvitationTemplateEntity, EventTypeEntity>("eventType", JoinType.LEFT)
                
                val searchPattern = "%${search.lowercase()}%"
                val searchPredicates = cb.or(
                    cb.like(cb.lower(customerJoin.get("name")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("lastName")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("email")), searchPattern),
                    cb.like(cb.lower(templateJoin.get("name")), searchPattern),
                    cb.like(cb.lower(eventTypeJoin.get("name")), searchPattern)
                )
                predicates += searchPredicates
            }
            
            isPaid?.let {
                predicates += cb.equal(root.get<Boolean>("isPaid"), it)
            }
            
            when (status.uppercase()) {
                "INACTIVE" -> predicates += cb.isFalse(root.get("isEnabled"))
                "ALL" -> { }
                else -> predicates += cb.isTrue(root.get("isEnabled"))
            }
            
            createdDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            createdDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            eventDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("date"), it)
            }
            
            eventDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("date"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }

    fun forUserWithFilters(
        userId: Long,
        searchText: String?,
        isPaid: Boolean?,
        status: String,
        createdDateFrom: Instant?,
        createdDateTo: Instant?,
        eventDateFrom: String?,
        eventDateTo: String?
    ): Specification<InvitationEntity> {
        return Specification { root, query, cb ->
            val predicates = mutableListOf<Predicate>()
            
            predicates += cb.equal(root.get<CustomerEntity>("customer").get<Long>("id"), userId)
            
            when (status.uppercase()) {
                "INACTIVE" -> predicates += cb.isFalse(root.get("isEnabled"))
                "ALL" -> { }
                else -> predicates += cb.isTrue(root.get("isEnabled"))
            }
            
            searchText?.takeIf { it.isNotBlank() }?.let { search ->
                val customerJoin = root.join<InvitationEntity, CustomerEntity>("customer", JoinType.LEFT)
                val templateJoin = root.join<InvitationEntity, InvitationTemplateEntity>("template", JoinType.LEFT)
                val eventTypeJoin = templateJoin.join<InvitationTemplateEntity, EventTypeEntity>("eventType", JoinType.LEFT)
                
                val searchPattern = "%${search.lowercase()}%"
                val searchPredicates = cb.or(
                    cb.like(cb.lower(customerJoin.get("name")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("lastName")), searchPattern),
                    cb.like(cb.lower(customerJoin.get("email")), searchPattern),
                    cb.like(cb.lower(templateJoin.get("name")), searchPattern),
                    cb.like(cb.lower(eventTypeJoin.get("name")), searchPattern)
                )
                predicates += searchPredicates
            }
            
            isPaid?.let {
                predicates += cb.equal(root.get<Boolean>("isPaid"), it)
            }
            
            createdDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("createdAt"), it)
            }
            
            createdDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("createdAt"), it)
            }
            
            eventDateFrom?.let {
                predicates += cb.greaterThanOrEqualTo(root.get("date"), it)
            }
            
            eventDateTo?.let {
                predicates += cb.lessThanOrEqualTo(root.get("date"), it)
            }
            
            cb.and(*predicates.toTypedArray())
        }
    }
}
