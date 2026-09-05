package mx.evolutiondev.invitaciones.modules.auth.service

import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes

/**
 * `429` uniforme de `POST /auth/token`.
 *
 * Lleva `@ResponseStatus` en la propia clase a propósito: ningún `@ControllerAdvice` de la
 * aplicación la captura, así que Spring aplica el estado sin tocar los manejadores globales.
 * Verificado sobre el código real: `GeneralExceptionHandler` e `InternalExceptionHandler` sólo
 * declaran tipos concretos (ninguno es `RuntimeException` ni `Exception`), y el único
 * `@ExceptionHandler(Exception::class)` de la aplicación —`Templates2ExceptionHandler.kt:309`—
 * vive en un advice acotado con
 * `@RestControllerAdvice(basePackages = ["…modules.templates2.api"])` (`:55`), que no alcanza a
 * `AuthController`.
 *
 * El mensaje es **constante**: no dice si el bloqueo fue por cuenta o por IP, ni cuánto falta para
 * que expire. El cuerpo y el tiempo de respuesta son los mismos para un correo que existe y para
 * uno que no, porque el bloqueo se comprueba **antes** de tocar la base de datos y antes de
 * cualquier bcrypt.
 */
@ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
class DemasiadosIntentosException(
        message: String = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
) : RuntimeException(message)

/**
 * I-02 (H-ADV-05): límite de intentos y hash señuelo para `POST /auth/token`.
 *
 * La fase 3 publicó la pantalla `/acceso` y con ella abrió al público un `/auth/token` que
 * (a) no limitaba intentos —60 fallos seguidos, ninguno bloqueado— y (b) tenía un oráculo de
 * temporización de ~15× que permitía **enumerar cuentas**: `CustomerService.validateUser`
 * lanzaba `UnauthorizedException` en cuanto el repositorio devolvía `null`, sin llegar a
 * ejecutar el `PasswordEncoder`. El texto del error sí era ya idéntico en ambos casos.
 *
 * ### Por qué un `ConcurrentHashMap` y no Caffeine
 * Caffeine **no está en el classpath**: `./gradlew dependencies --configuration runtimeClasspath`
 * devuelve 0 coincidencias sobre 518 líneas. El encargo pedía no añadir dependencia nueva si era
 * posible, y lo es: un `ConcurrentHashMap` con ventana fija y poda explícita basta para dos
 * contadores enteros. La contrapartida (in-process, no distribuido; se pierde al reiniciar) queda
 * documentada en `preguntas-abiertas.md`.
 *
 * ### Ventana y contadores
 * Ventana **fija** de 15 min que arranca en el primer fallo de la clave. Al llegar al límite, todo
 * intento con esa clave responde `429` hasta que la ventana caduca. Dos contadores independientes:
 * por **cuenta** (correo normalizado) y por **IP**. Un fallo incrementa los dos; basta con que uno
 * esté al límite para bloquear.
 *
 * ### Un acceso correcto limpia los contadores
 * `registrarExito` borra la entrada de la cuenta **y** la de la IP. Así, un usuario legítimo nunca
 * queda bloqueado después de un `200`, y una oficina tras NAT no se autobloquea porque varios
 * compañeros hayan fallado. Contrapartida asumida y explícita: quien tenga unas credenciales
 * válidas puede reiniciar su propio contador de IP; el control duro sigue siendo el de cuenta
 * (5/15 min), que **no** lo limpia el éxito de otra cuenta.
 *
 * ### Memoria acotada
 * Los mapas no crecen sin tope: `podar()` borra primero las ventanas caducadas y, si aun así se
 * llega a `maxEntradas`, desaloja el decil que antes caduca. Las claves se truncan (correo 320,
 * IP 64) para que una cabecera enorme no infle la entrada. Con los valores por defecto el techo
 * son 2 × 50 000 entradas de dos campos (~pocos MB). La poda es O(n) pero sólo se ejecuta cuando
 * el mapa está en el tope, no en cada petición.
 */
