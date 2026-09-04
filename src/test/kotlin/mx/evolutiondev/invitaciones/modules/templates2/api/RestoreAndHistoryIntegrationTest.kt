package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired

/**
 * `03 §3.5` y `03 §3.6` contra PostgreSQL real: el historial de snapshots y `restore`, que es la red
 * de seguridad del **servidor** (el undo interactivo es del cliente, ADR-019).
 */
class RestoreAndHistoryIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService

    private val slug = "prueba-restore"
    private val slugCorto = "prueba-restore-corto"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        limpiarPlantilla(slugCorto)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
        limpiarPlantilla(slugCorto)
    }

    // =============================================================================================
    // Historial
    // =============================================================================================

    @Test
    fun `el historial es descendente, pagina por cursor y nunca devuelve el doc`() {
        repeat(3) { i -> escribirTitulo(i.toLong(), "texto-$i", "b_hist_$i") }

        val primera = editor.history(customerId, invitationId, limit = 2, cursor = null, clientBatchId = null)
        assertEquals(listOf(3L, 2L), primera.items.map { it.revision })
        assertEquals("1", primera.nextCursor)

        val segunda = editor.history(customerId, invitationId, limit = 2, cursor = primera.nextCursor, clientBatchId = null)
        assertEquals(listOf(1L, 0L), segunda.items.map { it.revision })
        assertNull(segunda.nextCursor)
        assertEquals("choose_template", segunda.items.last().origin)
    }

    @Test
    fun `el historial filtra por clientBatchId para responder si mi lote se aplico`() {
        escribirTitulo(0, "A", "b_hist_x1")
        escribirTitulo(1, "B", "b_hist_x2")

        val pagina = editor.history(customerId, invitationId, null, null, clientBatchId = "b_hist_x2")
        assertEquals(1, pagina.items.size)
        assertEquals(2L, pagina.items.single().revision)
        assertEquals("b_hist_x2", pagina.items.single().clientBatchId)
    }

    @Test
    fun `un cursor que no es una revision es 400, no un 500`() {
        assertThrows<mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception.MalformedJson> {
            editor.history(customerId, invitationId, null, "no-soy-un-numero", null)
        }
    }

    // =============================================================================================
    // Restore
    // =============================================================================================

    @Test
    fun `restaurar crea una revision NUEVA con el contenido de la vieja y no reescribe la historia`() {
        escribirTitulo(0, "primera", "b_rest_a1")
        escribirTitulo(1, "segunda", "b_rest_a2")

        val r = editor.restore(customerId, invitationId, json("""{"revision":1,"baseRevision":2}"""))

        assertEquals(3L, r.revision, "restore nunca hace UPDATE … SET revision = <pasada> (03 §4)")
        assertEquals("primera", (contenidoDelDocumento(invitationId)["cover.title"] as TextValue).value)
        assertEquals(
            "restore",
            consultar(
                "SELECT s.origin FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
                    "WHERE d.invitation_id = ? AND s.revision = 3",
                invitationId,
            ),
        )
        // Las revisiones 0-2 siguen ahí: nada retrocede destructivamente (ADR-006).
        assertEquals(4L, contar(
            "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
                "WHERE d.invitation_id = ?",
            invitationId,
        ))
    }

    /** `02 §11.3`: restaurar es una escritura optimista más. */
    @Test
    fun `restore con baseRevision vieja es 409 y no pisa el trabajo de la otra pestana`() {
        escribirTitulo(0, "primera", "b_rest_b1")
        // La otra pestaña guarda mientras esta tenía la revisión 1 a la vista.
        escribirTitulo(1, "de la otra pestana", "b_rest_b2")

        val e = assertThrows<RevisionConflictException> {
            editor.restore(customerId, invitationId, json("""{"revision":0,"baseRevision":1}"""))
        }
        assertEquals(TplErrorCode.TPL_REVISION_CONFLICT, e.code)
        assertEquals(2L, e.details["currentRevision"])
        assertEquals(
            "de la otra pestana",
            (contenidoDelDocumento(invitationId)["cover.title"] as TextValue).value,
            "el trabajo de la otra pestaña tiene que seguir intacto",
        )
    }

    @Test
    fun `restaurar una revision inexistente es 404 TPL_SNAPSHOT_NOT_FOUND`() {
        val e = assertThrows<SnapshotNotFoundException> {
            editor.restore(customerId, invitationId, json("""{"revision":99,"baseRevision":0}"""))
        }
        assertEquals(TplErrorCode.TPL_SNAPSHOT_NOT_FOUND, e.code)
    }

    /** `03 §9.2`: las snapshots se resuelven por `document_id`, nunca por una revisión global. */
    @Test
    fun `la revision de OTRO documento no es visible desde esta invitacion`() {
        val otraInvitacion = nuevaInvitacion(customerId)
        try {
            editor.chooseTemplate(
                customerId, otraInvitacion,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            )
            repeat(3) { i -> escribirTitulo(i.toLong(), "ajeno-$i", "b_ajeno_$i", otraInvitacion) }

            // La otra invitación tiene revisión 3; esta, solo la 0.
            val e = assertThrows<SnapshotNotFoundException> {
                editor.restore(customerId, invitationId, json("""{"revision":3,"baseRevision":0}"""))
            }
            assertEquals(TplErrorCode.TPL_SNAPSHOT_NOT_FOUND, e.code)
        } finally {
            limpiarInvitacion(otraInvitacion)
        }
    }

    /**
     * ADR-029: `restore` **revalida** contra el manifiesto vigente. Un valor que era legal cuando se
     * guardó y ya no lo es (aquí, un título más largo del que admite la plantilla actual) va al
     * `attic` y se anuncia en `movedToAttic`; no se descarta en silencio ni tumba la restauración.
     */
    @Test
    fun `restore revalida contra el manifiesto vigente y manda al attic lo que ya no vale`() {
        escribirTitulo(0, "Un titulo larguisimo", "b_rest_c1")

        // La invitación cambia a una plantilla cuyo `cover.title` admite 5 caracteres.
        registrarVersion(paqueteBase(slugCorto, tituloMaxLength = 5))
        val cambio = editor.chooseTemplate(
            customerId, invitationId,
            json("""{"templateSlug":"$slugCorto","templateVersion":"1.0.0","baseRevision":1}"""),
        )
        assertTrue(
            cambio.movedToAttic.contains("cover.title"),
            "el valor transportado que no cumple el spec destino va al attic, no bloquea el cambio",
        )

        // Y restaurar la revisión 1 (con el título largo) tampoco lo reintroduce.
        val r = editor.restore(customerId, invitationId, json("""{"revision":1,"baseRevision":2}"""))
        assertTrue(r.movedToAttic.contains("cover.title"), "restore lo vuelve a mandar al attic")
        assertFalse(
            contenidoDelDocumento(invitationId).containsKey("cover.title"),
            "un valor inválido para la versión vigente no puede volver al content",
        )
    }

    // ---------------------------------------------------------------------------------------------

    private fun escribirTitulo(base: Long, texto: String, lote: String, invitacion: Long = invitationId) {
        editor.applyOperations(
            customerId, invitacion,
            json(
                """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"$texto"}}]}""",
            ),
        )
    }
}
