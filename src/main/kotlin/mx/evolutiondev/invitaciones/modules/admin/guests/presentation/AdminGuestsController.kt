package mx.evolutiondev.invitaciones.modules.admin.guests.presentation

import jakarta.validation.Valid
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.shared.guests.service.GuestExportService
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestFileLoadedResponse
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestResponseItem
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestsCreationRequest
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.mapToResponseItem
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

/**
 * Controller for ADMIN role guest management operations.
 * 
 * Provides ADMIN users the ability to manage guests for invitations belonging to users
 * they have created. All operations validate hierarchical permissions through the
 * InvitationGuestsService which uses HierarchyValidationService.
 * 
 * Note: These endpoints are functionally identical to USER endpoints at /user/invitations/{id}/guests
 * but are provided separately for clear API organization by role.
 */
@RestController
@RequestMapping("/admin/invitations")
class AdminGuestsController(
    private val invitationGuestsService: InvitationGuestsService,
    private val guestExportService: GuestExportService
) {

    @GetMapping("/{id}/guests")
    @ResponseStatus(HttpStatus.OK)
    fun getGuests(
        @PathVariable id: Long,
        @RequestParam(defaultValue = "1") page: Int,
        @RequestParam(required = false) attendanceStatus: String?,
        @RequestParam(required = false) fullName: String?,
        @RequestParam(required = false) phone: String?,
        @RequestParam(required = false) email: String?,
        authentication: Authentication
    ): PaginatedResponse<GuestResponseItem> {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        
        return invitationGuestsService.getGuests(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id,
            attendanceStatus = attendanceStatus,
            fullName = fullName,
            email = email,
            phone = phone,
            page = page
        )
    }

    @GetMapping("/{id}/guests/{guestId}")
    @ResponseStatus(HttpStatus.OK)
    fun getGuest(
        @PathVariable id: Long,
        @PathVariable guestId: Long,
        authentication: Authentication
    ): GuestResponseItem {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        
        return invitationGuestsService.getGuest(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id,
            guestId = guestId
        ).mapToResponseItem()
    }

    @PostMapping("/{id}/guests/append")
    @ResponseStatus(HttpStatus.OK)
    fun appendGuest(
        @PathVariable id: Long,
        @RequestBody request: GuestsCreationRequest,
        authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()
        
        invitationGuestsService.appendGuest(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id,
            request = request
        )

        return GeneralMessageResponse("Invitado agregado correctamente")
    }

    @PutMapping("/{id}/guests/{guestId}/update")
    @ResponseStatus(HttpStatus.OK)
    fun updateGuest(
        @PathVariable id: Long,
        @PathVariable guestId: Long,
        @RequestBody request: GuestsCreationRequest,
        authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        invitationGuestsService.updateGuest(
            userId = loggedInUserId,
            appRole = appRole,
            guestId = guestId,
            invitationId = id,
            request = request
        )

        return GeneralMessageResponse("Invitado actualizado correctamente")
    }

    @DeleteMapping("/{id}/guests/{guestId}")
    @ResponseStatus(HttpStatus.OK)
    fun deleteGuest(
        @PathVariable id: Long,
        @PathVariable guestId: Long,
        authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        invitationGuestsService.deleteGuest(
            userId = loggedInUserId,
            appRole = appRole,
            guestId = guestId
        )

        return GeneralMessageResponse("Invitado eliminado correctamente")
    }

    @PostMapping("/{id}/guests/upload", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    @ResponseStatus(HttpStatus.OK)
    fun uploadGuests(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
        authentication: Authentication
    ): GuestFileLoadedResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        return invitationGuestsService.appendMultipleGuests(
            userId = loggedInUserId,
            invitationId = id,
            appRole = appRole,
            file = file
        )
    }

    @PutMapping("/{id}/guests/{guestId}/cancel-attendance")
    @ResponseStatus(HttpStatus.OK)
    fun cancelAttendance(
        @PathVariable id: Long,
        @PathVariable guestId: Long,
        authentication: Authentication
    ): GeneralMessageResponse {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        invitationGuestsService.cancelAttendanceFromDashboard(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id,
            guestId = guestId
        )

        return GeneralMessageResponse("Asistencia cancelada correctamente")
    }

    @GetMapping("/{id}/guests/download/messages-pdf")
    @ResponseStatus(HttpStatus.OK)
    fun downloadMessagesPdf(
        @PathVariable id: Long,
        authentication: Authentication
    ): ResponseEntity<ByteArrayResource> {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        val pdfBytes = guestExportService.generateCongratulationsPdf(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id
        )

        val resource = ByteArrayResource(pdfBytes)

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"mensajes-felicitacion.pdf\"")
            .header(HttpHeaders.CONTENT_TYPE, "application/pdf")
            .contentLength(pdfBytes.size.toLong())
            .body(resource)
    }

    @GetMapping("/{id}/guests/download/confirmed-xlsx")
    @ResponseStatus(HttpStatus.OK)
    fun downloadConfirmedXlsx(
        @PathVariable id: Long,
        authentication: Authentication
    ): ResponseEntity<ByteArrayResource> {
        val loggedInUserId = authentication.userId()
        val appRole = authentication.role()

        val xlsxBytes = guestExportService.generateConfirmedGuestsXlsx(
            userId = loggedInUserId,
            appRole = appRole,
            invitationId = id
        )

        val resource = ByteArrayResource(xlsxBytes)

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"invitados-confirmados.xlsx\"")
            .header(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .contentLength(xlsxBytes.size.toLong())
            .body(resource)
    }
}

