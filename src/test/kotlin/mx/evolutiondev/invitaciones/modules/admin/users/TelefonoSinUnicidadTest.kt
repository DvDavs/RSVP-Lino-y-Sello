package mx.evolutiondev.invitaciones.modules.admin.users

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.CustomerRepository
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.core.email.EmailService
import mx.evolutiondev.invitaciones.modules.admin.users.service.AdminUsersService
import mx.evolutiondev.invitaciones.modules.auth.presentation.model.response.UserRequest
import mx.evolutiondev.invitaciones.modules.auth.service.AuthThrottleService
import mx.evolutiondev.invitaciones.modules.auth.service.CustomerService
import mx.evolutiondev.invitaciones.modules.product.account.EmailVerificationService
import mx.evolutiondev.invitaciones.modules.product.account.ProductMailProperties
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import java.util.Optional

/**
 * R1-10 · La unicidad del teléfono se había retirado **a medias**.
 *
 * `ADR-5-E3-05` la quitó del alta pública porque era un oráculo de enumeración y porque la restricción
 * que decía defender no existe: `customer.phone` no tiene índice único
 * (`V1__initial_schema.sql:1868-1869` es un `CREATE INDEX` normal y parcial). Pero se quedó viva en las
 * rutas administrativas, y ahí `findByPhone` era una derivada de **resultado único**: en cuanto dos
 * cuentas compartían número —cosa que ahora cualquiera provoca sin autenticarse, registrando dos veces
 * el mismo teléfono— lanzaba `IncorrectResultSizeDataAccessException` y el alta administrativa pasaba de
 * un `400` explicativo a un `500` provocable desde fuera.
 *
 * Aquí se comprueba que el comportamiento es el mismo en los dos lados y que el arma ya no está.
 */
class TelefonoSinUnicidadTest {

    private val encoder = BCryptPasswordEncoder()
    private val repositorio: CustomerRepository = mock()
    private val jerarquia: HierarchyValidationService = mock()
    private val emailService: EmailService = mock()
    private val jwtUtil: JwtUtil = mock()
    private val limitador = AuthThrottleService(
        passwordEncoder = encoder,
        maxFallosPorCuenta = 5,
        maxFallosPorIp = 20,
        ventanaMinutos = 15,
        maxEntradas = 50_000,
    )

    private val verificacion = EmailVerificationService(
        customerRepository = repositorio,
        refreshTokenRepository = mock<RefreshTokenRepository>(),
        emailService = emailService,
        authThrottleService = limitador,
        jwtUtil = jwtUtil,
        mailProperties = ProductMailProperties(),
        frontendUrl = "https://linoysello.example",
        horasDeValidez = 24,
    )

    private val servicio = CustomerService(
        customerRepository = repositorio,
        passwordEncoder = encoder,
        hierarchyValidationService = jerarquia,
        emailService = emailService,
        authThrottleService = limitador,
        emailVerificationService = verificacion,
        mailProperties = ProductMailProperties(),
    )

    private fun alta(email: String, telefono: String?) = UserRequest(
        name = "Ana",
        lastName = "Ruiz",
        email = email,
        phone = telefono,
        birthdate = null,
        address = null,
        city = null,
        postalCode = null,
        state = null,
        howKnow = null,
        password = "Demo1234!",
    )

    @Test
    @DisplayName("R1-10: el alta administrativa acepta un telefono ya usado; no consulta unicidad ni revienta")
    fun elAltaAdministrativaAceptaUnTelefonoRepetido() {
        val creadora = CustomerEntity(id = 1, email = "admin@ejemplo.mx", role = Role.ADMIN)
        whenever(repositorio.findById(1L)).thenReturn(Optional.of(creadora))
        whenever(jerarquia.validateUserCreationHierarchy(any(), any())).thenReturn(true)
        whenever(repositorio.findByEmailEvenIfDisabled(any())).thenReturn(null)
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }

        // El mundo en el que dos clientas ya comparten ese numero. Antes: `existsByPhoneEvenIfDisabled`
        // decia `true`, `findByPhone` reventaba con IncorrectResultSizeDataAccessException y salia un 500.
        whenever(repositorio.existsByPhoneEvenIfDisabled(any())).thenReturn(true)

        val creada = servicio.createUserByAdmin(1L, alta("nueva@ejemplo.mx", "+525512345678"))

        assertEquals("+525512345678", creada.phone)
        assertEquals(Role.USER, creada.role)
        verify(repositorio, never()).existsByPhoneEvenIfDisabled(any())
    }

    @Test
    @DisplayName("R1-10: la reactivacion por ADMIN tampoco comprueba la unicidad del telefono")
    fun laReactivacionPorAdminAceptaUnTelefonoRepetido() {
        val creadora = CustomerEntity(id = 1, email = "admin@ejemplo.mx", role = Role.ADMIN)
        val dadaDeBaja = CustomerEntity(
            id = 9,
            email = "ana@ejemplo.mx",
            phone = "+525500000000",
            role = Role.USER,
        ).apply { isEnabled = false }

        whenever(repositorio.findById(1L)).thenReturn(Optional.of(creadora))
        whenever(jerarquia.validateUserCreationHierarchy(any(), any())).thenReturn(true)
        whenever(repositorio.findByEmailEvenIfDisabled("ana@ejemplo.mx")).thenReturn(dadaDeBaja)
        whenever(repositorio.save(any<CustomerEntity>())).doAnswer { it.arguments[0] as CustomerEntity }
        whenever(repositorio.existsByPhoneEvenIfDisabled(any())).thenReturn(true)

        // Numero DISTINTO del que tenia: es el caso que antes lanzaba el 400 «no disponible».
        val reactivada = servicio.createUserByAdmin(1L, alta("ana@ejemplo.mx", "+525512345678"))

        assertEquals("+525512345678", reactivada.phone)
        verify(repositorio, never()).existsByPhoneEvenIfDisabled(any())
    }

    @Test
    @DisplayName("R1-10: `findByPhone` ya no existe en el repositorio — el arma del 500 esta retirada")
    fun elRepositorioYaNoDeclaraFindByPhone() {
        val metodos = CustomerRepository::class.java.methods.map { it.name }
        assertFalse(
            metodos.contains("findByPhone"),
            "findByPhone es una derivada de resultado unico sobre una columna sin indice unico: " +
                "en cuanto hay dos filas lanza IncorrectResultSizeDataAccessException. No puede volver. " +
                "Metodos hoy: $metodos",
        )
    }

    @Test
    @DisplayName("R1-10: la actualizacion administrativa ya no comprueba la unicidad del telefono")
    fun laActualizacionAdministrativaYaNoComprueba() {
        val metodos = AdminUsersService::class.java.declaredMethods.map { it.name }
        assertNull(
            metodos.firstOrNull { it.contains("verifyIfPhoneIsUniqueForUpdate") },
            "la comprobacion del telefono tiene que haber desaparecido; metodos: $metodos",
        )
        // La del CORREO se queda: `customer.email` sí tiene indice unico de verdad
        // (`V1__initial_schema.sql:1605`) y sin ella el choque saldria como 500.
        assertFalse(
            metodos.none { it.contains("verifyIfEmailIsUniqueForUpdate") },
            "la comprobacion del correo NO se retira: esa restriccion sí existe en la base",
        )
    }
}
