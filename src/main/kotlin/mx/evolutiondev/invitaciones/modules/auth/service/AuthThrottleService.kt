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
enum class AmbitoIntentos(val prefijo: String, val topeGlobal: Boolean) {
    /**
     * `POST /auth/token` — el de I-02. Cada fallo de credenciales cuenta; un acceso correcto limpia.
     *
     * **Sin tope global** (R3-01), y a propósito: aquí la defensa dura es el cubo por cuenta
     * (5/15 min), que es el que de verdad acota la adivinación contra un objetivo. Un techo de
     * fallos para toda la plataforma sería el peor interruptor posible —cualquiera lo agota y **nadie
     * puede entrar**— a cambio de nada que el cubo por cuenta no dé ya.
     */
    ACCESO("acceso", topeGlobal = false),

    /**
     * `POST /auth/request-password-reset` — **cada** petición cuenta; no hay «éxito» que limpie.
     * Lleva tope global: es `permitAll`, acuña un token y manda correo, y sin proxy declarado no hay
     * ninguna otra identidad que acote el caudal (R3-01).
     */
    RECUPERACION("recuperacion", topeGlobal = true),

    /**
     * `POST /auth/signup` — **cada** petición cuenta, la rechazada y la que crea la cuenta (R2-02).
     *
     * Hasta la re-revisión, un alta correcta llamaba a [AuthThrottleService.registrarExito], que
     * borra el contador de IP: las altas con éxito no se acumulaban nunca y el techo de 20/IP solo
     * frenaba tanteos fallidos, de modo que cinco cuentas seguidas desde una IP no veían un solo
     * `429`. Y el alta con éxito es precisamente la petición cara: escribe una fila de `customer` y
     * encola **dos** correos. Aquí no hay «éxito» que limpie nada, igual que en [RECUPERACION].
     */
    REGISTRO("registro", topeGlobal = true),

    /**
     * `POST /auth/verify-email:resend` (fase 5, E3; `12-producto-completo.md §A6.4` punto 5).
     * **Cada** petición cuenta, como en [RECUPERACION]: la respuesta es genérica siempre, así que no
     * hay «éxito» observable que pueda limpiar el contador. Sin este ámbito el reenvío sería un
     * amplificador de correo —una petición sin autenticar, un correo enviado— sobre un canal SMTP de
     * cuenta gratuita.
     */
    VERIFICACION("verificacion", topeGlobal = true),

    /**
     * `PUT /user/account/password` y `POST /user/account/email` (fase 5, E3). Ámbito **propio** y no
     * [ACCESO] a propósito: si compartieran contador, quien robase una sesión podría dejar a la
     * persona legítima sin poder **entrar** fallando adrede el cambio de contraseña. Con ámbito
     * propio, agotar el cambio de contraseña agota exactamente el cambio de contraseña.
     */
    CAMBIO_CUENTA("cambio-cuenta", topeGlobal = false),
}

