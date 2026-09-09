package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired

/**
 * **La puerta de publicación de la fase 5** contra PostgreSQL real (ADR-5-0B-01, ADR-5-4-02).
 *
 * Lo que estas pruebas fijan, y que ninguna pantalla puede sustituir: la puerta vive en el
 * **backend**. Un cliente que se salte la interfaz y llame `POST …/release` directamente recibe
 * `402 TPL_PLAN_UNPAID`; el preflight dice lo mismo antes, para que el editor pueda enseñar el
 * bloqueo con el camino que lo resuelve en vez de un botón que no lleva a ninguna parte.
 *
 * Editar sigue siendo gratis: la invitación nace **sin pagar** y todo lo que se hace aquí antes de
 * publicar —elegir plantilla, escribir el título— funciona igual que si estuviera pagada.
 */
class PuertaDePagoIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService

    private val slug = "prueba-puerta-pago"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        // Nace SIN pagar: es el estado real de una invitación recién creada (ADR-5-0B-01 punto 5).
        invitationId = nuevaInvitacion(customerId, pagada = false)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
        // Contenido de usuario en el bloque obligatorio: sin esto el bloqueo que veríamos sería el de
        // H-03 (`TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT`) y la prueba no estaría midiendo la puerta.
        escribirTitulo(0, "Ana y Luis", "b_puerta_01")
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    @Test
    fun `sin plan pagado el preflight dice que no se puede publicar y por que`() {
        val pre = releases.preflight(customerId, invitationId)
        assertFalse(pre.canPublish, "sin plan pagado no se publica")
        assertEquals(TplErrorCode.TPL_PLAN_UNPAID.name, pre.blockers.first().code)
    }

    @Test
    fun `sin plan pagado publicar es 402 y no inserta ninguna fila`() {
        val e = assertThrows<PublishBlockedException> {
            releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        }
        assertEquals(TplErrorCode.TPL_PLAN_UNPAID, e.code)
        assertEquals(402, e.status, "la puerta responde 402, no 403 ni 422")
        assertEquals(0L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    /** El bloqueo del plan va **primero**: es el único que la clienta puede resolver ahora mismo. */
    @Test
    fun `el bloqueo del plan aparece antes que los de contenido`() {
        // Se devuelve el título a su valor de demostración para que haya dos bloqueos a la vez.
        val otra = nuevaInvitacion(customerId, pagada = false)
        editor.chooseTemplate(customerId, otra, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
        val pre = releases.preflight(customerId, otra)
        assertTrue(pre.blockers.size >= 2, "hay bloqueo de plan y de contenido: ${pre.blockers}")
        assertEquals(TplErrorCode.TPL_PLAN_UNPAID.name, pre.blockers.first().code)
        limpiarInvitacion(otra)
    }

    /** Editar es gratis: el documento se lee y se escribe con la puerta cerrada. */
    @Test
    fun `con la puerta cerrada editar sigue funcionando`() {
        escribirTitulo(1, "Ana y Luis para siempre", "b_puerta_02")
        val doc = editor.getDocument(customerId, invitationId)
        assertEquals(2L, doc.revision)
    }

    /** Pagada —lo único que cambia es `invitation.is_paid`—, publica exactamente como antes. */
    @Test
    fun `al marcar la invitacion pagada la publicacion vuelve a funcionar`() {
        actualizar("UPDATE invitation SET is_paid = true WHERE id = ?", invitationId)
        val pre = releases.preflight(customerId, invitationId)
        assertTrue(pre.canPublish, "con plan pagado no queda ningún bloqueo: ${pre.blockers}")
        val release = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        assertFalse(release.reusedActiveRelease)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId))
    }

    /** `is_paid` a `NULL` (el valor con el que nacen las invitaciones antiguas) **no** abre la puerta. */
    @Test
    fun `is_paid nulo cuenta como no pagada`() {
        actualizar("UPDATE invitation SET is_paid = NULL WHERE id = ?", invitationId)
        val pre = releases.preflight(customerId, invitationId)
        assertFalse(pre.canPublish)
        assertEquals(TplErrorCode.TPL_PLAN_UNPAID.name, pre.blockers.first().code)
    }

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
