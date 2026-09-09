package mx.evolutiondev.invitaciones.modules.admin.users.service

import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.modules.admin.users.service.model.UpdateProfileRequest
import mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService
import mx.evolutiondev.invitaciones.modules.user.profile.presentation.request.SurveyRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ProfileService(
        private val customerRepository: CustomerRepository,
        private val avatarService: AvatarService
) {

    fun updateProfile(
            userId: Long, 
            request: UpdateProfileRequest,
            updaterId: Long,
            appRole: AppRole
    ): CustomerEntity {
        val customer = customerRepository.findById(userId).orElseThrow {
            throw IllegalArgumentException("No se encontro un usuario asociado al id: $userId")
        }

        // Fase 5, E3 (`ADR-5-E3-05` y `ADR-5-E3-06`). Aquí se quitaron dos comprobaciones:
        //
        // 1. La de unicidad del **teléfono**: decía «este número no está disponible», que es el mismo
        //    oráculo de enumeración del alta, y defendía una unicidad que la base nunca tuvo
        //    (`customer.phone` solo tiene un índice normal, `V1__initial_schema.sql:1868-1869`).
        // 2. La del **correo**, porque el correo ya no se cambia desde aquí: `request` no lo trae.
        //    Solo miraba las cuentas habilitadas (`existingMail.isEnabled`), así que el correo de una
        //    cuenta deshabilitada llegaba al índice único y salía como `500`. El flujo nuevo
        //    (`AccountService.pedirCambioDeCorreo`) compara contra `findByEmailEvenIfDisabled`.

        customer.name = request.name
        customer.lastName = request.lastName
        customer.phone = request.phone
        customer.birthdate = request.birthdate
        customer.address = request.address
        customer.city = request.city
        customer.postalCode = request.postalCode
        customer.state = request.state
        customer.updatedBy = if (appRole == AppRole.USER) null else updaterId

        return customerRepository.save(customer)
    }

    fun updateProfilePhoto(userId: Long, avatarId: Long): CustomerEntity {
        val customer = customerRepository.findById(userId).orElseThrow {
            throw IllegalArgumentException("No se encontró un usuario asociado al id: $userId")
        }
        avatarService.findAvatarById(avatarId)

        customer.avatarId = avatarId
        return customerRepository.save(customer)
    }

    @Transactional 
    fun saveSurveyAnswer(userId: Long, request: SurveyRequest) {
        val customer = customerRepository.findById(userId).orElseThrow {
            IllegalArgumentException("Usuario no encontrado")
        }

        val finalSource = if (request.source.equals("otros", ignoreCase = true) && !request.otherText.isNullOrBlank()) {
            "Otros: ${request.otherText}"
        } else {
            request.source
        }

        customer.howKnow = finalSource
        customer.isSurveyAnswered = true

        customerRepository.save(customer)
    }
}