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
import mx.evolutiondev.invitaciones.modules.product.account.EmailVerificationService
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
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
        private val authThrottleService: AuthThrottleService,
        /**
         * Verificación de correo del alta (fase 5, E3; `ADR-5-E3-02`). Vive en
         * `modules/product/account` porque ese es el territorio de la sesión que la escribe
         * (`ADR-5-0C-01`); aquí solo se pide el token y se manda el correo.
         */
        private val emailVerificationService: EmailVerificationService,
        /** Marca de los correos: «Lino & Sello» por configuración, nunca escrita en el código (D-02). */
        private val mailProperties: ProductMailProperties
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

    /**
     * N-01 (`ADR-3C-N01-01`): `/auth/signup` es `permitAll` y responde `400` cuando el correo ya
     * existe y `200` cuando no, así que **enumera cuentas** igual que lo hacía
     * `/auth/request-password-reset`. Aquí NO se puede unificar la respuesta —el alta tiene que
     * decirle a la persona que ese correo ya está tomado, o no hay forma de registrarse—, así que lo
     * que se cierra es el **caudal**: el mismo limitador de I-02, en su propio ámbito
     * (`AmbitoIntentos.REGISTRO`), comprobado antes de tocar la base y registrado después.
     *
     * Un alta correcta limpia el contador de ese ámbito: quien de verdad se está registrando nunca
     * queda bloqueado por sus propios tanteos, y una red tras NAT no se autobloquea.
     */
    fun signUp(userRequest: UserRequest): CustomerEntity {
        authThrottleService.comprobar(AmbitoIntentos.REGISTRO, userRequest.email)

        val existingUser = customerRepository.findByEmailEvenIfDisabled(userRequest.email)
        
        // R1-01 (`ADR-5-E3-C1-01`). **El alta pública NO reactiva.** Antes, un correo que existía pero
        // estaba deshabilitado caía en `reactivateDisabledUser`, que reescribía la contraseña con la
        // que venía en el cuerpo, ponía `isEnabled = true` y borraba `deletedBy`: cualquiera que
        // supiera el correo de una cuenta dada de baja se quedaba con ella —y con sus invitaciones,
        // invitados y RSVP— desde una ruta `permitAll`, sin contraseña anterior, sin token y sin aviso
        // al titular.
        //
        // Los dos casos —correo tomado por una cuenta viva y correo tomado por una cuenta
        // deshabilitada— responden ahora **exactamente lo mismo**: la misma excepción, el mismo texto,
        // el mismo `400`. Y cuestan lo mismo: una consulta, un `registrarIntento` y el lanzamiento;
        // ninguna de las dos ramas hace bcrypt, ni acuña token, ni escribe, ni encola correo, así que
        // el tiempo de respuesta tampoco distingue una cuenta deshabilitada de una viva.
        //
        // La vuelta de una cuenta dada de baja queda **sólo** en manos de un ADMIN/MASTER
        // (`createUserByAdmin` → `reactivateDisabledUserByAdmin`, ruta autenticada y con jerarquía).
        // Queda anotado en `preguntas-abiertas.md`: hoy no hay reactivación autoservicio.
        if (existingUser != null) {
            authThrottleService.registrarIntento(AmbitoIntentos.REGISTRO, userRequest.email)
            throw DuplicatedEmailException("Este correo no se encuentra disponible, por favor intenta con uno diferente")
        }

        // El teléfono YA NO se comprueba por unicidad en el alta pública (`ADR-5-E3-05`). El mensaje
        // «este número no se encuentra disponible» era un oráculo de enumeración: cualquiera podía
        // preguntarle al alta, sin autenticarse, si un número concreto tenía cuenta. Y la unicidad que
        // decía defender no existía: `customer.phone` NO tiene índice único en la base
        // (`V1__initial_schema.sql:1868-1869` es un índice normal), y la propia comprobación dejaba
        // pasar el número si la cuenta que lo tenía estaba deshabilitada. Se quita la comprobación,
        // no el mensaje: así el alta responde igual exista o no ese número.

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
        // La cuenta nace SIN verificar y con su token acuñado (§A2.1, §A6.4). El acceso NO se bloquea:
        // el alta sigue devolviendo sesión iniciada y bloquear es una decisión de producto que hoy no
        // se toma.
        val tokenDeVerificacion = emailVerificationService.prepararVerificacionDeAlta(newUser)
        val savedUser = customerRepository.save(newUser)

        coroutineScope.launch {
            emailService.sendEmail(
                to = savedUser.email,
                templateName = "welcome",
                variables = mapOf(
                    "customerName" to "${savedUser.name} ${savedUser.lastName}",
                    "companyName" to mailProperties.remitenteNombre
                )
            )
        }
        emailVerificationService.enviarCorreoDeVerificacion(
                nombre = savedUser.name,
                destino = savedUser.email,
                token = tokenDeVerificacion
        )

        authThrottleService.registrarExito(AmbitoIntentos.REGISTRO, userRequest.email)
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

        // R1-10 (`ADR-5-E3-C1-03`): aquí **tampoco** se comprueba la unicidad del teléfono, por la
        // misma razón que en `signUp` y por una añadida. La razón vieja: `customer.phone` no tiene
        // índice único en la base (`V1__initial_schema.sql:1868-1869` es un índice normal y parcial),
        // así que la comprobación no defendía ninguna restricción real. La añadida: desde que el alta
        // pública dejó de comprobarla, cualquiera puede registrar sin autenticarse dos cuentas con el
        // mismo número — y entonces `findByPhone`, que es una derivada de **resultado único**, lanzaba
        // `IncorrectResultSizeDataAccessException` y esta alta administrativa pasaba de un `400`
        // explicativo a un `500` provocable desde fuera. La comprobación se retira en los dos lados a
        // la vez para que el comportamiento sea el mismo; `findByPhone` se elimina del repositorio.

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
                    "companyName" to mailProperties.remitenteNombre,
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
        // R1-10: sin comprobación de unicidad del teléfono, igual que en `createUserByAdmin`. Aquí no
        // había `findByPhone`, así que no había `500`, pero sí un `400` que bloqueaba a la ADMIN por un
        // número que el alta pública deja repetir libremente. Coherencia en los dos lados.

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
                    "companyName" to mailProperties.remitenteNombre,
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