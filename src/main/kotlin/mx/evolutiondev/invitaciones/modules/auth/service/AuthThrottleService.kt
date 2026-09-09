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
 * `429` uniforme de `POST /auth/token`, `POST /auth/request-password-reset` y `POST /auth/signup`
 * (N-01, `ADR-3C-N01-01`).
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
 * Ámbito del contador (N-01, `ADR-3C-N01-01`).
 *
 * Cada extremo limitado lleva su **propio espacio de claves**; el prefijo forma parte de la clave
 * del mapa, así que `acceso:ana@…` y `recuperacion:ana@…` son entradas distintas. No es una
 * floritura: si las tres rutas compartieran contador, pedir cinco correos de recuperación para la
 * cuenta de otra persona la dejaría sin poder **entrar** durante 15 minutos — un ataque de
 * denegación NUEVO, creado por el propio arreglo. Con el prefijo, agotar la recuperación agota
 * exactamente la recuperación.
 *
 * La contrapartida, dicha con todas las letras: un atacante dispone de tres cubos en vez de uno, así
 * que el techo total de intentos por IP se multiplica por tres (20 → 60 en 15 min). Se acepta porque
 * los tres cubos protegen cosas distintas y ninguno de ellos es el que adivina contraseñas: el de
 * `/auth/token` sigue siendo 20 y sigue siendo el único que abre sesión.
 */
enum class AmbitoIntentos(val prefijo: String) {
    /** `POST /auth/token` — el de I-02. Cada fallo de credenciales cuenta; un acceso correcto limpia. */
    ACCESO("acceso"),

    /** `POST /auth/request-password-reset` — **cada** petición cuenta; no hay «éxito» que limpie. */
    RECUPERACION("recuperacion"),

    /**
     * `POST /auth/signup` — **cada** petición cuenta, la rechazada y la que crea la cuenta (R2-02).
     *
     * Hasta la re-revisión, un alta correcta llamaba a [AuthThrottleService.registrarExito], que
     * borra el contador de IP: las altas con éxito no se acumulaban nunca y el techo de 20/IP solo
     * frenaba tanteos fallidos, de modo que cinco cuentas seguidas desde una IP no veían un solo
     * `429`. Y el alta con éxito es precisamente la petición cara: escribe una fila de `customer` y
     * encola **dos** correos. Aquí no hay «éxito» que limpie nada, igual que en [RECUPERACION].
     */
    REGISTRO("registro"),

    /**
     * `POST /auth/verify-email:resend` (fase 5, E3; `12-producto-completo.md §A6.4` punto 5).
     * **Cada** petición cuenta, como en [RECUPERACION]: la respuesta es genérica siempre, así que no
     * hay «éxito» observable que pueda limpiar el contador. Sin este ámbito el reenvío sería un
     * amplificador de correo —una petición sin autenticar, un correo enviado— sobre un canal SMTP de
     * cuenta gratuita.
     */
    VERIFICACION("verificacion"),

