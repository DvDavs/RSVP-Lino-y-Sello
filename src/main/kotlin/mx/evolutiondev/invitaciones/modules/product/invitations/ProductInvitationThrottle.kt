package mx.evolutiondev.invitaciones.modules.product.invitations

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Operación limitada. **Cada una lleva su propio cubo** (R2-01/R2-04).
 *
 * Compartirlo fue el error de la primera versión: el borrado es la salida que R1-05 construyó para
 * que una clienta atascada en el tope de tres borradores pudiera destrabarse sola, y con un cubo
 * común agotar el alta le quitaba justo esa salida. Quien se pasa creando pierde la creación, no el
 * derecho a limpiar lo que creó.
 */
enum class OperacionInvitacion(val etiqueta: String) {
    /** `POST /product/invitations`. */
    ALTA("alta"),

    /** `DELETE /product/invitations/{id}`. */
    BORRADO("borrado"),
}

/**
 * Freno de caudal de `POST /product/invitations` y `DELETE /product/invitations/{id}` (R1-05,
 * corregido en R2-01).
 *
 * **Por qué hace falta.** El tope de tres borradores acota cuántas filas vivas puede tener una
 * clienta, pero no cuántas peticiones de escritura puede lanzar: crear y borrar en bucle escribe y
 * borra filas de `invitation` —tabla ancha, veintidós columnas, trece cascadas— sin coste para quien
 * llama. El tope es de producto; esto es el freno.
 *
 * **Con qué identidad limita: el `customer_id`** (R2-01). Las dos rutas están autenticadas, así que
 * la identidad no hay que adivinarla: viene del token, no se puede falsificar y es la unidad de
 * cobro y de cuota del producto, o sea la unidad justa. La primera versión contaba **además** por
 * IP, y esa mitad estaba rota: `confiar-en-x-forwarded-for` es `false` por defecto —y tiene que
 * serlo mientras no haya un proxy de confianza declarado— así que `remoteAddr` era el del proxy
 * **para todo el mundo**: sesenta escrituras de una sola clienta dejaban a **la plataforma entera**
 * sin poder crear ni borrar invitaciones. Un freno cuyo peor caso es una denegación de servicio
 * global no es un freno.
 *
 * Por eso el cubo por IP **solo cuenta cuando alguien ha declarado que hay un proxy de confianza
 * delante** ([confiarEnXff]), que es la única situación en la que la IP que se ve es la del cliente.
 * Para activarlo hacen falta las dos cosas, y en este orden: `server.forward-headers-strategy` en el
 * despliegue (para que Spring lea la cabecera) y
 * `product.invitations.throttle.confiar-en-x-forwarded-for=true`. Sin proxy, la defensa dura sigue
 * siendo la de cuenta, que es la que de verdad acota el trabajo por clienta; queda anotado en
 * `preguntas-abiertas.md`.
 *
 * **Por qué no se reutiliza `AuthThrottleService`.** Es el limitador correcto y acepta ámbitos, pero
 * el ámbito es un `enum` suyo (`AmbitoIntentos`) y colgarse de uno ajeno dejaría que un bucle de
 * altas bloqueara el cambio de contraseña desde esa misma IP — exactamente la denegación cruzada que
 * el KDoc de `AmbitoIntentos` explica que hay que evitar. Un cubo propio para un extremo propio.
 *
 * **Forma copiada a propósito** de `AuthThrottleService`: ventana fija que arranca en la primera
 * petición de la clave y mapa `ConcurrentHashMap` in-process. Misma contrapartida, dicha igual de
 * claro: con más de una instancia el límite se divide entre ellas y se pierde al reiniciar
 * (`preguntas-abiertas.md`). Lo que **no** se copia es la poda: ver [podar].
 */
