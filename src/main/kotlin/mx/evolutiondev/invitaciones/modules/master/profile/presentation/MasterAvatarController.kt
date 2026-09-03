package mx.evolutiondev.invitaciones.modules.master.profile.presentation

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.model.AvatarResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/master/profile/avatars")
class MasterAvatarController(private val avatarService: AvatarService) {

    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@RequestParam("file") file: MultipartFile): AvatarResponse {
        return avatarService.createAvatar(file)
    }

    @PutMapping("/{id}", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun update(@PathVariable id: Long, @RequestParam("file") file: MultipartFile): AvatarResponse {
        return avatarService.updateAvatar(id, file)
    }

    @DeleteMapping("/{id}")
    fun delete(@PathVariable id: Long): GeneralMessageResponse {
        avatarService.deleteAvatar(id)
        return GeneralMessageResponse("Avatar eliminado correctamente.")
    }
}

