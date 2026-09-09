package mx.evolutiondev.invitaciones.modules.shared.guests.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.util.formatter.isAtLeastOneDayBefore
import mx.evolutiondev.invitaciones.core.util.formatter.toDate
import mx.evolutiondev.invitaciones.core.util.formatter.valueOrZero
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

        // S-07 (severidad MEDIA), cerrado: aquí se guardaba `request.email` en el invitado cuando el
        // cuerpo traía uno distinto, sin confirmarlo y sin avisar al correo anterior. Bastaba tener
        // el enlace —un reenvío de WhatsApp, una captura— para redirigir a otro buzón todos los
        // avisos posteriores, incluido el que lleva el `cancellationToken`
        // (`EmailGuestNotifier.kt:241`, `:251-252`), y con eso tomar el control de ese RSVP.
        //
        // El RSVP **no** cambia el correo del invitado. `request.email` se ignora por completo y sin
        // error: el cuerpo se sigue aceptando tal cual para no romper a los clientes heredados que lo
        // mandan, pero no tiene ningún efecto. La superficie nueva (`/public/` + `r/{token}`) ni
        // siquiera declara el campo. Si algún día el producto quiere recoger un correo de contacto
        // declarado por el invitado, va en una columna aparte que no reemplace el destino de las
        // notificaciones (arreglo mínimo propuesto en el hallazgo).
        val updatedGuest = guest

        if (eventoCerrado(updatedGuest.invitation.date, updatedGuest.invitation.time)) {
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

    companion object {

        /** El mismo formato que arma `InvitationEntity.eventDate()` (`_InvitationKtx.kt:7-9`). */
        const val FORMATO_FECHA_EVENTO = "yyyy-MM-dd HH:mm"

        /**
         * **La única definición de «este evento ya cerró».**
         *
         * Se extrajo a una función pública porque la superficie pública nueva del RSVP necesita
         * decirlo **antes** de enseñar el formulario (`event.closed` del contrato 5-2 §2), y la
         * alternativa era escribir la misma condición en dos sitios y que un día dejaran de coincidir:
         * la página ofrecería confirmar y el `PUT` lo rechazaría.
         *
         * Toma la fecha y la hora crudas de `invitation` en vez de la entidad, para que quien solo ha
         * leído dos columnas con una consulta nativa no tenga que montar el grafo del módulo antiguo
         * únicamente para preguntar esto.
         *
         * Semántica conservada exactamente: `"$fecha $hora".toDate()` es lo que hacía
         * `eventDate()`, y `isAtLeastOneDayBefore` compara por día natural en la zona del servidor
         * (`StringUtilsKtx.kt:34-38`), así que el día del evento ya cuenta como cerrado.
         */
        fun eventoCerrado(fecha: String, hora: String, ahora: Date = Date()): Boolean =
                !ahora.isAtLeastOneDayBefore("$fecha $hora".toDate(FORMATO_FECHA_EVENTO))
    }
}

