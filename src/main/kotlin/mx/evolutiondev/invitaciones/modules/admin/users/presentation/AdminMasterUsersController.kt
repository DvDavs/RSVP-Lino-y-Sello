package mx.evolutiondev.invitaciones.modules.admin.users.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toCustomerList
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.AdministratorRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.AdministratorUpdateRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.UpdatePasswordAdministratorRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.admin.users.service.AdminUsersService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin/administrators/users")
class AdminMasterUsersController(
        private val customerService: CustomerService,
        private val adminUsersService: AdminUsersService,
        private val avatarService: AvatarService,
        private val s3Service: S3Service
) {

    @GetMapping("/all")
    @ResponseStatus(HttpStatus.OK)
    fun listAdministrators(): List<Customer> {
        return customerService.getAdministratorsAndMasters().toCustomerList(avatarService, s3Service)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getAdministratorById(@PathVariable id: Long): Customer {
        return adminUsersService.findUserById(id)
    }

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    fun createAdministrator(
            @Valid @RequestBody request: AdministratorRequest,
            authentication: Authentication
    ): Customer {
        val creatorId = authentication.userId()
        return adminUsersService.createAdministrator(creatorId, request)
    }

    @PutMapping("/{id}/update")
    @ResponseStatus(HttpStatus.OK)
    fun updateAdministrator(
            @PathVariable id: Long,
            @Valid @RequestBody request: AdministratorUpdateRequest,
            authentication: Authentication
    ): Customer {
        val updaterId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.updateAdministrator(id, request, updaterId, appRole)
    }

    @PutMapping("/{id}/password/update")
    @ResponseStatus(HttpStatus.OK)
    fun updatePasswordAdministrator(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdatePasswordAdministratorRequest,
            authentication: Authentication
    ): Customer {
        val updaterId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.updateAdministratorPassword(id, request, updaterId, appRole)
    }


    @DeleteMapping("/{id}/force")
    @ResponseStatus(HttpStatus.OK)
    fun hardDeleteUser(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        adminUsersService.hardDeleteUser(id, loggedInUserId)
        return GeneralMessageResponse("Usuario eliminado permanentemente.")
    }
}