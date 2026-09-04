package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.composition.ContentHasher
import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplDocumentSnapshotRepository
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplReleaseRepository
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * `03 §3.10`-`§3.14` contra PostgreSQL real: preflight, publicación inmutable, despublicación,
 * historial y rotación del enlace.
 */
class ReleaseIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var releaseRepo: TplReleaseRepository
    @Autowired private lateinit var documentos: TplDocumentRepository
    @Autowired private lateinit var snapshots: TplDocumentSnapshotRepository

    private val slug = "prueba-release"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
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
    }

    // =============================================================================================
    // 03 §6 — el preflight que mata H-03
    // =============================================================================================

    @Test
    fun `un bloque obligatorio en su valor de demostracion bloquea la publicacion`() {
        val pre = releases.preflight(customerId, invitationId)

        assertFalse(pre.canPublish)
        val bloqueo = pre.blockers.single()
        assertEquals(TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT.name, bloqueo.code)
        assertEquals(listOf("cover.title"), bloqueo.blockIds)
        assertTrue(pre.contentHash.startsWith("sha256:"), "el hash se sirve con prefijo de algoritmo")
        assertFalse(pre.sameAsActiveRelease)
    }

    @Test
    fun `publicar con el bloqueo activo es 422 y no inserta ninguna fila`() {
        val e = assertThrows<PublishBlockedException> {
            releases.publish(customerId, invitationId, json("""{"baseRevision":0}"""))
        }
        assertEquals(TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT, e.code)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `con contenido de usuario el preflight deja publicar`() {
        escribirTitulo(0, "Ana y Luis", "b_pre_ok01")
        val pre = releases.preflight(customerId, invitationId)
        assertTrue(pre.canPublish)
        assertTrue(pre.blockers.isEmpty())
    }

    // =============================================================================================
    // 03 §3.12 — publicar
    // =============================================================================================

    @Test
    fun `publicar congela composed, report y business_snapshot con la revision exacta`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0001")

        val r = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        assertFalse(r.reusedActiveRelease)
        assertEquals(1L, r.documentRevision)
        assertTrue(Patterns.PREFIXED_SHA256.matches(r.contentHash))
        val fila = releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId)!!
        assertEquals(r.releaseId, fila.id)
        assertTrue(fila.isActive)
        assertNull(fila.unpublishedAt)
        // `business_snapshot` congelado: es lo que permite calcular `stale` sin recomponer (ADR-007).
        assertEquals(
            invitationId,
            DomainJson.businessSnapshot(fila.businessSnapshot).invitationId,
        )
        assertTrue(fila.composed.get("sections").size() > 0)
    }

    @Test
    fun `publicar dos veces sin cambios devuelve el MISMO release y no crea historial ruidoso`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0002")
        val primera = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        val segunda = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        assertTrue(segunda.reusedActiveRelease)
        assertEquals(primera.releaseId, segunda.releaseId)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `publicar tras cambiar algo crea otro release y deja solo uno activo`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0003")
        val primera = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        escribirTitulo(1, "Ana & Luis", "b_pub_0004")
        val segunda = releases.publish(customerId, invitationId, json("""{"baseRevision":2}"""))

        assertNotEquals(primera.releaseId, segunda.releaseId)
        assertNotEquals(primera.contentHash, segunda.contentHash)
        assertEquals(2L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId))
        assertEquals(segunda.releaseId, releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId)!!.id)
    }

    @Test
    fun `publicar con baseRevision vieja es 409 y no publica`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0005")
        val e = assertThrows<RevisionConflictException> {
            releases.publish(customerId, invitationId, json("""{"baseRevision":0}"""))
        }
        assertEquals(TplErrorCode.TPL_REVISION_CONFLICT, e.code)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `una invitacion deshabilitada no se puede publicar aunque su dueno pueda editarla`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0006")
        actualizar("UPDATE invitation SET is_enabled = false WHERE id = ?", invitationId)

        val e = assertThrows<InvitationUnavailableException> {
            releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        }
        assertEquals(TplErrorCode.TPL_INVITATION_UNAVAILABLE, e.code)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `un dueno baneado no puede publicar`() {
        escribirTitulo(0, "Ana y Luis", "b_pub_0007")
        actualizar("UPDATE customer SET is_banned = true WHERE id = ?", customerId)
        try {
            assertThrows<InvitationUnavailableException> {
                releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
            }
        } finally {
            actualizar("UPDATE customer SET is_banned = false WHERE id = ?", customerId)
        }
    }

    // =============================================================================================
    // 02 §11.2 — autoguardado contra publicación simultánea
    // =============================================================================================

    /**
     * Sin el `SELECT … FOR UPDATE` de `ReleaseStore.lockDocument`, `tpl_release.document_revision`
     * podría no corresponder al `composed` congelado: un release que **miente** sobre qué revisión
     * publicó. La comprobación no es "no hubo excepciones": se recompone el snapshot de la revisión
     * que el release dice haber publicado y su `contentHash` tiene que coincidir con el guardado.
     */
    @Test
    fun `publicar mientras entra un lote deja un release que no miente sobre su revision`() {
        escribirTitulo(0, "Ana y Luis", "b_conc_001")
        val pool = Executors.newFixedThreadPool(2)
        try {
            val tareas = listOf<Callable<Result<Any>>>(
                Callable { runCatching { releases.publish(customerId, invitationId, json("""{"baseRevision":1}""")) } },
                Callable {
                    runCatching<Any> {
                        editor.applyOperations(
                            customerId, invitationId,
                            json(
                                """{"baseRevision":1,"clientBatchId":"b_conc_002","operations":[
                                   {"op":"setBlock","blockId":"cover.subtitle","value":{"kind":"text","value":"nuevo"}}]}""",
                            ),
                        )
                    }
                },
            )
            val resultados = pool.invokeAll(tareas, 60, TimeUnit.SECONDS).map { it.get() }
            assertTrue(resultados.any { it.isSuccess }, "al menos una de las dos operaciones debe completar")

            val release = releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId)
            if (release != null) {
                val fila = documentos.findByInvitationId(invitationId)!!
                val snapshot = snapshots.findByDocumentIdAndRevision(fila.id, release.documentRevision)
                assertNotNull(snapshot, "la revisión publicada tiene que tener snapshot")
                val resultado = editor.componer(
                    DomainJson.document(snapshot!!.doc),
                    editor.versionDe(fila),
                    editor.negocio(invitationId),
                    invitationId,
                )
                assertEquals(
                    release.contentHash,
                    ContentHasher.contentHash(resultado),
                    "el composed congelado no corresponde a document_revision: el release miente (02 §11.2)",
                )
            }
        } finally {
            pool.shutdownNow()
        }
    }

    // =============================================================================================
    // 03 §3.13 / §3.14 / §3.10 — despublicar, historial y rotar
    // =============================================================================================

    @Test
    fun `despublicar desactiva sin borrar y es idempotente`() {
        escribirTitulo(0, "Ana y Luis", "b_unp_0001")
        val r = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        releases.unpublish(customerId, invitationId)
        releases.unpublish(customerId, invitationId) // segunda vez: también 204

        assertNull(releaseRepo.findByInvitationIdAndIsActiveTrue(invitationId))
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
        assertNotNull(
            consultar("SELECT unpublished_at FROM tpl_release WHERE id = ?", r.releaseId),
            "la fila se conserva con su marca de despublicación (auditable y republicable)",
        )
    }

    @Test
    fun `el historial de publicaciones no devuelve composed y marca cual sigue activo`() {
        escribirTitulo(0, "Ana y Luis", "b_lst_0001")
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        escribirTitulo(1, "Ana & Luis", "b_lst_0002")
        val segunda = releases.publish(customerId, invitationId, json("""{"baseRevision":2}"""))

        val lista = releases.list(customerId, invitationId, limit = 10, cursor = null)
        assertEquals(2, lista.items.size)
        assertEquals(segunda.releaseId, lista.items.first().releaseId)
        assertTrue(lista.items.first().isActive)
        assertFalse(lista.items.last().isActive)
        assertEquals(slug, lista.items.first().templateVersion?.slug)
    }

    @Test
    fun `rotar el enlace revoca el anterior de inmediato y no toca los releases`() {
        escribirTitulo(0, "Ana y Luis", "b_rot_0001")
        val release = releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        val anterior = documentos.findByInvitationId(invitationId)!!.publicToken

        val rotado = releases.rotatePublicToken(customerId, invitationId)

        assertNotEquals(anterior, rotado.publicToken)
        assertTrue(Patterns.PUBLIC_TOKEN.matches(rotado.publicToken))
        assertEquals("${EditorTestConfig.FRONTEND}/i/${rotado.publicToken}", rotado.publicUrl)
        // El token viejo deja de resolver; el nuevo resuelve al MISMO release (el enlace es del
        // documento, no del release).
        assertNull(releaseRepo.findActiveByPublicToken(anterior))
        assertEquals(release.releaseId, releaseRepo.findActiveByPublicToken(rotado.publicToken)?.id)
        assertEquals(1L, revisionDe(invitationId), "rotar no toca la revisión ni el doc")
    }

    @Test
    fun `el GET del documento marca stale el release cuando cambia un dato de negocio`() {
        escribirTitulo(0, "Ana y Luis", "b_stl_0001")
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))

        val antes = editor.getDocument(customerId, invitationId).activeRelease!!
        assertFalse(antes.stale)

        actualizar("UPDATE invitation SET date = '2027-05-01' WHERE id = ?", invitationId)

        val despues = editor.getDocument(customerId, invitationId).activeRelease!!
        assertTrue(despues.stale, "un cambio en invitation.date deja el release desfasado")
        assertEquals(listOf("business.date"), despues.staleReason)
    }

    // ---------------------------------------------------------------------------------------------

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
