package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Duration

/**
 * **ADV-02 / ADR-1R-F-09 / ADR-2-6-01** — `POST {frontend}/api/revalidate` tras publicar.
 *
 * `contratos.md §8` lo declara literalmente "Tarea nueva para la fase 2" y ningún bloque lo
 * implementó: 2-4 se lo pasó a 2-5 y 2-5 lo listó en "Sin implementar". Estas pruebas fijan las
 * cuatro condiciones que lo hacen seguro, y las fijan **ejecutándolas**, no leyéndolas:
 *
 * 1. se llama tras publicar, despublicar y rotar el enlace;
 * 2. **no** se llama si la transacción se revierte (`AFTER_COMMIT`, no "al final del método");
 * 3. un fallo del webhook no propaga: la publicación ya está commiteada;
 * 4. sin configurar, no se llama a nadie (y no se inventa un host).
 */
class RevalidateWebhookTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var cliente: ClienteRevalidacionFalso
    @Autowired private lateinit var eventos: ApplicationEventPublisher
    @Autowired private lateinit var txManager: PlatformTransactionManager

    private val slug = "prueba-revalidate"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
        cliente.limpiar()
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
        cliente.limpiar()
    }

    // =============================================================================================
    // 1 — se llama tras los tres sucesos que dejan obsoleto el borde
    // =============================================================================================

    @Test
    fun `publicar invalida la cache del enlace publico, con la etiqueta de ADR-1R-F-09`() {
        escribirTitulo(0, "Ana y Luis", "b_rev_0001")
        val token = tokenPublico()

        val r = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        assertFalse(r.reusedActiveRelease)
        val llamada = cliente.llamadas.single()
        assertEquals(EditorTestConfig.REVALIDATE_URL, llamada.url)
        assertEquals(EditorTestConfig.REVALIDATE_TOKEN, llamada.token, "la cabecera x-revalidate-token")
        val cuerpo = Templates2Json.readTree(llamada.cuerpo)
        assertEquals("invitation:$token", cuerpo.get("tag").asText(), "contratos.md §8: revalidateTag(\"invitation:{publicToken}\")")
        assertEquals(token, cuerpo.get("publicToken").asText())
        assertEquals("published", cuerpo.get("reason").asText())
    }

    @Test
    fun `despublicar tambien invalida - si no, el enlace retirado seguiria vivo 300 s`() {
        escribirTitulo(0, "Ana y Luis", "b_rev_0002")
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        cliente.limpiar()

        releases.unpublish(customerId, invitationId)

        val cuerpo = Templates2Json.readTree(cliente.llamadas.single().cuerpo)
        assertEquals("unpublished", cuerpo.get("reason").asText())
        assertEquals(tokenPublico(), cuerpo.get("publicToken").asText())
    }

    /**
     * Rotar revoca un enlace filtrado (ADR-1R-B-05): lo que el borde tiene cacheado está bajo el token
     * **viejo**, y es ese el que hay que invalidar. Invalidar el nuevo no revocaría nada.
     */
    @Test
    fun `rotar el enlace invalida el token ANTERIOR, no el nuevo`() {
        val anterior = tokenPublico()

        val respuesta = releases.rotatePublicToken(customerId, invitationId)

        assertNotEquals(anterior, respuesta.publicToken)
        val cuerpo = Templates2Json.readTree(cliente.llamadas.single().cuerpo)
        assertEquals("token-rotated", cuerpo.get("reason").asText())
        assertEquals(anterior, cuerpo.get("publicToken").asText(), "se invalida lo que estaba cacheado")
        assertEquals("invitation:$anterior", cuerpo.get("tag").asText())
    }

    // =============================================================================================
    // 2 — AFTER_COMMIT: nada de invalidar una publicación que todavía puede deshacerse
    // =============================================================================================

    @Test
    fun `si la transaccion se revierte no se llama al frontend`() {
        val plantilla = TransactionTemplate(txManager)
        val evento = PublicRenderInvalidated(invitationId, tokenPublico(), PublicRenderInvalidated.Motivo.PUBLICADO)

        assertThrows<IllegalStateException> {
            plantilla.execute<Unit> {
                eventos.publishEvent(evento)
                throw IllegalStateException("la publicación se deshace")
            }
        }

        assertTrue(
            cliente.llamadas.isEmpty(),
            "AFTER_COMMIT: una transacción revertida no puede invalidar la caché de nada",
        )
    }

    @Test
    fun `la misma transaccion, commiteada, si llama`() {
        val plantilla = TransactionTemplate(txManager)
        val evento = PublicRenderInvalidated(invitationId, tokenPublico(), PublicRenderInvalidated.Motivo.PUBLICADO)

        plantilla.execute<Unit> { eventos.publishEvent(evento) }

        assertEquals(1, cliente.llamadas.size, "sin esta prueba, la anterior pasaría aunque el evento no llegara nunca")
    }

    /** Un evento publicado **fuera** de transacción no dispara nada: `fallbackExecution` es `false`. */
    @Test
    fun `un evento fuera de transaccion no dispara el webhook`() {
        eventos.publishEvent(PublicRenderInvalidated(invitationId, tokenPublico(), PublicRenderInvalidated.Motivo.PUBLICADO))
        assertTrue(cliente.llamadas.isEmpty())
    }

    // =============================================================================================
    // 3 — un fallo del webhook no puede tumbar una publicación ya commiteada
    // =============================================================================================

    @Test
    fun `si el frontend esta caido la publicacion sigue en pie`() {
        escribirTitulo(0, "Ana y Luis", "b_rev_0003")
        cliente.falla = true

        val r = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        assertEquals(1, cliente.llamadas.size, "se intentó")
        assertTrue(r.contentHash.startsWith("sha256:"), "y la publicación respondió normalmente")
        assertEquals(
            1L,
            contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId),
            "la fila de tpl_release está commiteada pese al fallo del webhook",
        )
    }

    @Test
    fun `un codigo de estado ajeno tampoco propaga`() {
        escribirTitulo(0, "Ana y Luis", "b_rev_0004")
        cliente.estado = 503

        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        assertEquals(1, cliente.llamadas.size)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId))
    }

    // =============================================================================================
    // 4 — desactivado (el estado de fábrica): no se llama a nadie y no se inventa un host
    // =============================================================================================

    @Test
    fun `sin url ni token la funcion esta desactivada y no llama a nadie`() {
        val espia = ClienteRevalidacionFalso()
        val apagado = RevalidationNotifier(espia, url = "", token = "")

        assertFalse(apagado.habilitado)
        assertFalse(apagado.notificar(evento()))
        assertTrue(espia.llamadas.isEmpty(), "sin configurar no se llama a ningún host")
    }

    @Test
    fun `con url pero sin token tampoco - mandar el enlace sin autenticar seria filtrarlo`() {
        val espia = ClienteRevalidacionFalso()
        val sinToken = RevalidationNotifier(espia, url = "https://app.local/api/revalidate", token = "")
        assertFalse(sinToken.habilitado)
        assertFalse(sinToken.notificar(evento()))
        assertTrue(espia.llamadas.isEmpty())

        val sinUrl = RevalidationNotifier(espia, url = "", token = "secreto")
        assertFalse(sinUrl.habilitado)
        assertFalse(sinUrl.notificar(evento()))
        assertTrue(espia.llamadas.isEmpty())
    }

    @Test
    fun `habilitado devuelve true solo con 2xx y nunca lanza`() {
        val espia = ClienteRevalidacionFalso()
        val notificador = RevalidationNotifier(espia, url = "https://app.local/api/revalidate", token = "secreto")
        assertTrue(notificador.habilitado)
        assertTrue(notificador.notificar(evento()))

        espia.estado = 404
        assertFalse(notificador.notificar(evento()))

        espia.falla = true
        assertFalse(notificador.notificar(evento()), "una excepción del cliente se traga y se registra")
    }

    /** El timeout se pasa siempre explícito: una espera sin tope bloquearía el hilo de la petición. */
    @Test
    fun `el timeout viaja al cliente`() {
        val espia = ClienteConTimeout()
        RevalidationNotifier(espia, "https://app.local/api/revalidate", "secreto", 1234L).notificar(evento())
        assertEquals(Duration.ofMillis(1234), espia.visto)
    }

    private class ClienteConTimeout : RevalidationClient {
        var visto: Duration? = null
        override fun post(url: String, token: String, cuerpo: String, timeout: Duration): Int {
            visto = timeout
            return 200
        }
    }

    // ---------------------------------------------------------------------------------------------

    private fun evento() = PublicRenderInvalidated(1L, "0123456789ABCDEFGHJKMNPQRS", PublicRenderInvalidated.Motivo.PUBLICADO)

    private fun tokenPublico(): String =
        consultar("SELECT public_token FROM tpl_document WHERE invitation_id = ?", invitationId) as String

    private fun escribirTitulo(base: Long, texto: String, lote: String) {
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"$texto"}}]}""",
            ),
        )
    }
}