/**
 * I-02 (H-ADV-05): límite de intentos y hash señuelo para `POST /auth/token`.
 *
 * ### Con qué identidad limita, y qué protege cada cubo (R3-01)
 * El cubo por **IP** sólo cuenta cuando el despliegue ha declarado que hay un proxy de confianza
 * delante ([confiarEnXff]). Es la misma decisión que R2-01 obligó a tomar en
 * `ProductInvitationThrottle` (`ADR-5-E3-C4-02`) y por la misma razón: con `confiar-en-x-forwarded-for`
 * en `false` —que es el defecto correcto mientras nadie declare el proxy— `remoteAddr` es la
 * dirección del **proxy para todo el mundo**, así que ese cubo no limita a un cliente: es un
 * interruptor de plataforma. Reproducido en `5-E3-R3-verificacion.md §4`: veinte peticiones a
 * `/auth/signup` dejaban a **cualquier** clienta sin poder registrarse durante quince minutos, y a
 * partir del sexto alta nadie recibía el correo de verificación.
 *
 * Aquí no se podía copiar la otra mitad del arreglo de R2-01 —limitar por `customer_id`— porque el
 * alta, la recuperación y el reenvío **no tienen usuario**: son `permitAll`. Así que lo que queda,
 * cuando no hay proxy declarado, es esto:
 *
 * | Cubo | Cuándo cuenta | Qué protege |
 * |---|---|---|
 * | por **cuenta** (correo), 5/ventana | siempre | que no se machaque una dirección concreta |
 * | por **IP**, 20/ventana | sólo con proxy declarado | que un cliente concreto no acapare |
 * | **global de ámbito**, 300/ventana | siempre, en los ámbitos sin usuario | que un guión desbocado no escriba filas sin fin |
 * | envío por **destinatario**, 5/ventana | siempre | que no se bombardee un buzón |
 * | envío por **IP**, 5/ventana | sólo con proxy declarado | que un cliente concreto no acapare el correo |
 * | envío **global de ámbito**, 60/ventana | siempre | que el producto no sea un cañón de correo |
 *
 * Lo que **no** queda protegido sin proxy declarado, dicho con todas las letras: quien esté dispuesto
 * a sostener más de veinte peticiones por minuto puede agotar el tope global de un ámbito y dejar a
 * la plataforma sin altas (o sin recuperaciones, o sin reenvíos) el resto de la ventana. No hay forma
 * de evitarlo sin una identidad de cliente: por eso el tope global es **holgado** —está para acotar
 * la catástrofe, no para ser el freno de cada día— y por eso el arreglo de verdad es declarar el
 * proxy. Ver `preguntas-abiertas.md`.
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
         * R3-01. Techo de correos por **destinatario**, ámbito y ventana. Es el cubo de envíos que
         * **no** depende de ver la IP del cliente: sin proxy declarado, el de arriba no cuenta, y sin
         * éste el reenvío y el alta seguirían pudiendo bombardear un buzón concreto. Cinco por el
         * mismo motivo que [maxEnviosPorIp]: un buzón real casi nunca necesita más en un cuarto de
         * hora.
         */
        @Value("\${auth.token.throttle.max-envios-por-destino:5}") private val maxEnviosPorDestino: Int = 5,
        /**
         * R3-01. Techo de correos que salen **en todo el despliegue** por ámbito y ventana. Protege el
         * recurso que de verdad es compartido —la cuenta SMTP y la reputación del dominio— del caso
         * que ningún cubo por dirección puede parar: una lista de direcciones reales, una petición por
         * dirección.
         *
         * Es **por ámbito**, no uno solo para todos: si fuera compartido, gastar el correo del alta
         * dejaría sin correo a la recuperación, que es exactamente la denegación cruzada que el KDoc
         * de [AmbitoIntentos] explica que hay que evitar.
         *
         * 60 y no 300 a propósito: agotar esto **degrada** (no sale el correo, la operación sigue) y
         * queda un `WARN` en el registro para quien opera, mientras que agotar [maxGlobalPorAmbito]
         * **deniega**. Al recurso caro se le pone el techo bajo porque equivocarse a la baja cuesta un
         * reenvío; al que deniega, el techo alto.
         */
        @Value("\${auth.token.throttle.max-envios-globales:60}") private val maxEnviosGlobales: Int = 60,
        /**
         * R3-01. Techo de peticiones **de todo el despliegue** por ámbito y ventana, para los ámbitos
         * sin usuario ([AmbitoIntentos.topeGlobal]). Existe porque, sin proxy declarado, no hay
         * ninguna otra identidad: el cubo por correo se esquiva rotando la dirección y el de IP no
         * cuenta. Está deliberadamente **holgado** —300 en quince minutos son veinte por minuto, muy
         * por encima de cualquier ráfaga legítima de este producto— porque su trabajo es acotar la
         * catástrofe, no frenar el uso normal; y porque cuanto más bajo, más barato le sale a
         * cualquiera dejar a la plataforma sin altas. Ver la tabla del KDoc de la clase.
         */
        @Value("\${auth.token.throttle.max-global-por-ambito:300}") private val maxGlobalPorAmbito: Int = 300,
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

    /**
     * Presupuesto de envíos (R1-14, ampliado en R3-01). Separado de [porIp] porque cuenta cosas
     * distintas: envíos que de verdad salen, no peticiones. Un solo mapa con tres formas de clave
     * —`ip:…`, `destino:…` y `global:…`— para que la poda sea la misma para las tres.
     */
    private val porEnvio = ConcurrentHashMap<String, Ventana>()

    /**
     * R3-01. Techo de peticiones para **todo el despliegue**, por ámbito. La clave es el prefijo del
     * ámbito y nada más: aquí no hay identidad que meter, y ése es justamente el punto.
     */
    private val porAmbito = ConcurrentHashMap<String, Ventana>()

    /**
     * Ventana de envíos cuyo agotamiento ya se avisó, por clave global. Sirve para que el aviso salga
     * **una vez por ventana** y no una vez por rechazo. Tiene tantas entradas como ámbitos con correo,
     * así que no necesita poda.
     */
    private val avisadoHasta = ConcurrentHashMap<String, Long>()

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
                "auth: límite de intentos activo en {} — {} fallos/cuenta, ventana {} min, tope {} entradas",
                AmbitoIntentos.entries.joinToString(", ") { it.prefijo },
                maxFallosPorCuenta, ventanaMinutos, maxEntradas
        )
        // R3-01. Que quien opera lea en el arranque con qué se está protegiendo de verdad, sin tener
        // que deducirlo: sin proxy declarado, los cubos por IP no cuentan y el techo es el global.
        if (confiarEnXff) {
            log.info(
                    "auth: proxy de confianza DECLARADO — límite por IP activo ({} fallos/IP, {} envíos/IP por ventana)",
                    maxFallosPorIp, maxEnviosPorIp
            )
        } else {
            log.info(
                    "auth: SIN proxy de confianza declarado — los cubos por IP NO cuentan (serían un techo " +
                            "para toda la plataforma, no por cliente). Quedan: {} intentos/cuenta, {} peticiones " +
                            "por ámbito y ventana en {}, {} envíos/destinatario y {} envíos por ámbito y ventana",
                    maxFallosPorCuenta, maxGlobalPorAmbito,
                    AmbitoIntentos.entries.filter { it.topeGlobal }.joinToString(", ") { it.prefijo },
                    maxEnviosPorDestino, maxEnviosGlobales
            )
        }
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
        // El cubo por IP sólo vale cuando la IP que se ve es la del cliente (R3-01): ver el KDoc de
        // la clase. Sin proxy declarado no se mira siquiera, porque bloquearía a todo el mundo a la vez.
        if (confiarEnXff && bloqueada(porIp, claveIp(ambito), maxFallosPorIp, ahora)) throw DemasiadosIntentosException()
        if (ambito.topeGlobal && bloqueada(porAmbito, ambito.prefijo, maxGlobalPorAmbito, ahora)) throw DemasiadosIntentosException()
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
        if (confiarEnXff) incrementar(porIp, claveIp(ambito), ahora)
        if (ambito.topeGlobal) incrementar(porAmbito, ambito.prefijo, ahora)
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
        if (confiarEnXff) porIp.remove(claveIp(ambito))
        // [porAmbito] NO se limpia nunca con un éxito, y es deliberado (R3-01): es un techo de
        // plataforma, así que dejar que una operación correcta lo reinicie equivale a no tenerlo —el
        // hallazgo exacto de R2-02, que aquí volvería multiplicado por todas las cuentas del mundo—.
        // Los dos ámbitos que llaman a este método no llevan tope global, así que hoy no hay nada que
        // limpiar; la línea que falta es la que importa.
    }

    /** Un acceso correcto por `POST /auth/token`. */
    fun registrarExito(email: String) = registrarExito(AmbitoIntentos.ACCESO, email)

    /**
     * Pide permiso para **mandar un correo** a [destino] en este ámbito (R1-14; extendido al alta en
     * R2-02; repartido en tres cubos en R3-01). Devuelve `true` y consume una unidad de cada cubo si
     * queda presupuesto en la ventana; `false` si alguno se agotó, sin gastar ninguno.
     *
     * Los tres cubos, y por qué hacen falta los tres (R3-01):
     * - **por destinatario** (5): que nadie use el producto para bombardear un buzón. Es el único que
     *   funciona sin ver la IP del cliente, y por eso es el que se añadió.
     * - **por IP** (5): sólo cuando hay proxy declarado ([confiarEnXff]). Antes era el único, y sin
     *   proxy no acotaba a un cliente sino a la plataforma entera: cinco altas y **nadie** recibía su
     *   correo de verificación, en silencio (`5-E3-R3-verificacion.md §4`).
     * - **global del ámbito** (60): el que sustituye al anterior en su papel de techo de caudal, ahora
     *   con un número elegido para eso y con un `WARN` en el registro cuando se agota.
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
    fun consumirEnvio(ambito: AmbitoIntentos, destino: String): Boolean {
        val ahora = reloj()
        val porDestino = "destino:" + ambito.prefijo + ":" + destino.trim().lowercase(Locale.ROOT).take(320)
        val global = "global:" + ambito.prefijo
        val porCliente = if (confiarEnXff) "ip:" + claveIp(ambito) else null

        // Se mira ANTES de gastar en los tres cubos: si uno no tiene hueco, no se consume de los
        // otros. Dos hilos justo en el borde pueden colarse por uno; el sobrepaso está acotado por el
        // número de hilos y no cambia el orden de magnitud de ningún techo.
        if (!hayHueco(porEnvio, porDestino, maxEnviosPorDestino, ahora)) return false
        if (porCliente != null && !hayHueco(porEnvio, porCliente, maxEnviosPorIp, ahora)) return false
        if (!hayHueco(porEnvio, global, maxEnviosGlobales, ahora)) {
            // El único de los tres que se avisa: que el correo del producto entero se haya agotado no
            // puede enterarse nadie sólo porque una clienta se quede sin él (R3-01). Al que llama se
            // le sigue devolviendo `false` a secas —el silencio hacia fuera es lo que evita el
            // oráculo—, pero quien opera tiene aquí la línea.
            //
            // **Una sola línea por ventana**, no una por rechazo: bajo ataque los rechazos son
            // cientos, y un arreglo sobre el registro que convierta el registro en un altavoz sería
            // un mal chiste. La marca es el fin de la ventana viva, así que la siguiente ventana que
            // se agote vuelve a avisar.
            val ventana = porEnvio[global]?.hasta
            if (ventana != null && avisadoHasta.put(global, ventana) != ventana) {
                log.warn(
                        "auth: presupuesto de correo AGOTADO en el ámbito {} ({} envíos por ventana de {} min); " +
                                "las siguientes operaciones de este ámbito NO mandarán correo hasta que la ventana caduque",
                        ambito.prefijo, maxEnviosGlobales, ventanaMinutos
                )
            }
            return false
        }

        incrementar(porEnvio, porDestino, ahora)
        if (porCliente != null) incrementar(porEnvio, porCliente, ahora)
        incrementar(porEnvio, global, ahora)
        return true
    }

    /** ¿Cabe una unidad más en la ventana viva de esta clave? No consume nada. */
    private fun hayHueco(mapa: ConcurrentHashMap<String, Ventana>, clave: String, limite: Int, ahora: Long): Boolean {
        val v = mapa[clave] ?: return true
        return ahora >= v.hasta || v.fallos < limite
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
     * IP del cliente. **Sólo se llama con [confiarEnXff] puesto** (R3-01), que es la única situación
     * en la que lo que se ve es de verdad la dirección de quien llama: sin proxy declarado
     * `remoteAddr` es la del proxy para **todo el mundo** y el cubo dejaba de limitar a un cliente
     * para limitar a la plataforma. Con la bandera puesta se prefiere el primer salto de
     * `X-Forwarded-For`, que es lo que el proxy de confianza reescribe; `remoteAddr` queda de reserva
     * por si la cabecera no llega.
     *
     * Para activarlo hacen falta las dos cosas, y en este orden: `server.forward-headers-strategy` en
     * el despliegue —para que Spring reconstruya bien la petición— y
     * `auth.token.throttle.confiar-en-x-forwarded-for=true`. Anotado en `preguntas-abiertas.md`.
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
