package mx.evolutiondev.invitaciones.modules.user.profile.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.s3.S3Service
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.service.ProfileService
import mx.evolutiondev.invitaciones.modules.admin.users.service.model.UpdateProfileRequest
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import mx.evolutiondev.invitaciones.modules.user.profile.presentation.ktx.toProfile
import mx.evolutiondev.invitaciones.modules.user.profile.presentation.request.SurveyRequest
import mx.evolutiondev.invitaciones.modules.user.profile.presentation.response.Profile
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/user/profile")
class ProfileController(
        private val customerService: CustomerService,
        private val profileService: ProfileService,
        private val avatarService: AvatarService,
        private val s3Service: S3Service
) {

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun getProfile(
            authentication: Authentication
    ): Profile {
        val loggedInUserId = authentication.userId()
        return customerService.findCustomerById(loggedInUserId).toProfile(avatarService, s3Service)
    }

    @PutMapping
    @ResponseStatus(HttpStatus.OK)
    fun updateProfile(
            authentication: Authentication,
            @RequestBody @Valid request: UpdateProfileRequest
    ): Profile {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        return profileService.updateProfile(loggedInUserId, request, loggedInUserId, appRole).toProfile(avatarService, s3Service)
    }

    @PutMapping("/photo/{avatarId}")
    @ResponseStatus(HttpStatus.OK)
    fun updateProfilePhoto(
            @PathVariable avatarId: Long,
            authentication: Authentication
    ): Profile {
        val loggedInUserId = authentication.userId()
        return profileService.updateProfilePhoto(loggedInUserId, avatarId).toProfile(avatarService, s3Service)
    }

    @PostMapping("/survey")
    @ResponseStatus(HttpStatus.OK)
    fun saveSurvey(
            authentication: Authentication,
            @RequestBody @Valid request: SurveyRequest
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        profileService.saveSurveyAnswer(loggedInUserId, request)
        return GeneralMessageResponse("Encuesta guardada correctamente")
    }
}