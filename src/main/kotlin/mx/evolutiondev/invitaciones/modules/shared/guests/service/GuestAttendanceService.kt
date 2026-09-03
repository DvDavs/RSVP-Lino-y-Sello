package mx.evolutiondev.invitaciones.modules.shared.guests.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.util.formatter.isAtLeastOneDayBefore
import mx.evolutiondev.invitaciones.core.util.formatter.isValidEmail
import mx.evolutiondev.invitaciones.core.util.formatter.valueOrZero
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.model.eventDate
import mx.evolutiondev.invitaciones.modules.shared.guests.exception.GuestNotFoundException
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.EmailGuestNotifier
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.AttendanceStatus
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.model.InvitationGuestEntity
import mx.evolutiondev.invitaciones.modules.shared.guests.service.model.ConfirmAttendanceRequest
import org.springframework.stereotype.Service
import java.util.*

@Service
class GuestAttendanceService(
        private val invitationGuestsRepository: InvitationGuestsRepository,
        private val emailGuestNotifier: EmailGuestNotifier,
        private val jwtUtil: JwtUtil
) {

    fun confirmAttendance(
            confirmationToken: String,
            request: ConfirmAttendanceRequest
    ): InvitationGuestEntity {
        val guest = invitationGuestsRepository.findByConfirmationToken(confirmationToken)
                ?: throw IllegalArgumentException("El token de confirmación no es válido")

        validateGuestForConfirmation(guest)

        var updatedGuest = guest

        if (!request.email.isNullOrBlank() && request.email != guest.email) {
            if (!request.email.isValidEmail()) {
                throw IllegalArgumentException("El formato del correo electrónico es inválido")
            }

            val existingEmail = invitationGuestsRepository.findByInvitationIdAndEmailAndIsEnabledTrue(
                guest.invitation.id,
                request.email
            )
            if (existingEmail != null && existingEmail.id != guest.id) {
                throw IllegalArgumentException("Este correo electrónico ya está registrado para otro invitado en este evento.")
            }

            updatedGuest = invitationGuestsRepository.save(guest.copy(email = request.email))
        }

        val eventDate = updatedGuest.invitation.eventDate()
        if (!Date().isAtLeastOneDayBefore(eventDate)) {
            throw IllegalArgumentException("La fecha del evento ya pasó, no puedes confirmar tu asistencia")
        }

        return if (request.isAttending) {
            confirmPositiveAttendance(updatedGuest, request)
        } else {
            confirmNegativeAttendance(updatedGuest, request)
        }
    }

    fun cancelAttendance(cancellationToken: String) {
        val guest = invitationGuestsRepository.findByCancellationToken(cancellationToken)
                ?: throw IllegalArgumentException("Token de cancelación inválido")

        if (!guest.isEnabled) {
            throw IllegalArgumentException("El invitado no existe o fue eliminado")
        }

        if (guest.attendanceStatus == AttendanceStatus.DECLINED) {
            throw IllegalArgumentException("Ya has declinado esta invitación previamente")
        }

        val wasConfirmed = guest.attendanceStatus == AttendanceStatus.CONFIRMED

        val updatedGuest = invitationGuestsRepository.save(
                guest.copy(
                        attendanceStatus = AttendanceStatus.DECLINED,
                        adultsCountConfirmed = 0,
                        childrenCountConfirmed = 0,
                        youngCountConfirmed = 0,
                        cancellationToken = null
                )
        )

        emailGuestNotifier.notifyDecline(updatedGuest, wasConfirmed)
    }

    private fun validateGuestForConfirmation(guest: InvitationGuestEntity) {
        if (!guest.isEnabled) {
            throw GuestNotFoundException("El invitado no existe o fue eliminado")
        }
    }

    private fun confirmPositiveAttendance(
            guest: InvitationGuestEntity,
            request: ConfirmAttendanceRequest
    ): InvitationGuestEntity {
        //val adultsCount = request.adultsConfirmed ?: 0
        val adultsCount = request.adultsConfirmed ?: 0
        val childrenCount = request.childrenConfirmed.valueOrZero()
        val youngCount = request.youngConfirmed.valueOrZero()

        val totalConfirmed = adultsCount + childrenCount + youngCount
        if (totalConfirmed < 1) {
            throw IllegalArgumentException("Debes confirmar al menos una persona para asistir")
        }

        // val maxAdults = guest.adultsCount ?: 0
        // if (maxAdults > 0 && adultsCount < 1) {
        //     throw IllegalArgumentException("Debes confirmar al menos un invitado adulto si vas a asistir")
        // }

        validateGuestCounts(guest, adultsCount, childrenCount, youngCount)

        val cancellationToken = jwtUtil.generateSecureToken()

        val updatedGuest = invitationGuestsRepository.save(
                guest.copy(
                        attendanceStatus = AttendanceStatus.CONFIRMED,
                        cancellationToken = cancellationToken,
                        adultsCountConfirmed = adultsCount,
                        childrenCountConfirmed = childrenCount,
                        youngCountConfirmed = youngCount,
                        congratulationsMessage = request.message
                )
        )

        emailGuestNotifier.notifyConfirmation(updatedGuest)

        return updatedGuest
    }

    private fun confirmNegativeAttendance(
            guest: InvitationGuestEntity,
            request: ConfirmAttendanceRequest
    ): InvitationGuestEntity {
        return invitationGuestsRepository.save(
                guest.copy(
                        attendanceStatus = AttendanceStatus.DECLINED,
                        adultsCountConfirmed = 0,
                        childrenCountConfirmed = 0,
                        youngCountConfirmed = 0,
                        congratulationsMessage = request.message
                )
        )
    }

    private fun validateGuestCounts(
            guest: InvitationGuestEntity, 
            adultsCount: Int, 
            childrenCount: Int, 
            youngCount: Int
    ) {
        val invitation = guest.invitation

        val maxAdults = guest.adultsCount ?: 0
        if (adultsCount > maxAdults) {
            throw IllegalArgumentException(
                "No puedes confirmar más adultos de los autorizados. Máximo permitido: $maxAdults"
            )
        }

        if (childrenCount > guest.childrenCount) {
            throw IllegalArgumentException(
                "No puedes confirmar más niños de los autorizados. Máximo permitido: ${guest.childrenCount}"
            )
        }

        if (youngCount > guest.youngCount) {
            throw IllegalArgumentException(
                "No puedes confirmar más jóvenes de los autorizados. Máximo permitido: ${guest.youngCount}"
            )
        }

        if (!invitation.childrenAllowed && childrenCount > 0) {
            throw IllegalArgumentException("No se permiten confirmar invitados con niños en este evento")
        }

        if (!invitation.youngAllowed && youngCount > 0) {
            throw IllegalArgumentException("No se permiten confirmar invitados con jóvenes en este evento")
        }
    }
}

