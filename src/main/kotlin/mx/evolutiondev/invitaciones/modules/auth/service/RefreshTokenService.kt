package mx.evolutiondev.invitaciones.modules.auth.service

import mx.evolutiondev.invitaciones.core.auth.jwt.JwtUtil
import mx.evolutiondev.invitaciones.core.auth.model.CustomerEntity
import mx.evolutiondev.invitaciones.core.auth.model.RefreshTokenEntity
import mx.evolutiondev.invitaciones.core.auth.repository.RefreshTokenRepository
import mx.evolutiondev.invitaciones.core.error.exception.UnauthorizedException
import mx.evolutiondev.invitaciones.core.error.exception.UserBannedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

@Service
class RefreshTokenService(
        private val refreshTokenRepository: RefreshTokenRepository,
        private val jwtUtil: JwtUtil,
        /**
         * Ventana de gracia de la detección de reutilización (R1-07). Un canje de un token que
         * acaba de consumirse **no** revoca la familia: es lo que hacen dos pestañas que refrescan
         * a la vez, o un reintento tras un corte de red. Pasada la ventana, el mismo canje ya no
         * tiene explicación benigna y sí revoca. Ver el KDoc de [rotateRefreshToken].
         */
        @Value("\${auth.refresh.gracia-reutilizacion-segundos:30}") private val graciaSegundos: Long = 30,
        /** Cuánto se recuerda un token consumido. Por defecto la vida del refresco: siete días. */
        @Value("\${auth.refresh.memoria-consumidos-horas:168}") private val memoriaConsumidosHoras: Long = 168,
        @Value("\${auth.refresh.max-consumidos:50000}") private val maxConsumidos: Int = 50_000,
) {
    private val refreshTokenValidityMillis: Long = 7 * 24 * 60 * 60 * 1000 // 1 week

    private val log = LoggerFactory.getLogger(RefreshTokenService::class.java)

    /**
     * Rastro de los tokens ya canjeados: **huella** del token → cuenta y momento del canje.
     *
     * Es lo que hace posible atribuir un canje repetido a una cuenta después de que la fila se haya
     * borrado. Se guarda la huella SHA-256, no el token: este mapa vive mucho más que la petición y
     * no tiene por qué contener material de sesión utilizable.
     *
     * En memoria y por instancia, como el resto de los limitadores del módulo
     * (`AuthThrottleService.kt:159-163`) y con la misma contrapartida escrita en
     * `preguntas-abiertas.md`: con más de una instancia, o tras un reinicio, la **detección** se
     * pierde. Falla hacia el lado seguro —deja de revocar, nunca revoca de más— y ninguna de las
     * dos propiedades duras depende de él: el canje repetido sigue fallando siempre, y de una
     * carrera sigue saliendo un único token válido, porque eso lo garantiza la base de datos.
     */
    private data class Consumido(val customerId: Long, val instante: Long)

    private val consumidos = ConcurrentHashMap<String, Consumido>()

    /** Inyectable **solo** desde las pruebas, para avanzar la ventana sin esperar. */
    internal var reloj: () -> Long = System::currentTimeMillis

    /**
     * Sesión nueva (`POST /auth/token`, `POST /auth/signup`): se revocan **todas** las de la cuenta y
     * se emite una.
     *
     * Antes se buscaba la fila con `findByCustomer` —una derivada de **resultado único**— y se
     * borraba esa. Era la misma trampa que R1-10 retiró de `findByPhone`: `refresh_tokens` no tiene
     * unicidad por cuenta (`V1__initial_schema.sql:1611` es única por `token`), así que dos filas de
     * la misma cuenta —que la rotación en carrera sabía producir antes de R1-07— convertían el
     * acceso en un `500`. El borrado en bloque no puede quedarse corto y además deja el efecto que
     * se quiere: entrar con la contraseña **echa** a cualquier sesión de refresco anterior, robada
     * incluida.
     */
    fun createOrUpdateRefreshToken(customer: CustomerEntity): RefreshTokenEntity {
        refreshTokenRepository.deleteAllByCustomerId(customer.id)

        val expiryDate = Instant.now().plusMillis(refreshTokenValidityMillis)
        val token = jwtUtil.generateSecureToken()

        val refreshToken = RefreshTokenEntity(
                token = token,
                expiryDate = expiryDate,
                customer = customer
        )

        return refreshTokenRepository.save(refreshToken)
    }

    /**
     * Canje del token de refresco **con rotación y detección de reutilización**
     * (`12-producto-completo.md §A2.1`, `ADR-5-E3-01`, `ADR-5-E3-C4-01`).
     *
     * Cada canje quema el token usado y emite uno nuevo, así que el token robado deja de valer en
     * cuanto la persona legítima refresca. Lo que R1-07 objetó de la primera versión, y lo que se
     * arregla aquí, son las otras dos mitades:
     *
     * **1. En carrera salían dos tokens válidos.** `delete` cargaba la entidad y la borraba en su
     * propia transacción, sin mirar si seguía ahí: dos canjes simultáneos del mismo token pasaban
     * los dos por la validación —la fila aún existía para los dos— y los dos insertaban. Ahora el
     * borrado es un `DELETE … WHERE token = ?` que **devuelve cuántas filas borró**
     * ([RefreshTokenRepository.deleteByToken]); la base de datos serializa los dos, uno recibe 1 y el
     * otro 0, y **solo el que recibe 1 emite token**. El que recibe 0 no revoca nada: acaba de
     * perder una carrera de milisegundos, que es lo que hacen dos pestañas abiertas.
     *
     * **2. El canje repetido no delataba a nadie.** Que un token ya consumido vuelva a presentarse
     * es *la* señal de que alguien lo copió, y antes solo producía un error para la víctima
     * mientras el ladrón seguía dentro sus siete días. Ahora el canje de un token consumido revoca
     * **la familia entera** de esa cuenta ([RefreshTokenRepository.deleteAllByCustomerId]): el
     * ladrón se queda fuera, y la persona legítima vuelve a entrar con su contraseña.
     *
     * **La ventana de gracia, y por qué existe.** Revocar la familia ante *cualquier* canje fallido
     * convierte una carrera benigna —dos pestañas, un reintento tras un corte de red, el móvil y el
     * navegador a la vez— en un cierre de sesión con contraseña de por medio. Eso es un fallo
     * frecuente y visible a cambio de un ataque raro, y empuja justo al comportamiento que no
     * queremos: gente que deja de usar la aplicación en dos sitios, o que aprende a ignorar el aviso.
     * Por eso el canje de un token consumido **hace menos de [graciaSegundos]** falla sin revocar
     * —no hay explicación maliciosa que necesite ese margen: quien roba un token lo usa cuando puede,
     * no en la misma decena de segundos que la víctima— y pasado ese margen sí revoca. El caso que
     * de verdad importa, el del informe (el ladrón canjea y la víctima refresca horas después, o al
     * revés), cae siempre fuera de la ventana.
     *
     * **Y qué pasa si la detección no llega a tiempo**: la víctima entra con su contraseña, y
     * [createOrUpdateRefreshToken] borra **todas** las filas de la cuenta, así que ese acceso echa al
     * ladrón igualmente. La detección adelanta el corte; no es lo único que corta.
     *
     * **Por qué NO lleva `@Transactional`**, que era la letra del arreglo propuesto en R1-07: este
     * método termina **lanzando** en los tres caminos que escriben algo interesante (token
     * desconocido, token consumido, carrera perdida), y una transacción de método revertiría
     * precisamente la revocación de la familia —la única escritura que tiene que sobrevivir a la
     * excepción—. La atomicidad que hace falta no es la del par borrado+alta, sino la del borrado
     * consigo mismo, y esa la da la propia sentencia: un `DELETE` de una fila es atómico y su cuenta
     * de filas es el testigo. Si el alta fallara después del borrado, la sesión se pierde y hay que
     * volver a entrar: molesto, seguro y muchísimo menos malo que perder la revocación.
     *
     * El contrato de la respuesta **no cambia**: mismos campos, con un `refreshToken` distinto, y el
     * mismo texto de error en todos los caminos que fallan —el cuerpo no dice si hubo revocación,
     * que sería contarle al ladrón que se le vio—.
     */
    fun rotateRefreshToken(token: String): RefreshTokenEntity {
        val actual = refreshTokenRepository.findByToken(token)
                ?: throw canjeSinFila(token)

        validarVigencia(actual)
        val customer = actual.customer

        if (refreshTokenRepository.deleteByToken(token) != 1) {
            // Carrera perdida: otro canje del mismo token se lo llevó hace milisegundos. No se
            // revoca la familia (ver el KDoc): es el caso benigno por excelencia y quien ganó ya
            // tiene un token válido.
            throw IllegalArgumentException(TOKEN_INVALIDO)
        }
        anotarConsumido(token, customer.id)

        val nuevo = RefreshTokenEntity(
                token = jwtUtil.generateSecureToken(),
                expiryDate = Instant.now().plusMillis(refreshTokenValidityMillis),
                customer = customer
        )
        return refreshTokenRepository.save(nuevo)
    }

    fun validateRefreshToken(token: String): RefreshTokenEntity {
        val refreshToken = refreshTokenRepository.findByToken(token)
                ?: throw IllegalArgumentException(TOKEN_INVALIDO)

        validarVigencia(refreshToken)
        return refreshToken
    }

    /**
     * Caducidad y estado de la cuenta. Cada borrado de aquí es limpieza: la fila ya no vale para
     * nada y el token se rechaza igual esté o no borrada.
     */
    private fun validarVigencia(refreshToken: RefreshTokenEntity) {
        if (refreshToken.expiryDate.isBefore(Instant.now())) {
            refreshTokenRepository.delete(refreshToken)
            throw IllegalArgumentException("El token de refresco ha expirado")
        }

        val customer = refreshToken.customer
        if (!customer.isEnabled) {
            refreshTokenRepository.delete(refreshToken)
            throw UnauthorizedException("Las credenciales no coinciden con nuestros registros")
        }
        if (customer.isBanned) {
            refreshTokenRepository.delete(refreshToken)
            throw UserBannedException("Su cuenta ha sido bloqueada. Contacte al administrador.")
        }
    }

    /**
     * No hay fila para este token: o nunca existió, o **ya se canjeó**. El segundo caso es el que
     * importa y el rastro de [consumidos] es lo que permite distinguirlo y saber de quién era.
     *
     * Devuelve la excepción en vez de lanzarla para que quien llama la lance: así el camino de
     * revocación queda a la vista en un solo sitio y el mensaje es el mismo que el de los demás.
     */
    private fun canjeSinFila(token: String): RuntimeException {
        val ahora = reloj()
        val huella = huella(token)
        val consumido = consumidos[huella]
        if (consumido != null && ahora - consumido.instante > graciaSegundos * 1000) {
            val revocadas = refreshTokenRepository.deleteAllByCustomerId(consumido.customerId)
            consumidos.remove(huella)
            log.warn(
                    "auth: token de refresco reutilizado {} s después de su canje; revocadas {} sesiones de la cuenta {}",
                    (ahora - consumido.instante) / 1000, revocadas, consumido.customerId,
            )
        }
        return IllegalArgumentException(TOKEN_INVALIDO)
    }

    private fun anotarConsumido(token: String, customerId: Long) {
        val ahora = reloj()
        consumidos[huella(token)] = Consumido(customerId, ahora)
        podar(ahora)
    }

    /**
     * Mantiene el rastro acotado: primero se van los recuerdos ya inútiles (más viejos que la vida
     * del refresco) y, si aun así se llega al tope, el decil más antiguo. Misma forma que
     * `AuthThrottleService.podar`, con el mismo motivo: O(n) solo cuando el mapa está lleno.
     */
    private fun podar(ahora: Long) {
        if (consumidos.size < maxConsumidos) return
        val caducado = ahora - memoriaConsumidosHoras * 3_600_000L
        consumidos.values.removeIf { it.instante <= caducado }
        if (consumidos.size < maxConsumidos) return
        val instantes = consumidos.values.map { it.instante }.sorted()
        val umbral = instantes[(instantes.size / 10).coerceAtLeast(1) - 1]
        consumidos.values.removeIf { it.instante <= umbral }
        log.warn("auth: el rastro de tokens consumidos llegó al tope de {} entradas; desalojado el decil más antiguo", maxConsumidos)
    }

    /** Huella SHA-256 en hexadecimal. Ver el KDoc de [consumidos]: el mapa no guarda el token. */
    private fun huella(token: String): String =
            MessageDigest.getInstance("SHA-256")
                    .digest(token.toByteArray(Charsets.UTF_8))
                    .joinToString("") { "%02x".format(it) }

    companion object {
        /**
         * Un único texto para todos los canjes que fallan. Si el cuerpo distinguiera «no existe» de
         * «ya se usó» —o dijera que hubo revocación— le estaría diciendo a quien copió el token qué
         * ha pasado con él.
         */
        private const val TOKEN_INVALIDO = "El token de refresco no es válido"
    }
}
