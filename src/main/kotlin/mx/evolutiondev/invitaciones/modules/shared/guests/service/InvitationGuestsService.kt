package mx.evolutiondev.invitaciones.modules.shared.guests.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.model.GeneralMessageResponse
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.user.invitations.model.GuestsSummaryResponse
import mx.evolutiondev.invitaciones.core.util.formatter.isAtLeastOneDayBefore
import mx.evolutiondev.invitaciones.core.util.formatter.valueOrZero
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.InvitationRepository
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.InvitationEntity
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.eventDate
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.DuplicateGuestException
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.EmailGuestNotifier
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.model.NotificationTemplate
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.filter.GuestsSpecifications
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.*
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.util.*

@Service
class InvitationGuestsService(
        private val invitationGuestsRepository: InvitationGuestsRepository,
        private val invitationRepository: InvitationRepository,
        private val emailGuestNotifier: EmailGuestNotifier,
        private val jwtUtil: JwtUtil,
        private val hierarchyValidationService: HierarchyValidationService,
        private val guestFileImportService: GuestFileImportService,
        private val guestAttendanceService: GuestAttendanceService
) {

    fun appendMultipleGuests(
            userId: Long,
            invitationId: Long,
            appRole: AppRole,
            file: MultipartFile
    ): GuestFileLoadedResponse {
        val invitation = validateInvitation(userId, appRole, invitationId)
        return guestFileImportService.importGuestsFromFile(invitation, file, userId, appRole)
    }

    fun appendGuest(
            userId: Long,
            appRole: AppRole,
            invitationId: Long,
            request: GuestsCreationRequest
    ) {
        val invitation = validateInvitation(userId, appRole, invitationId)
        val adultsCount = request.adultsCount.valueOrZero()

        validateGuestCounts(adultsCount, request.childrenCount.valueOrZero(), 
                request.youngCount.valueOrZero(), invitation)

        //val token = jwtUtil.generateSecureToken()
        val token = jwtUtil.generateInvitationSecureToken()

        invitationGuestsRepository
                .findByEmailAndPhoneAndIsEnabledFalse(request.email, request.phone)
                ?.let { deletedGuest ->
                    val cancellationToken = jwtUtil.generateSecureToken()
                    
                    invitationGuestsRepository.save(
                            deletedGuest.copy(
                                    fullName = request.fullName,
                                    adultsCount = adultsCount,
                                    youngCount = request.youngCount.valueOrZero(),
                                    childrenCount = request.childrenCount.valueOrZero(),
                                    graduatesName = request.graduatesName,
                                    tableNumber = request.tableNumber,
                                    confirmationToken = token,
                                    cancellationToken = cancellationToken,
                                    isEnabled = true,
                                    attendanceStatus = AttendanceStatus.PENDING,
                                    createdBy = if (appRole == AppRole.USER) null else userId,
                                    updatedBy = if (appRole == AppRole.USER) null else userId
                            )
                    )
                    return
                }

        validateGuestContactInfo(invitationId, request.email, request.phone)

        val cancellationToken = jwtUtil.generateSecureToken()

        invitationGuestsRepository.save(
                InvitationGuestEntity(
                        invitation = invitation,
                        fullName = request.fullName,
                        email = request.email,
                        phone = request.phone,
                        adultsCount = adultsCount,
                        childrenCount = request.childrenCount.valueOrZero(),
                        youngCount = request.youngCount.valueOrZero(),
                        graduatesName = request.graduatesName,
                        tableNumber = request.tableNumber,
                        confirmationToken = token,
                        cancellationToken = cancellationToken,
                        createdBy = if (appRole == AppRole.USER) null else userId,
                        updatedBy = if (appRole == AppRole.USER) null else userId
                )
        )
    }

    fun updateGuest(
            userId: Long,
            appRole: AppRole,
            guestId: Long,
            invitationId: Long,
            request: GuestsCreationRequest
    ) {
        val invitation = validateInvitation(userId, appRole, invitationId)
        val guest = findGuestById(guestId)

        if (appRole == AppRole.USER && !guest.isEnabled) {
            throw GuestNotFoundException("El invitado con el id: $guestId no existe")
        }

        val adultsCount = request.adultsCount.valueOrZero()
        validateGuestCounts(adultsCount, request.childrenCount.valueOrZero(),
                request.youngCount.valueOrZero(), invitation)

        if (guest.email != request.email || guest.phone != request.phone) {
            validateGuestContactInfo(invitationId, request.email, request.phone, guestId)
        }

        invitationGuestsRepository.save(
                guest.copy(
                        fullName = request.fullName,
                        email = request.email,
                        phone = request.phone,
                        adultsCount = adultsCount,
                        childrenCount = request.childrenCount.valueOrZero(),
                        youngCount = request.youngCount.valueOrZero(),
                        graduatesName = request.graduatesName,
                        tableNumber = request.tableNumber,
                        whatsappSent = request.whatsappSent ?: guest.whatsappSent,
                        updatedBy = if (appRole == AppRole.USER) null else userId
                )
        )
    }

    @Transactional
    fun deleteGuest(userId: Long, appRole: AppRole, guestId: Long) {
        val guest = findGuestById(guestId)

        if (appRole == AppRole.USER && guest.invitation.customer.id != userId) {
            throw IllegalArgumentException("No tienes permisos para eliminar este invitado")
        }

        invitationGuestsRepository.hardDeleteById(guestId)
    }

    fun getGuests(
            userId: Long,
            appRole: AppRole,
            invitationId: Long,
            attendanceStatus: String?,
            fullName: String?,
            email: String?,
            phone: String?,
            page: Int
    ): PaginatedResponse<GuestResponseItem> {
        validateInvitation(userId, appRole, invitationId)

        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))

        val status = when (attendanceStatus?.uppercase()) {
            "CONFIRMED" -> AttendanceStatus.CONFIRMED
            "DECLINED" -> AttendanceStatus.DECLINED
            "PENDING" -> AttendanceStatus.PENDING
            null -> null
            else -> null
        }

        val spec = GuestsSpecifications.prepare(
                appRole = appRole,
                userId = userId,
                invitationId = invitationId,
                attendanceStatus = status,
                fullName = fullName,
                email = email,
                phone = phone
        )

        val result = invitationGuestsRepository.findAll(spec, pageable).mapToPageResponse()

        return PaginatedResponse(
                content = result.content,
                totalPages = result.totalPages,
                pageNumber = page
        )
    }



    fun getAllGuests(
        userId: Long,
        appRole: AppRole,
        invitationId: Long,
    ): GuestsSummaryResponse {

        validateInvitation(userId, appRole, invitationId)

        val guests = invitationGuestsRepository.findAllByInvitationId(invitationId)

        val confirmed = guests.filter { it.attendanceStatus == AttendanceStatus.CONFIRMED }
        val pending   = guests.filter { it.attendanceStatus == AttendanceStatus.PENDING }
        val declined  = guests.filter { it.attendanceStatus == AttendanceStatus.DECLINED }

        // Helper para evitar nulls en campos Long?
        fun List<InvitationGuestEntity>.sumInt(selector: (InvitationGuestEntity) -> Int?) =
            sumOf { selector(it) ?: 0 }

        return GuestsSummaryResponse(
           // Generales
            totalInvitados   = guests.sumInt { (it.adultsCount ?: 0) + (it.childrenCount ?: 0) + (it.youngCount ?: 0) },
            totalConfirmados = guests.sumInt { (it.adultsCountConfirmed ?: 0) + (it.childrenCountConfirmed ?: 0) + (it.youngCountConfirmed ?: 0) },
            totalPendientes  = pending.sumInt { (it.adultsCount ?: 0) + (it.childrenCount ?: 0) + (it.youngCount ?: 0) },
            totalCancelados  = declined.sumInt { (it.adultsCount ?: 0) + (it.childrenCount ?: 0) + (it.youngCount ?: 0) },

            // Adultos
            totalAdultosInvitados   = guests.sumInt { it.adultsCount },
            totalAdultosPendientes  = pending.sumInt { it.adultsCount },
            totalAdultosConfirmados = guests.sumInt { it.adultsCountConfirmed },
            totalAdultosCancelados  = declined.sumInt { it.adultsCount },

            // Niños
            totalNinosInvitados   = guests.sumInt { it.childrenCount },
            totalNinosPendientes  = pending.sumInt { it.childrenCount },
            totalNinosConfirmados = guests.sumInt { it.childrenCountConfirmed },
            totalNinosCancelados  = declined.sumInt { it.childrenCount },

            // Jóvenes
            totalJovenesInvitados   = guests.sumInt { it.youngCount },
            totalJovenesPendientes  = pending.sumInt { it.youngCount },
            totalJovenesConfirmados = guests.sumInt { it.youngCountConfirmed },
            totalJovenesCancelados  = declined.sumInt { it.youngCount },
        )
    }


    fun getGuest(
            userId: Long,
            appRole: AppRole,
            guestId: Long,
            invitationId: Long
    ): InvitationGuestEntity {
        validateInvitation(userId, appRole, invitationId)
        val guest = findGuestById(guestId)
        
        if (appRole == AppRole.USER && !guest.isEnabled) {
            throw GuestNotFoundException("El invitado con el id: $guestId no existe")
        }
        
        return guest
    }

    fun attendInvite(
            confirmationToken: String,
            request: ConfirmAttendanceRequest
    ): InvitationGuestEntity {
        return guestAttendanceService.confirmAttendance(confirmationToken, request)
    }

    fun cancelAttendance(cancellationToken: String) {
        guestAttendanceService.cancelAttendance(cancellationToken)
    }

    fun cancelAttendanceFromDashboard(
            userId: Long,
            appRole: AppRole,
            invitationId: Long,
            guestId: Long
    ) {
        validateInvitation(userId, appRole, invitationId)
        val guest = findGuestById(guestId)

        if (guest.attendanceStatus != AttendanceStatus.CONFIRMED) {
            throw IllegalArgumentException("Este invitado no tiene asistencia confirmada")
        }

        invitationGuestsRepository.save(
                guest.copy(
                        attendanceStatus = AttendanceStatus.DECLINED,
                        adultsCountConfirmed = 0,
                        childrenCountConfirmed = 0,
                        youngCountConfirmed = 0,
                        cancellationToken = null
                )
        )
    }

    fun notifyGuests(
            userId: Long,
            appRole: AppRole,
            invitationId: Long
    ): GeneralMessageResponse {
        val invitation = validateInvitation(userId, appRole, invitationId)
        
        if (!invitation.isFinished) {
            throw IllegalArgumentException("La invitación no puede ser enviada porque aún no ha sido guardada en el editor.")
        }
        
        val guests = invitationGuestsRepository.findByInvitationIdAndIsEnabledTrueAndAttendanceStatus(
            invitation.id, 
            AttendanceStatus.PENDING
        )

        if (guests.isEmpty()) {
            throw IllegalArgumentException("Esta invitación aún no cuenta con invitados")
        }

        val eventDate = invitation.eventDate()
        if (!Date().isAtLeastOneDayBefore(eventDate)) {
            throw IllegalArgumentException("El evento ya no está disponible para los invitados")
        }

        emailGuestNotifier.notifyAll(
                invitationId = invitation.id,
                requesterId = userId,
                appRole = appRole,
                guests = guests,
                template = NotificationTemplate(subject = "", content = "")
        )

        return GeneralMessageResponse(
                message = "La notificación se está enviando a los invitados. " +
                        "Este proceso puede tardar unos minutos."
        )
    }

    fun getAllGuestsForMaster(
            invitationId: Long?,
            createdByUserId: Long?,
            createdByAdminId: Long?,
            attendanceStatus: String?,
            fullName: String?,
            email: String?,
            phone: String?,
            page: Int
    ): PaginatedResponse<GuestResponseItem> {
        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))

        val usersCreatedByAdmin = if (createdByAdminId != null) {
            hierarchyValidationService.getUsersCreatedBy(createdByAdminId)
        } else {
            emptyList()
        }

        val status = when (attendanceStatus?.uppercase()) {
            "CONFIRMED" -> AttendanceStatus.CONFIRMED
            "DECLINED" -> AttendanceStatus.DECLINED
            "PENDING" -> AttendanceStatus.PENDING
            null -> null
            else -> null
        }

        val spec = GuestsSpecifications.forMaster(
                invitationId = invitationId,
                createdByUserId = createdByUserId,
                createdByAdminId = createdByAdminId,
                usersCreatedByAdmin = usersCreatedByAdmin,
                attendanceStatus = status,
                fullName = fullName,
                email = email,
                phone = phone
        )

        val result = invitationGuestsRepository.findAll(spec, pageable).mapToPageResponse()

        return PaginatedResponse(
                content = result.content,
                totalPages = result.totalPages,
                pageNumber = page
        )
    }

    fun hardDeleteGuest(guestId: Long) {
        val guest = findGuestById(guestId)
        invitationGuestsRepository.delete(guest)
    }


    private fun validateInvitation(
            userId: Long,
            appRole: AppRole,
            invitationId: Long
    ): InvitationEntity {
        val invitation = invitationRepository.findById(invitationId).orElseThrow {
            IllegalArgumentException("La invitación con el id: $invitationId no existe")
        }

        if (!hierarchyValidationService.validateInvitationAccess(userId, invitationId)) {
            throw IllegalArgumentException("No tienes permisos para acceder a esta invitación")
        }

        if (appRole == AppRole.USER && !invitation.isEnabled) {
            throw IllegalArgumentException("La invitación con el id: $invitationId no existe")
        }

        return invitation
    }

    private fun findGuestById(guestId: Long): InvitationGuestEntity {
        return invitationGuestsRepository.findById(guestId)
                .orElseThrow { GuestNotFoundException("El invitado con el id: $guestId no existe") }
    }

    private fun validateGuestCounts(
            adultsCount: Int,
            childrenCount: Int,
            youngCount: Int,
            invitation: InvitationEntity
    ) {
        if (adultsCount < 0) {
            throw IllegalArgumentException("El número de adultos no puede ser negativo")
        }
        if (childrenCount < 0) {
            throw IllegalArgumentException("El número de niños no puede ser negativo")
        }
        if (youngCount < 0) {
            throw IllegalArgumentException("El número de jóvenes no puede ser negativo")
        }

        if (!invitation.childrenAllowed && childrenCount > 0) {
            throw IllegalArgumentException("No se permiten agregar invitados con niños a esta invitación")
        }

        if (!invitation.youngAllowed && youngCount > 0) {
            throw IllegalArgumentException("No se permiten agregar invitados con jóvenes a esta invitación")
        }

        val totalPeople = adultsCount + childrenCount + youngCount
        if (totalPeople == 0) {
            throw IllegalArgumentException("Debe haber al menos una persona (adultos, jóvenes o niños)")
        }

        if (!invitation.childrenAllowed && !invitation.youngAllowed && adultsCount == 0) {
            throw IllegalArgumentException("Esta invitación NO permite niños ni jóvenes. Debe haber al menos 1 adulto")
        }
    }

    private fun validateGuestContactInfo(
            invitationId: Long,
            email: String,
            phone: String,
            guestIdToIgnore: Long? = null
    ) {
        if (email.isNotBlank()) {
            val existingByEmail = invitationGuestsRepository.findByInvitationIdAndEmailAndIsEnabledTrue(invitationId, email)
            if (existingByEmail != null && existingByEmail.id != guestIdToIgnore) {
                throw DuplicateGuestException(
                        "Ya existe un invitado registrado con el correo electrónico: $email en esta invitación"
                )
            }
        }

        // if (phone.isNotBlank()) {
        //     val existingByPhone = invitationGuestsRepository.findByInvitationIdAndPhoneAndIsEnabledTrue(invitationId, phone)
        //     if (existingByPhone != null && existingByPhone.id != guestIdToIgnore) {
        //         throw DuplicateGuestException(
        //                 "Ya existe un invitado registrado con el teléfono: $phone en esta invitación"
        //         )
        //     }
        // }
    }
}
