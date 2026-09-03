package mx.evolutiondev.invitaciones.modules.admin.users.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toCustomer
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toUserRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.CreateUserRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.AdministratorUpdateRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.UpdatePasswordAdministratorRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.admin.users.service.AdminUsersService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/admin/users")
class AdminUsersController(
        private val customerService: CustomerService,
        private val adminUsersService: AdminUsersService
) {

    @PostMapping("/create")
    @ResponseStatus(HttpStatus.OK)
    fun createUser(
            @Valid @RequestBody request: CreateUserRequest,
            authentication: Authentication
    ): Customer {
        val creatorId = authentication.userId()
        val userRequest = request.toUserRequest()
        val createdUser = customerService.createUserByAdmin(creatorId, userRequest)
        return createdUser.toCustomer()
    }

    @GetMapping("/my-users")
    @ResponseStatus(HttpStatus.OK)
    fun getMyUsers(
        @RequestParam(defaultValue = "1") page: Int,
        authentication: Authentication
    ): PaginatedResponse<Customer> {
        val adminId = authentication.userId()
        return adminUsersService.getUsersCreatedByAdmin(adminId, page)
    }

    
    @PutMapping("/{id}/ban")
    @ResponseStatus(HttpStatus.OK)
    fun banUser(
            @PathVariable id: Long,
            authentication: Authentication
    ): Customer {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.banUser(
                userId = id,
                loggedInUserId = loggedInUserId,
                appRole = appRole
        )
    }

    @PutMapping("/{id}/unban")
    @ResponseStatus(HttpStatus.OK)
    fun unbanUser(
            @PathVariable id: Long,
            authentication: Authentication
    ): Customer {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.unbanUser(
                userId = id,
                loggedInUserId = loggedInUserId,
                appRole = appRole
        )
    }

    @DeleteMapping("/{id}/delete")
    @ResponseStatus(HttpStatus.OK)
    fun deleteUser(
            @PathVariable id: Long,
            authentication: Authentication
    ): Customer {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.removeUser(
                userId = id,
                loggedInUserId = loggedInUserId,
                appRole = appRole
        )
    }

    @PostMapping("/{id}/re-activate")
    @ResponseStatus(HttpStatus.OK)
    fun reactivateUser(
            @PathVariable id: Long,
            authentication: Authentication
    ): Customer {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.reactivateUser(
                userId = id,
                loggedInUserId = loggedInUserId,
                appRole = appRole
        )
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getUserById(
        @PathVariable id: Long,
        authentication: Authentication
    ): Customer {
        val requesterId = authentication.userId()
        return adminUsersService.getUserByIdForAdmin(requesterId, id)
    }

    @PutMapping("/{id}/update")
    @ResponseStatus(HttpStatus.OK)
    fun updateUser(
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
    fun updatePasswordUser(
            @PathVariable id: Long,
            @Valid @RequestBody request: UpdatePasswordAdministratorRequest,
            authentication: Authentication
    ): Customer {
        val updaterId = authentication.userId()
        val appRole = authentication.role()
        return adminUsersService.updateAdministratorPassword(id, request, updaterId, appRole)
    }
}