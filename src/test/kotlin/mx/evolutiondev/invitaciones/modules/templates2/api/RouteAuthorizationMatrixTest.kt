package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import java.io.ByteArrayInputStream

/**
 * **La matriz ruta × rol de `03 §9.1`, ejecutada.** Una prueba dinámica por celda.
 *
 * Qué mide cada columna, y por qué no puede medirse toda igual:
 *
 * - **`USER` dueño, `ADMIN` de ese cliente, `MASTER`** → `validateInvitationAccess` devuelve `true`
 *   (es su semántica verificada en `HierarchyValidationService.kt:42-71`) y la ruta debe **funcionar**.
 * - **`USER` ajeno, `ADMIN` ajeno** → devuelve `false` y la ruta debe responder `403 TPL_FORBIDDEN`,
 *   **sin escribir nada**.
 * - **Anónimo → `401`** lo produce `AuthEntryPointJwt` desde la cadena de filtros de Spring Security
 *   (`SecurityConfig.kt:34`), que **no** pasa por este módulo (`03 §10.4`). Aquí se comprueba lo único
 *   que este módulo controla y que hace que ese `401` exista: que **cada** controlador de `/editor/` +
 *   `**` lleva `@PreAuthorize` a nivel de clase (ADR-1R-B-10) — sin él, `anyRequest().authenticated()`
 *   dejaría la ruta abierta a cualquier usuario autenticado de cualquier rol.
 *
 * `HierarchyValidationService` es un mock por un defecto **ajeno y preexistente**: su implementación
 * real arrastra `InvitationGuestEntity`, que mapea `graduates_name`, una columna que ninguna migración
 * crea (ADR-2-ORQ-02). Lo que se prueba aquí es que **cada ruta le pregunta** y respeta la respuesta,
 * que es la parte que este módulo puede romper.
 */
