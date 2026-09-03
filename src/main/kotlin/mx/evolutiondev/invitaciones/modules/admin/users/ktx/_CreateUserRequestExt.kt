package mx.evolutiondev.invitaciones.modules.admin.users.ktx

import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.CreateUserRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest

fun CreateUserRequest.toUserRequest(): UserRequest {
    return UserRequest(
        name = this.name,
        lastName = this.lastName,
        email = this.email,
        phone = this.phone,
        birthdate = this.birthdate,
        address = this.address,
        city = this.city,
        postalCode = this.postalCode,
        state = this.state,
        howKnow = this.howKnow,
        password = this.password
    )
}
