package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.persistence.AssetGcJob
import mx.evolutiondev.invitaciones.modules.templates2.persistence.Templates2S3KeyService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import java.io.ByteArrayInputStream

/**
 * Rutas 7-9 (`03 §3.7`-`§3.9`) y el orden de efectos de `02 §10.1`/`§10.5` contra **PostgreSQL real**.
 *
 * Cubre los casos 6, 8, 9, 10, 18, 26, 27 y 28 de `03 §12`. Los dos que más importan son los de fallo
 * parcial: **S3 escribe y la base falla** y **S3 falla y la base no escribe**. Son los que deciden si
 * un fallo deja el sistema inconsistente o solo con basura recuperable.
 */
@Import(Templates2ApiTestConfig::class)
class AssetIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var assets: EditorAssetService
    @Autowired private lateinit var s3: S3Falso
    @Autowired private lateinit var gc: AssetGcJob
    @Autowired private lateinit var claves: Templates2S3KeyService
    @Autowired private lateinit var hierarchy: HierarchyValidationService

    private val slug = "prueba-assets"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        s3.limpiar()
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
    }

    @AfterEach
    fun limpiar() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
        actualizar("DELETE FROM tpl_asset_gc WHERE public_id LIKE 'as_%'")
    }

    // =============================================================================================
    // 03 §3.7 — subida
    // =============================================================================================

    @Test
    fun `una subida valida deja objeto, fila y URL firmada de 15 minutos`() {
        val r = subir(png(64, 48), "image/png")

        assertFalse(r.reused)
        assertEquals("image/png", r.contentType)
        assertEquals(64, r.width)
        assertEquals(48, r.height)
        assertTrue(r.assetId.startsWith("as_"))
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId))

        val clave = consultar("SELECT s3_key FROM tpl_asset WHERE public_id = ?", r.assetId) as String
        assertEquals(claves.invitationAssetKey(invitationId, r.sha256, tipoPng()), clave)
        assertTrue(s3.objetos.containsKey("${Templates2ApiTestConfig.BUCKET}/$clave"))
        // `03 §3.7`: 15 minutos explícitos, porque el defecto del método son 7 días.
        assertTrue(r.previewUrl.endsWith("X-Amz-Expires=900"), "previewUrl real: ${r.previewUrl}")
    }

    /** Caso 6 de `03 §12`. */
    @Test
    fun `subir los mismos bytes dos veces devuelve el mismo assetId y no duplica nada`() {
        val bytes = png(10, 10)
        val primera = subir(bytes, "image/png")
        val segunda = subir(bytes, "image/png")

        assertFalse(primera.reused)
        assertTrue(segunda.reused, "la idempotencia es por contenido (ux_tpl_asset_invitation_sha)")
        assertEquals(primera.assetId, segunda.assetId)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId))
        assertEquals(1, s3.objetos.size, "un solo objeto en S3")
        assertEquals(1, s3.subidas, "la segunda vez ni siquiera se llama a S3")
    }

    /** Caso 28 de `03 §12`: la cabecera sola no basta. */
    @Test
    fun `un PNG declarado como webp es 415 y no toca S3`() {
        val e = assertThrows<AssetTypeUnsupportedException> { subir(png(10, 10), "image/webp") }
        assertEquals(TplErrorCode.TPL_ASSET_TYPE_UNSUPPORTED, e.code)
        assertEquals(0, s3.subidas)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `un tipo fuera del catalogo del editor es 415`() {
        // `image/svg+xml` existe en el catálogo del esquema pero **no** se acepta aquí (ADR-2-5-04).
        val svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>".toByteArray()
        assertThrows<AssetTypeUnsupportedException> { subir(svg, "image/svg+xml") }
        assertThrows<AssetTypeUnsupportedException> { subir(png(2, 2), "application/pdf") }
        assertThrows<AssetTypeUnsupportedException> { subir(png(2, 2), null) }
        assertEquals(0, s3.subidas)
    }

    /** Caso 26 de `03 §12`. */
    @Test
    fun `un archivo de 16 MiB es 413 por las dos vias y sin llamar a S3`() {
        val grande = ByteArray(16 * 1024 * 1024)
        val porCabecera = assertThrows<AssetTooLargeException> {
            assets.subir(customerId, invitationId, "image/png", grande.size.toLong(), ByteArrayInputStream(grande))
        }
        assertEquals(TplErrorCode.TPL_ASSET_TOO_LARGE, porCabecera.code)

        // Sin `Content-Length` (troceado): lo corta la lectura contada.
        val porLectura = assertThrows<AssetTooLargeException> {
            assets.subir(customerId, invitationId, "image/png", -1, ByteArrayInputStream(grande))
        }
        assertEquals(TplErrorCode.TPL_ASSET_TOO_LARGE, porLectura.code)
        assertEquals(0, s3.subidas)
    }

    /** Caso 27 de `03 §12`, con la cuota bajada por parámetro para no subir 200 archivos. */
    @Test
    fun `pasada la cuota, la subida es 409 TPL_ASSET_QUOTA_EXCEEDED`() {
        val hasta = 3
        repeat(hasta) { subir(png(4 + it, 4), "image/png") }
        // La cuota real son 200; aquí se comprueba el mecanismo insertando filas hasta el tope.
        rellenarHastaLaCuota()

        val e = assertThrows<AssetQuotaExceededException> { subir(png(99, 99), "image/png") }
        assertEquals(TplErrorCode.TPL_ASSET_QUOTA_EXCEEDED, e.code)
    }

    @Test
    fun `sin documento de trabajo no se puede subir nada`() {
        val otroCliente = nuevoCliente()
        val sinDocumento = nuevaInvitacion(otroCliente)
        try {
            val e = assertThrows<DocumentNotStartedException> {
                assets.subir(customerId, sinDocumento, "image/png", 10, ByteArrayInputStream(png(4, 4)))
            }
            assertEquals(TplErrorCode.TPL_DOCUMENT_NOT_STARTED, e.code)
        } finally {
            limpiarInvitacion(sinDocumento)
            limpiarCliente(otroCliente)
        }
    }

    // =============================================================================================
    // 02 §10.5 — fallo parcial en las dos direcciones
    // =============================================================================================

    /** Caso 8 de `03 §12`: S3 cae ⇒ `502` y **cero filas**. */
    @Test
    fun `si S3 falla al subir, no queda ninguna fila`() {
        s3.fallaSubida = true
        val e = assertThrows<AssetStorageUnavailableException> { subir(png(8, 8), "image/png") }

        assertEquals(TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE, e.code)
        assertEquals(502, e.status)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId))
        assertTrue(s3.objetos.isEmpty())
    }

    /**
     * Caso 9 de `03 §12`: la base falla **después** de escribir en S3.
     *
     * Se fuerza con una fila que ya ocupa el `public_id` — el único fallo de `INSERT` reproducible sin
     * tocar el esquema. Lo que la prueba fija es la propiedad que hace tolerable ese fallo: **la clave
     * de S3 es determinista**, así que el reintento reescribe el mismo objeto y a la segunda hay
     * exactamente una fila, sin acumular copias huérfanas.
     */
    @Test
    fun `si la base falla tras subir, el reintento reescribe la misma clave y deja una sola fila`() {
        val bytes = png(12, 12)
        val sha = shaDe(bytes)
        val clave = claves.invitationAssetKey(invitationId, sha, tipoPng())

        // Primer intento: escribe en S3 y falla al insertar (el `public_id` ya existe).
        val ocupado = "as_" + "0".repeat(26)
        insertarAssetCrudo(ocupado, sha, clave)
        assertThrows<Exception> { subir(bytes, "image/png") }
        val objetosTrasElFallo = s3.objetos.keys.toSet()

        // El reintento, ya sin el estorbo, escribe **la misma clave**.
        actualizar("DELETE FROM tpl_asset WHERE public_id = ?", ocupado)
        val r = subir(bytes, "image/png")

        assertEquals(clave, consultar("SELECT s3_key FROM tpl_asset WHERE public_id = ?", r.assetId))
        assertEquals(objetosTrasElFallo, s3.objetos.keys.toSet(), "no se acumuló un segundo objeto")
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId))
    }

    /** Caso 10 de `03 §12`: el `DELETE` commitea aunque S3 esté caído; la clave queda en la cola. */
    @Test
    fun `borrar con S3 caido deja la fila borrada y la clave encolada`() {
        val r = subir(png(6, 6), "image/png")
        val clave = consultar("SELECT s3_key FROM tpl_asset WHERE public_id = ?", r.assetId) as String
        s3.fallaBorrado = true

        assets.borrar(customerId, invitationId, r.assetId)

        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", r.assetId))
        assertEquals(
            1L,
            contar("SELECT count(*) FROM tpl_asset_gc WHERE public_id = ? AND deleted_at IS NULL", r.assetId),
        )
        // El job reintenta y falla: la fila **no** se pierde, se anota el error.
        gc.recolectar()
        assertEquals(1L, contar("SELECT attempts FROM tpl_asset_gc WHERE public_id = ?", r.assetId))
        assertEquals(
            1L,
            contar("SELECT count(*) FROM tpl_asset_gc WHERE public_id = ? AND deleted_at IS NULL", r.assetId),
        )

        // Con S3 de vuelta, la cola se drena y el objeto desaparece.
        s3.fallaBorrado = false
        gc.recolectar()
        assertTrue(s3.borrados.contains("${Templates2ApiTestConfig.BUCKET}/$clave"))
        assertEquals(
            0L,
            contar("SELECT count(*) FROM tpl_asset_gc WHERE public_id = ? AND deleted_at IS NULL", r.assetId),
        )
    }

    /** Caso 11 de `03 §12`, por el camino que este bloque puede probar: la cascada encola las claves. */
    @Test
    fun `borrar la invitacion encola en S3 los assets que se lleva la cascada`() {
        subir(png(3, 3), "image/png")
        subir(png(5, 5), "image/png")
        val invitacion = invitationId

        limpiarInvitacion(invitacion)
        invitationId = nuevaInvitacion(customerId) // para que el @AfterEach no falle

        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitacion))
        assertEquals(
            2L,
            contar("SELECT count(*) FROM tpl_asset_gc WHERE s3_key LIKE ? AND deleted_at IS NULL",
                "templates2/invitation/$invitacion/%"),
            "el trigger encoló las dos claves aunque el borrado no pasara por código de templates2",
        )
        gc.recolectar()
        assertEquals(
            0L,
            contar("SELECT count(*) FROM tpl_asset_gc WHERE s3_key LIKE ? AND deleted_at IS NULL",
                "templates2/invitation/$invitacion/%"),
            "AssetGcJob drena la cola y solo entonces desaparece el objeto de S3 (R-S3-2)",
        )
    }

    // =============================================================================================
    // 03 §3.8 — listado
    // =============================================================================================

    @Test
    fun `el listado marca referenced por el documento y por cualquier release`() {
        val usado = subir(png(20, 20), "image/png")
        val libre = subir(png(21, 21), "image/png")

        var lista = assets.listar(customerId, invitationId, null, null)
        assertEquals(2, lista.items.size)
        assertTrue(lista.items.all { !it.referenced }, "recién subidos, ninguno está referenciado")

        usarEnElDocumento(usado.assetId, base = 0, lote = "b_ref_0001")
        lista = assets.listar(customerId, invitationId, null, null)
        assertTrue(lista.items.first { it.assetId == usado.assetId }.referenced)
        assertFalse(lista.items.first { it.assetId == libre.assetId }.referenced)

        // Publicado y luego retirado del documento: el release sigue necesitándolo.
        escribirTitulo(1, "Ana y Luis", "b_ref_0002")
        releases.publish(customerId, invitationId, json("""{"baseRevision":2}"""))
        editor.applyOperations(
            customerId, invitationId,
            json("""{"baseRevision":2,"clientBatchId":"b_ref_0003","operations":[
                {"op":"clearBlock","blockId":"cover.photo"}]}"""),
        )

        lista = assets.listar(customerId, invitationId, null, null)
        assertTrue(
            lista.items.first { it.assetId == usado.assetId }.referenced,
            "un release es inmutable: su asset sigue referenciado aunque el documento ya no lo use",
        )
    }

    @Test
    fun `el listado pagina y no mezcla invitaciones`() {
        repeat(3) { subir(png(30 + it, 30), "image/png") }
        val pagina1 = assets.listar(customerId, invitationId, 2, null)
        assertEquals(2, pagina1.items.size)
        assertEquals("1", pagina1.nextCursor)
        val pagina2 = assets.listar(customerId, invitationId, 2, pagina1.nextCursor)
        assertEquals(1, pagina2.items.size)
        assertNull(pagina2.nextCursor)
        assertTrue((pagina1.items + pagina2.items).map { it.assetId }.toSet().size == 3)
    }

    // =============================================================================================
    // 03 §3.9 — borrado
    // =============================================================================================

    @Test
    fun `borrar un asset libre responde 204 y encola la clave`() {
        val r = subir(png(7, 7), "image/png")
        assets.borrar(customerId, invitationId, r.assetId)

        assertEquals(0L, contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", r.assetId))
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset_gc WHERE public_id = ?", r.assetId))
        assertTrue(s3.borrados.isEmpty(), "S3 nunca se toca antes del commit (R-S3-2)")
    }

    @Test
    fun `borrar un asset usado por el documento es 409 y no borra nada`() {
        val r = subir(png(9, 9), "image/png")
        usarEnElDocumento(r.assetId, base = 0, lote = "b_del_0001")

        val e = assertThrows<AssetInUseException> { assets.borrar(customerId, invitationId, r.assetId) }
        assertEquals(TplErrorCode.TPL_ASSET_IN_USE, e.code)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", r.assetId))
    }

    @Test
    fun `borrar un asset que solo usa un release ya despublicado sigue siendo 409`() {
        val r = subir(png(11, 11), "image/png")
        usarEnElDocumento(r.assetId, base = 0, lote = "b_del_0002")
        escribirTitulo(1, "Ana y Luis", "b_del_0003")
        releases.publish(customerId, invitationId, json("""{"baseRevision":2}"""))
        releases.unpublish(customerId, invitationId)
        editor.applyOperations(
            customerId, invitationId,
            json("""{"baseRevision":2,"clientBatchId":"b_del_0004","operations":[
                {"op":"clearBlock","blockId":"cover.photo"}]}"""),
        )

        val e = assertThrows<AssetInUseException> { assets.borrar(customerId, invitationId, r.assetId) }
        assertEquals("release", e.details["usedBy"])
    }

    /** Caso 18 de `03 §12`: un `assetId` ajeno responde `404`, **nunca** `403`. */
    @Test
    fun `un assetId de otra invitacion responde 404 y no confirma su existencia`() {
        val otroCliente = nuevoCliente()
        val otraInvitacion = nuevaInvitacion(otroCliente)
        try {
            editor.chooseTemplate(
                otroCliente, otraInvitacion,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            )
            val ajeno = assets.subir(
                otroCliente, otraInvitacion, "image/png", -1, ByteArrayInputStream(png(13, 13)),
            )

            val e = assertThrows<AssetNotFoundException> {
                assets.borrar(customerId, invitationId, ajeno.assetId)
            }
            assertEquals(TplErrorCode.TPL_ASSET_NOT_FOUND, e.code)
            assertEquals(404, e.status, "un 403 confirmaría que el recurso existe (03 §9.2)")
            assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", ajeno.assetId))

            // Y un id inventado da exactamente la misma respuesta.
            val inventado = assertThrows<AssetNotFoundException> {
                assets.borrar(customerId, invitationId, "as_" + "Z".repeat(26))
            }
            assertEquals(e.code, inventado.code)
        } finally {
            limpiarInvitacion(otraInvitacion)
            limpiarCliente(otroCliente)
        }
    }

    @Test
    fun `sin acceso a la invitacion, las tres rutas de assets responden 403 TPL_FORBIDDEN`() {
        val r = subir(png(14, 14), "image/png")
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)

        assertEquals(
            TplErrorCode.TPL_FORBIDDEN,
            assertThrows<ForbiddenException> {
                assets.subir(999L, invitationId, "image/png", -1, ByteArrayInputStream(png(15, 15)))
            }.code,
        )
        assertEquals(
            TplErrorCode.TPL_FORBIDDEN,
            assertThrows<ForbiddenException> { assets.listar(999L, invitationId, null, null) }.code,
        )
        assertEquals(
            TplErrorCode.TPL_FORBIDDEN,
            assertThrows<ForbiddenException> { assets.borrar(999L, invitationId, r.assetId) }.code,
        )
        assertEquals(1L, contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", r.assetId))
    }

    /**
     * ADR-030 en su punto exacto: un `assetId` **ajeno** referenciado desde un `setBlock` se rechaza
     * con `422 TPL_ASSET_NOT_OWNED` y el documento no cambia (caso 17 de `03 §12`).
     */
    @Test
    fun `un assetId ajeno en un setBlock es TPL_ASSET_NOT_OWNED y no incrementa la revision`() {
        val otroCliente = nuevoCliente()
        val otraInvitacion = nuevaInvitacion(otroCliente)
        try {
            editor.chooseTemplate(
                otroCliente, otraInvitacion,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            )
            val ajeno = assets.subir(
                otroCliente, otraInvitacion, "image/png", -1, ByteArrayInputStream(png(16, 16)),
            )

            val e = assertThrows<OperationRejectedException> {
                usarEnElDocumento(ajeno.assetId, base = 0, lote = "b_ajeno_01")
            }
            assertEquals(TplErrorCode.TPL_ASSET_NOT_OWNED, e.code)
            assertEquals(0L, revisionDe(invitationId))
        } finally {
            limpiarInvitacion(otraInvitacion)
            limpiarCliente(otroCliente)
        }
    }

    // =============================================================================================

    private fun subir(bytes: ByteArray, tipo: String?) = assets.subir(
        customerId, invitationId, tipo, bytes.size.toLong(), ByteArrayInputStream(bytes),
    )

    private fun usarEnElDocumento(assetId: String, base: Long, lote: String) {
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
                   {"op":"setBlock","blockId":"cover.photo","value":{"kind":"image","assetId":"$assetId",
                    "alt":"","focal":{"x":0.5,"y":0.5}}}]}""",
            ),
        )
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

    private fun tipoPng() = mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType.IMAGE_PNG

    private fun shaDe(bytes: ByteArray): String =
        java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /**
     * Fila que ocupa **la misma `(bucket, s3_key)`** con otro `sha256`: choca contra
     * `uq_tpl_asset_key` y hace fallar el `INSERT` **después** de que el objeto ya esté en S3, que es
     * el fallo parcial de `02 §10.5` fila 2. El `sha256` distinto es imprescindible: con el mismo, el
     * servicio devolvería `reused` en el paso 5 y no llegaría a intentar el `INSERT`.
     */
    private fun insertarAssetCrudo(publicId: String, sha: String, clave: String) {
        val otroSha = if (sha.startsWith("f")) "e" + sha.substring(1) else "f" + sha.substring(1)
        actualizar(
            "INSERT INTO tpl_asset (public_id, invitation_id, bucket, s3_key, sha256, content_type, bytes) " +
                "VALUES (?, ?, ?, ?, ?, 'image/png', 1)",
            publicId, invitationId, Templates2ApiTestConfig.BUCKET, clave, otroSha,
        )
    }

    /** Deja la invitación en la cuota con filas mínimas, sin subir 200 archivos de verdad. */
    private fun rellenarHastaLaCuota() {
        val faltan = 200 - contar("SELECT count(*) FROM tpl_asset WHERE invitation_id = ?", invitationId)
        for (i in 0 until faltan) {
            val sufijo = i.toString().padStart(26, '0').replace('0', 'A').takeLast(26)
            actualizar(
                "INSERT INTO tpl_asset (public_id, invitation_id, bucket, s3_key, sha256, content_type, bytes) " +
                    "VALUES (?, ?, ?, ?, ?, 'image/png', 1)",
                "as_$sufijo", invitationId, Templates2ApiTestConfig.BUCKET, "relleno/$i.png",
                "%064x".format(java.math.BigInteger.valueOf(i + 1L)),
            )
        }
    }

    /** PNG mínimo **válido de cabecera**: firma + `IHDR` con el ancho y el alto pedidos. */
    private fun png(ancho: Int, alto: Int): ByteArray {
        val salida = java.io.ByteArrayOutputStream()
        salida.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        salida.write(byteArrayOf(0, 0, 0, 13))
        salida.write("IHDR".toByteArray(Charsets.US_ASCII))
        salida.write(be32(ancho))
        salida.write(be32(alto))
        salida.write(byteArrayOf(8, 6, 0, 0, 0))
        salida.write(ByteArray(4))
        return salida.toByteArray()
    }

    private fun be32(v: Int) = byteArrayOf(
        (v ushr 24).toByte(), (v ushr 16).toByte(), (v ushr 8).toByte(), v.toByte(),
    )
}
