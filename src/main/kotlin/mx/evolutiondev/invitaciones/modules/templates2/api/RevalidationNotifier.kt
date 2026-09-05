package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * Por qué el enlace público de una invitación deja de ser válido en el borde (`03 §3.12`-`§3.13`,
 * `§3.10`). Es un evento de dominio, no un DTO de HTTP: lo publica `ReleaseService` **dentro** de su
 * transacción y lo consume [RevalidationNotifier] **después** del commit.
 */
data class PublicRenderInvalidated(
    val invitationId: Long,
    val publicToken: String,
    val motivo: Motivo,
) {
    /** Los tres sucesos que cambian lo que sirve `GET /public/i/{publicToken}/render`. */
    enum class Motivo(val wire: String) {
        PUBLICADO("published"),
        DESPUBLICADO("unpublished"),
        TOKEN_ROTADO("token-rotated"),
    }
}

/**
 * La llamada HTTP saliente, aislada en una interfaz **para poder probar el resto sin red**. La
 * implementación real es [HttpRevalidationClient].
 */
fun interface RevalidationClient {

    /** Devuelve el código de estado. Cualquier fallo sale como excepción; nunca en silencio. */
    fun post(url: String, token: String, cuerpo: String, timeout: Duration): Int
}

/**
 * `java.net.http.HttpClient` del JDK 21: **sin dependencia nueva** (`contratos.md §2` no permite
 * añadir stack) y sin arrastrar `RestTemplate`/`WebClient` del módulo antiguo a una llamada de un solo
 * verbo. El cliente se construye una vez: es seguro entre hilos.
 */
@Component
class HttpRevalidationClient : RevalidationClient {

    private val http: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(CONEXION_SEGUNDOS))
        .followRedirects(HttpClient.Redirect.NEVER)
        // Hallazgo de I-07, PROBADO contra un `next start` real (no contra el `HttpServer` del JDK
        // de `HttpRevalidationClientTest`, que no habla HTTP/2 y por eso nunca lo delató): sin fijar
        // la versión, este cliente PREFIERE HTTP/2 y manda la cabecera `Upgrade` de un intento h2c en
        // la petición HTTP/1.1 inicial. El servidor de Next.js no la entiende, cierra la conexión sin
        // devolver ni un byte, y el envío entero revienta con
        // `IOException: HTTP/1.1 header parser received no bytes` — SIEMPRE, con las dos claves ya
        // bien configuradas. `.version(HTTP_1_1)` evita el intento de upgrade; medido: mismo cuerpo,
        // mismo servidor, pasa de fallar el 100 % de las veces a `200` siempre.
        .version(HttpClient.Version.HTTP_1_1)
        .build()

    override fun post(url: String, token: String, cuerpo: String, timeout: Duration): Int {
        val peticion = HttpRequest.newBuilder(URI.create(url))
            .timeout(timeout)
            .header("content-type", "application/json")
            .header(CABECERA_TOKEN, token)
            .POST(HttpRequest.BodyPublishers.ofString(cuerpo, Charsets.UTF_8))
            .build()
        return http.send(peticion, HttpResponse.BodyHandlers.discarding()).statusCode()
    }

    companion object {
        /** Nombre literal de `contratos.md §8` (ADR-1R-F-09). */
        const val CABECERA_TOKEN = "x-revalidate-token"
        const val CONEXION_SEGUNDOS = 2L
    }
}

/**
 * `POST {frontend}/api/revalidate` tras publicar, despublicar o rotar el enlace (**ADR-1R-F-09**,
 * `contratos.md §8`, que lo declara literalmente "Tarea nueva para la fase 2"). Objeción **ADV-02** de
 * la revisión adversarial global: era un hueco *entre* bloques —2-4 se lo pasó a 2-5 y 2-5 lo listó
 * como "sin implementar"— sobre una cláusula vigente del contrato. Cerrada en el bloque 2-6
 * (**ADR-2-6-01**).
 *
 * Cuatro decisiones, y ninguna es cosmética:
 *
 * 1. **`AFTER_COMMIT`, no dentro de la transacción.** Invalidar la caché de una publicación que
 *    todavía puede deshacerse dejaría al borde sirviendo el render de un release que nunca existió.
 *    `@TransactionalEventListener` sin `fallbackExecution` es además la garantía de que un evento
 *    publicado fuera de transacción **no** dispara nada.
 * 2. **Un fallo del webhook no puede tumbar la publicación.** Cuando este método corre, la invitación
 *    ya está publicada y commiteada: propagar la excepción convertiría un `201` correcto en un `500`
 *    y el cliente reintentaría una publicación que ya ocurrió. La red de seguridad es el
 *    `revalidate: 300` de Next.js (`contratos.md §4`: "ventana de `max-age` de 300 s tras despublicar
 *    o rotar el token"), así que el peor caso de un fallo aquí es la ventana que el contrato ya acepta.
 * 3. **URL y token por propiedad, y ausentes ⇒ función desactivada.** No se inventa un host: sin
 *    `templates2.revalidate.url` y `templates2.revalidate.token` no se llama a nadie y se dice una
 *    vez, al arrancar, a nivel `INFO`. `app.frontend.url` **no** sirve de defecto: su propio valor por
 *    defecto es `http://localhost` (`application.yml:80`), y apuntar un webhook con token a un host
 *    adivinado es peor que no llamar.
 * 4. **El token no se escribe en ningún log ni en ningún mensaje de excepción**, y el `publicToken`
 *    tampoco: es el secreto del enlace público. Se registra el `invitationId` y el motivo, que es lo
 *    que hace falta para diagnosticar.
 *
 * **Qué manda al frontend.** `contratos.md §8` fija el verbo, la ruta y la cabecera, y qué hace el
 * handler (`revalidateTag("invitation:{publicToken}")`), pero no el cuerpo — el handler es de la
 * fase 3 y todavía no existe. El cuerpo es
 * `{"tag": "invitation:<publicToken>", "publicToken": "<publicToken>", "reason": "published|unpublished|token-rotated"}`:
 * lleva la etiqueta ya formada (para que el handler no tenga que reconstruir la convención) y sus dos
 * partes por separado. Queda anotado en `preguntas-abiertas.md` para que la fase 3 lo confirme o lo
 * enmiende antes de escribir el handler.
 */
