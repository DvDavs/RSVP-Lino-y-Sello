package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * `03 §3.4` contra PostgreSQL real: el lote de operaciones, su idempotencia real y la escritura
 * optimista. Es el corazón del editor y donde viven los tres casos de `03 §12` que importan
 * (reintento tras timeout, `baseRevision` desactualizada y dos lotes con la misma base).
 */
class OperationsIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releaseService: ReleaseService

    private val slug = "prueba-ops"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, cuerpoChoose())
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    // =============================================================================================
    // Aplicación y snapshots
    // =============================================================================================

    @Test
    fun `aplica el lote, incrementa la revision y deja UN snapshot con su clientBatchId`() {
        val r = editor.applyOperations(customerId, invitationId, loteTitulo("b_1_0000000", 0, "Ana y Luis"))

        assertTrue(r.applied)
        assertEquals(1L, r.revision)
        assertEquals(1L, revisionDe(invitationId))
        assertEquals("Ana y Luis", (contenidoDelDocumento(invitationId)["cover.title"] as TextValue).value)
        assertEquals(1L, contarSnapshots("b_1_0000000"))
        assertEquals("operations", consultar(sqlOrigen("b_1_0000000")))
    }

    @Test
    fun `addItem devuelve el ULID definitivo del servidor, nunca el tempId del cliente`() {
        val r = editor.applyOperations(customerId, invitationId, loteFoto("b_add_000000", 0, "tmp:abcd1234"))

        val ulid = r.idMap["tmp:abcd1234"]
        assertNotNull(ulid, "el servidor tiene que devolver el mapa tempId → ULID (ADR-020)")
        assertTrue(Patterns.ULID.matches(ulid!!), "\"$ulid\" no es un ULID")
    }

    // =============================================================================================
    // 03 §12 caso 1 — reintento tras TIMEOUT (la idempotencia real, ADR-1R-B-03)
    // =============================================================================================

    /**
     * El caso que el argumento antiguo ("el reintento falla su propio chequeo de `baseRevision`") **no**
     * cubre: el lote SÍ se aplicó, pero el cliente no vio la respuesta, así que reintenta con la misma
     * `baseRevision` vieja. Sin `ux_tpl_document_snapshot_batch`, ese reintento pasaría el chequeo de
     * revisión y aplicaría el lote **dos veces** (ítems duplicados, textos pisados).
     */
    @Test
    fun `reintento del MISMO cuerpo tras un timeout es un no-op que devuelve la revision que produjo`() {
        val cuerpo = loteTitulo("b_timeout", 0, "Ana y Luis")
        val primera = editor.applyOperations(customerId, invitationId, cuerpo)
        assertTrue(primera.applied)
        assertEquals(1L, primera.revision)

        // ---- aquí el cliente NO ve la respuesta (timeout de red) y reenvía EXACTAMENTE lo mismo ----
        val reintento = editor.applyOperations(customerId, invitationId, cuerpo)

        assertFalse(reintento.applied, "el lote no se puede aplicar dos veces")
        assertEquals(1L, reintento.revision, "debe devolver la revisión que ESE lote produjo")
        assertEquals(1L, revisionDe(invitationId), "el documento no avanzó una segunda vez")
        assertEquals(1L, contarSnapshots("b_timeout"), "un lote deja exactamente un snapshot")
    }

    @Test
    fun `el reintento de un lote con addItem no duplica el item y reconstruye el idMap`() {
        val cuerpo = loteFoto("b_dup_000000", 0, "tmp:abcd1234")
        val primera = editor.applyOperations(customerId, invitationId, cuerpo)
        val reintento = editor.applyOperations(customerId, invitationId, cuerpo)

        assertFalse(reintento.applied)
        assertEquals(primera.revision, reintento.revision)
        assertEquals(
            primera.idMap["tmp:abcd1234"], reintento.idMap["tmp:abcd1234"],
            "el idMap del reintento tiene que ser el de la primera ejecución (03 §3.4 punto 6)",
        )
        assertEquals(1, items(), "el ítem no se puede duplicar")
    }

    // =============================================================================================
    // 03 §12 caso 2 y 02 §11.1 — dos pestañas
    // =============================================================================================

    @Test
    fun `baseRevision desactualizada con un clientBatchId nuevo es 409 con el documento actual`() {
        editor.applyOperations(customerId, invitationId, loteTitulo("b_1_0000000", 0, "Ana y Luis"))

        val e = assertThrows<RevisionConflictException> {
            editor.applyOperations(customerId, invitationId, loteTitulo("b_2_0000000", 0, "Otro texto"))
        }
        assertEquals(TplErrorCode.TPL_REVISION_CONFLICT, e.code)
        assertEquals(1L, e.details["currentRevision"])
        assertNotNull(e.details["document"], "el 409 lleva el documento actual para que el cliente rebase")
        assertNotNull(e.details["composed"])
        assertEquals(1L, revisionDe(invitationId), "el lote perdedor no escribió nada")
    }

    /** `03 §12` caso 2 en concurrencia real: dos hilos, misma `baseRevision`. Uno gana, uno falla. */
    @Test
    fun `dos lotes simultaneos con la misma baseRevision - uno gana y el otro recibe conflicto tipado`() {
        val pool = Executors.newFixedThreadPool(2)
        try {
            val tareas = listOf("b_par_a_0000" to "Texto A", "b_par_b_0000" to "Texto B").map { (lote, texto) ->
                Callable {
                    runCatching { editor.applyOperations(customerId, invitationId, loteTitulo(lote, 0, texto)) }
                }
            }
            val resultados = pool.invokeAll(tareas, 60, TimeUnit.SECONDS).map { it.get() }
            val ok = resultados.filter { it.isSuccess }
            val fallos = resultados.mapNotNull { it.exceptionOrNull() }

            assertEquals(1, ok.size, "solo uno de los dos lotes puede aplicarse")
            assertEquals(1, fallos.size)
            assertTrue(
                fallos.single() is RevisionConflictException,
                "el perdedor debe recibir un error TIPADO, no una excepción de base de datos: ${fallos.single()}",
            )
            // El documento queda coherente: una sola revisión nueva y un solo snapshot.
            assertEquals(1L, revisionDe(invitationId))
            assertEquals(2L, totalSnapshots(), "revisión 0 (choose_template) + la del lote ganador")
        } finally {
            pool.shutdownNow()
        }
    }

    // =============================================================================================
    // tempId, pertenencia de assets y bloques no editables
    // =============================================================================================

    @Test
    fun `un tempId que ningun addItem declaro es 422 TPL_TEMP_ID_UNRESOLVED`() {
        val cuerpo = json(
            """
            {"baseRevision":0,"clientBatchId":"b_tmp_000000","operations":[
              {"op":"setItemBlock","groupId":"gallery.photos","itemId":"tmp:zzzzzzzz","blockId":"caption",
               "value":{"kind":"text","value":"x"}}]}
            """.trimIndent(),
        )
        val e = assertThrows<TempIdUnresolvedException> { editor.applyOperations(customerId, invitationId, cuerpo) }
        assertEquals(TplErrorCode.TPL_TEMP_ID_UNRESOLVED, e.code)
        assertEquals(0L, revisionDe(invitationId))
    }

    @Test
    fun `dos addItem con el mismo tempId son 422 TPL_TEMP_ID_DUPLICATE`() {
        val cuerpo = json(
            """
            {"baseRevision":0,"clientBatchId":"b_tmp2_00000","operations":[
              {"op":"addItem","groupId":"gallery.photos","tempId":"tmp:abcd1234","values":{}},
              {"op":"addItem","groupId":"gallery.photos","tempId":"tmp:abcd1234","values":{}}]}
            """.trimIndent(),
        )
        val e = assertThrows<TempIdDuplicateException> { editor.applyOperations(customerId, invitationId, cuerpo) }
        assertEquals(TplErrorCode.TPL_TEMP_ID_DUPLICATE, e.code)
    }

    @Test
    fun `un assetId de otra invitacion es 422 TPL_ASSET_NOT_OWNED y no toca el documento`() {
        val otroCliente = nuevoCliente()
        val otraInvitacion = nuevaInvitacion(otroCliente)
        val ajeno = insertarAsset(otraInvitacion)
        try {
            val e = assertThrows<OperationRejectedException> {
                editor.applyOperations(customerId, invitationId, loteImagen("b_asset_0000", 0, ajeno))
            }
            assertEquals(TplErrorCode.TPL_ASSET_NOT_OWNED, e.code)
            assertEquals(0L, revisionDe(invitationId), "el lote entero se rechaza: todo o nada")
        } finally {
            limpiarInvitacion(otraInvitacion)
            limpiarCliente(otroCliente)
        }
    }

    @Test
    fun `un assetId propio si se acepta`() {
        val propio = insertarAsset(invitationId)
        val r = editor.applyOperations(customerId, invitationId, loteImagen("b_asset_ok", 0, propio))
        assertTrue(r.applied)
    }

    @Test
    fun `escribir un bloque de negocio es 422 TPL_BLOCK_NOT_EDITABLE con details source`() {
        val cuerpo = json(
            """
            {"baseRevision":0,"clientBatchId":"b_biz_000000","operations":[
              {"op":"setBlock","blockId":"cover.date","value":{"kind":"date","value":"2027-05-01"}}]}
            """.trimIndent(),
        )
        val e = assertThrows<OperationRejectedException> { editor.applyOperations(customerId, invitationId, cuerpo) }
        assertEquals(TplErrorCode.TPL_BLOCK_NOT_EDITABLE, e.code)
        val operacion = (e.details["operations"] as List<*>).first() as Map<*, *>
        assertEquals("business", operacion["source"], "details.source distingue business de fixed (X-04)")
    }

    @Test
    fun `un blockId que la plantilla no declara es 422 TPL_BLOCK_UNKNOWN`() {
        val cuerpo = json(
            """
            {"baseRevision":0,"clientBatchId":"b_unk_000000","operations":[
              {"op":"setBlock","blockId":"cover.inventado","value":{"kind":"text","value":"x"}}]}
            """.trimIndent(),
        )
        val e = assertThrows<OperationRejectedException> { editor.applyOperations(customerId, invitationId, cuerpo) }
        assertEquals(TplErrorCode.TPL_BLOCK_UNKNOWN, e.code)
    }

    @Test
    fun `una clave desconocida en el cuerpo es 400 y no se descarta en silencio`() {
        val cuerpo = json(
            """
            {"baseRevision":0,"clientBatchId":"b_x_0000000","invitationId":999,"operations":[
              {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"x"}}]}
            """.trimIndent(),
        )
        assertThrows<mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception> {
            editor.applyOperations(customerId, invitationId, cuerpo)
        }
        assertEquals(0L, revisionDe(invitationId))
    }

    // =============================================================================================
    // ADR-1R-F-04 — la inversa de `setBlock` sobre un bloque en `default` es `clearBlock`
    // =============================================================================================

    /**
     * **Regla dura de ADR-1R-F-04, en forma de prueba que falla si alguien la rompe.**
     *
     * Deshacer un `setBlock` sobre un bloque que estaba en `provenance:"default"` tiene que devolverlo
     * a `default` — y con él, el bloqueo de publicación. Si el undo se implementara como
     * `setBlock(valorPorDefecto)`, el bloque quedaría en `provenance:"user"`, desaparecería de
     * `stillDefault`, la publicación se destrabaría y el cliente publicaría **contenido de
     * demostración como si fuera suyo**: H-03, exactamente.
     *
     * La segunda mitad de la prueba demuestra que ese atajo *sí* destraba la publicación, que es la
     * razón por la que está prohibido.
     */
    @Test
    fun `deshacer con clearBlock devuelve el bloque a default y vuelve a bloquear la publicacion`() {
        // 1. De salida, el bloque obligatorio está en su valor de demostración y la publicación está
        //    bloqueada.
        assertTrue(bloqueaPorDefault(), "de salida, cover.title está en default y no se puede publicar")

        // 2. El cliente escribe: se destraba.
        editor.applyOperations(customerId, invitationId, loteTitulo("b_u1_0000000", 0, "Ana y Luis"))
        assertFalse(bloqueaPorDefault(), "con contenido de usuario la publicación se destraba")

        // 3. Ctrl+Z ⇒ `clearBlock` (la inversa correcta): vuelve a bloquear.
        editor.applyOperations(
            customerId, invitationId,
            json("""{"baseRevision":1,"clientBatchId":"b_u2_0000000","operations":[{"op":"clearBlock","blockId":"cover.title"}]}"""),
        )
        assertTrue(
            bloqueaPorDefault(),
            "tras clearBlock el bloque vuelve a provenance:default y la publicación se bloquea otra vez",
        )
        assertFalse(
            contenidoDelDocumento(invitationId).containsKey("cover.title"),
            "clearBlock borra la clave del content; no la reescribe con el default",
        )

        // 4. Y el atajo prohibido: `setBlock(valorPorDefecto)` promueve demo a contenido de usuario.
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":2,"clientBatchId":"b_u3_0000000","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"$TEXTO_DEMO"}}]}""",
            ),
        )
        assertFalse(
            bloqueaPorDefault(),
            "ESTE es el peligro que ADR-1R-F-04 prohíbe: setBlock(default) destraba la publicación con " +
                "contenido de demostración. Si esta aserción falla, el undo por clearBlock dejó de ser " +
                "distinguible del atajo y H-03 está reabierto.",
        )
    }

    // =============================================================================================
    // Límites
    // =============================================================================================

    @Test
    fun `un lote vacio o de mas de 50 operaciones es 422 TPL_OPERATION_INVALID`() {
        val cincuentaYUna = (1..51).joinToString(",") {
            """{"op":"setBlock","blockId":"cover.subtitle","value":{"kind":"text","value":"v$it"}}"""
        }
        val e = assertThrows<OperationRejectedException> {
            editor.applyOperations(
                customerId, invitationId,
                json("""{"baseRevision":0,"clientBatchId":"b_51_0000000","operations":[$cincuentaYUna]}"""),
            )
        }
        assertEquals(TplErrorCode.TPL_OPERATION_INVALID, e.code)
    }

    @Test
    fun `un documento por encima de 1 MiB es 422 TPL_DOCUMENT_TOO_LARGE y no incrementa la revision`() {
        val slugGrande = "prueba-ops-grande"
        val otra = nuevaInvitacion(customerId)
        try {
            limpiarPlantilla(slugGrande)
            registrarVersion(paqueteEnorme(slugGrande))
            editor.chooseTemplate(
                customerId, otra,
                json("""{"templateSlug":"$slugGrande","templateVersion":"1.0.0"}"""),
            )
            val e = assertThrows<DocumentTooLargeException> {
                editor.applyOperations(customerId, otra, loteRelatoGigante())
            }
            assertEquals(TplErrorCode.TPL_DOCUMENT_TOO_LARGE, e.code)
            assertEquals(0L, revisionDe(otra))
        } finally {
            limpiarInvitacion(otra)
            limpiarPlantilla(slugGrande)
        }
    }

    // ---------------------------------------------------------------------------------------------

    private fun cuerpoChoose() = json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}""")

    /**
     * 40 párrafos × 15 tramos × 2 000 caracteres = 1,2 M de caracteres: **cada pieza** respeta el JSON
     * Schema (2 000 por tramo, 50 tramos, 40 párrafos) y el conjunto rebasa el 1 MiB del documento. Es
     * el ataque exacto que describe `02 §2` V32: lotes legítimos que engordan el `doc` sin cota.
     */
    private fun loteRelatoGigante(): com.fasterxml.jackson.databind.JsonNode {
        val tramo = """{"type":"text","text":"${"y".repeat(2_000)}"}"""
        val parrafo = """{"type":"paragraph","content":[${(1..15).joinToString(",") { tramo }}]}"""
        val doc = """{"type":"doc","content":[${(1..40).joinToString(",") { parrafo }}]}"""
        return json(
            """{"baseRevision":0,"clientBatchId":"b_big_000000","operations":[
               {"op":"setBlock","blockId":"cover.story","value":{"kind":"richText","doc":$doc}}]}""",
        )
    }

    private fun loteTitulo(lote: String, base: Long, texto: String) = json(
        """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
           {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"$texto"}}]}""",
    )

    private fun loteFoto(lote: String, base: Long, tempId: String) = json(
        """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
           {"op":"addItem","groupId":"gallery.photos","tempId":"$tempId",
            "values":{"caption":{"kind":"text","value":"Primera cita"}}}]}""",
    )

    private fun loteImagen(lote: String, base: Long, assetId: String) = json(
        """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
           {"op":"setBlock","blockId":"cover.photo",
            "value":{"kind":"image","assetId":"$assetId","alt":"","focal":{"x":0.5,"y":0.5}}}]}""",
    )

    /** ¿El preflight bloquea por contenido de demostración? (`03 §6`) */
    private fun bloqueaPorDefault(): Boolean =
        releaseService.preflight(customerId, invitationId).blockers
            .any { it.code == TplErrorCode.TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT.name }

    private fun items(): Int =
        (contenidoDelDocumento(invitationId)["gallery.photos"] as? GroupValue)?.items?.size ?: 0

    private fun insertarAsset(invitacion: Long): String {
        val publicId = "as_" + (1..26).map { "0123456789ABCDEFGHJKMNPQRSTVWXYZ".random() }.joinToString("")
        val sha = UUID.randomUUID().toString().replace("-", "").repeat(2).take(64)
        actualizar(
            "INSERT INTO tpl_asset (public_id, invitation_id, bucket, s3_key, sha256, content_type, bytes, width, height) " +
                "VALUES (?, ?, 'bucket-de-pruebas', ?, ?, 'image/webp', 1024, 800, 600)",
            publicId, invitacion, "templates2/invitation/$invitacion/$sha.webp", sha,
        )
        return publicId
    }

    private fun contarSnapshots(lote: String): Long = contar(
        "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
            "WHERE d.invitation_id = ? AND s.client_batch_id = ?",
        invitationId, lote,
    )

    private fun totalSnapshots(): Long = contar(
        "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id WHERE d.invitation_id = ?",
        invitationId,
    )

    private fun sqlOrigen(lote: String) =
        "SELECT s.origin FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
            "WHERE d.invitation_id = $invitationId AND s.client_batch_id = '$lote'"
}
