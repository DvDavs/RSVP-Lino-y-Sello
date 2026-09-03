package mx.evolutiondev.invitaciones.modules.master.songs.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.master.songs.presentation.model.CreateSongRequest
import mx.evolutiondev.invitaciones.modules.master.songs.repository.model.SongEntity
import mx.evolutiondev.invitaciones.modules.master.songs.service.MasterSongsService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master/songs")
@Validated
class MasterSongsController(
        private val masterSongsService: MasterSongsService
) {

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    fun createSong(
            @Valid @RequestBody request: CreateSongRequest,
            authentication: Authentication
    ): SongEntity {
        val userId = authentication.userId()
        return masterSongsService.createSong(request, userId)
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    fun listAllSongs(
            @RequestParam(required = false) planId: Long?,
            @RequestParam(required = false) eventId: Long?,
            @RequestParam(required = false) isEnable: Boolean?,
            @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<SongEntity> {
        return masterSongsService.listAllSongs(page, planId, eventId, isEnable)
    }

    @GetMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun getSongById(
            @PathVariable id: Long
    ): SongEntity {
        return masterSongsService.getSongById(id)
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun updateSong(
            @PathVariable id: Long,
            @Valid @RequestBody request: CreateSongRequest,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterSongsService.updateSong(id, request, userId)
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    fun deactivateSong(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterSongsService.deactivateSong(id, userId)
    }

    @PatchMapping("/{id}/activate")
    @ResponseStatus(HttpStatus.OK)
    fun activateSong(
            @PathVariable id: Long,
            authentication: Authentication
    ): GeneralMessageResponse {
        val userId = authentication.userId()
        return masterSongsService.activateSong(id, userId)
    }
}

