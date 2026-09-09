package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import mx.evolutiondev.invitaciones.core.auth.model.Role
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.modules.auth.service.RefreshTokenService
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doAnswer
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

/**
 * `POST /auth/token/refresh` con rotación (`12-producto-completo.md §A2.1`, `ADR-5-E3-01`).
 *
 * Lo que vigila: **el token que se canjea deja de servir**. Antes de este cambio,
 * `RefreshTokenService.kt:38-58` validaba y `AuthController.kt:44-49` devolvía el mismo token, así que
 * uno robado servía los siete días completos y el uso legítimo no lo delataba nunca.
 *
 * Prueba de unidad pura: repositorio simulado con un mapa, sin Spring y sin base de datos.
 */
class RefreshTokenRotationTest {

    private val jwtUtil: JwtUtil = mock()
    private val repositorio: RefreshTokenRepository = mock()

    /** Almacén de mentira: lo que hay «en la tabla» de tokens de refresco. */
    private val tabla = mutableMapOf<String, RefreshTokenEntity>()

    private val cliente = CustomerEntity(
        id = 7,
        name = "Ana",
        lastName = "Ruiz",
        email = "ana@ejemplo.mx",
        password = "no-importa",
        role = Role.USER,
    )

    private val servicio = RefreshTokenService(repositorio, jwtUtil)

    private fun prepararRepositorio() {
        whenever(repositorio.findByToken(any())).doAnswer { invocacion -> tabla[invocacion.arguments[0]] }
        whenever(repositorio.save(any<RefreshTokenEntity>())).doAnswer { invocacion ->
            val entidad = invocacion.arguments[0] as RefreshTokenEntity
            tabla[entidad.token] = entidad
            entidad
        }
        whenever(repositorio.delete(any<RefreshTokenEntity>())).doAnswer { invocacion ->
            tabla.remove((invocacion.arguments[0] as RefreshTokenEntity).token)
            null
        }
    }

    private fun sembrar(token: String, vive: Boolean = true): RefreshTokenEntity {
        val entidad = RefreshTokenEntity(
            id = 1,
            token = token,
            expiryDate = if (vive) Instant.now().plusSeconds(3600) else Instant.now().minusSeconds(3600),
            customer = cliente,
        )
        tabla[token] = entidad
        return entidad
    }

    @Test
    @DisplayName("el canje devuelve un token DISTINTO del que se envio")
    fun elCanjeRota() {
        prepararRepositorio()
        sembrar("token-viejo")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-nuevo")

        val rotado = servicio.rotateRefreshToken("token-viejo")

        assertEquals("token-nuevo", rotado.token)
        assertNotEquals("token-viejo", rotado.token)
        assertEquals(cliente.id, rotado.customer.id)
    }

    @Test
    @DisplayName("el token ya canjeado NO vuelve a servir: el segundo canje falla")
    fun elTokenUsadoMuere() {
        prepararRepositorio()
        sembrar("token-viejo")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-nuevo")

        servicio.rotateRefreshToken("token-viejo")

        // Este es el punto entero del cambio: quien copió el token viejo ya no entra con él.
        assertFailsWith<IllegalArgumentException> { servicio.rotateRefreshToken("token-viejo") }
        verify(repositorio).delete(any<RefreshTokenEntity>())
    }

    @Test
    @DisplayName("el token nuevo si sirve para el siguiente canje")
    fun elTokenNuevoSirve() {
        prepararRepositorio()
        sembrar("token-viejo")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-nuevo", "token-tercero")

        servicio.rotateRefreshToken("token-viejo")
        val segundo = servicio.rotateRefreshToken("token-nuevo")

        assertEquals("token-tercero", segundo.token)
    }

    @Test
    @DisplayName("un token caducado se borra y no rota")
    fun elCaducadoNoRota() {
        prepararRepositorio()
        sembrar("token-caducado", vive = false)

        assertFailsWith<IllegalArgumentException> { servicio.rotateRefreshToken("token-caducado") }
        assert(tabla.isEmpty()) { "el token caducado tiene que quedar borrado" }
    }
}
