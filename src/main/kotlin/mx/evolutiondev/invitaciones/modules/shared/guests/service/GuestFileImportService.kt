package mx.evolutiondev.invitaciones.modules.shared.guests.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.InvalidFileFormatException
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.GuestFileLoadedResponse
import org.apache.poi.ss.usermodel.CellType
import org.apache.poi.ss.usermodel.WorkbookFactory
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.InputStream

@Service
class GuestFileImportService(
        private val invitationGuestsRepository: InvitationGuestsRepository,
        private val jwtUtil: JwtUtil,
        private val emailGuestNotifier: mx.evolutiondev.invitaciones.modules.shared.guests.notifier.EmailGuestNotifier
) {

    private val expectedHeaders = listOf(
            "nombre completo",
            "nombre del graduado",
            "teléfono",
            "correo electrónico",
            "adultos",
            "jovenes",
            "niños"
    )

    /**
     * Import guests from a CSV or XLSX file.
     * 
     * @param invitation The invitation to add guests to
     * @param file The CSV or XLSX file containing guest data
     * @param userId The ID of the user performing the import
     * @param appRole The role of the user performing the import
     * @return Response containing success message and any duplicate records found
     */
    fun importGuestsFromFile(
            invitation: InvitationEntity,
            file: MultipartFile,
            userId: Long,
            appRole: AppRole
    ): GuestFileLoadedResponse {
        val lines = parseAndValidateFile(file)
        val hasTableNumber = detectTableNumberColumn(lines.first())
        val hasGraduatesName = detectGraduatesNameColumn(lines.first())
        
        val validGuests = mutableListOf<InvitationGuestEntity>()
        val rejectedRecords = mutableListOf<mx.evolutiondev.invitaciones.modules.shared.guests.service.model.RejectedRecord>()
        
        lines
                .drop(1)
                .filter { it.isNotBlank() }
                .forEachIndexed { index, line ->
                    try {
                        val guest = parseGuestFromLine(line, index, invitation, hasGraduatesName, hasTableNumber, userId, appRole)
                        validGuests.add(guest)
                    } catch (e: InvalidFileFormatException) {
                        val parts = line.split(",").map { it.trim() }
                        val fullName = parts.getOrNull(0)?.takeIf { it.isNotBlank() }
                        
                        rejectedRecords.add(
                            mx.evolutiondev.invitaciones.modules.shared.guests.service.model.RejectedRecord(
                                rowNumber = index + 2,
                                fullName = fullName,
                                reason = e.message ?: "Error de validación desconocido"
                            )
                        )
                    }
                }

        validateDuplicatesInFile(validGuests)
        val (newGuests, duplicatedRecords) = filterDatabaseDuplicates(validGuests, invitation.id)

        val savedGuests = invitationGuestsRepository.saveAll(newGuests)

        savedGuests
            .filter { !it.email.isNullOrBlank() }
            .forEach { guest ->
                emailGuestNotifier.notifySingle(guest)
            }

        val loadedCount = newGuests.size
        val totalRejectedCount = rejectedRecords.size + duplicatedRecords.size

        return GuestFileLoadedResponse(
                message = when {
                    totalRejectedCount == 0 -> "Todos los invitados (${loadedCount}) se han cargado correctamente."
                    loadedCount == 0 -> "No se pudo cargar ningún registro. ${totalRejectedCount} registros fueron rechazados."
                    else -> "${loadedCount} invitados cargados correctamente. ${totalRejectedCount} registros rechazados."
                },
                hasDuplicated = duplicatedRecords.isNotEmpty(),
                duplicatedRecords = duplicatedRecords,
                hasRejected = rejectedRecords.isNotEmpty(),
                rejectedRecords = rejectedRecords,
                loadedCount = loadedCount,
                rejectedCount = totalRejectedCount
        )
    }

    /**
     * Parse and validate the file format, returning the lines.
     * Handles different encodings (UTF-8, Windows-1252, ISO-8859-1).
     */
    private fun parseAndValidateFile(file: MultipartFile): List<String> {
        if (file.isEmpty) {
            throw InvalidFileFormatException("Debes subir un archivo válido.")
        }

        val filename = file.originalFilename.orEmpty()
        val isXlsx = filename.endsWith(".xlsx") || filename.endsWith(".xls")
        val isCsv = filename.endsWith(".csv")

        if (!isXlsx && !isCsv) {
            throw InvalidFileFormatException("Debes subir un archivo .csv o .xlsx válido.")
        }

        val inputStream: InputStream = if (isXlsx) {
            convertXlsxToCsv(file)
        } else {
            file.inputStream
        }

        val lines = readLinesWithEncodingDetection(inputStream)

        if (lines.isEmpty()) {
            throw InvalidFileFormatException("El archivo está vacío.")
        }

        validateHeaders(lines.first())

        if (lines.size <= 1) {
            throw InvalidFileFormatException("El archivo no contiene registros de invitados.")
        }

        return lines
    }
    
    /**
     * Read lines from InputStream trying different encodings.
     * Excel exports CSV in different encodings depending on the system locale.
     */
    private fun readLinesWithEncodingDetection(inputStream: InputStream): List<String> {
        val bytes = inputStream.readBytes()
        
        try {
            val utf8Text = String(bytes, Charsets.UTF_8)
            if (!utf8Text.contains('\uFFFD')) {
                return utf8Text.lines()
            }
        } catch (e: Exception) {
        }
        
        try {
            val windows1252 = charset("Windows-1252")
            return String(bytes, windows1252).lines()
        } catch (e: Exception) {
        }
        
        try {
            return String(bytes, Charsets.ISO_8859_1).lines()
        } catch (e: Exception) {
            return String(bytes, Charsets.UTF_8).lines()
        }
    }

    /**
     * Validate that the file headers are correct.
     */
    private fun validateHeaders(headerLine: String) {
        val header = headerLine.split(",").map { it.trim().lowercase() }
         val expectedHeadersWithTable = expectedHeaders + "número de mesa"
        val isValidHeader = header == expectedHeaders || header == expectedHeadersWithTable

        if (!isValidHeader) {
            throw InvalidFileFormatException(
                    "El encabezado del archivo no es válido. Se esperaban: $expectedHeaders " +
                            "o con columna opcional: $expectedHeadersWithTable"
            )
        }
    }

    private fun detectTableNumberColumn(headerLine: String): Boolean {
        val header = headerLine.split(",").map { it.trim().lowercase() }
        return header.contains("número de mesa")
    }

    private fun detectGraduatesNameColumn(headerLine: String): Boolean {
        val header = headerLine.split(",").map { it.trim().lowercase() }
        return header.contains("nombre del graduado")
    }

    private fun parseGuestFromLine(
            line: String,
            index: Int,
            invitation: InvitationEntity,
            hasGraduatesName: Boolean,
            hasTableNumber: Boolean,
            userId: Long,
            appRole: AppRole
    ): InvitationGuestEntity {
        val parts = line.split(",").map { it.trim() }
        val expectedColumnCount = if (hasTableNumber) 8 else 7
        
        if (parts.size < 6) {
            throw InvalidFileFormatException(
                    "No tiene suficientes columnas. Se esperan al menos 6"
            )
        }

        val paddedParts = if (parts.size < expectedColumnCount) {
            parts + List(expectedColumnCount - parts.size) { "" }
        } else {
            parts
        }

        val fullName = paddedParts.getOrNull(0)?.takeIf { it.isNotBlank() }
        // val phone = paddedParts.getOrNull(1)?.takeIf { it.isNotBlank() }
        //     ?: throw InvalidFileFormatException("El teléfono es obligatorio")
        val graduatesName = if (hasGraduatesName) paddedParts.getOrNull(1)?.takeIf { it.isNotBlank() } else null
        val phone = paddedParts.getOrNull(2)?.takeIf { it.isNotBlank() }
        val email = paddedParts.getOrNull(3)?.takeIf { it.isNotBlank() }
        val adults = paddedParts.getOrNull(4)?.toIntOrNull() ?: 0
        val young = paddedParts.getOrNull(5)?.toIntOrNull()
        val children = paddedParts.getOrNull(6)?.toIntOrNull()
        val tableNumber = if (hasTableNumber) paddedParts.getOrNull(7)?.toIntOrNull() else null

        if (fullName == null) {
            throw InvalidFileFormatException(
                    "El nombre completo es obligatorio"
            )
        }

        validateGuestData(email, phone, adults, young, children, graduatesName, hasGraduatesName, tableNumber, hasTableNumber, index, invitation)

        val token = jwtUtil.generateInvitationSecureToken()

        return InvitationGuestEntity(
                invitation = invitation,
                fullName = fullName,
                graduatesName = graduatesName,
                phone = phone,
                email = email,
                adultsCount = adults,
                childrenCount = children ?: 0,
                youngCount = young ?: 0,
                tableNumber = tableNumber,
                confirmationToken = token,
                createdBy = if (appRole == AppRole.USER) null else userId,
                updatedBy = if (appRole == AppRole.USER) null else userId
        )
    }

    private fun validateGuestData(
            email: String?,
            phone: String?,
            adults: Int,
            young: Int?,
            children: Int?,
            graduatesName:  String?,
            hasGraduatesName: Boolean,
            tableNumber: Int?,
            hasTableNumber: Boolean,
            rowIndex: Int,
            invitation: InvitationEntity
    ) {
        val youngCount = young ?: 0
        val childrenCount = children ?: 0

        if (email != null && !email.isNotBlank()) {
            val emailRegex = "^[a-zA-Z0-9_+&*-]+(?:\\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,7}$".toRegex()
            if (!email.matches(emailRegex)) {
                throw InvalidFileFormatException(
                        "Correo electrónico inválido: '$email'"
                )
            }
        }
        
        // val phoneRegex = "^\\d{10}$".toRegex()
        // if (!phone.matches(phoneRegex)) {
        //     throw InvalidFileFormatException(
        //             "Teléfono inválido: '$phone'. Debe contener exactamente 10 dígitos numéricos"
        //     )
        // }
        // if (!phone.isNullOrBlank()) {
        //     val phoneRegex = "^\\d{10}$".toRegex()
        //     if (!phone.matches(phoneRegex)) {
        //         throw InvalidFileFormatException(
        //             "Teléfono inválido: '$phone'. Debe contener exactamente 10 dígitos numéricos"
        //         )
        //     }
        // }

        if (adults < 0) {
            throw InvalidFileFormatException(
                    "Valor inválido en 'adultos': $adults"
            )
        }

        if (youngCount < 0) {
            throw InvalidFileFormatException(
                    "Valor inválido en 'jóvenes': $youngCount"
            )
        }

        if (childrenCount < 0) {
            throw InvalidFileFormatException(
                    "Valor inválido en 'niños': $childrenCount"
            )
        }

        if (!invitation.childrenAllowed && childrenCount > 0) {
            throw InvalidFileFormatException(
                    "Esta invitación NO permite niños"
            )
        }

        if (!invitation.youngAllowed && youngCount > 0) {
            throw InvalidFileFormatException(
                    "Esta invitación NO permite jóvenes"
            )
        }

        val totalPeople = adults + youngCount + childrenCount

        if (totalPeople == 0) {
            throw InvalidFileFormatException(
                    "Debe haber al menos una persona (adultos, jóvenes o niños)"
            )
        }

        // Adultos es obligatorio (>0) salvo que haya al menos un joven o un niño registrado
        if (adults == 0 && youngCount == 0 && childrenCount == 0) {
            throw InvalidFileFormatException(
                    "Debe haber al menos 1 adulto cuando no se registran jóvenes ni niños"
            )
        }

        // Si la invitación no permite jóvenes ni niños, adultos debe ser mayor a 0
        if (!invitation.childrenAllowed && !invitation.youngAllowed && adults == 0) {
            throw InvalidFileFormatException(
                    "Esta invitación NO permite niños ni jóvenes. Debe haber al menos 1 adulto"
            )
        }

        if (tableNumber != null && tableNumber < 0) {
            throw InvalidFileFormatException(
                    "Número de mesa inválido: $tableNumber. No puede ser negativo."
            )
        }
    }

    private fun validateDuplicatesInFile(guests: List<InvitationGuestEntity>) {
        val emails = mutableSetOf<String>()
        val phones = mutableSetOf<String>()

        guests.forEachIndexed { index, guest ->
            val rowNum = index + 2

            guest.email?.let { email ->
                if (!emails.add(email)) {
                    throw InvalidFileFormatException(
                            "El correo electrónico '$email' está duplicado en la fila $rowNum"
                    )
                }
            }

            // guest.phone?.let { phone ->
            //     if (!phones.add(phone)) {
            //         throw InvalidFileFormatException(
            //                 "El teléfono '$phone' está duplicado en la fila $rowNum"
            //         )
            //     }
            // }
        }
    }

    private fun filterDatabaseDuplicates(
            guests: List<InvitationGuestEntity>,
            invitationId: Long
    ): Pair<List<InvitationGuestEntity>, List<String>> {
        // ---- Validación de duplicados contra la base de datos DESHABILITADA ----
        // Para reactivarla: descomenta el bloque de abajo y elimina la línea
        // "return Pair(guests, emptyList())" que está justo después de este comentario.

        // val existingEmails = invitationGuestsRepository
        //         .findEmailsByInvitationId(invitationId)
        //         .toSet()
        //
        // val existingPhones = invitationGuestsRepository
        //         .findPhonesByInvitationId(invitationId)
        //         .toSet()
        //
        // val duplicatedRecords = mutableListOf<String>()
        //
        // val newGuests = guests.filterIndexed { index, guest ->
        //     val rowNum = index + 2
        //     var isDuplicate = false
        //
        //     if (guest.email != null && guest.email in existingEmails) {
        //         isDuplicate = true
        //         duplicatedRecords.add(
        //                 "El correo '${guest.email}' ya existe en esta invitación. Fila $rowNum."
        //         )
        //     }
        //
        //     // if (!isDuplicate && guest.phone != null && guest.phone in existingPhones) {
        //     //     isDuplicate = true
        //     //     duplicatedRecords.add(
        //     //             "El teléfono '${guest.phone}' ya existe en esta invitación. Fila $rowNum."
        //     //     )
        //     // }
        //
        //     !isDuplicate
        // }
        //
        // return Pair(newGuests, duplicatedRecords)

        return Pair(guests, emptyList())
    }

    private fun convertXlsxToCsv(file: MultipartFile): InputStream {
        val workbook = WorkbookFactory.create(file.inputStream)
        val sheet = workbook.getSheetAt(0)
        val csvBuilder = StringBuilder()

        var maxColumns = 0
        for (row in sheet) {
            val lastColumn = row.lastCellNum.toInt()
            if (lastColumn > maxColumns) {
                maxColumns = lastColumn
            }
        }

        for (row in sheet) {
            val cells = mutableListOf<String>()
            var hasContent = false
            
            for (colIndex in 0 until maxColumns) {
                val cell = row.getCell(colIndex)
                
                val cellValue = if (cell == null) {
                    ""
                } else {
                    when (cell.cellType) {
                        CellType.STRING -> {
                            val value = cell.stringCellValue
                            if (value.isNotBlank()) hasContent = true
                            value
                        }
                        CellType.NUMERIC -> {
                            hasContent = true
                            val numValue = cell.numericCellValue
                            
                            if (numValue % 1.0 == 0.0) {
                                numValue.toLong().toString()
                            } else {
                                numValue.toString()
                            }
                        }
                        CellType.BOOLEAN -> {
                            hasContent = true
                            cell.booleanCellValue.toString()
                        }
                        CellType.BLANK -> ""
                        else -> ""
                    }
                }
                cells.add(cellValue)
            }
            
            if (hasContent) {
                csvBuilder.appendLine(cells.joinToString(","))
            }
        }

        workbook.close()
        return csvBuilder.toString().byteInputStream()
    }
}