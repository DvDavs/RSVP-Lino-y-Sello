package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import mx.evolutiondev.invitaciones.core.util.formatter.DateFormatterImpl
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.http.HttpHeaders
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.RequestMapping
import java.time.Instant

/**
 * Contrato HTTP de las rutas 7-9 y 15-16 de `03 §2`: rutas exactas, códigos de estado, cabeceras y **de
 * dónde sale cada identificador**. Mismo patrón que `EditorControllersTest` (2-4).
 *
 * Lo que aquí se mide del render público es justo lo que un CDN mira: `ETag`, `Cache-Control`,
 * `Vary`, `nosniff` y el `304`. Son contrato, no adorno: sin `ETag` estable no hay caché posible y sin
 * `no-store` en `exists` la sonda del editor mentiría durante cinco minutos.
 */
class AssetAndRenderControllersTest {

    private val assets: EditorAssetService = mock()
    private val render: PublicRenderService = mock()

    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(EditorAssetController(assets), PublicRenderController(render))
        .setControllerAdvice(Templates2ExceptionHandler(DateFormatterImpl()))
        .build()

    private val autenticacion: Authentication =
        UsernamePasswordAuthenticationToken(CustomerDetails(7L, "a@b.test", "x", emptyList()), null, emptyList())

    // =============================================================================================
    // Rutas 7-9: assets
    // =============================================================================================

