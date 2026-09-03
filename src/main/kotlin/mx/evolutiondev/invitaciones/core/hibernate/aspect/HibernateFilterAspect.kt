package mx.evolutiondev.invitaciones.core.hibernate.aspect

import jakarta.persistence.EntityManager
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import mx.evolutiondev.invitaciones.core.auth.model.Role
import org.aspectj.lang.JoinPoint
import org.aspectj.lang.annotation.Aspect
import org.aspectj.lang.annotation.Before
import org.hibernate.Session
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component

@Aspect
@Component
class HibernateFilterAspect(
    private val entityManager: EntityManager
) {

    @Before("execution(* org.springframework.data.jpa.repository.JpaRepository+.*(..))")
    fun applyHibernateFilter(joinPoint: JoinPoint) {
        try {
            val session = entityManager.unwrap(Session::class.java)
            val role = getCurrentUserRole()
            val methodName = joinPoint.signature.name

            when (role) {
                Role.USER -> {
                    enableFilter(session)
                }
                Role.ADMIN, Role.MASTER -> {
                    disableFilter(session)
                }
                null -> {
                    enableFilter(session)
                }
            }
        } catch (e: Exception) {
        }
    }

    private fun getCurrentUserRole(): Role? {
        return try {
            val authentication = SecurityContextHolder.getContext().authentication
            
            if (authentication == null || !authentication.isAuthenticated) {
                return null
            }

            val principal = authentication.principal
            if (principal !is CustomerDetails) {
                return null
            }

            val authority = principal.authorities.firstOrNull()?.authority
            if (authority == null) {
                return null
            }
            
            val roleName = authority.split("_").getOrNull(1)?.uppercase()
            if (roleName == null) {
                return null
            }
            
            val role = try {
                Role.valueOf(roleName)
            } catch (e: IllegalArgumentException) {
                null
            }
            
            role
        } catch (e: Exception) {
            null
        }
    }

    private fun enableFilter(session: Session) {
        try {
            session.enableFilter("enabledFilter")
        } catch (e: Exception) {
            throw e
        }
    }

    private fun disableFilter(session: Session) {
        try {
            if (session.getEnabledFilter("enabledFilter") != null) {
                session.disableFilter("enabledFilter")
            }
        } catch (e: Exception) {
            throw e
        }
    }
}