@Component
class RevalidationNotifier(
    private val cliente: RevalidationClient,
    @Value("\${templates2.revalidate.url:}") private val url: String = "",
    @Value("\${templates2.revalidate.token:}") private val token: String = "",
    @Value("\${templates2.revalidate.timeout-ms:3000}") private val timeoutMs: Long = TIMEOUT_MS,
) {

    private val log = LoggerFactory.getLogger(RevalidationNotifier::class.java)

    /** Desactivado si falta cualquiera de las dos: llamar sin token sería filtrar el enlace a un tercero. */
    val habilitado: Boolean = url.isNotBlank() && token.isNotBlank()

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun alInvalidarse(evento: PublicRenderInvalidated) {
        notificar(evento)
    }

    /**
     * Visible para las pruebas y para cualquier llamada directa. **Nunca lanza**: devuelve `true` solo
     * si el frontend contestó con un 2xx.
     */
    fun notificar(evento: PublicRenderInvalidated): Boolean {
        if (!habilitado) {
            log.debug(
                "templates2: revalidación del frontend desactivada (templates2.revalidate.url/token sin " +
                    "configurar); la invitación {} depende del max-age de 300 s ({})",
                evento.invitationId, evento.motivo.wire,
            )
            return false
        }
        return try {
            val estado = cliente.post(url, token, cuerpo(evento), Duration.ofMillis(timeoutMs))
            if (estado in 200..299) {
                log.info(
                    "templates2: caché del render público invalidada para la invitación {} ({})",
                    evento.invitationId, evento.motivo.wire,
                )
                true
            } else {
                // Aviso, no error: la publicación ya está hecha y es correcta.
                log.warn(
                    "templates2: el frontend respondió {} al revalidar la invitación {} ({}); el enlace " +
                        "servirá contenido viejo hasta {} s (revalidate: 300, contratos.md §4)",
                    estado, evento.invitationId, evento.motivo.wire, VENTANA_SEGUNDOS,
                )
                false
            }
        } catch (e: Exception) {
            // Se atrapa `Exception` a propósito: cualquier fallo de red, DNS, TLS o timeout llega aquí
            // DESPUÉS del commit. Dejarlo subir convertiría una publicación correcta en un 500.
            log.warn(
                "templates2: no se pudo revalidar el frontend para la invitación {} ({}): {}: {}. La " +
                    "publicación NO se deshace; el borde se corrige solo en {} s.",
                evento.invitationId, evento.motivo.wire, e::class.java.simpleName, e.message, VENTANA_SEGUNDOS,
            )
            false
        }
    }

    /** El `publicToken` viaja en el cuerpo, nunca en el log ni en la URL (quedaría en los accesos). */
    private fun cuerpo(evento: PublicRenderInvalidated): String {
        val nodo = Templates2Json.mapper.createObjectNode()
        nodo.put("tag", ETIQUETA + evento.publicToken)
        nodo.put("publicToken", evento.publicToken)
        nodo.put("reason", evento.motivo.wire)
        return Templates2Json.mapper.writeValueAsString(nodo)
    }

    companion object {
        /** `revalidateTag("invitation:{publicToken}")` — `contratos.md §8`, ADR-1R-F-09. */
        const val ETIQUETA = "invitation:"
        const val TIMEOUT_MS = 3000L

        /** `max-age` del render público (`PublicRenderController`, `contratos.md §4`). */
        const val VENTANA_SEGUNDOS = 300
    }
}
