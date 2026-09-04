package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.catalog.CatalogEntry
import mx.evolutiondev.invitaciones.modules.templates2.catalog.Pagina
import mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateCatalogService
import mx.evolutiondev.invitaciones.modules.templates2.domain.Capability
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/** Contrato HTTP de `GET /editor/templates2/catalog` (`03 §3.1`). */
class CatalogControllerTest {

    private val catalogo: TemplateCatalogService = mock()
    private val controlador = CatalogController(catalogo)
    private val mvc: MockMvc = MockMvcBuilders.standaloneSetup(controlador).build()

    @Test
    fun `devuelve los items con el nombre localizado y la URL de preview`() {
        whenever(catalogo.catalogo(anyOrNull(), any(), any(), anyOrNull())).doReturn(Pagina(listOf(entrada()), null))

        mvc.perform(get("/editor/templates2/catalog").param("eventKind", "wedding"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].slug").value("boda-clasica"))
            .andExpect(jsonPath("$.items[0].version").value("1.0.0"))
            .andExpect(jsonPath("$.items[0].name.['es-MX']").value("Boda clásica"))
            .andExpect(jsonPath("$.items[0].eventKinds[0]").value("wedding"))
            .andExpect(jsonPath("$.items[0].minPlanTier").value(2))
            .andExpect(jsonPath("$.items[0].previewUrl").value("https://cdn/x.webp"))
            .andExpect(jsonPath("$.items[0].capabilities[0]").value("music"))
        verify(catalogo).catalogo(eq(EventKind.WEDDING), eq(3), eq(20), anyOrNull())
    }

    @Test
    fun `sin planTier el catalogo se pide completo y el limite por defecto es 20`() {
        whenever(catalogo.catalogo(anyOrNull(), any(), any(), anyOrNull())).doReturn(Pagina(emptyList(), null))
        mvc.perform(get("/editor/templates2/catalog")).andExpect(status().isOk)
        verify(catalogo).catalogo(eq(null), eq(3), eq(20), anyOrNull())
    }

    @Test
    fun `el limite se acota a 50`() {
        whenever(catalogo.catalogo(anyOrNull(), any(), any(), anyOrNull())).doReturn(Pagina(emptyList(), null))
        mvc.perform(get("/editor/templates2/catalog").param("limit", "999")).andExpect(status().isOk)
        verify(catalogo).catalogo(anyOrNull(), any(), eq(50), anyOrNull())
    }

    /** P1: un filtro que no se entiende **no** se ignora devolviendo el catálogo entero. */
    @Test
    fun `un eventKind fuera del catalogo cerrado se rechaza con codigo tipado`() {
        val e = assertThrows<Templates2Exception.MalformedJson> {
            controlador.catalog("boda-civil", null, null, null)
        }
        assertEquals(400, e.status)
        assertEquals("eventKind", e.details["param"])
    }

    @Test
    fun `un planTier fuera de 1 a 3 se rechaza con codigo tipado`() {
        val e = assertThrows<Templates2Exception.MalformedJson> {
            controlador.catalog(null, 9, null, null)
        }
        assertEquals("planTier", e.details["param"])
    }

    private fun entrada() = CatalogEntry(
        templateVersionId = 14,
        slug = "boda-clasica",
        version = "1.0.0",
        name = LocalizedText(mapOf(Locale.ES_MX to "Boda clásica")),
        eventKinds = listOf(EventKind.WEDDING),
        minPlanTier = 2,
        previewUrl = "https://cdn/x.webp",
        capabilities = listOf(Capability.MUSIC),
        status = "published",
    )
}