    /**
     * `PUT /user/account/password` y `POST /user/account/email` (fase 5, E3). Ámbito **propio** y no
     * [ACCESO] a propósito: si compartieran contador, quien robase una sesión podría dejar a la
     * persona legítima sin poder **entrar** fallando adrede el cambio de contraseña. Con ámbito
     * propio, agotar el cambio de contraseña agota exactamente el cambio de contraseña.
     */
    CAMBIO_CUENTA("cambio-cuenta"),
}

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
 * ### Ámbitos (N-01, `ADR-3C-N01-01`)
 * Desde la fase 3-C el limitador cubre **tres** extremos —`/auth/token`, `/auth/signup` y
 * `/auth/request-password-reset`— y cada uno lleva su propio espacio de claves (`AmbitoIntentos`).
 * Los límites, la ventana y el cuerpo del `429` son los mismos en los tres; lo que no se comparte es
 * el contador.
 *
 * ### Un acceso correcto limpia los contadores — **solo en `ACCESO`** (R2-02)
 * `registrarExito` borra la entrada de la cuenta **y** la de la IP, dentro de su ámbito, y desde la
 * re-revisión lo llama únicamente `/auth/token`. Así, un usuario legítimo nunca
 * queda bloqueado después de un `200`, y una oficina tras NAT no se autobloquea porque varios
 * compañeros hayan fallado. En los ámbitos donde la operación con éxito es la cara —el alta, la
 * recuperación— limpiar con el éxito era tanto como no contar: ahí cuenta toda petición. Contrapartida asumida y explícita: quien tenga unas credenciales
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
        @Value("\${auth.token.throttle.max-entradas:50000}") private val maxEntradas: Int = 50_000,
        /**
         * R1-14. Techo de **correos que de verdad salen** por IP y ventana, para los ámbitos que
         * mandan correo sin autenticar. Existe porque el cubo por cuenta se indexa por el correo
         * recibido y por tanto se esquiva rotando la dirección: con una lista de direcciones reales sin
         * verificar, una petición por dirección era un correo por dirección y el único freno era el
         * cubo de 20 por IP. Este presupuesto cuenta envíos, no peticiones, así que la rotación deja de
         * amplificar.
         *
         * 5 y no 20 porque un buzón real casi nunca necesita más de un par de reenvíos en un cuarto de
         * hora, y porque el coste de equivocarse a la baja lo paga un botón deshabilitado, no una
         * cuenta perdida.
         */
        @Value("\${auth.token.throttle.max-envios-por-ip:5}") private val maxEnviosPorIp: Int = 5,
        /**
         * ¿Se puede creer la cabecera `X-Forwarded-For`? **Por defecto NO**, y no es paranoia: la
         * cabecera la pone el cliente, así que confiar en ella sin un proxy delante convierte el
         * límite por IP en decoración —basta rotar el valor en cada intento— y además deja pegar a
         * IP ajenas para bloquearlas. Sólo debe activarse cuando delante hay un proxy de confianza
         * que la reescribe. Medido en la revisión adversarial de la fase 3-B: con la cabecera
         * rotando, 25 intentos fallidos seguidos dieron 25 `401` y ningún `429`.
         */
        @Value("\${auth.token.throttle.confiar-en-x-forwarded-for:false}") private val confiarEnXff: Boolean = false
) {

    private val log = LoggerFactory.getLogger(AuthThrottleService::class.java)

    /** Fin de la ventana (epoch ms) y fallos acumulados en ella. */
    private data class Ventana(val hasta: Long, val fallos: Int)

    private val porCuenta = ConcurrentHashMap<String, Ventana>()
    private val porIp = ConcurrentHashMap<String, Ventana>()

    /** Presupuesto de envíos por IP y ámbito (R1-14). Separado de [porIp]: cuenta cosas distintas. */
    private val porEnvio = ConcurrentHashMap<String, Ventana>()

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
                "auth: límite de intentos activo en {} — {} fallos/cuenta, {} fallos/IP, ventana {} min, tope {} entradas",
                AmbitoIntentos.entries.joinToString(", ") { it.prefijo },
                maxFallosPorCuenta, maxFallosPorIp, ventanaMinutos, maxEntradas
        )
    }

    /**
     * Lanza `DemasiadosIntentosException` si la cuenta **o** la IP están al límite en ese ámbito.
     *
     * Se llama **antes** de consultar el repositorio: así el `429` cuesta lo mismo exista o no la
     * cuenta, y no gasta ni una consulta ni un bcrypt.
     */
    fun comprobar(ambito: AmbitoIntentos, email: String) {
        val ahora = reloj()
        if (bloqueada(porCuenta, claveCuenta(ambito, email), maxFallosPorCuenta, ahora)) throw DemasiadosIntentosException()
        if (bloqueada(porIp, claveIp(ambito), maxFallosPorIp, ahora)) throw DemasiadosIntentosException()
    }

    /** `POST /auth/token`. Se conserva sin ámbito para no tocar la firma que usa `CustomerService`. */
    fun comprobar(email: String) = comprobar(AmbitoIntentos.ACCESO, email)

    /**
     * Un intento que cuenta contra el límite: incrementa el contador de la cuenta y el de la IP
     * **dentro de su ámbito**. En `ACCESO` y `REGISTRO` es un intento *fallido*; en `RECUPERACION`
     * lo es toda petición, porque ahí no hay respuesta que distinga el éxito del fracaso.
     */
    fun registrarIntento(ambito: AmbitoIntentos, email: String) {
        val ahora = reloj()
        incrementar(porCuenta, claveCuenta(ambito, email), ahora)
        incrementar(porIp, claveIp(ambito), ahora)
    }

    /** Un intento fallido de `POST /auth/token`. */
    fun registrarFallo(email: String) = registrarIntento(AmbitoIntentos.ACCESO, email)

    /**
     * La operación salió bien: se borran los dos contadores **de ese ámbito**. Es lo que garantiza
     * que un usuario legítimo no quede bloqueado justo después de un acceso correcto, y que una
     * oficina tras NAT no se autobloquee.
     *
     * Lo llama **solo** [AmbitoIntentos.ACCESO], y con razón: ahí el éxito es una prueba de que
     * quien llama tiene credenciales, y lo que se limpia es un contador de *fallos*. Donde el éxito
     * es la operación cara —crear una cuenta y mandar dos correos ([AmbitoIntentos.REGISTRO]), o
     * mandar un correo de recuperación ([AmbitoIntentos.RECUPERACION])— limpiar el contador con el
     * éxito equivale a no tener contador: es lo que R2-02 encontró en el alta.
     */
    fun registrarExito(ambito: AmbitoIntentos, email: String) {
        // Solo lo usa ACCESO. `REGISTRO` dejó de llamarlo en R2-02 y `RECUPERACION` nunca lo llamó.
        porCuenta.remove(claveCuenta(ambito, email))
        porIp.remove(claveIp(ambito))
    }

    /** Un acceso correcto por `POST /auth/token`. */
    fun registrarExito(email: String) = registrarExito(AmbitoIntentos.ACCESO, email)

    /**
     * Pide permiso para **mandar un correo** en este ámbito desde esta IP (R1-14; extendido al alta
     * en R2-02). Devuelve `true` y consume una unidad si queda presupuesto en la ventana; `false` si
     * se agotó.
     *
     * Quien llama tiene que **callarse el `false`**: seguir respondiendo exactamente lo mismo y no
     * mandar el correo. Un `429` aquí sería un oráculo de enumeración nuevo —el presupuesto solo se
     * gasta con direcciones que existen y están sin verificar, así que el bloqueo delataría cuáles
     * son—; el silencio no cuenta nada y corta la amplificación igual.
     *
     * Es el mismo mapa in-process que el resto del limitador, con la misma limitación: **con más de
     * una instancia el techo se multiplica por el número de instancias**. Anotado en
     * `preguntas-abiertas.md`; es un asunto de despliegue, no de este código.
     */
    fun consumirEnvio(ambito: AmbitoIntentos): Boolean {
        val ahora = reloj()
        val clave = claveIp(ambito)
        var concedido = false
        porEnvio.compute(clave) { _, actual ->
            when {
                actual == null || ahora >= actual.hasta -> {
                    concedido = true
                    Ventana(ahora + ventanaMs, 1)
                }
                actual.fallos < maxEnviosPorIp -> {
                    concedido = true
                    actual.copy(fallos = actual.fallos + 1)
                }
                else -> actual
            }
        }
        podar(porEnvio, ahora)
        return concedido
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

    /**
     * Clave de cuenta normalizada y con ámbito: el mismo correo en otra caja no esquiva el contador,
     * y el contador de un extremo no puede bloquear otro (`AmbitoIntentos`). El prefijo va delante y
     * termina en `:`, que no puede aparecer en la parte normalizada de un correo válido, así que dos
     * ámbitos nunca colisionan.
     */
    private fun claveCuenta(ambito: AmbitoIntentos, email: String): String =
            ambito.prefijo + ":" + email.trim().lowercase(Locale.ROOT).take(320)

    /** Clave de IP con ámbito, por la misma razón que la de cuenta. */
    private fun claveIp(ambito: AmbitoIntentos): String = ambito.prefijo + ":" + ipCliente()

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
        // La cabecera sólo se mira si alguien ha declarado que hay un proxy de confianza delante.
        // Con `confiarEnXff = false` (el defecto) el contador va SIEMPRE contra la dirección real del
        // socket, que el cliente no puede falsificar.
        if (confiarEnXff) {
            val reenviada = peticion.getHeader("X-Forwarded-For")
            if (!reenviada.isNullOrBlank()) {
                val primera = reenviada.substringBefore(',').trim()
                if (primera.isNotEmpty()) return primera.take(64)
            }
        }
        return (peticion.remoteAddr ?: "desconocida").take(64)
    }
}
