package mx.evolutiondev.invitaciones.modules.admin.users.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers   
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.auth.model.AppRole
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.modules.admin.invitations.repository.*
import mx.evolutiondev.invitaciones.modules.shared.invitations.service.InvitationPersistenceHelper
import mx.evolutiondev.invitaciones.modules.shared.guests.repository.InvitationGuestsRepository
import mx.evolutiondev.invitaciones.modules.shared.guests.notifier.repository.InvitationGuestNotificationRepository
import mx.evolutiondev.invitaciones.core.error.exception.DuplicatedEmailException
import mx.evolutiondev.invitaciones.core.error.exception.HierarchyViolationException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toCustomer
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.AdministratorRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.AdministratorUpdateRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.request.UpdatePasswordAdministratorRequest
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.admin.users.service.filter.CustomerSpecifications
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminUsersService(
        private val customerRepository: CustomerRepository,
        private val passwordEncoder: PasswordEncoder,
        private val hierarchyValidationService: HierarchyValidationService,
        private val emailService: EmailService,
        private val invitationRepository: InvitationRepository,
        private val invitationPersistenceHelper: InvitationPersistenceHelper,
        private val avatarService: mx.evolutiondev.invitaciones.modules.profile.avatar.service.AvatarService,
        private val s3Service: mx.evolutiondev.invitaciones.core.s3.S3Service,
        private val invitationGuestsRepository: InvitationGuestsRepository,
        private val invitationPersonRepository: InvitationPersonRepository,
        private val invitationPhraseRepository: InvitationPhraseRepository,
        private val invitationItineraryRepository: InvitationItineraryRepository,
        private val invitationGalleryRepository: InvitationGalleryRepository,
        private val invitationGiftRegistryRepository: InvitationGiftRegistryRepository,
        private val invitationMusicRepository: InvitationMusicRepository,
        private val invitationRecommendationRepository: InvitationRecommendationRepository,
        private val invitationStoryRepository: InvitationStoryRepository,
        private val invitationActivityRepository: InvitationActivityRepository,
        private val invitationParentRepository: InvitationParentRepository,
        private val invitationGodparentRepository: InvitationGodparentRepository,
        private val invitationDressCodeRepository: InvitationDressCodeRepository,
        private val invitationGuestNotificationRepository: InvitationGuestNotificationRepository
) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun findUserById(userId: Long): Customer {
        val customer = findCustomerEntityById(userId)
        return customer.toCustomer(avatarService, s3Service)
    }

    fun createAdministrator(creatorId: Long, request: AdministratorRequest): Customer {
        val creator = findCustomerEntityById(creatorId)
        val targetRole = Role.valueOf(request.role)
        
        if (!hierarchyValidationService.validateUserCreationHierarchy(creator.role, targetRole)) {
            throw HierarchyViolationException("No tienes permisos para crear un usuario con rol ${targetRole.name}")
        }

        val existingUser = customerRepository.findByEmailEvenIfDisabled(request.email)
        
        if (existingUser != null) {
            if (existingUser.isEnabled) {
                throw DuplicatedEmailException("Este correo no se encuentra disponible, por favor intenta con uno diferente")
            } else {
                return reactivateDisabledAdministrator(existingUser, request, creatorId, targetRole)
            }
        }

        // R1-10 (`ADR-5-E3-C1-03`): sin comprobación de unicidad del teléfono. `customer.phone` no
        // tiene índice único (`V1__initial_schema.sql:1868-1869` es un índice normal y parcial) y el
        // alta pública dejó de comprobarla (`ADR-5-E3-05`), así que cualquiera podía registrar sin
        // autenticarse dos cuentas con el mismo número y, a partir de ahí, `findByPhone` —derivada de
        // resultado único— reventaba con `IncorrectResultSizeDataAccessException`: esta alta
        // administrativa devolvía un `500` provocable desde fuera en vez de un `400`. Se retira la
        // comprobación en las dos rutas a la vez y `findByPhone` desaparece del repositorio.

        val customerEntity = customerRepository.save(CustomerEntity(
                name = request.name,
                lastName = request.lastName,
                email = request.email,
                password = passwordEncoder.encode(request.password),
                role = targetRole,
                createdBy = creatorId,
                phone = request.phone,
                birthdate = request.birthdate,
                address = request.address,
                city = request.city,
                postalCode = request.postalCode,
                state = request.state,
                howKnow = request.howKnow
        ))

        coroutineScope.launch {
            sendWelcomeEmailToAdministrator(customerEntity, request.password, targetRole)
        }

        return customerEntity.toCustomer(avatarService, s3Service)
    }

    private fun reactivateDisabledAdministrator(
        existingUser: CustomerEntity,
        request: AdministratorRequest,
        creatorId: Long,
        targetRole: Role
    ): Customer {
        // R1-10: sin comprobación de unicidad del teléfono, igual que en `createAdministrator`.

        existingUser.apply {
            name = request.name
            lastName = request.lastName
            password = passwordEncoder.encode(request.password)
            role = targetRole
            isEnabled = true
            deletedBy = null
            updatedBy = creatorId
            createdBy = creatorId
            phone = request.phone
            birthdate = request.birthdate
            address = request.address
            city = request.city
            postalCode = request.postalCode
            state = request.state
            howKnow = request.howKnow
        }

        val savedUser = customerRepository.save(existingUser)

        coroutineScope.launch {
            sendWelcomeEmailToAdministrator(savedUser, request.password, targetRole)
        }

        return savedUser.toCustomer(avatarService, s3Service)
    }

    private suspend fun sendWelcomeEmailToAdministrator(customerEntity: CustomerEntity, password: String, targetRole: Role) {
        val roleDisplayName = when (targetRole) {
            Role.ADMIN -> "Administrador"
            Role.MASTER -> "Master"
            else -> targetRole.name
        }
        
        emailService.sendEmail(
            to = customerEntity.email,
            templateName = "welcome",
            variables = mapOf(
                "customerName" to "${customerEntity.name} ${customerEntity.lastName}",
                // Marca: D-02 («Lino & Sello»). Se **omite** la variable a propósito en vez de
                // escribir el nombre aquí: `EmailContentGenerator` cae en `producto.correo.remitente-nombre`
                // cuando falta (`ADR-5-E3-07`). Así este fichero —territorio de E5— no gana una
                // dependencia nueva en el constructor por un cambio de marca.
                "isAdminCreated" to true,
                "temporaryPassword" to password,
                "userEmail" to customerEntity.email,
                "roleDisplayName" to roleDisplayName,
                "isAdminRole" to true
            )
        )
    }

    fun updateAdministrator(
            userId: Long,
            request: AdministratorUpdateRequest,
            updaterId: Long,
            appRole: AppRole
    ): Customer {
        val customerEntity = findCustomerEntityById(userId)
        
        if (!hierarchyValidationService.validateUserAccess(updaterId, userId)) {
            throw UnauthorizedAccessException("No tienes permisos para actualizar este usuario")
        }
        if (customerEntity.email != request.email) {
            verifyIfEmailIsUniqueForUpdate(request.email)
        }
        
        // R1-10: la unicidad del teléfono ya no se comprueba en ninguna ruta. El correo SÍ sigue
        // comprobándose aquí: `customer.email` sí tiene índice único de verdad
        // (`V1__initial_schema.sql:1605`) y sin la comprobación el choque saldría como `500`.
        
        customerEntity.name = request.name
        customerEntity.lastName = request.lastName
        customerEntity.email = request.email
        customerEntity.role = Role.valueOf(request.role)
        customerEntity.phone = request.phone
        customerEntity.birthdate = request.birthdate
        customerEntity.address = request.address
        customerEntity.city = request.city
        customerEntity.postalCode = request.postalCode
        customerEntity.state = request.state
        customerEntity.howKnow = request.howKnow
        customerEntity.updatedBy = updaterId
        return customerRepository.save(customerEntity).toCustomer(avatarService, s3Service)
    }

    fun updateAdministratorPassword(
            userId: Long,
            request: UpdatePasswordAdministratorRequest,
            updaterId: Long,
            appRole: AppRole
    ): Customer {
        val customerEntity = findCustomerEntityById(userId)
        
        if (!hierarchyValidationService.validateUserAccess(updaterId, userId)) {
            throw UnauthorizedAccessException("No tienes permisos para actualizar la contraseña de este usuario")
        }
        customerEntity.password = passwordEncoder.encode(request.password)
        customerEntity.updatedBy = updaterId
        return customerRepository.save(customerEntity).toCustomer(avatarService, s3Service)
    }

    fun banUser(
            userId: Long,
            loggedInUserId: Long,
            appRole: AppRole
    ): Customer {
        avoidDisableYourLoggedInAccount(
                userId = userId,
                loggedInUserId = loggedInUserId
        )
        
        if (!hierarchyValidationService.validateUserAccess(loggedInUserId, userId)) {
            throw UnauthorizedAccessException("No tienes permisos para banear este usuario")
        }
        
        val customerEntity = customerRepository.findByIdEvenIfDisabled(userId)
            ?: throw IllegalArgumentException("El usuario con el id: $userId no existe")
        
        customerEntity.isBanned = true
        customerEntity.updatedBy = loggedInUserId
        
        return customerRepository.save(customerEntity).toCustomer(avatarService, s3Service)
    }

    fun unbanUser(
            userId: Long,
            loggedInUserId: Long,
            appRole: AppRole
    ): Customer {
        avoidDisableYourLoggedInAccount(
                userId = userId,
                loggedInUserId = loggedInUserId
        )
        
        if (!hierarchyValidationService.validateUserAccess(loggedInUserId, userId)) {
            throw UnauthorizedAccessException("No tienes permisos para desbanear este usuario")
        }
        
        val customerEntity = customerRepository.findByIdEvenIfDisabled(userId)
            ?: throw IllegalArgumentException("El usuario con el id: $userId no existe")
        
        customerEntity.isBanned = false
        customerEntity.updatedBy = loggedInUserId
        
        return customerRepository.save(customerEntity).toCustomer(avatarService, s3Service)
    }

    @Transactional
    fun removeUser(
            userId: Long,
            loggedInUserId: Long,
            appRole: AppRole
    ): Customer {
        try {
            
            avoidDisableYourLoggedInAccount(
                    userId = userId,
                    loggedInUserId = loggedInUserId
            )
            
            if (!hierarchyValidationService.validateUserAccess(loggedInUserId, userId)) {
                throw UnauthorizedAccessException("No tienes permisos para eliminar este usuario")
            }
            
            val customerEntity = customerRepository.findByIdEvenIfDisabled(userId)
                ?: throw IllegalArgumentException("El usuario con el id: $userId no existe")
            
            
            customerEntity.isEnabled = false
            customerEntity.deletedBy = loggedInUserId
            val savedCustomer = customerRepository.save(customerEntity)
            
            
            val userInvitations = invitationRepository.findAllByCustomerId(userId)

            userInvitations.forEach { invitation ->
                invitation.isEnabled = false
                invitation.deletedBy = loggedInUserId
                invitation.updatedBy = loggedInUserId
            }
            invitationRepository.saveAll(userInvitations)
            
            
            return savedCustomer.toCustomer(avatarService, s3Service)
        } catch (e: Exception) {
            throw e
        }
    }

    @Transactional
    fun reactivateUser(
            userId: Long,
            loggedInUserId: Long,
            appRole: AppRole
    ): Customer {
        try {
            
            avoidDisableYourLoggedInAccount(
                    userId = userId,
                    loggedInUserId = loggedInUserId
            )
            
            if (!hierarchyValidationService.validateUserAccess(loggedInUserId, userId)) {
                throw UnauthorizedAccessException("No tienes permisos para reactivar este usuario")
            }
            
            val customerEntity = customerRepository.findByIdEvenIfDisabled(userId)
                ?: throw IllegalArgumentException("El usuario con el id: $userId no existe")
            
            
            customerEntity.isEnabled = true
            customerEntity.deletedBy = null
            customerEntity.updatedBy = loggedInUserId
            val savedCustomer = customerRepository.save(customerEntity)
            
            
            val disabledInvitations = invitationRepository.findAllDisabledByCustomerIdNative(userId)
            
            disabledInvitations.forEach { invitation ->
                invitation.isEnabled = true
                invitation.updatedBy = loggedInUserId
            }
            invitationRepository.saveAll(disabledInvitations)
            
            
            return savedCustomer.toCustomer(avatarService, s3Service)
        } catch (e: Exception) {
            throw e
        }
    }

    fun getUsersCreatedByAdmin(adminId: Long, page: Int): PaginatedResponse<Customer> {
        val admin = findCustomerEntityById(adminId)
        
        if (admin.role !in listOf(Role.ADMIN, Role.MASTER)) {
            throw UnauthorizedAccessException("Solo usuarios ADMIN o MASTER pueden consultar usuarios subordinados")
        }

        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }

        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "created_at"))

        val pageResult = customerRepository.findAllByCreatedByWithAnyStatus(adminId, pageable)

        return PaginatedResponse(
            content = pageResult.content.map { it.toCustomer(avatarService, s3Service) },
            totalPages = pageResult.totalPages,
            pageNumber = page
        )
    }

    private fun avoidDisableYourLoggedInAccount(
            userId: Long,
            loggedInUserId: Long
    ) {
        if (userId == loggedInUserId) {
            throw IllegalArgumentException("No puedes deshabilitar o eliminar la cuenta con la que has iniciado sesión")
        }
    }


    private fun findCustomerEntityById(userId: Long): CustomerEntity {
        return customerRepository.findById(userId).orElseThrow {
            throw IllegalArgumentException("El usuario con el id: $userId no existe")
        }
    }

    @Transactional
    fun hardDeleteUser(userId: Long, loggedInUserId: Long) {
        avoidDisableYourLoggedInAccount(
                userId = userId,
                loggedInUserId = loggedInUserId
        )
        
        customerRepository.findByIdEvenIfDisabled(userId)
            ?: throw IllegalArgumentException("El usuario con el id: $userId no existe")
        
        val invitationsOnlyCreatedByUser = invitationRepository.findAllByCreatedBy(userId)
            .filter { it.customer.id != userId }
        
        invitationsOnlyCreatedByUser.forEach { invitation ->
            invitation.createdBy = null
            invitation.updatedBy = null
        }
        invitationRepository.saveAll(invitationsOnlyCreatedByUser)
        
        // 3. Borrar invitaciones PROPIAS del usuario
        val invitationsOwnedByUser = invitationRepository.findAllByCustomerId(userId)
        invitationsOwnedByUser.forEach { invitation ->
            deleteInvitationRelatedEntities(invitation.id)
            invitationRepository.hardDeleteById(invitation.id)
        }

        // 4. Desvincular auditoría en tablas huérfanas
        customerRepository.nullifyAuditFields(userId)

        // 5. Borrar usuario físicamente
        customerRepository.hardDeleteById(userId)
    }
    
    private fun deleteInvitationRelatedEntities(invitationId: Long) {
        val guestNotifications = invitationGuestNotificationRepository.findByInvitationId(invitationId)
        if (guestNotifications.isNotEmpty()) {
            invitationGuestNotificationRepository.deleteAllInBatch(guestNotifications)
        }
        
        val allGuests = invitationGuestsRepository.findAllByInvitationId(invitationId)
        if (allGuests.isNotEmpty()) {
            invitationGuestsRepository.deleteAllInBatch(allGuests)
        }
        
        invitationPersonRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationPhraseRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationItineraryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGalleryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGiftRegistryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationMusicRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationRecommendationRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationStoryRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationActivityRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationParentRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationGodparentRepository.deleteAllInBatchByInvitationId(invitationId)
        invitationDressCodeRepository.deleteAllInBatchByInvitationId(invitationId)
    }

    fun getUsersForMaster(createdByAdminId: Long?, page: Int, status: String?, role: String?): PaginatedResponse<Customer> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }

        val pageIndex = (page - 1).coerceAtLeast(0)
        
        val pageResult = when (status?.uppercase()) {
            "DELETED" -> {
                val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "created_at"))
                
                when {
                    createdByAdminId != null && role != null -> {
                        customerRepository.findAllByCreatedByAndRoleAndIsEnabledWithAnyStatus(createdByAdminId, role, false, pageable)
                    }
                    createdByAdminId != null -> {
                        customerRepository.findAllByCreatedByAndIsEnabledWithAnyStatus(createdByAdminId, false, pageable)
                    }
                    role != null -> {
                        customerRepository.findAllByRoleAndIsEnabledWithAnyStatus(role, false, pageable)
                    }
                    else -> {
                        customerRepository.findAllByIsEnabledWithAnyStatus(false, pageable)
                    }
                }
            }
            "ALL" -> {
                val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "created_at"))
                
                when {
                    createdByAdminId != null && role != null -> {
                        customerRepository.findAllByCreatedByAndRoleWithAnyStatus(createdByAdminId, role, pageable)
                    }
                    createdByAdminId != null -> {
                        customerRepository.findAllByCreatedByWithAnyStatus(createdByAdminId, pageable)
                    }
                    role != null -> {
                        customerRepository.findAllByRoleWithAnyStatus(role, pageable)
                    }
                    else -> {
                        customerRepository.findAllWithAnyStatus(pageable)
                    }
                }
            }
            else -> {
                val pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))
                val specification = CustomerSpecifications.filterUsers(
                    createdByAdminId = createdByAdminId,
                    role = role,
                    status = "ACTIVE"
                )
                customerRepository.findAll(specification, pageable)
            }
        }

        return PaginatedResponse(
            content = pageResult.content.map { it.toCustomer(avatarService, s3Service) },
            totalPages = pageResult.totalPages,
            pageNumber = page
        )
    }

    private fun verifyIfEmailIsUniqueForUpdate(email: String) {
        customerRepository.findByEmailEvenIfDisabled(email)?.let {
            throw DuplicatedEmailException("Este correo no se encuentra disponible, por favor intenta con uno diferente")
        }
    }

    fun getUserByIdForAdmin(requesterId: Long, targetUserId: Long): Customer {
        val targetUser = customerRepository.findByIdEvenIfDisabled(targetUserId)
            ?: throw IllegalArgumentException("El usuario con el id: $targetUserId no existe")
    
        if (!hierarchyValidationService.validateUserAccess(requesterId, targetUserId)) {
            throw UnauthorizedAccessException("No tienes permisos para ver la información de este usuario")
        }
    
        return targetUser.toCustomer(avatarService, s3Service)
    }
}