@Service
class AuthThrottleService(
        private val passwordEncoder: PasswordEncoder,
        @Value("\${auth.token.throttle.max-fallos-por-cuenta:5}") private val maxFallosPorCuenta: Int = 5,
        @Value("\${auth.token.throttle.max-fallos-por-ip:20}") private val maxFallosPorIp: Int = 20,
        @Value("\${auth.token.throttle.ventana-minutos:15}") private val ventanaMinutos: Long = 15,
        @Value("\${auth.token.throttle.max-entradas:50000}") private val maxEntradas: Int = 50_000
) {

    private val log = LoggerFactory.getLogger(AuthThrottleService::class.java)

    /** Fin de la ventana (epoch ms) y fallos acumulados en ella. */
    private data class Ventana(val hasta: Long, val fallos: Int)

    private val porCuenta = ConcurrentHashMap<String, Ventana>()
    private val porIp = ConcurrentHashMap<String, Ventana>()

    /** Inyectable **sólo** desde las pruebas, para avanzar la ventana sin dormir 15 minutos. */
    internal var reloj: () -> Long = System::currentTimeMillis

    private val ventanaMs: Long get() = ventanaMinutos * 60_000L

    /**
     * Hash bcrypt señuelo, precalculado en el arranque con el **mismo** `PasswordEncoder` (y por
     * tanto el mismo coste) con el que se guardan las contraseñas reales. La contraseña de origen
     * es aleatoria y se descarta: nadie puede acertarla, y `matches` contra este hash siempre
     * devuelve `false` gastando exactamente lo que gasta un `matches` contra un usuario real.
     */
    val hashSenuelo: String = passwordEncoder.encode(UUID.randomUUID().toString() + UUID.randomUUID().toString())

    init {
        log.info(
                "auth: límite de intentos de /auth/token activo — {} fallos/cuenta, {} fallos/IP, ventana {} min, tope {} entradas",
                maxFallosPorCuenta, maxFallosPorIp, ventanaMinutos, maxEntradas
        )
    }

    /**
     * Lanza `DemasiadosIntentosException` si la cuenta **o** la IP están al límite.
     *
     * Se llama **antes** de consultar el repositorio: así el `429` cuesta lo mismo exista o no la
     * cuenta, y no gasta ni una consulta ni un bcrypt.
     */
    fun comprobar(email: String) {
        val ahora = reloj()
        if (bloqueada(porCuenta, claveCuenta(email), maxFallosPorCuenta, ahora)) throw DemasiadosIntentosException()
        if (bloqueada(porIp, ipCliente(), maxFallosPorIp, ahora)) throw DemasiadosIntentosException()
    }

    /** Un intento fallido: incrementa el contador de la cuenta y el de la IP. */
    fun registrarFallo(email: String) {
        val ahora = reloj()
        incrementar(porCuenta, claveCuenta(email), ahora)
        incrementar(porIp, ipCliente(), ahora)
    }

    /**
     * La contraseña coincidió: se borran los dos contadores. Es lo que garantiza que un usuario
     * legítimo no quede bloqueado justo después de un acceso correcto.
     */
    fun registrarExito(email: String) {
        porCuenta.remove(claveCuenta(email))
        porIp.remove(ipCliente())
    }

    /**
     * Gasta un bcrypt contra el hash señuelo. Se invoca en el camino «el correo no existe» para que
     * cueste lo mismo que «el correo existe y la contraseña es mala». Devuelve siempre `false`; el
     * valor se devuelve —en vez de descartarse— para que ni el compilador ni el JIT puedan eliminar
     * la llamada.
     */
    fun gastarHashSenuelo(passwordEnClaro: String): Boolean = passwordEncoder.matches(passwordEnClaro, hashSenuelo)

    // ---------------------------------------------------------------------------------------

    private fun bloqueada(mapa: ConcurrentHashMap<String, Ventana>, clave: String, limite: Int, ahora: Long): Boolean {
        val v = mapa[clave] ?: return false
        if (ahora >= v.hasta) {
            mapa.remove(clave, v)
            return false
        }
        return v.fallos >= limite
    }

    private fun incrementar(mapa: ConcurrentHashMap<String, Ventana>, clave: String, ahora: Long) {
        mapa.compute(clave) { _, actual ->
            if (actual == null || ahora >= actual.hasta) Ventana(ahora + ventanaMs, 1)
            else actual.copy(fallos = actual.fallos + 1)
        }
        podar(mapa, ahora)
    }

    /**
     * Mantiene el mapa acotado. Sólo hace algo cuando se ha alcanzado el tope, así que el coste
     * O(n) no se paga en el camino normal.
     */
    private fun podar(mapa: ConcurrentHashMap<String, Ventana>, ahora: Long) {
        if (mapa.size < maxEntradas) return
        mapa.values.removeIf { ahora >= it.hasta }
        if (mapa.size < maxEntradas) return
        // Sigue lleno de ventanas vivas (ataque distribuido): se desaloja el decil que antes caduca.
        val vencimientos = mapa.values.map { it.hasta }.sorted()
        val umbral = vencimientos[(vencimientos.size / 10).coerceAtLeast(1) - 1]
        mapa.values.removeIf { it.hasta <= umbral }
        log.warn("auth: el mapa de intentos llegó al tope de {} entradas; desalojado el decil más antiguo", maxEntradas)
    }

    /** Clave de cuenta normalizada: el mismo correo en otra caja no esquiva el contador. */
    private fun claveCuenta(email: String): String = email.trim().lowercase(Locale.ROOT).take(320)

    /**
     * IP del cliente. Se prefiere el primer salto de `X-Forwarded-For` porque en producción la
     * aplicación va detrás de un proxy y `remoteAddr` sería el del proxy para **todo el mundo**:
     * con 20 fallos se bloquearía a todos los usuarios a la vez. La contrapartida es que la
     * cabecera es falsificable mientras no haya proxy de confianza configurado
     * (`server.forward-headers-strategy` vive en `application.yml`, área prohibida), así que el
     * límite por IP es una defensa secundaria; la dura es la de cuenta. Anotado en
     * `preguntas-abiertas.md`.
     */
    private fun ipCliente(): String {
        val atributos = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
                ?: return "sin-peticion"
        val peticion = atributos.request
        val reenviada = peticion.getHeader("X-Forwarded-For")
        if (!reenviada.isNullOrBlank()) {
            val primera = reenviada.substringBefore(',').trim()
            if (primera.isNotEmpty()) return primera.take(64)
        }
        return (peticion.remoteAddr ?: "desconocida").take(64)
    }
}
