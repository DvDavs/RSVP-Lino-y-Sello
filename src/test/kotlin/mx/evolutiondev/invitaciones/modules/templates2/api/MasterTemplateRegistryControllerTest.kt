package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.catalog.PaqueteFixture
import mx.evolutiondev.invitaciones.modules.templates2.catalog.RawTemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.catalog.Pagina
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateCatalogService
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistrationOutcome
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateRegistrationService
import mx.evolutiondev.invitaciones.modules.templates2.catalog.VersionEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import java.time.Instant

/**
 * Contrato HTTP de `03 §3.17`-`§3.19`. `standaloneSetup` (sin contexto de Spring) porque el contexto
 * completo de la aplicación **no arranca hoy** por un defecto ajeno del módulo antiguo
 * (`InvitationGuestEntity` mapea `graduates_name`, columna que ninguna migración crea — ADR-2-ORQ-02):
 * aquí se prueba el enrutado, el multipart y la forma del cuerpo; la autorización se comprueba en
 * `Templates2AnotacionesSeguridadTest` y el algoritmo en las pruebas contra PostgreSQL.
 */
class MasterTemplateRegistryControllerTest {

    private val registro: TemplateRegistrationService = mock()
    private val catalogo: TemplateCatalogService = mock()
    private val mvc: MockMvc = MockMvcBuilders
        .standaloneSetup(MasterTemplateRegistryController(registro, catalogo))
        .build()

    private val paquete = PaqueteFixture.ejemplo("boda-clasica-1.0.0")

    @Test
    fun `un alta responde 201 con result created y alreadyRegistered false`() {
        whenever(registro.register(any(), anyOrNull())).doReturn(salida(creada = true))

        mvc.perform(multipartDelPaquete())
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.result").value("created"))
            .andExpect(jsonPath("$.alreadyRegistered").value(false))
            .andExpect(jsonPath("$.templateVersionId").value(14))
            .andExpect(jsonPath("$.slug").value("boda-clasica"))
            .andExpect(jsonPath("$.packageHash").value(HASH))
            .andExpect(jsonPath("$.assetsRegistered").value(2))
    }

    /** El corazón del bloque: el reenvío del mismo paquete se **dice**, no se descarta. */
    @Test
    fun `un paquete ya registrado responde 200 con alreadyRegistered true`() {
        whenever(registro.register(any(), anyOrNull())).doReturn(salida(creada = false))

        mvc.perform(multipartDelPaquete())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.result").value("noop_same_hash"))
            .andExpect(jsonPath("$.alreadyRegistered").value(true))
            .andExpect(jsonPath("$.templateVersionId").value(14))
    }

    @Test
    fun `las partes del multipart llegan al servicio como el arbol de 01 2_1`() {
        whenever(registro.register(any(), anyOrNull())).doReturn(salida(creada = true))
        mvc.perform(multipartDelPaquete()).andExpect(status().isCreated)

        val captor = argumentCaptor<RawTemplatePackage>()
        verify(registro).register(captor.capture(), anyOrNull())
        assertEquals(paquete.files.keys.sorted(), captor.firstValue.files.keys.sorted())
    }

    @Test
    fun `la lista MASTER responde items y recentRegistrations`() {
        whenever(catalogo.versiones(anyOrNull(), anyOrNull(), any(), anyOrNull()))
            .doReturn(Pagina(listOf(versionEntry()), null))
        whenever(catalogo.registrosRecientes(anyOrNull(), any())).doReturn(emptyList())

        mvc.perform(get("/master/templates2/versions"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].templateVersionId").value(14))
            .andExpect(jsonPath("$.items[0].documentsUsing").value(3))
            .andExpect(jsonPath("$.nextCursor").doesNotExist())
    }

    @Test
    fun `deprecar usa la forma id dos puntos deprecate y responde el estado nuevo`() {
        whenever(catalogo.deprecar(14)).doReturn(versionEntry(status = "deprecated"))

        mvc.perform(post("/master/templates2/versions/14:deprecate"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.status").value("deprecated"))
        verify(catalogo).deprecar(14)
    }

    @Test
    fun `el limite de la lista se acota a 50 aunque se pida mas`() {
        whenever(catalogo.versiones(anyOrNull(), anyOrNull(), any(), anyOrNull()))
            .doReturn(Pagina(emptyList(), null))
        whenever(catalogo.registrosRecientes(anyOrNull(), any())).doReturn(emptyList())

        mvc.perform(get("/master/templates2/versions").param("limit", "500")).andExpect(status().isOk)
        verify(catalogo).versiones(anyOrNull(), anyOrNull(), eq(50), anyOrNull())
    }

    @Test
    fun `el cuerpo de la respuesta no lleva ninguna clave inesperada`() {
        whenever(registro.register(any(), anyOrNull())).doReturn(salida(creada = true))
        val cuerpo = mvc.perform(multipartDelPaquete()).andReturn().response.contentAsString
        val nodo: JsonNode = Templates2Json.mapper.readTree(cuerpo)
        assertEquals(
            listOf("alreadyRegistered", "assetsRegistered", "packageHash", "result", "slug", "templateVersionId", "version"),
            nodo.fieldNames().asSequence().toList().sorted(),
        )
        assertTrue(nodo.get("packageHash").asText().startsWith("sha256:"))
    }

    private fun multipartDelPaquete() = multipart("/master/templates2/versions").apply {
        PaqueteFixture.partes(paquete).forEach { p ->
            file(MockMultipartFile(p.partName, p.fileName, null, p.bytes))
        }
    }

    private fun salida(creada: Boolean) = TemplateRegistrationOutcome(
        result = if (creada) {
            RegistrationResult.Created(TemplateSlug("boda-clasica"), SemverVersion(1, 0, 0), HASH)
        } else {
            RegistrationResult.NoopSameHash(TemplateSlug("boda-clasica"), SemverVersion(1, 0, 0), HASH)
        },
        templateVersionId = 14,
        slug = "boda-clasica",
        version = "1.0.0",
        packageHash = HASH,
        assetsRegistered = 2,
    )

    private fun versionEntry(status: String = "published") = VersionEntry(
        templateVersionId = 14, slug = "boda-clasica", version = "1.0.0", status = status,
        packageHash = HASH, publishedAt = Instant.parse("2026-09-04T00:00:00Z"), documentsUsing = 3,
    )

    companion object {
        val HASH = "sha256:" + "ab".repeat(32)
    }
}
