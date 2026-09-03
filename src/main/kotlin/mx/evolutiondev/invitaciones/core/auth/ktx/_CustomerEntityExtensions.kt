package mx.evolutiondev.invitaciones.core.auth.ktx

import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity

fun CustomerEntity.isCustomerAvailable() : Boolean {
    return this.isEnabled && !this.isBanned
}