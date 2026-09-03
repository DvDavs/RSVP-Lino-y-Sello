package mx.evolutiondev.invitaciones.modules.public.profile.presentation

import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.model.AvatarResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/public/profile/avatars")
class PublicAvatarController(private val avatarService: AvatarService) {

    @GetMapping
    fun listAll(): List<AvatarResponse> {
        return avatarService.listAvatars()
    }
}

