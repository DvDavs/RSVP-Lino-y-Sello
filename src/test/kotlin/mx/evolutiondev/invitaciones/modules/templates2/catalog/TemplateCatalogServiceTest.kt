package mx.evolutiondev.invitaciones.modules.templates2.catalog

import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TemplateRegistrar
import mx.evolutiondev.invitaciones.modules.templates2.persistence.TplTemplateVersionQueryRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired

/**
 * `GET /editor/templates2/catalog` (`03 §3.1`), `GET /master/templates2/versions` (`§3.18`) y
 * `:deprecate` (`§3.19`) contra PostgreSQL real, con las dos plantillas de ejemplo ya registradas.
 */
class TemplateCatalogServiceTest : RegistroTestSupport() {

    @Autowired lateinit var servicio: TemplateRegistrationService
    @Autowired lateinit var catalogo: TemplateCatalogService
    @Autowired lateinit var consultas: TplTemplateVersionQueryRepository
    @Autowired lateinit var almacen: AlmacenFalso

    private val slugs = arrayOf("boda-clasica", "xv-jardin")

    @BeforeEach
    fun registrarLasDos() {
        limpiarCatalogo(*slugs)
        almacen.reiniciar()
        servicio.register(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        servicio.register(PaqueteFixture.ejemplo("xv-jardin-1.0.0"))
    }

    @AfterEach
    fun limpiar() = limpiarCatalogo(*slugs)

    @Test
    fun `el catalogo filtra por eventKind con el operador de contencion sobre event_kinds`() {
        val bodas = catalogo.catalogo(EventKind.WEDDING, 3, 20, null)
        assertEquals(listOf("boda-clasica"), bodas.items.map { it.slug })
        val quince = catalogo.catalogo(EventKind.QUINCE, 3, 20, null)
        assertEquals(listOf("xv-jardin"), quince.items.map { it.slug })
        assertEquals(emptyList<String>(), catalogo.catalogo(EventKind.BAPTISM, 3, 20, null).items.map { it.slug })
    }

    @Test
    fun `el catalogo filtra por minPlanTier`() {
        // boda-clasica declara minPlanTier 2; xv-jardin, 1.
        val basico = catalogo.catalogo(null, 1, 20, null)
        assertEquals(listOf("xv-jardin"), basico.items.map { it.slug })
        val premium = catalogo.catalogo(null, 2, 20, null)
        assertEquals(listOf("boda-clasica", "xv-jardin"), premium.items.map { it.slug })
    }

    @Test
    fun `cada item trae nombre, capacidades y la URL de preview construida desde s3_key`() {
        val item = catalogo.catalogo(EventKind.WEDDING, 3, 20, null).items.single()
        assertEquals("Boda clásica", item.name.byLocale.values.first())
        assertEquals(listOf(EventKind.WEDDING), item.eventKinds)
        assertEquals(2, item.minPlanTier)
        assertEquals("published", item.status)
        assertTrue(item.capabilities.isNotEmpty())
        assertNotNull(item.previewUrl)
        assertTrue(
            item.previewUrl!!.startsWith(RegistroTestConfig.BASE_URL + "/templates2/template/boda-clasica/1.0.0/"),
            "la URL se construye por patrón desde s3_key (02 §10.4): ${item.previewUrl}",
        )
    }

    @Test
    fun `el catalogo pagina con cursor y no repite ni pierde items`() {
        val primera = catalogo.catalogo(null, 3, 1, null)
        assertEquals(1, primera.items.size)
        assertNotNull(primera.nextCursor)
        val segunda = catalogo.catalogo(null, 3, 1, primera.nextCursor)
        assertEquals(1, segunda.items.size)
        assertNull(segunda.nextCursor)
        assertEquals(
            listOf("boda-clasica", "xv-jardin"),
            (primera.items + segunda.items).map { it.slug }.sorted(),
        )
    }

    @Test
    fun `una version deprecada desaparece del catalogo pero sigue en la lista MASTER`() {
        val id = catalogo.versiones("xv-jardin", null, 20, null).items.single().templateVersionId
        val salida = catalogo.deprecar(id)
        assertEquals(TemplateRegistrar.DEPRECADA, salida.status)

        assertEquals(emptyList<String>(), catalogo.catalogo(EventKind.QUINCE, 3, 20, null).items.map { it.slug })
        assertEquals(listOf("xv-jardin"), catalogo.versiones("xv-jardin", null, 20, null).items.map { it.slug })
        assertEquals("deprecated", consultas.findById(id).orElseThrow().status)
    }

    @Test
    fun `deprecar dos veces es idempotente`() {
        val id = catalogo.versiones("xv-jardin", null, 20, null).items.single().templateVersionId
        catalogo.deprecar(id)
        assertEquals(TemplateRegistrar.DEPRECADA, catalogo.deprecar(id).status)
    }

    @Test
    fun `deprecar una version inexistente es 404`() {
        val e = assertThrows<TemplateVersionNotFoundException> { catalogo.deprecar(-1) }
        assertEquals(404, e.status)
    }

    @Test
    fun `la lista MASTER trae package_hash, documentsUsing y la auditoria reciente con los rechazos`() {
        assertThrows<BreakingChangeNotMajorException> {
            servicio.register(PaqueteFixture.variante("boda-clasica-1.0.0", "1.1.0", quitarBloque = "footer.note"))
        }
        val pagina = catalogo.versiones("boda-clasica", null, 20, null)
        val item = pagina.items.single()
        assertTrue(item.packageHash.startsWith("sha256:"))
        assertEquals(0L, item.documentsUsing)

        val recientes = catalogo.registrosRecientes("boda-clasica", 10)
        assertEquals(2, recientes.size)
        val rechazo = recientes.first { it.result == "rejected" }
        assertEquals("TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR", rechazo.errorCode)
        assertEquals("1.1.0", rechazo.version)
    }

    @Test
    fun `filtrar la lista MASTER por status`() {
        assertEquals(2, catalogo.versiones(null, "published", 20, null).items.count { it.slug in slugs })
        assertEquals(0, catalogo.versiones(null, "deprecated", 20, null).items.count { it.slug in slugs })
    }

    @Test
    fun `un slug que no existe devuelve una lista vacia, no un error`() {
        val pagina = catalogo.versiones("no-existe", null, 20, null)
        assertEquals(emptyList<String>(), pagina.items.map { it.slug })
        assertNull(pagina.nextCursor)
    }
}
