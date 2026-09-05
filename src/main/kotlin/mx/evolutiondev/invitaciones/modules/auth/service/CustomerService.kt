package mx.evolutiondev.invitaciones.modules.auth.service

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.core.email.model.EmailRequest
import mx.evolutiondev.invitaciones.core.error.exception.DuplicatedEmailException
import mx.evolutiondev.invitaciones.core.error.exception.HierarchyViolationException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedAccessException
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import mx.evolutiondev.invitaciones.core.model.PaginatedResponse
import mx.evolutiondev.invitaciones.modules.admin.users.ktx.toCustomer
import mx.evolutiondev.invitaciones.modules.admin.users.presentation.response.Customer
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.request.AuthRequest
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service

@Service
class CustomerService(
        private val customerRepository: CustomerRepository,
        private val passwordEncoder: PasswordEncoder,
        private val hierarchyValidationService: HierarchyValidationService,
        private val emailService: EmailService,
        private val authThrottleService: AuthThrottleService
) {

    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        /**
         * I-02: un unico literal para el `401`. Los tres caminos que fallan devuelven exactamente el
         * mismo texto -«no existe», «existe con contrasena mala» y «existe pero deshabilitado»- asi
         * que la respuesta no distingue cual de ellos ocurrio.
         */
        private const val CREDENCIALES_NO_COINCIDEN = "Las credenciales no coinciden con nuestros registros"
    }

    /**
     * I-02 (H-ADV-05). Tres cambios y ninguno mas:
     *
     * 1. `comprobar` **antes** de tocar el repositorio: si la cuenta o la IP estan al limite se
     *    responde `429` sin consulta ni bcrypt, y por tanto en el mismo tiempo exista o no la cuenta.
     * 2. Cuando el correo no existe se gasta igualmente un bcrypt contra el **hash senuelo**. Antes
     *    se salia en cuanto el repositorio devolvia `null`, sin llegar al `PasswordEncoder`: ese era
     *    el oraculo de temporizacion (~15x medido, sin solape) que permitia enumerar cuentas.
     * 3. Se registra el fallo tras cada `401` de credenciales y se limpian los contadores en cuanto
     *    la contrasena coincide, para que un acceso correcto nunca deje al usuario bloqueado.
     */
    fun validateUser(authRequest: AuthRequest): CustomerEntity {
        authThrottleService.comprobar(authRequest.email)

        val customer = customerRepository.findByEmailEvenIfDisabled(authRequest.email)
        if (customer == null) {
            authThrottleService.gastarHashSenuelo(authRequest.password)
            authThrottleService.registrarFallo(authRequest.email)
            throw UnauthorizedException(CREDENCIALES_NO_COINCIDEN)
        }
        if (!passwordEncoder.matches(authRequest.password, customer.password)) {
            authThrottleService.registrarFallo(authRequest.email)
            throw UnauthorizedException(CREDENCIALES_NO_COINCIDEN)
        }
        authThrottleService.registrarExito(authRequest.email)
        if (!customer.isEnabled) {
            throw UnauthorizedException(CREDENCIALES_NO_COINCIDEN)
        }
        if (customer.isBanned) {
            throw UserBannedException("Su cuenta ha sido bloqueada. Contacte al administrador.")
        }
        return customer
    }

    fun signUp(userRequest: UserRequest): CustomerEntity {
        val existingUser = customerRepository.findByEmailEvenIfDisabled(userRequest.email)
        
        if (existingUser != null) {
            if (existingUser.isEnabled) {
                throw DuplicatedEmailException("Este correo no se encuentra disponible, por favor intenta con uno diferente")
            } else {
                return reactivateDisabledUser(existingUser, userRequest)
            }
        }

        userRequest.phone?.let { phone ->
            if (customerRepository.existsByPhoneEvenIfDisabled(phone)) {
                val phoneOwner = customerRepository.findByPhone(phone)
                if (phoneOwner != null) {
                    throw IllegalArgumentException(
                            "Este número de teléfono no se encuentra disponible, por favor intenta con uno diferente"
                    )
                }
            }
        }

        val newUser = CustomerEntity(
                name = userRequest.name,
                lastName = userRequest.lastName,
                email = userRequest.email,
                password = passwordEncoder.encode(userRequest.password),
                role = Role.USER,
                createdBy = null,
                birthdate = userRequest.birthdate,
                phone = userRequest.phone,
                address = userRequest.address,
                postalCode = userRequest.postalCode,
                city = userRequest.city,
                state = userRequest.state,
                howKnow = userRequest.howKnow
        )
        val savedUser = customerRepository.save(newUser)

        coroutineScope.launch {
            emailService.sendEmail(
                to = savedUser.email,
                templateName = "welcome",
                variables = mapOf(
                    "customerName" to "${savedUser.name} ${savedUser.lastName}",
                    "companyName" to "AGAPE"
                )
            )
        }

        return savedUser
    }

    private fun reactivateDisabledUser(existingUser: CustomerEntity, userRequest: UserRequest): CustomerEntity {
        userRequest.phone?.let { phone ->
            if (phone != existingUser.phone && customerRepository.existsByPhoneEvenIfDisabled(phone)) {
                throw IllegalArgumentException(
                        "Este número de teléfono no se encuentra disponible, por favor intenta con uno diferente"
                )
            }
        }

        existingUser.apply {
            name = userRequest.name
            lastName = userRequest.lastName
            password = passwordEncoder.encode(userRequest.password)
            isEnabled = true
            deletedBy = null
            birthdate = userRequest.birthdate
            phone = userRequest.phone
            address = userRequest.address
            postalCode = userRequest.postalCode
            city = userRequest.city
            state = userRequest.state
            howKnow = userRequest.howKnow
        }

        val savedUser = customerRepository.save(existingUser)

        coroutineScope.launch {
            emailService.sendEmail(
                to = savedUser.email,
                templateName = "welcome",
                variables = mapOf(
                    "customerName" to "${savedUser.name} ${savedUser.lastName}",
                    "companyName" to "AGAPE"
                )
            )
        }

        return savedUser
    }

    fun createUserByAdmin(creatorId: Long, userRequest: UserRequest): CustomerEntity {
        val creator = customerRepository.findById(creatorId).orElseThrow {
            IllegalArgumentException("No se encontró un usuario asociado al id: $creatorId")
        }

        if (!creator.isEnabled) {
            throw UnauthorizedAccessException("El usuario creador no está habilitado")
        }

        val targetRole = Role.USER
        if (!hierarchyValidationService.validateUserCreationHierarchy(creator.role, targetRole)) {
            throw HierarchyViolationException("No tienes permisos para crear usuarios con el rol especificado")
        }

        val existingUser = customerRepository.findByEmailEvenIfDisabled(userRequest.email)
        
        if (existingUser != null) {
            if (existingUser.isEnabled) {
                throw DuplicatedEmailException("Este correo no se encuentra disponible, por favor intenta con uno diferente")
            } else {
                return reactivateDisabledUserByAdmin(existingUser, userRequest, creatorId)
            }
        }

        userRequest.phone?.let { phone ->
            if (customerRepository.existsByPhoneEvenIfDisabled(phone)) {
                val phoneOwner = customerRepository.findByPhone(phone)
                if (phoneOwner != null) {
                    throw IllegalArgumentException(
                            "Este número de teléfono no se encuentra disponible, por favor intenta con uno diferente"
                    )
                }
            }
        }

        val newUser = CustomerEntity(
                name = userRequest.name,
                lastName = userRequest.lastName,
                email = userRequest.email,
                password = passwordEncoder.encode(userRequest.password),
                role = targetRole,
                createdBy = creatorId,
                birthdate = userRequest.birthdate,
                phone = userRequest.phone,
                address = userRequest.address,
                postalCode = userRequest.postalCode,
                city = userRequest.city,
                state = userRequest.state,
                howKnow = userRequest.howKnow
        )
        val savedUser = customerRepository.save(newUser)
        
        coroutineScope.launch {
            emailService.sendEmail(
                to = savedUser.email,
                templateName = "welcome",
                variables = mapOf(
                    "customerName" to "${savedUser.name} ${savedUser.lastName}",
                    "companyName" to "AGAPE",
                    "isAdminCreated" to true,
                    "temporaryPassword" to userRequest.password,
                    "userEmail" to savedUser.email
                )
            )
        }
        
        return savedUser
    }

    private fun reactivateDisabledUserByAdmin(
        existingUser: CustomerEntity,
        userRequest: UserRequest,
        creatorId: Long
    ): CustomerEntity {
        userRequest.phone?.let { phone ->
            if (phone != existingUser.phone && customerRepository.existsByPhoneEvenIfDisabled(phone)) {
                throw IllegalArgumentException(
                        "Este número de teléfono no se encuentra disponible, por favor intenta con uno diferente"
                )
            }
        }

        existingUser.apply {
            name = userRequest.name
            lastName = userRequest.lastName
            password = passwordEncoder.encode(userRequest.password)
            isEnabled = true
            deletedBy = null
            updatedBy = creatorId
            createdBy = creatorId
            birthdate = userRequest.birthdate
            phone = userRequest.phone
            address = userRequest.address
            postalCode = userRequest.postalCode
            city = userRequest.city
            state = userRequest.state
            howKnow = userRequest.howKnow
        }

        val savedUser = customerRepository.save(existingUser)

        coroutineScope.launch {
            emailService.sendEmail(
                to = savedUser.email,
                templateName = "welcome",
                variables = mapOf(
                    "customerName" to "${savedUser.name} ${savedUser.lastName}",
                    "companyName" to "AGAPE",
                    "isAdminCreated" to true,
                    "temporaryPassword" to userRequest.password,
                    "userEmail" to savedUser.email
                )
            )
        }

        return savedUser
    }

    fun findCustomerById(userId: Long): CustomerEntity {
        return customerRepository.findById(userId).orElseThrow {
            throw IllegalArgumentException("No se encontro un usuario asociado al id: $userId")
        }
    }

    fun getAdministratorsAndMasters(): List<CustomerEntity> {
        return customerRepository.findByRoleIn(
                listOf(
                        Role.MASTER,
                        Role.ADMIN
                )
        )
    }

    fun getAllEnabledUsersPaginated(page: Int): PaginatedResponse<Customer> {
        if (page <= 0) {
            throw IllegalArgumentException("Las páginas son enteros positivos mayores a 0")
        }

        val pageIndex = (page - 1).coerceAtLeast(0)
        val pageable: Pageable = PageRequest.of(pageIndex, 20, Sort.by(Sort.Direction.DESC, "createdAt"))

        val pageResult = customerRepository.findAll(pageable)

        return PaginatedResponse(
            content = pageResult.content.map { it.toCustomer() },
            totalPages = pageResult.totalPages,
            pageNumber = page
        )
    }
}