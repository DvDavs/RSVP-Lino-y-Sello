package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes

/**
 * Límite de intentos de `/public/` + `r/{token}`, por **IP** y por **token** (contrato 5-2 §2).
 *
 * ### Instancia propia, no la de `/auth`
 * Copia la **disciplina** de `AuthThrottleService` —ventana fija en un `ConcurrentHashMap`, dos
 * contadores independientes, poda acotada, `X-Forwarded-For` desconfiado por defecto— pero **no** su
 * instancia ni sus mapas. El motivo es el mismo que llevó a `AmbitoIntentos`
 * (`AuthThrottleService.kt:38-52`): si el RSVP compartiera contador con `/auth`, una avalancha de
 * enlaces de invitados dejaría sin poder **entrar** a las clientas, que es una denegación de
 * servicio nueva creada por el propio arreglo. Con una clase aparte los dos ámbitos son disjuntos
 * por construcción, sin necesidad de prefijos ni de acordarse de pasarlos.
 *
 * ### Cuenta **toda** petición, no solo las fallidas
 * En `/auth/token` hay un «fallo» observable que contar. Aquí no: el `404` uniforme es
 * indistinguible del éxito para el que no tiene el enlace, así que lo que se limita es el **tráfico**
 * contra la ruta. Un invitado legítimo hace un puñado de peticiones (abrir, confirmar, cambiar de
 * opinión); los topes están puestos muy por encima de eso.
 *
 * ### Por qué el límite existe, dicho con todas las letras
 * **No** es confidencialidad. Los `confirmation_token` tienen 128 bits de entropía real
 * (`JwtUtil.kt:66-71`, hallazgo S-12), así que adivinar uno no es viable ni con el limitador apagado.
 * El límite existe por **coste**: evita que una avalancha de tokens inventados convierta una ruta
 * pública en una consulta a base de datos por paquete. De ahí que los topes sean generosos.
 *
 * ### El `429` no puede ser un oráculo
 * El cuerpo lo escribe [RsvpException.TooManyAttempts], que no tiene parámetros: es idéntico para un
 * token válido y para uno inventado. Y la comprobación va **antes** de la consulta, así que el `429`
 * tampoco se delata por el tiempo que tarda.
 *
 * ### Ningún token en memoria en claro, ninguno en un log
 * La clave del cubo por token es el **SHA-256** del token, no el token. Es un cambio barato que
 * quita los enlaces personales de un volcado de memoria, y hace imposible que un `toString()`
 * descuidado los escriba. Esta clase no registra jamás un token, una IP concreta, un nombre ni un
 * correo: su único `log` es el resumen de arranque y el aviso de mapa lleno, ninguno con datos de
 * nadie.
 *
 * ### Configuración
 * Los cuatro valores tienen **defecto en código** y no se han añadido a `application.yml`, que es
 * fichero compartido en esta fase. Si el orquestador decide que merecen variable de entorno, las
 * claves ya están escritas y basta con declararlas.
 */
