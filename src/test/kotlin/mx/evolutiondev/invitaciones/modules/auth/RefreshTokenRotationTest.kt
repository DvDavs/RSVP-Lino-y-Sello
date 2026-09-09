package mx.evolutiondev.invitaciones.modules.auth

import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue
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
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.time.Instant

/**
 * `POST /auth/token/refresh` con rotación y **detección de reutilización**
 * (`12-producto-completo.md §A2.1`, `ADR-5-E3-01`, `ADR-5-E3-C4-01`; R1-07).
 *
 * Lo que vigila, en tres capas:
 *
 *  a. **el token que se canjea deja de servir** — lo de siempre desde `ADR-5-E3-01`;
 *  b. **de una carrera sale un solo token válido** — antes salían dos, porque el borrado no miraba
 *     si la fila seguía ahí;
 *  c. **el canje de un token ya consumido revoca la familia entera**, que es la señal de que alguien
 *     lo copió… salvo dentro de la ventana de gracia, donde el canje repetido es lo que hacen dos
 *     pestañas y no cierra la sesión de nadie.
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

    /** Reloj de mentira, para cruzar la ventana de gracia sin esperar. */
    private var ahora = 1_000_000L

    private val servicio = RefreshTokenService(repositorio, jwtUtil, graciaSegundos = 30)
        .apply { reloj = { ahora } }

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
        // El `DELETE … WHERE token = ?` de verdad: devuelve cuántas filas borró.
        whenever(repositorio.deleteByToken(any())).doAnswer { invocacion ->
            if (tabla.remove(invocacion.arguments[0]) != null) 1 else 0
        }
        whenever(repositorio.deleteAllByCustomerId(any())).doAnswer { invocacion ->
            val id = invocacion.arguments[0] as Long
            val victimas = tabla.filterValues { it.customer.id == id }.keys.toList()
            victimas.forEach { tabla.remove(it) }
            victimas.size
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
        verify(repositorio).deleteByToken("token-viejo")
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

    /**
     * **R1-07, el hallazgo.** Canjear dos veces el mismo token, con la segunda vez fuera de la
     * ventana de gracia, es la firma de una copia: alguien tiene el token que la persona legítima ya
     * gastó. Entonces se revoca la familia entera, así que el token que salió del primer canje —el
     * que tiene quien ganó la carrera, ladrón incluido— **también muere**.
     *
     * Antes del arreglo esta prueba fallaba en la última línea: el segundo canje daba error y no se
     * revocaba nada, de modo que quien canjeó primero seguía dentro sus siete días.
     */
    @Test
    @DisplayName("R1-07: el canje repetido fuera de gracia revoca la familia entera")
    fun laReutilizacionRevocaLaFamilia() {
        prepararRepositorio()
        sembrar("token-robado")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-del-ladron")

        // 1) El ladrón llega primero y se lleva un token nuevo.
        val delLadron = servicio.rotateRefreshToken("token-robado")
        assertEquals("token-del-ladron", delLadron.token)

        // 2) Horas después, la persona legítima refresca con el token que le habían copiado.
        ahora += 3_600_000L
        assertFailsWith<IllegalArgumentException> { servicio.rotateRefreshToken("token-robado") }

        verify(repositorio).deleteAllByCustomerId(cliente.id)
        assertTrue(tabla.isEmpty(), "la familia entera tiene que quedar revocada, el token del ladron incluido")
    }

    /**
     * La otra cara, y la razón de que la ventana exista: dos pestañas que refrescan a la vez, o un
     * reintento tras un corte de red, **no** pueden cerrarle la sesión a nadie. El segundo canje
     * falla —el token ya no vale, eso no cambia— pero la sesión buena sigue viva.
     */
    @Test
    @DisplayName("la carrera benigna dentro de la gracia NO revoca la sesion")
    fun laCarreraBenignaNoRevoca() {
        prepararRepositorio()
        sembrar("token-viejo")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-nuevo")

        servicio.rotateRefreshToken("token-viejo")

        ahora += 2_000L // dos segundos: la otra pestaña
        assertFailsWith<IllegalArgumentException> { servicio.rotateRefreshToken("token-viejo") }

        verify(repositorio, never()).deleteAllByCustomerId(any())
        assertTrue(tabla.containsKey("token-nuevo"), "la sesion buena tiene que seguir viva")
    }

    /**
     * **R1-07, la otra mitad.** Dos canjes *simultáneos*: los dos leen la fila antes de que ninguno
     * la borre. Con el borrado viejo los dos insertaban y salían **dos refrescos válidos** de un
     * token robado. Ahora la base de datos serializa el `DELETE` y solo quien borra una fila emite.
     */
    @Test
    @DisplayName("R1-07: de dos canjes simultaneos sale UN solo token valido")
    fun laCarreraNoEmiteDosTokens() {
        val fila = RefreshTokenEntity(
            id = 1,
            token = "token-viejo",
            expiryDate = Instant.now().plusSeconds(3600),
            customer = cliente,
        )
        // Los dos canjes ven la fila (leyeron antes de que nadie borrara)...
        whenever(repositorio.findByToken("token-viejo")).thenReturn(fila, fila)
        // ...pero el borrado solo se lo lleva uno.
        whenever(repositorio.deleteByToken("token-viejo")).thenReturn(1, 0)
        whenever(repositorio.save(any<RefreshTokenEntity>())).doAnswer { it.arguments[0] as RefreshTokenEntity }
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-a", "token-b")

        val ganador = servicio.rotateRefreshToken("token-viejo")
        assertFailsWith<IllegalArgumentException> { servicio.rotateRefreshToken("token-viejo") }

        assertEquals("token-a", ganador.token)
        verify(repositorio, times(1)).save(any<RefreshTokenEntity>())
        // Perder una carrera de milisegundos no es una copia: no se revoca nada.
        verify(repositorio, never()).deleteAllByCustomerId(any())
    }

    /**
     * Entrar con la contraseña revoca **todas** las sesiones de refresco de la cuenta, no «la» fila
     * que devolviera una derivada de resultado único. Es la red de seguridad de la detección: aunque
     * la reutilización no se detecte (otra instancia, un reinicio), el acceso legítimo echa al
     * ladrón.
     */
    @Test
    @DisplayName("entrar con la contrasena revoca todas las sesiones anteriores")
    fun elAccesoRevocaLoAnterior() {
        prepararRepositorio()
        sembrar("token-de-antes")
        whenever(jwtUtil.generateSecureToken()).thenReturn("token-de-ahora")

        val nuevo = servicio.createOrUpdateRefreshToken(cliente)

        verify(repositorio).deleteAllByCustomerId(cliente.id)
        assertEquals("token-de-ahora", nuevo.token)
        assertEquals(setOf("token-de-ahora"), tabla.keys)
    }
}