@Service
class ProductInvitationThrottle(
    @Value("\${product.invitations.throttle.max-por-cuenta:20}") private val maxPorCuenta: Int = 20,
    /**
     * Cupo **propio** del borrado, y más holgado que el del alta a propósito: es la salida de
     * emergencia de R1-05 y limpiar tres borradores nunca puede salir más caro que crearlos.
     */
    @Value("\${product.invitations.throttle.max-borrados-por-cuenta:30}") private val maxBorradosPorCuenta: Int = 30,
    @Value("\${product.invitations.throttle.max-por-ip:60}") private val maxPorIp: Int = 60,
    @Value("\${product.invitations.throttle.ventana-minutos:15}") private val ventanaMinutos: Long = 15,
    @Value("\${product.invitations.throttle.max-entradas:50000}") private val maxEntradas: Int = 50_000,
    /**
     * ¿Se puede creer `X-Forwarded-For`? **Por defecto no**, por la misma razón que en
     * `AuthThrottleService.kt:143-151`: la cabecera la pone el cliente y sin un proxy de confianza
     * delante convierte el límite por IP en decoración. Mientras esté en `false` el cubo por IP
     * **no cuenta nada** (R2-01): ver el KDoc de la clase.
     */
    @Value("\${product.invitations.throttle.confiar-en-x-forwarded-for:false}") private val confiarEnXff: Boolean = false,
) {

    private val log = LoggerFactory.getLogger(ProductInvitationThrottle::class.java)

    private data class Ventana(val hasta: Long, val peticiones: Int)

    /** La clave lleva la operación delante: el alta y el borrado no comparten cubo (R2-01). */
    private val porCuenta = ConcurrentHashMap<String, Ventana>()
    private val porIp = ConcurrentHashMap<String, Ventana>()

    /** Peticiones atendidas desde el último barrido. Ver [podar]. */
    private val desdeElUltimoBarrido = AtomicLong(0)

    /** Inyectable **solo** desde las pruebas, para avanzar la ventana sin dormir quince minutos. */
    internal var reloj: () -> Long = System::currentTimeMillis

    private val ventanaMs: Long get() = ventanaMinutos * 60_000L

    /**
     * Cuenta esta petición y lanza [DemasiadasInvitacionesException] si la clienta se pasa de la
     * ventana en **esa operación**. Se cuenta antes de trabajar, y toda petición cuenta: no hay
     * respuesta observable que distinga un «éxito» que pudiera limpiar el contador, y las que fallan
     * por validación no llegan hasta aquí.
     */
    fun comprobarYRegistrar(customerId: Long, operacion: OperacionInvitacion = OperacionInvitacion.ALTA) {
        val ahora = reloj()
        val tope = if (operacion == OperacionInvitacion.BORRADO) maxBorradosPorCuenta else maxPorCuenta
        val cuenta = incrementar(porCuenta, "${operacion.etiqueta}:$customerId", ahora)
        if (cuenta > tope) throw DemasiadasInvitacionesException()
        // Segunda barrera, y solo cuando la IP que se ve es de verdad la del cliente (R2-01).
        if (confiarEnXff) {
            val ip = incrementar(porIp, "${operacion.etiqueta}:${ipCliente()}", ahora)
            if (ip > maxPorIp) throw DemasiadasInvitacionesException()
        }
    }

    private fun incrementar(mapa: ConcurrentHashMap<String, Ventana>, clave: String, ahora: Long): Int {
        val ventana = mapa.compute(clave) { _, actual ->
            if (actual == null || ahora >= actual.hasta) Ventana(ahora + ventanaMs, 1)
            else actual.copy(peticiones = actual.peticiones + 1)
        }!!
        podar(ahora)
        return ventana.peticiones
    }

    /**
     * Barrido periódico de ventanas caducadas (R2-01).
     *
     * `AuthThrottleService.podar` solo limpia cuando el mapa **ya** está en el tope, y aquí eso
     * significaba que una entrada de una clienta que pasó una vez por el alta se quedaba en memoria
     * hasta que el mapa llegara a cincuenta mil: nunca, en la práctica, con lo que el mapa solo
     * crecía. Se barre cada [BARRIDO_CADA_N] peticiones —coste O(n) amortizado a una milésima— y se
     * conserva el desalojo del decil más antiguo como último recurso para el caso patológico.
     */
    private fun podar(ahora: Long) {
        val toca = desdeElUltimoBarrido.incrementAndGet() >= BARRIDO_CADA_N
        if (toca) {
            desdeElUltimoBarrido.set(0)
            porCuenta.values.removeIf { ahora >= it.hasta }
            porIp.values.removeIf { ahora >= it.hasta }
        }
        podarSiLleno(porCuenta, ahora)
        podarSiLleno(porIp, ahora)
    }

    private fun podarSiLleno(mapa: ConcurrentHashMap<String, Ventana>, ahora: Long) {
        if (mapa.size < maxEntradas) return
        mapa.values.removeIf { ahora >= it.hasta }
        if (mapa.size < maxEntradas) return
        val vencimientos = mapa.values.map { it.hasta }.sorted()
        val umbral = vencimientos[(vencimientos.size / 10).coerceAtLeast(1) - 1]
        mapa.values.removeIf { it.hasta <= umbral }
        log.warn("product/invitations: el mapa del freno llegó al tope de {} entradas; desalojado el decil más antiguo", maxEntradas)
    }

    /** Solo se llama con [confiarEnXff] puesto; sin proxy de confianza esta identidad no vale. */
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

    private companion object {
        /** Cada cuántas peticiones se barren las ventanas caducadas. */
        const val BARRIDO_CADA_N = 1_000L
    }
}