@Service
class RsvpThrottleService(
    /**
     * Peticiones por token y ventana. 40 deja de sobra para abrir la página, confirmar, cambiar de
     * opinión y recargar unas cuantas veces; un enlace que recibe 40 peticiones en 15 minutos no lo
     * está usando la persona a la que se lo mandaron.
     */
    @Value("\${producto.rsvp.throttle.max-por-token:40}") private val maxPorToken: Int = 40,
    /**
     * Peticiones por IP y ventana. Alto **a propósito**: los invitados llegan por WhatsApp desde
     * redes móviles con NAT de operador, así que decenas de personas distintas comparten IP. Un tope
     * estrecho aquí no para a ningún atacante (que rota IP) y sí deja fuera a una familia entera.
     */
    @Value("\${producto.rsvp.throttle.max-por-ip:240}") private val maxPorIp: Int = 240,
    @Value("\${producto.rsvp.throttle.ventana-minutos:15}") private val ventanaMinutos: Long = 15,
    @Value("\${producto.rsvp.throttle.max-entradas:50000}") private val maxEntradas: Int = 50_000,
    /**
     * ¿Se puede creer `X-Forwarded-For`? **Por defecto no**, por la misma razón medida en la fase 3-B
     * y documentada en `AuthThrottleService.kt:113-121`: la cabecera la pone el cliente, así que sin
     * un proxy de confianza delante confiar en ella convierte el límite por IP en decoración y
     * además permite pegar a IP ajenas para bloquearlas.
     */
    @Value("\${producto.rsvp.throttle.confiar-en-x-forwarded-for:false}") private val confiarEnXff: Boolean = false,
) {

    private val log = LoggerFactory.getLogger(RsvpThrottleService::class.java)

    /** Fin de la ventana (epoch ms) y peticiones acumuladas en ella. */
    private data class Ventana(val hasta: Long, val intentos: Int)

    private val porToken = ConcurrentHashMap<String, Ventana>()
    private val porIp = ConcurrentHashMap<String, Ventana>()

    /** Inyectable **solo** desde las pruebas, para avanzar la ventana sin dormir 15 minutos. */
    internal var reloj: () -> Long = System::currentTimeMillis

    private val ventanaMs: Long get() = ventanaMinutos * 60_000L

    init {
        log.info(
            "rsvp: limite de intentos activo — {} por token, {} por IP, ventana {} min, tope {} entradas",
            maxPorToken, maxPorIp, ventanaMinutos, maxEntradas,
        )
    }

    /**
     * Lanza [RsvpException.TooManyAttempts] si el token **o** la IP están al límite.
     *
     * Se llama **antes** de tocar la base de datos y antes de validar el formato del token: así el
     * `429` cuesta lo mismo exista o no el invitado, y no gasta ni una consulta.
     */
    fun comprobar(tokenCrudo: String) {
        val ahora = reloj()
        if (bloqueado(porToken, claveToken(tokenCrudo), maxPorToken, ahora)) throw RsvpException.TooManyAttempts()
        if (bloqueado(porIp, ipCliente(), maxPorIp, ahora)) throw RsvpException.TooManyAttempts()
    }

    /** Anota la petición en los dos cubos. Aquí **toda** petición cuenta; ver la nota de la clase. */
    fun registrarIntento(tokenCrudo: String) {
        val ahora = reloj()
        incrementar(porToken, claveToken(tokenCrudo), ahora)
        incrementar(porIp, ipCliente(), ahora)
    }

    // ---------------------------------------------------------------------------------------

    private fun bloqueado(mapa: ConcurrentHashMap<String, Ventana>, clave: String, limite: Int, ahora: Long): Boolean {
        val v = mapa[clave] ?: return false
        if (ahora >= v.hasta) {
            mapa.remove(clave, v)
            return false
        }
        return v.intentos >= limite
    }

    private fun incrementar(mapa: ConcurrentHashMap<String, Ventana>, clave: String, ahora: Long) {
        mapa.compute(clave) { _, actual ->
            if (actual == null || ahora >= actual.hasta) Ventana(ahora + ventanaMs, 1)
            else actual.copy(intentos = actual.intentos + 1)
        }
        podar(mapa, ahora)
    }

    /**
     * Mantiene el mapa acotado. Solo hace algo cuando se ha alcanzado el tope, así que el coste O(n)
     * no se paga en el camino normal. Copiado de `AuthThrottleService.kt:226-235`.
     */
    private fun podar(mapa: ConcurrentHashMap<String, Ventana>, ahora: Long) {
        if (mapa.size < maxEntradas) return
        mapa.values.removeIf { ahora >= it.hasta }
        if (mapa.size < maxEntradas) return
        val vencimientos = mapa.values.map { it.hasta }.sorted()
        val umbral = vencimientos[(vencimientos.size / 10).coerceAtLeast(1) - 1]
        mapa.values.removeIf { it.hasta <= umbral }
        log.warn("rsvp: el mapa de intentos llego al tope de {} entradas; desalojado el decil mas antiguo", maxEntradas)
    }

    /**
     * SHA-256 del token en hexadecimal. Ver la nota de la clase: el enlace personal no se guarda en
     * claro ni siquiera como clave de un mapa. El token se recorta antes de hashear para que una URL
     * de megabytes no cueste nada.
     */
    private fun claveToken(tokenCrudo: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(tokenCrudo.take(MAX_LONGITUD_CLAVE).toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    /** Misma lógica y mismo defecto desconfiado que `AuthThrottleService.kt:258-273`. */
    private fun ipCliente(): String {
        val atributos = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
            ?: return "sin-peticion"
        val peticion = atributos.request
        if (confiarEnXff) {
            val reenviada = peticion.getHeader("X-Forwarded-For")
            if (!reenviada.isNullOrBlank()) {
                val primera = reenviada.substringBefore(',').trim()
                if (primera.isNotEmpty()) return primera.take(MAX_LONGITUD_IP)
            }
        }
        return (peticion.remoteAddr ?: "desconocida").take(MAX_LONGITUD_IP)
    }

    private companion object {
        const val MAX_LONGITUD_CLAVE = 512
        const val MAX_LONGITUD_IP = 64
    }
}
