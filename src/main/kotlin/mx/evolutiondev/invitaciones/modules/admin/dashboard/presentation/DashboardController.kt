package mx.evolutiondev.invitaciones.modules.admin.dashboard.presentation

import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import mx.evolutiondev.invitaciones.modules.admin.dashboard.model.DashboardResponse
import mx.evolutiondev.invitaciones.modules.admin.dashboard.service.DashboardService
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/admin/dashboard")
class DashboardController(
    private val dashboardService: DashboardService
) {

    @GetMapping
    fun getDashboardData(authentication: Authentication): ResponseEntity<DashboardResponse> {
        val userDetails = authentication.principal as CustomerDetails
        val role = userDetails.authorities.first().authority.replace("ROLE_", "")

        return if (role == "ADMIN" || role == "MASTER") {
            ResponseEntity.ok(dashboardService.getAdminDashboardData(userDetails.id, role))
        } else {
            ResponseEntity.ok(dashboardService.getUserDashboardData(userDetails.id))
        }
    }
}
