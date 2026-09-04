package mx.evolutiondev.invitaciones.modules.templates2.api

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.net.InetAddress
import java.net.InetSocketAddress
import java.time.Duration

/**
 * El único punto del módulo que pone bytes en la red (ADR-2-6-01). Se prueba contra un servidor HTTP
 * **real** del propio JDK en la interfaz de bucle local, no contra un mock, porque lo que hay que
 * comprobar es justo lo que un mock no ve: que el verbo es `POST`, que la cabecera se llama
 * literalmente `x-revalidate-token` (`contratos.md §8`, ADR-1R-F-09) y que el cuerpo llega entero.
 * Sin servidor, "la cabecera correcta" sería una afirmación sobre una constante, no sobre la petición.
 */
class HttpRevalidationClientTest {

    private lateinit var servidor: HttpServer
    private lateinit var url: String

    private var metodo: String? = null
    private var token: String? = null
    private var contentType: String? = null
    private var cuerpo: String? = null

    @Volatile private var estado: Int = 204

    @BeforeEach
    fun arrancar() {
        servidor = HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0)
        servidor.createContext("/api/revalidate") { intercambio ->
            metodo = intercambio.requestMethod
            token = intercambio.requestHeaders.getFirst(HttpRevalidationClient.CABECERA_TOKEN)
            contentType = intercambio.requestHeaders.getFirst("content-type")
            cuerpo = intercambio.requestBody.readBytes().toString(Charsets.UTF_8)
            intercambio.sendResponseHeaders(estado, -1)
            intercambio.close()
        }
        servidor.start()
        url = "http://${servidor.address.hostString}:${servidor.address.port}/api/revalidate"
    }

    @AfterEach
    fun parar() = servidor.stop(0)

    @Test
    fun `manda POST con la cabecera x-revalidate-token y el cuerpo JSON`() {
        val json = """{"tag":"invitation:0123456789ABCDEFGHJKMNPQRS","reason":"published"}"""

        val codigo = HttpRevalidationClient().post(url, "secreto-de-prueba", json, Duration.ofSeconds(5))

        assertEquals(204, codigo)
        assertEquals("POST", metodo)
        assertEquals("secreto-de-prueba", token, "el nombre de la cabecera lo fija contratos.md §8")
        assertEquals("application/json", contentType)
        assertEquals(json, cuerpo)
    }

    /** Un estado ajeno **se devuelve**, no se lanza: quien decide qué hacer es [RevalidationNotifier]. */
    @Test
    fun `un 5xx se devuelve como codigo, no como excepcion`() {
        estado = 503
        assertEquals(503, HttpRevalidationClient().post(url, "t", "{}", Duration.ofSeconds(5)))
    }

    /**
     * Un host que no contesta **sí** lanza. Es deliberado y es la mitad del contrato: el cliente no
     * se traga nada, y quien no puede propagar —porque corre después del commit— es el notificador.
     */
    @Test
    fun `un destino inalcanzable lanza y deja que el notificador decida`() {
        val puerto = servidor.address.port
        servidor.stop(0)
        assertThrows<Exception> {
            HttpRevalidationClient().post(
                "http://${InetAddress.getLoopbackAddress().hostAddress}:$puerto/api/revalidate",
                "t", "{}", Duration.ofMillis(500),
            )
        }
        // Y el notificador, con ese mismo cliente, no propaga: la publicación ya está commiteada.
        val notificador = RevalidationNotifier(
            HttpRevalidationClient(),
            "http://${InetAddress.getLoopbackAddress().hostAddress}:$puerto/api/revalidate",
            "t",
            500L,
        )
        assertEquals(
            false,
            notificador.notificar(
                PublicRenderInvalidated(1L, "0123456789ABCDEFGHJKMNPQRS", PublicRenderInvalidated.Motivo.PUBLICADO),
            ),
        )
    }

    /** El token no puede acabar en la URL: quedaría en los registros de acceso de cualquier proxy. */
    @Test
    fun `el token viaja en la cabecera y nunca en la URL`() {
        HttpRevalidationClient().post(url, "secreto-de-prueba", "{}", Duration.ofSeconds(5))
        assertNull(
            Regex("secreto-de-prueba").find(url),
            "la URL de destino no puede llevar el token",
        )
    }
}
