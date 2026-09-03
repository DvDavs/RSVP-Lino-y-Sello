package mx.evolutiondev.invitaciones.modules.master.guests.presentation

import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.shared.guests.service.GuestExportService
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.userId
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.role
import mx.evolutiondev.invitaciones.modules.shared.guests.service.InvitationGuestsService
import org.springframework.core.io.ByteArrayResource
import org.springframework.http.HttpHeaders
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestResponseItem
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/master")
class MasterGuestsController(
    private val invitationGuestsService: InvitationGuestsService,
    private val guestExportService: GuestExportService
) {

    @GetMapping("/guests")
    @ResponseStatus(HttpStatus.OK)
    fun getAllGuests(
        @RequestParam(required = false) invitationId: Long?,
        @RequestParam(required = false) createdByUserId: Long?,
        @RequestParam(required = false) createdByAdminId: Long?,
        @RequestParam(required = false) attendanceStatus: String?,
        @RequestParam(required = false) fullName: String?,
        @RequestParam(required = false) email: String?,
        @RequestParam(required = false) phone: String?,
        @RequestParam(defaultValue = "1") page: Int
    ): PaginatedResponse<GuestResponseItem> {
        return invitationGuestsService.getAllGuestsForMaster(
            invitationId = invitationId,
            createdByUserId = createdByUserId,
            createdByAdminId = createdByAdminId,
            attendanceStatus = attendanceStatus,
            fullName = fullName,
            email = email,
            phone = phone,
            page = page
        )
    }

    @DeleteMapping("/guests/{guestId}/force")
    @ResponseStatus(HttpStatus.OK)
    fun hardDeleteGuest(
        @PathVariable guestId: Long
    ): GeneralMessageResponse {
        invitationGuestsService.hardDeleteGuest(guestId)
        return GeneralMessageResponse("Invitado eliminado permanentemente de la base de datos.")
    }

    @PutMapping("/invitations/{id}/guests/{guestId}/cancel-attendance")
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

    @GetMapping("/invitations/{id}/guests/download/messages-pdf")
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

    @GetMapping("/invitations/{id}/guests/download/confirmed-xlsx")
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
