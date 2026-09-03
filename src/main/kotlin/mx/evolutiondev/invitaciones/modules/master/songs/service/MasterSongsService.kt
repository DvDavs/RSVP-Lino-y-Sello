package mx.evolutiondev.invitaciones.modules.master.songs.service

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.master.eventtypes.repository.EventTypeRepository
import mx.evolutiondev.invitaciones.modules.master.plans.repository.InvitationPlanRepository
import mx.evolutiondev.invitaciones.modules.master.songs.presentation.model.CreateSongRequest
import mx.evolutiondev.invitaciones.modules.master.songs.repository.SongRepository
import mx.evolutiondev.invitaciones.modules.master.songs.repository.model.SongEntity
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service

@Service
class MasterSongsService(
        private val songRepository: SongRepository,
        private val invitationPlanRepository: InvitationPlanRepository,
        private val eventTypeRepository: EventTypeRepository
) {

    fun createSong(request: CreateSongRequest, userId: Long): SongEntity {
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan id proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }

        val event = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El event id proporcionado no es válido") }
        
        if (!event.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }

        return songRepository.save(
                SongEntity(
                        name = request.name,
                        url = request.url,
                        invitationPlan = plan,
                        eventType = event,
                        createdBy = userId
                )
        )
    }

    fun listSongs(planId: Long, eventId: Long): List<SongEntity> {
        return songRepository.findAllByInvitationPlanIdAndEventTypeIdAndIsEnabledTrue(planId, eventId)
    }

    fun listAllSongs(page: Int, planId: Long?, eventId: Long?, isEnable: Boolean?): PaginatedResponse<SongEntity> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }
        
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
        
        val resultPage: Page<SongEntity> = when {
            eventId != null && planId != null && isEnable != null -> 
                songRepository.findAllByEventTypeIdAndInvitationPlanIdAndIsEnabled(eventId, planId, isEnable, pageable)
            eventId != null && isEnable != null -> 
                songRepository.findAllByEventTypeIdAndIsEnabled(eventId, isEnable, pageable)
            planId != null && isEnable != null -> 
                songRepository.findAllByInvitationPlanIdAndIsEnabled(planId, isEnable, pageable)
            eventId != null && planId != null -> 
                songRepository.findAllByEventTypeIdAndInvitationPlanId(eventId, planId, pageable)
            isEnable != null -> 
                songRepository.findAllByIsEnabled(isEnable, pageable)
            eventId != null -> 
                songRepository.findAllByEventTypeId(eventId, pageable)
            planId != null -> 
                songRepository.findAllByInvitationPlanId(planId, pageable)
            else -> 
                songRepository.findAll(pageable)
        }
        
        return PaginatedResponse(
                content = resultPage.content,
                totalPages = resultPage.totalPages,
                pageNumber = resultPage.number + 1
        )
    }

    fun getSongById(id: Long): SongEntity {
        return songRepository.findById(id)
                .orElseThrow { IllegalArgumentException("La canción con ID $id no existe") }
    }

    fun updateSong(id: Long, request: CreateSongRequest, userId: Long): GeneralMessageResponse {
        val song = songRepository.findById(id)
                .orElseThrow { IllegalArgumentException("La canción con ID $id no existe") }
        
        val plan = invitationPlanRepository.findById(request.planId)
                .orElseThrow { IllegalArgumentException("El plan proporcionado no es válido") }
        
        if (!plan.isEnabled) {
            throw IllegalArgumentException("El plan seleccionado está deshabilitado y no puede ser asignado")
        }
        
        val eventType = eventTypeRepository.findById(request.eventId)
                .orElseThrow { IllegalArgumentException("El tipo de evento proporcionado no es válido") }
        
        if (!eventType.isEnabled) {
            throw IllegalArgumentException("El tipo de evento seleccionado está deshabilitado y no puede ser asignado")
        }
        
        song.name = request.name
        song.url = request.url
        song.invitationPlan = plan
        song.eventType = eventType
        song.updatedBy = userId
        
        songRepository.save(song)
        
        return GeneralMessageResponse("Canción actualizada correctamente")
    }

    fun deactivateSong(id: Long, userId: Long): GeneralMessageResponse {
        val song = songRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("La canción con ID $id no existe")
        
        if (!song.isEnabled) {
            return GeneralMessageResponse("La canción ya está desactivada")
        }
        
        song.isEnabled = false
        song.deletedBy = userId
        songRepository.save(song)
        
        return GeneralMessageResponse("Canción desactivada correctamente")
    }

    fun activateSong(id: Long, userId: Long): GeneralMessageResponse {
        val song = songRepository.findByIdEvenIfDisabled(id)
                ?: throw IllegalArgumentException("La canción con ID $id no existe")
        
        if (song.isEnabled) {
            return GeneralMessageResponse("La canción ya está activa")
        }
        
        song.isEnabled = true
        song.updatedBy = userId
        song.deletedBy = null
        songRepository.save(song)
        
        return GeneralMessageResponse("Canción activada correctamente")
    }
}

