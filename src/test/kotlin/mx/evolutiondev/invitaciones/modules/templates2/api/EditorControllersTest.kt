package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.core.auth.model.CustomerDetails
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.isNull
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Instant

/**
 * Contrato HTTP de las rutas 2-6 y 10-14 de `03 §2`: rutas exactas (incluidos los dos verbos con `:`),
 * códigos de estado y **de dónde sale cada identificador** — `requesterId` del principal del JWT,
 * `invitationId` de la ruta, nunca del cuerpo (`03 §9.2`, mata H-13).
 */
class EditorControllersTest {

    private val documentos: EditorDocumentService = mock()
    private val publicacion: ReleaseService = mock()
    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(EditorDocumentController(documentos), EditorReleaseController(publicacion))
        .build()

    private val autenticacion: Authentication =
        UsernamePasswordAuthenticationToken(CustomerDetails(7L, "a@b.test", "x", emptyList()), null, emptyList())

    private fun nodo(): ObjectNode = Templates2Json.mapper.createObjectNode().put("marcador", 1)

    // =============================================================================================
    // Documento
    // =============================================================================================

    @Test
    fun `choose-template responde 201 cuando crea el documento y 200 cuando ya existia`() {
        whenever(documentos.chooseTemplate(any(), any(), any())).doReturn(respuestaChoose(created = true))
        mvc.perform(
            post("/editor/invitations/42/document:choose-template")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"templateSlug":"boda-clasica","templateVersion":"1.0.0"}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.created").value(true))
            .andExpect(jsonPath("$.publicUrl").value("https://app/i/pub_x"))

        whenever(documentos.chooseTemplate(any(), any(), any())).doReturn(respuestaChoose(created = false))
        mvc.perform(
            post("/editor/invitations/42/document:choose-template")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"templateSlug":"boda-clasica","templateVersion":"1.0.0","baseRevision":3}"""),
        ).andExpect(status().isOk)
    }

    @Test
    fun `el servicio recibe el id del principal y el de la ruta, nunca uno del cuerpo`() {
        whenever(documentos.chooseTemplate(any(), any(), any())).doReturn(respuestaChoose(created = true))
        mvc.perform(
            post("/editor/invitations/42/document:choose-template")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"templateSlug":"s","templateVersion":"1.0.0"}"""),
        ).andExpect(status().isCreated)

        verify(documentos).chooseTemplate(eq(7L), eq(42L), any())
    }

    @Test
    fun `GET document responde 200 con el documento, la vista compuesta y el informe`() {
        whenever(documentos.getDocument(any(), any())).doReturn(
            DocumentResponse(
                document = nodo(), revision = 42,
                templateVersion = TemplateVersionRef("boda-clasica", "1.0.0", "published"),
                manifest = nodo(), theme = nodo(),
                composed = nodo(), report = nodo(),
                publicToken = "pub_x", publicUrl = "https://app/i/pub_x",
                activeRelease = ActiveReleaseRef(7, Instant.EPOCH, "sha256:ab", 41, true, listOf("business.date")),
            ),
        )
        mvc.perform(get("/editor/invitations/42/document").principal(autenticacion))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.revision").value(42))
            .andExpect(jsonPath("$.templateVersion.slug").value("boda-clasica"))
            .andExpect(jsonPath("$.activeRelease.stale").value(true))
            .andExpect(jsonPath("$.activeRelease.staleReason[0]").value("business.date"))
    }

    @Test
    fun `POST operations responde 200 con revision, applied e idMap`() {
        whenever(documentos.applyOperations(any(), any(), any())).doReturn(
            OperationBatchResponse(43, true, mapOf("tmp:a" to "01J8"), nodo(), nodo()),
        )
        mvc.perform(
            post("/editor/invitations/42/document/operations")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"baseRevision":42,"clientBatchId":"b_7fA3-91xQz20","operations":[]}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.revision").value(43))
            .andExpect(jsonPath("$.applied").value(true))
            .andExpect(jsonPath("$.idMap.['tmp:a']").value("01J8"))
    }

    @Test
    fun `GET history pasa limit, cursor y clientBatchId tal cual`() {
        whenever(documentos.history(any(), any(), any(), any(), any())).doReturn(
            HistoryPageResponse(listOf(HistoryItemResponse(43, Instant.EPOCH, "b_1", "operations", 12)), "42"),
        )
        mvc.perform(
            get("/editor/invitations/42/document/history")
                .principal(autenticacion)
                .param("limit", "10").param("cursor", "50").param("clientBatchId", "b_1"),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].origin").value("operations"))
            .andExpect(jsonPath("$.nextCursor").value("42"))
        verify(documentos).history(eq(7L), eq(42L), eq(10), eq("50"), eq("b_1"))
    }

    @Test
    fun `POST restore responde 200 con la revision nueva y lo movido al attic`() {
        whenever(documentos.restore(any(), any(), any())).doReturn(
            RestoreResponse(44, nodo(), nodo(), listOf("couple.groomText")),
        )
        mvc.perform(
            post("/editor/invitations/42/document/restore")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"revision":37,"baseRevision":43}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.revision").value(44))
            .andExpect(jsonPath("$.movedToAttic[0]").value("couple.groomText"))
    }

    // =============================================================================================
    // Publicación
    // =============================================================================================

    @Test
    fun `preflight responde 200 con bloqueos y avisos separados`() {
        whenever(publicacion.preflight(any(), any())).doReturn(
            PreflightResponse(
                canPublish = false,
                blockers = listOf(PreflightFinding("TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT", blockIds = listOf("cover.title"))),
                warnings = listOf(PreflightFinding("TPL_SECTION_EMPTY", sectionKeys = listOf("story"))),
                report = nodo(), contentHash = "sha256:ab", sameAsActiveRelease = false,
            ),
        )
        mvc.perform(get("/editor/invitations/42/release/preflight").principal(autenticacion))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.canPublish").value(false))
            .andExpect(jsonPath("$.blockers[0].blockIds[0]").value("cover.title"))
            .andExpect(jsonPath("$.warnings[0].sectionKeys[0]").value("story"))
    }

    @Test
    fun `POST release responde 201 al publicar y 200 al reutilizar el release activo`() {
        whenever(publicacion.publish(any(), any(), any())).doReturn(respuestaRelease(reusado = false))
        mvc.perform(
            post("/editor/invitations/42/release")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"baseRevision":43}"""),
        )
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.contentHash").value("sha256:ab"))

        whenever(publicacion.publish(any(), any(), any())).doReturn(respuestaRelease(reusado = true))
        mvc.perform(
            post("/editor/invitations/42/release")
                .principal(autenticacion)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"baseRevision":43}"""),
        )
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.reusedActiveRelease").value(true))
    }

    @Test
    fun `DELETE release responde 204 y GET releases lista sin composed`() {
        mvc.perform(delete("/editor/invitations/42/release").principal(autenticacion))
            .andExpect(status().isNoContent)
        verify(publicacion).unpublish(7L, 42L)

        whenever(publicacion.list(any(), any(), isNull(), isNull())).doReturn(
            ReleaseListResponse(
                listOf(
                    ReleaseItemResponse(
                        8, Instant.EPOCH, null, "sha256:ab", 43,
                        TemplateVersionRef("boda-clasica", "1.0.0", "published"), true, 12,
                    ),
                ),
                null,
            ),
        )
        mvc.perform(get("/editor/invitations/42/releases").principal(autenticacion))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].releaseId").value(8))
            .andExpect(jsonPath("$.items[0].composed").doesNotExist())
    }

    @Test
    fun `public-token rotate responde 200 con el enlace nuevo`() {
        whenever(publicacion.rotatePublicToken(any(), any())).doReturn(
            PublicTokenResponse("pub_nuevo", "https://app/i/pub_nuevo", Instant.EPOCH),
        )
        mvc.perform(post("/editor/invitations/42/public-token:rotate").principal(autenticacion))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.publicToken").value("pub_nuevo"))
            .andExpect(jsonPath("$.publicUrl").value("https://app/i/pub_nuevo"))
        verify(publicacion).rotatePublicToken(7L, 42L)
    }

    // ---------------------------------------------------------------------------------------------

    private fun respuestaChoose(created: Boolean) = ChooseTemplateResponse(
        revision = 0, created = created, changed = created,
        document = nodo(), composed = nodo(), report = nodo(), movedToAttic = emptyList(),
        templateVersion = TemplateVersionRef("boda-clasica", "1.0.0", "published"),
        publicToken = "pub_x", publicUrl = "https://app/i/pub_x",
    )

    private fun respuestaRelease(reusado: Boolean) = ReleaseResponse(
        releaseId = 8, contentHash = "sha256:ab", documentRevision = 43, publishedAt = Instant.EPOCH,
        publicToken = "pub_x", publicUrl = "https://app/i/pub_x", reusedActiveRelease = reusado,
    )

    @Test
    fun `las rutas son exactamente las de la tabla de 03 §2`() {
        assertEquals(
            listOf("/editor/invitations/{invitationId}"),
            org.springframework.core.annotation.AnnotatedElementUtils.findMergedAnnotation(
                EditorDocumentController::class.java, org.springframework.web.bind.annotation.RequestMapping::class.java,
            )!!.value.toList(),
        )
        assertEquals(
            listOf("/editor/invitations/{invitationId}"),
            org.springframework.core.annotation.AnnotatedElementUtils.findMergedAnnotation(
                EditorReleaseController::class.java, org.springframework.web.bind.annotation.RequestMapping::class.java,
            )!!.value.toList(),
        )
    }

    /**
     * ADR-1R-B-10 (objeción A-02): `/editor/` + `**` **no tiene regla** en `SecurityConfig` —cae en
     * `anyRequest().authenticated()`—, así que sin este `@PreAuthorize` de clase cualquier usuario
     * autenticado de cualquier rol entraría y la única barrera sería `HierarchyValidationService`.
     * Una anotación que alguien borre en un refactor no rompe ninguna prueba funcional; esta sí.
     */
    @Test
    fun `los dos controladores del editor exigen uno de los tres roles reales`() {
        for (clase in listOf(EditorDocumentController::class.java, EditorReleaseController::class.java)) {
            val anotacion = org.springframework.core.annotation.AnnotatedElementUtils.findMergedAnnotation(
                clase, org.springframework.security.access.prepost.PreAuthorize::class.java,
            )
            assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion?.value, "${clase.simpleName} sin @PreAuthorize")
        }
    }
}
