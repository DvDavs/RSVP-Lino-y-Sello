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

        request.phone?.let {
            val existingPhone = customerRepository.findByPhone(it)
            if (existingPhone != null && existingPhone.id != userId) {
                throw IllegalArgumentException(
                        "Actualmente este número telefónico no se encuentra disponible intenta con uno diferente"
                )
            }
        }

        val existingMail = customerRepository.findByEmail(request.email)
        if (existingMail != null && existingMail.isEnabled && existingMail.id != userId) {
            throw IllegalArgumentException(
                    "Actualmente este correo electrónico no se encuentra disponible intenta con uno diferente"
            )
        }

        customer.name = request.name
        customer.lastName = request.lastName
        customer.email = request.email
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