package mx.evolutiondev.invitaciones.modules.shared.guests.service

import com.lowagie.text.*
import com.lowagie.text.pdf.PdfPCell
import com.lowagie.text.pdf.PdfPTable
import com.lowagie.text.pdf.PdfWriter
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.xssf.usermodel.XSSFWorkbook
import org.springframework.stereotype.Service
import java.awt.Color
import java.io.ByteArrayOutputStream

@Service
class GuestExportService(
        private val invitationGuestsRepository: InvitationGuestsRepository,
        private val invitationRepository: InvitationRepository,
        private val hierarchyValidationService: HierarchyValidationService
) {

    fun generateCongratulationsPdf(
            userId: Long,
            appRole: AppRole,
            invitationId: Long
    ): ByteArray {
        validateInvitationAccess(userId, appRole, invitationId)

        val guests = invitationGuestsRepository
                .findByInvitationIdAndIsEnabledTrue(invitationId)
                .filter { !it.congratulationsMessage.isNullOrBlank() }

        val outputStream = ByteArrayOutputStream()
        val document = Document(PageSize.A4, 36f, 36f, 54f, 36f)
        val writer = PdfWriter.getInstance(document, outputStream)

        document.open()

        val titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18f, Color.BLACK)
        val title = Paragraph("Mensajes de Felicitación", titleFont)
        title.alignment = Element.ALIGN_CENTER
        document.add(title)
        document.add(Paragraph(" "))

        if (guests.isEmpty()) {
            val noDataFont = FontFactory.getFont(FontFactory.HELVETICA, 12f, Color.GRAY)
            val noData = Paragraph("No hay mensajes de felicitación registrados.", noDataFont)
            noData.alignment = Element.ALIGN_CENTER
            document.add(noData)
        } else {
            val table = PdfPTable(2)
            table.widthPercentage = 100f
            table.setWidths(floatArrayOf(1f, 3f))

            val headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12f, Color.WHITE)
            val headerBackground = Color(52, 73, 94)

            val nameHeader = PdfPCell(Phrase("Nombre del Invitado", headerFont))
            nameHeader.backgroundColor = headerBackground
            nameHeader.setPadding(8f)
            table.addCell(nameHeader)

            val messageHeader = PdfPCell(Phrase("Mensaje", headerFont))
            messageHeader.backgroundColor = headerBackground
            messageHeader.setPadding(8f)
            table.addCell(messageHeader)

            val cellFont = FontFactory.getFont(FontFactory.HELVETICA, 10f, Color.BLACK)
            guests.forEach { guest ->
                val nameCell = PdfPCell(Phrase(guest.fullName ?: "Sin nombre", cellFont))
                nameCell.setPadding(6f)
                table.addCell(nameCell)

                val messageCell = PdfPCell(Phrase(guest.congratulationsMessage ?: "", cellFont))
                messageCell.setPadding(6f)
                table.addCell(messageCell)
            }

            document.add(table)
        }

        document.close()
        writer.close()

        return outputStream.toByteArray()
    }

    fun generateConfirmedGuestsXlsx(
            userId: Long,
            appRole: AppRole,
            invitationId: Long
    ): ByteArray {
        validateInvitationAccess(userId, appRole, invitationId)

        val guests = invitationGuestsRepository.findByInvitationIdAndIsEnabledTrue(invitationId)

        val workbook = XSSFWorkbook()
        val sheet = workbook.createSheet("Invitados Confirmados")

        val headerRow = sheet.createRow(0)
        val headerStyle = workbook.createCellStyle()
        val font = workbook.createFont()
        font.bold = true
        headerStyle.setFont(font)

        val headers = listOf(
                "Nombre",
                "Nombre del Gradudado",
                "Correo",
                "Teléfono",
                "Adultos Confirmados",
                "Niños Confirmados",
                "Jóvenes Confirmados",
                "Número de Mesa",
                "Estado de Asistencia"
        )

        headers.forEachIndexed { index, header ->
            val cell = headerRow.createCell(index)
            cell.setCellValue(header)
            cell.cellStyle = headerStyle
        }

        guests.forEachIndexed { index, guest ->
            val row = sheet.createRow(index + 1)

            row.createCell(0).setCellValue(guest.fullName ?: "")
            row.createCell(1).setCellValue(guest.graduatesName ?: "")
            row.createCell(2).setCellValue(guest.email ?: "")
            row.createCell(3).setCellValue(guest.phone ?: "")
            row.createCell(4).setCellValue(guest.adultsCountConfirmed.toDouble())
            row.createCell(5).setCellValue(guest.childrenCountConfirmed.toDouble())
            row.createCell(6).setCellValue(guest.youngCountConfirmed.toDouble())
            
            val tableNumberCell = row.createCell(7)
            if (guest.tableNumber != null) {
                tableNumberCell.setCellValue(guest.tableNumber.toDouble())
            } else {
                tableNumberCell.setCellValue("-")
            }
            

            val attendanceStatusText = when (guest.attendanceStatus) {
                AttendanceStatus.CONFIRMED -> "Confirmado"
                AttendanceStatus.DECLINED -> "Declinado"
                AttendanceStatus.PENDING -> "Pendiente"
            }
            row.createCell(8).setCellValue(attendanceStatusText)
        }

        sheet.setColumnWidth(0, 6000)
        sheet.setColumnWidth(1, 6000)
        sheet.setColumnWidth(2, 8000)
        sheet.setColumnWidth(3, 4000)
        sheet.setColumnWidth(4, 4500)
        sheet.setColumnWidth(5, 4500)
        sheet.setColumnWidth(6, 4500)
        sheet.setColumnWidth(7, 3500)
        sheet.setColumnWidth(8, 5000)


        val outputStream = ByteArrayOutputStream()
        workbook.write(outputStream)
        workbook.close()

        return outputStream.toByteArray()
    }

    private fun validateInvitationAccess(userId: Long, appRole: AppRole, invitationId: Long) {
        val invitation = invitationRepository.findById(invitationId)
                .orElseThrow { IllegalArgumentException("La invitación no existe") }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw IllegalArgumentException("No tienes permisos para acceder a esta invitación")
        }

        if (appRole == AppRole.USER && !invitation.isEnabled) {
            throw IllegalArgumentException("La invitación no existe")
        }
    }
}

