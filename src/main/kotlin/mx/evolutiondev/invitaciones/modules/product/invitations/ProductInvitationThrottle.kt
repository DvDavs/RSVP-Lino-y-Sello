package mx.evolutiondev.invitaciones.modules.product.invitations

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import java.util.concurrent.ConcurrentHashMap

/**
 * Freno de caudal de `POST /product/invitations` y `DELETE /product/invitations/{id}` (R1-05).
 *
 * **Por qué hace falta.** El tope de tres borradores acota cuántas filas vivas puede tener una
 * clienta, pero no cuántas peticiones de escritura puede lanzar: crear y borrar en bucle escribe y
 * borra filas de `invitation` —tabla ancha, veintidós columnas, trece cascadas— sin coste para quien
 * llama. El tope es de producto; esto es el freno.
 *
 * **Por qué no se reutiliza `AuthThrottleService`.** Es el limitador correcto y acepta ámbitos, pero
 * el ámbito es un `enum` suyo (`AmbitoIntentos`) y añadirle una constante significa editar
 * `modules/auth`, que en esta sesión es territorio de otro agente y está fuera del alcance de este
 * encargo. Reutilizar un ámbito ajeno tampoco vale: el cubo por IP se indexa **solo** por el prefijo
 * del ámbito (`AuthThrottleService.kt:264`), así que colgarse de `CAMBIO_CUENTA` dejaría que un bucle
 * de altas bloqueara el cambio de contraseña desde esa misma IP — exactamente la denegación cruzada
 * que el KDoc de `AmbitoIntentos` explica que hay que evitar. Un cubo propio para un extremo propio.
 *
 * **Forma copiada a propósito** de `AuthThrottleService`: ventana fija que arranca en la primera
 * petición de la clave, dos contadores independientes (cuenta e IP), poda solo al llegar al tope y
 * mapa `ConcurrentHashMap` in-process. Misma contrapartida, dicha igual de claro: con más de una
 * instancia el límite se divide entre ellas y se pierde al reiniciar (`preguntas-abiertas.md`).
 */
@Service
class ProductInvitationThrottle(
    @Value("\${product.invitations.throttle.max-por-cuenta:20}") private val maxPorCuenta: Int = 20,
    @Value("\${product.invitations.throttle.max-por-ip:60}") private val maxPorIp: Int = 60,
    @Value("\${product.invitations.throttle.ventana-minutos:15}") private val ventanaMinutos: Long = 15,
    @Value("\${product.invitations.throttle.max-entradas:50000}") private val maxEntradas: Int = 50_000,
    /**
     * ¿Se puede creer `X-Forwarded-For`? **Por defecto no**, por la misma razón que en
     * `AuthThrottleService.kt:130-138`: la cabecera la pone el cliente y sin un proxy de confianza
     * delante convierte el límite por IP en decoración.
     */
    @Value("\${product.invitations.throttle.confiar-en-x-forwarded-for:false}") private val confiarEnXff: Boolean = false,
) {

    private val log = LoggerFactory.getLogger(ProductInvitationThrottle::class.java)

    private data class Ventana(val hasta: Long, val peticiones: Int)

    private val porCuenta = ConcurrentHashMap<Long, Ventana>()
    private val porIp = ConcurrentHashMap<String, Ventana>()

    /** Inyectable **solo** desde las pruebas, para avanzar la ventana sin dormir quince minutos. */
    internal var reloj: () -> Long = System::currentTimeMillis

    private val ventanaMs: Long get() = ventanaMinutos * 60_000L

    /**
     * Cuenta esta petición y lanza [DemasiadasInvitacionesException] si la clienta **o** la IP se
     * pasan de la ventana. Se cuenta **antes** de trabajar, y toda petición cuenta: no hay respuesta
     * observable que distinga un «éxito» que pudiera limpiar el contador, y las que fallan por
     * validación no llegan hasta aquí.
     */
    fun comprobarYRegistrar(customerId: Long) {
        val ahora = reloj()
        val cuenta = incrementar(porCuenta, customerId, ahora)
        val ip = incrementar(porIp, ipCliente(), ahora)
        if (cuenta > maxPorCuenta || ip > maxPorIp) throw DemasiadasInvitacionesException()
    }

    private fun <K : Any> incrementar(mapa: ConcurrentHashMap<K, Ventana>, clave: K, ahora: Long): Int {
        val ventana = mapa.compute(clave) { _, actual ->
            if (actual == null || ahora >= actual.hasta) Ventana(ahora + ventanaMs, 1)
            else actual.copy(peticiones = actual.peticiones + 1)
        }!!
        podar(mapa, ahora)
        return ventana.peticiones
    }

    /** Igual que `AuthThrottleService.podar`: O(n) solo cuando el mapa ya está en el tope. */
    private fun <K : Any> podar(mapa: ConcurrentHashMap<K, Ventana>, ahora: Long) {
        if (mapa.size < maxEntradas) return
        mapa.values.removeIf { ahora >= it.hasta }
        if (mapa.size < maxEntradas) return
        val vencimientos = mapa.values.map { it.hasta }.sorted()
        val umbral = vencimientos[(vencimientos.size / 10).coerceAtLeast(1) - 1]
        mapa.values.removeIf { it.hasta <= umbral }
        log.warn("product/invitations: el mapa del freno llegó al tope de {} entradas; desalojado el decil más antiguo", maxEntradas)
    }

    private fun ipCliente(): String {
        val atributos = RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes
            ?: return "sin-peticion"
        val peticion = atributos.request
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