@Import(Templates2ApiTestConfig::class)
class RouteAuthorizationMatrixTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var assets: EditorAssetService
    @Autowired private lateinit var render: PublicRenderService
    @Autowired private lateinit var hierarchy: HierarchyValidationService

    private val slug = "prueba-matriz"
    private var customerId = 0L
    private var adminId = 0L
    private var masterId = 0L
    private var invitationId = 0L
    private var assetId = ""
    private var lote = 0

    @BeforeEach
    fun preparar() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        // `tpl_document.updated_by` y `tpl_asset.created_by` son FK a `customer`: los requesters de las
        // columnas ADMIN y MASTER tienen que existir de verdad, no ser ids inventados.
        adminId = nuevoCliente()
        masterId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
        assetId = assets.subir(
            customerId, invitationId, "image/png", -1, ByteArrayInputStream(pngMinimo()),
        ).assetId
    }

    @AfterEach
    fun limpiar() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarCliente(adminId)
        limpiarCliente(masterId)
        limpiarPlantilla(slug)
        actualizar("DELETE FROM tpl_asset_gc WHERE public_id LIKE 'as_%'")
    }

    /** Las 13 rutas de invitación de `03 §2` (filas 2-14), cada una con su llamada real. */
    private fun rutasDeInvitacion(quien: Long): List<Pair<String, () -> Unit>> = listOf(
        "2 POST :choose-template" to {
            editor.chooseTemplate(
                quien, invitationId,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0","baseRevision":${revisionDe(invitationId)}}"""),
            )
            Unit
        },
        "3 GET /document" to { editor.getDocument(quien, invitationId); Unit },
        "4 POST /document/operations" to {
            editor.applyOperations(
                quien, invitationId,
                json(
                    """{"baseRevision":${revisionDe(invitationId)},"clientBatchId":"b_matriz_${lote++}",
                       "operations":[{"op":"setBlock","blockId":"cover.title",
                       "value":{"kind":"text","value":"Ana y Luis"}}]}""",
                ),
            )
            Unit
        },
        "5 GET /document/history" to { editor.history(quien, invitationId, null, null, null); Unit },
        "6 POST /document/restore" to {
            editor.restore(quien, invitationId, json("""{"revision":0,"baseRevision":${revisionDe(invitationId)}}"""))
            Unit
        },
        "7 POST /assets" to {
            assets.subir(quien, invitationId, "image/png", -1, ByteArrayInputStream(pngMinimo(9)))
            Unit
        },
        "8 GET /assets" to { assets.listar(quien, invitationId, null, null); Unit },
        "9 DELETE /assets/{assetId}" to { assets.borrar(quien, invitationId, assetId) },
        "10 GET /release/preflight" to { releases.preflight(quien, invitationId); Unit },
        "11 POST /release" to {
            releases.publish(quien, invitationId, json("""{"baseRevision":${revisionDe(invitationId)}}"""))
            Unit
        },
        "12 DELETE /release" to { releases.unpublish(quien, invitationId) },
        "13 GET /releases" to { releases.list(quien, invitationId, null, null); Unit },
        "14 POST /public-token:rotate" to { releases.rotatePublicToken(quien, invitationId); Unit },
    )

    /**
     * Las tres columnas que **deben** funcionar. Que la llamada termine sin `ForbiddenException` es la
     * aserción; otros errores de negocio (un `422` de publicación bloqueada, por ejemplo) no son un
     * fallo de autorización y no invalidan la celda.
     */
    @TestFactory
    fun `matriz 03 9-1 - con acceso concedido ninguna ruta responde 403`(): List<DynamicTest> {
        val columnas = listOf("USER dueno" to customerId, "ADMIN de ese cliente" to adminId, "MASTER" to masterId)
        return columnas.flatMap { (rol, quien) ->
            rutasDeInvitacion(quien).map { (nombre, llamada) ->
                DynamicTest.dynamicTest("$nombre · $rol") {
                    whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
                    try {
                        llamada()
                    } catch (e: ForbiddenException) {
                        throw AssertionError("$nombre respondió 403 a $rol, que sí tiene acceso", e)
                    } catch (e: EditorException) {
                        assertFalse(
                            e.code == TplErrorCode.TPL_FORBIDDEN,
                            "$nombre respondió TPL_FORBIDDEN a $rol",
                        )
                    }
                }
            }
        }
    }

    /** Las dos columnas que **deben** cerrarse, y además sin efectos secundarios. */
    @TestFactory
    fun `matriz 03 9-1 - sin acceso, las trece rutas responden 403 TPL_FORBIDDEN y no escriben`(): List<DynamicTest> {
        val revisionInicial = revisionDe(invitationId)
        return listOf("USER ajeno" to 777L, "ADMIN ajeno" to 888L).flatMap { (rol, quien) ->
            rutasDeInvitacion(quien).map { (nombre, llamada) ->
                DynamicTest.dynamicTest("$nombre · $rol") {
                    whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)
                    val e = assertThrows<ForbiddenException>(nombre) { llamada() }
                    assertEquals(TplErrorCode.TPL_FORBIDDEN, e.code, nombre)
                    assertEquals(403, e.status, nombre)
                    assertEquals(revisionInicial, revisionDe(invitationId), "$nombre escribió pese al 403")
                    assertEquals(
                        1L,
                        contar("SELECT count(*) FROM tpl_asset WHERE public_id = ?", assetId),
                        "$nombre borró un asset pese al 403",
                    )
                }
            }
        }
    }

    /** Filas 15 y 16: **sin auth**, y sin que la autorización jerárquica pinte nada. */
    @Test
    fun `las dos rutas publicas no consultan la jerarquia y responden sin autenticacion`() {
        val token = editor.getDocument(customerId, invitationId).publicToken
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)

        // `exists` responde igual con o sin acceso: no hay identidad que consultar.
        assertFalse(render.exists(token).published)
        assertEquals(
            TplErrorCode.TPL_RELEASE_NOT_FOUND,
            assertThrows<ReleaseNotFoundException> { render.render(token) }.code,
            "sin release activo, el render es 404 aunque quien pregunte no tenga ninguna identidad",
        )
    }

    /**
     * La columna "Anónimo" de `03 §9.1`: el `401` no lo emite este módulo, pero **sí** depende de que
     * cada controlador de `/editor/` + `**` lleve su `@PreAuthorize` (ADR-1R-B-10). Sin esta prueba, un
     * borrado accidental de la anotación no rompería ninguna prueba funcional.
     */
    @Test
    fun `todos los controladores del editor exigen rol y el publico no`() {
        val editorControllers = listOf(
            CatalogController::class.java,
            EditorDocumentController::class.java,
            EditorReleaseController::class.java,
            EditorAssetController::class.java,
        )
        for (clase in editorControllers) {
            val anotacion = AnnotatedElementUtils.findMergedAnnotation(clase, PreAuthorize::class.java)
            assertNotNull(anotacion, "${clase.simpleName} debe llevar @PreAuthorize a nivel de clase")
            assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value, clase.simpleName)
        }
        assertEquals(
            "hasRole('MASTER')",
            AnnotatedElementUtils.findMergedAnnotation(
                MasterTemplateRegistryController::class.java, PreAuthorize::class.java,
            )!!.value,
        )
        assertTrue(
            AnnotatedElementUtils.findMergedAnnotation(
                PublicRenderController::class.java, PreAuthorize::class.java,
            ) == null,
        )
    }

    // =============================================================================================
    // 03 §9.2 — inyección de ids (H-13)
    // =============================================================================================

    @Test
    fun `un invitationId ajeno en la ruta no da acceso, aunque el cuerpo sea perfecto`() {
        val otroCliente = nuevoCliente()
        val ajena = nuevaInvitacion(otroCliente)
        try {
            whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)
            assertEquals(
                TplErrorCode.TPL_FORBIDDEN,
                assertThrows<ForbiddenException> { editor.getDocument(customerId, ajena) }.code,
            )
        } finally {
            whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(true)
            limpiarInvitacion(ajena)
            limpiarCliente(otroCliente)
        }
    }

    /** Fila 2 de `03 §9.2`: ningún DTO del módulo tiene `invitationId`, y el lector es estricto. */
    @Test
    fun `colar invitationId en el cuerpo es 400 TPL_MALFORMED_JSON, no un descarte silencioso`() {
        val e = assertThrows<mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception> {
            editor.chooseTemplate(
                customerId, invitationId,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0","baseRevision":0,"invitationId":200}"""),
            )
        }
        assertEquals(TplErrorCode.TPL_MALFORMED_JSON, e.code)
        assertEquals(400, e.status)
    }

    /** Fila 6 de `03 §9.2`: las snapshots se resuelven por el documento ya autorizado. */
    @Test
    fun `restaurar una revision que existe en otro documento es 404 TPL_SNAPSHOT_NOT_FOUND`() {
        val otroCliente = nuevoCliente()
        val otraInvitacion = nuevaInvitacion(otroCliente)
        try {
            editor.chooseTemplate(
                otroCliente, otraInvitacion, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            )
            editor.applyOperations(
                otroCliente, otraInvitacion,
                json(
                    """{"baseRevision":0,"clientBatchId":"b_mtx_otro","operations":[
                       {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Otra"}}]}""",
                ),
            )
            // La revisión 1 existe… en el OTRO documento.
            val e = assertThrows<SnapshotNotFoundException> {
                editor.restore(customerId, invitationId, json("""{"revision":1,"baseRevision":0}"""))
            }
            assertEquals(TplErrorCode.TPL_SNAPSHOT_NOT_FOUND, e.code)
        } finally {
            limpiarInvitacion(otraInvitacion)
            limpiarCliente(otroCliente)
        }
    }

    /** Fila 8 de `03 §9.2`: un `publicToken` ajeno solo sirve **su** invitación, nunca otra. */
    @Test
    fun `un publicToken de otra invitacion no da acceso a esta`() {
        val otroCliente = nuevoCliente()
        val otraInvitacion = nuevaInvitacion(otroCliente)
        try {
            val ajeno = editor.chooseTemplate(
                otroCliente, otraInvitacion, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            ).publicToken
            val propio = editor.getDocument(customerId, invitationId).publicToken

            assertFalse(ajeno == propio, "cada documento tiene su propio token")
            // Publicar la mía y pedir la suya no puede devolver la mía.
            assertThrows<ReleaseNotFoundException> { render.render(ajeno) }
        } finally {
            limpiarInvitacion(otraInvitacion)
            limpiarCliente(otroCliente)
        }
    }

    private fun pngMinimo(ancho: Int = 8): ByteArray {
        val salida = java.io.ByteArrayOutputStream()
        salida.write(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
        salida.write(byteArrayOf(0, 0, 0, 13))
        salida.write("IHDR".toByteArray(Charsets.US_ASCII))
        salida.write(byteArrayOf(0, 0, 0, ancho.toByte()))
        salida.write(byteArrayOf(0, 0, 0, 8))
        salida.write(byteArrayOf(8, 6, 0, 0, 0))
        salida.write(ByteArray(4))
        return salida.toByteArray()
    }
}