    @Test
    fun `POST assets responde 201 en una subida nueva y 200 cuando reutiliza por contenido`() {
        whenever(assets.subir(any(), any(), any(), any(), any())).doReturn(respuestaSubida(reused = false))
        mvc.perform(
            post("/editor/invitations/42/assets")
                .principal(autenticacion)
                .contentType("image/webp")
                .content(byteArrayOf(1, 2, 3)),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.assetId").value(ASSET))
            .andExpect(jsonPath("$.reused").value(false))
            .andExpect(jsonPath("$.previewUrl").value("https://s3/preview"))

        whenever(assets.subir(any(), any(), any(), any(), any())).doReturn(respuestaSubida(reused = true))
        mvc.perform(
            post("/editor/invitations/42/assets")
                .principal(autenticacion)
                .contentType("image/webp")
                .content(byteArrayOf(1, 2, 3)),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.reused").value(true))
    }

    @Test
    fun `la subida recibe el id del principal, el de la ruta y el Content-Type declarado`() {
        whenever(assets.subir(any(), any(), any(), any(), any())).doReturn(respuestaSubida(reused = false))
        mvc.perform(
            post("/editor/invitations/42/assets")
                .principal(autenticacion)
                .contentType("image/png")
                .header("X-Asset-Filename", "../../etc/passwd")
                .content(byteArrayOf(1, 2, 3)),
        ).andExpect(status().isCreated)

        // El nombre de archivo del cliente **no** llega al servicio: no decide dónde se escribe nada.
        verify(assets).subir(eq(7L), eq(42L), eq("image/png"), any(), any())
    }

    @Test
    fun `GET assets devuelve la pagina con referenced y el cursor`() {
        // `any()` de mockito-kotlin **no** casa con `null`: los dos parámetros opcionales
        // necesitan `anyOrNull()` o el stub no se aplica y el controlador devuelve un cuerpo vacío.
        whenever(assets.listar(any(), any(), anyOrNull(), anyOrNull())).doReturn(
            AssetListResponse(
                items = listOf(
                    AssetItemResponse(ASSET, 482113, "image/webp", 1600, 1200, Instant.EPOCH, true, "https://s3/p"),
                ),
                nextCursor = "1",
            ),
        )
        mvc.perform(get("/editor/invitations/42/assets").principal(autenticacion).param("limit", "1"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].assetId").value(ASSET))
            .andExpect(jsonPath("$.items[0].referenced").value(true))
            .andExpect(jsonPath("$.nextCursor").value("1"))

        verify(assets).listar(eq(7L), eq(42L), eq(1), eq(null))
    }

    @Test
    fun `DELETE asset responde 204, y un assetId ajeno responde 404 y no 403`() {
        mvc.perform(delete("/editor/invitations/42/assets/$ASSET").principal(autenticacion))
            .andExpect(status().isNoContent)
        verify(assets).borrar(eq(7L), eq(42L), eq(ASSET))

        doThrow(AssetNotFoundException("ajeno")).whenever(assets).borrar(any(), any(), eq(AJENO))
        mvc.perform(delete("/editor/invitations/42/assets/$AJENO").principal(autenticacion))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("TPL_ASSET_NOT_FOUND"))
    }

    @Test
    fun `un asset en uso responde 409 con el codigo tipado`() {
        doThrow(AssetInUseException("en uso", mapOf("usedBy" to "release")))
            .whenever(assets).borrar(any(), any(), any())
        mvc.perform(delete("/editor/invitations/42/assets/$ASSET").principal(autenticacion))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("TPL_ASSET_IN_USE"))
            .andExpect(jsonPath("$.details.usedBy").value("release"))
    }

    // =============================================================================================
    // Rutas 15-16: render público
    // =============================================================================================

    @Test
    fun `GET render devuelve 200 con ETag igual al contentHash y las cabeceras de cache de 03 7`() {
        whenever(render.render(any())).doReturn(salidaRender())

        mvc.perform(get("/public/i/$TOKEN/render"))
            .andExpect(status().isOk)
            .andExpect(header().string(HttpHeaders.ETAG, "\"$HASH\""))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, PublicRenderController.CACHE_CONTROL))
            .andExpect(header().string(HttpHeaders.VARY, HttpHeaders.ACCEPT_ENCODING))
            .andExpect(header().string(PublicRenderController.CABECERA_NOSNIFF, "nosniff"))
            .andExpect(jsonPath("$.contentHash").value(HASH))
            .andExpect(jsonPath("$.composed.composedVersion").value(1))
    }

    @Test
    fun `If-None-Match coincidente responde 304 sin cuerpo`() {
        whenever(render.render(any())).doReturn(salidaRender())
        val resultado = mvc.perform(get("/public/i/$TOKEN/render").header(HttpHeaders.IF_NONE_MATCH, "\"$HASH\""))
            .andExpect(status().isNotModified)
            .andExpect(header().string(HttpHeaders.ETAG, "\"$HASH\""))
            .andReturn()
        assertEquals("", resultado.response.contentAsString)
    }

    @Test
    fun `un ETag distinto devuelve el cuerpo entero`() {
        whenever(render.render(any())).doReturn(salidaRender())
        mvc.perform(get("/public/i/$TOKEN/render").header(HttpHeaders.IF_NONE_MATCH, "\"sha256:otro\""))
            .andExpect(status().isOk)
    }

    @Test
    fun `el render no exige autenticacion`() {
        whenever(render.render(any())).doReturn(salidaRender())
        // Sin `.principal(...)`: es la única superficie del módulo sin auth (`SecurityConfig.kt:38`).
        mvc.perform(get("/public/i/$TOKEN/render")).andExpect(status().isOk)
        mvc.perform(get("/public/i/$TOKEN/exists")).andExpect(status().isOk)
    }

    @Test
    fun `exists responde no-store y nunca 404`() {
        whenever(render.exists(any())).doReturn(ExistsResponse(false))
        mvc.perform(get("/public/i/pub_INVENTADO/exists"))
            .andExpect(status().isOk)
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(jsonPath("$.published").value(false))
    }

    @Test
    fun `un token sin release responde 404 TPL_RELEASE_NOT_FOUND`() {
        whenever(render.render(any())).doThrow(ReleaseNotFoundException("no hay nada"))
        mvc.perform(get("/public/i/$TOKEN/render"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("TPL_RELEASE_NOT_FOUND"))
    }

    @Test
    fun `una invitacion deshabilitada responde 403 TPL_INVITATION_UNAVAILABLE`() {
        whenever(render.render(any())).doThrow(InvitationUnavailableException("no disponible"))
        mvc.perform(get("/public/i/$TOKEN/render"))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.code").value("TPL_INVITATION_UNAVAILABLE"))
    }

    // =============================================================================================
    // Las rutas y sus anotaciones (ADR-1R-B-10 y decisión X-08)
    // =============================================================================================

    @Test
    fun `los assets exigen rol y el render publico no lleva PreAuthorize`() {
        val assetsAnotacion = AnnotatedElementUtils.findMergedAnnotation(
            EditorAssetController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(assetsAnotacion, "EditorAssetController debe llevar @PreAuthorize (ADR-1R-B-10)")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", assetsAnotacion!!.value)

        assertTrue(
            AnnotatedElementUtils.findMergedAnnotation(
                PublicRenderController::class.java, PreAuthorize::class.java,
            ) == null,
            "el render público NO puede llevar @PreAuthorize: lo cerraría (03 §3.15)",
        )
    }

    @Test
    fun `la ruta publica es la forma canonica de X-08`() {
        assertEquals(
            listOf("/public/i/{publicToken}"),
            AnnotatedElementUtils.findMergedAnnotation(
                PublicRenderController::class.java, RequestMapping::class.java,
            )!!.value.toList(),
            "la forma /public/invitations/{token}/render de ADR-013 quedó enmendada y no existe",
        )
        assertEquals(
            listOf("/editor/invitations/{invitationId}/assets"),
            AnnotatedElementUtils.findMergedAnnotation(
                EditorAssetController::class.java, RequestMapping::class.java,
            )!!.value.toList(),
        )
    }

    // =============================================================================================

    private fun respuestaSubida(reused: Boolean) = AssetUploadResponse(
        assetId = ASSET, bytes = 482113, contentType = "image/webp", sha256 = "9c".repeat(32),
        width = 1600, height = 1200, previewUrl = "https://s3/preview", reused = reused,
    )

    private fun salidaRender(): RenderOutcome {
        val composed = Templates2Json.mapper.createObjectNode().put("composedVersion", 1)
        return RenderOutcome(RenderResponse(composed, Instant.EPOCH, HASH), "\"$HASH\"")
    }

    companion object {
        private const val ASSET = "as_01J8ZQ2K3M4N5P6R7S8T9V0W1X"
        private const val AJENO = "as_01J8ZQ2K3M4N5P6R7S8T9V0W99"
        private const val TOKEN = "pub_01J8ZQ2K3M4N5P6R7S8T9V0W1X"
        private val HASH = "sha256:3f" + "0".repeat(62)
    }
}
