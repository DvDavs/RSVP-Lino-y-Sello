package mx.evolutiondev.invitaciones.modules.admin.users.service.filter

import jakarta.persistence.criteria.Predicate
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import org.springframework.data.jpa.domain.Specification

object CustomerSpecifications {

    /**
     * Creates a filtering specification for customers based on multiple optional criteria.
     * 
     * @param createdByAdminId Filter by creator admin ID (optional)
     * @param role Filter by role: USER, ADMIN, MASTER (optional)
     * @param status Filter by status: "ACTIVE", "DELETED", "ALL" (defaults to "ACTIVE")
     * @return Specification that can be used with CustomerRepository
     */
    fun filterUsers(
        createdByAdminId: Long?,
        role: String?,
        status: String?
    ): Specification<CustomerEntity> {
        return Specification { root, _, cb ->
            val predicates = mutableListOf<Predicate>()

            createdByAdminId?.let {
                predicates += cb.equal(root.get<Long>("createdBy"), it)
            }

            role?.takeIf { it.isNotBlank() }?.let {
                try {
                    val roleEnum = Role.valueOf(it.uppercase())
                    predicates += cb.equal(root.get<Role>("role"), roleEnum)
                } catch (e: IllegalArgumentException) {
                    predicates += cb.disjunction()
                }
            }

            when (status?.uppercase()) {
                "ACTIVE", null -> {
                    predicates += cb.isTrue(root.get("isEnabled"))
                }
                "DELETED" -> {
                    predicates += cb.isFalse(root.get("isEnabled"))
                }
                "ALL" -> {
                }
            }

            cb.and(*predicates.toTypedArray())
        }
    }

    fun ignoreRestriction(): Specification<CustomerEntity> {
        return Specification { root, query, cb ->
            query?.distinct(true)
            cb.conjunction()
        }
    }
}

