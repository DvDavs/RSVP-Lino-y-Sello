package mx.evolutiondev.invitaciones.modules.user.invitations.service.ktx

import mx.evolutiondev.invitaciones.modules.user.invitations.service.model.MusicRequest

fun MusicRequest.addOrThrow(): Boolean {
    if (enabled && type.isNullOrEmpty() && url.isNullOrEmpty()) {
        throw IllegalArgumentException("Si las canciones están habilitadas debes proporcionar el type y la url")
    } else {
        return enabled
    }
}
