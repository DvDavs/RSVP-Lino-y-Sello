package mx.evolutiondev.invitaciones.modules.product.admin

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * Contrato HTTP de `GET /product/admin/health` y su autorizacion (`_12c-modulo-product.md`, ADR-5-0C-01).
 *
 * Estilo copiado de `CatalogControllerTest.kt:28-32`: `standaloneSetup`, sin contexto de Spring y
 * sin base de datos, porque el controlador no tiene dependencias. La comprobacion del `@PreAuthorize`
 * es la de `Templates2AnotacionesSeguridadTest.kt:24-40` y existe por el mismo motivo: la autorizacion
 * de esta ruta depende de una anotacion, y una anotacion que alguien borre en un refactor no rompe
 * ninguna prueba funcional. Esta si.
 */
class ProductAdminHealthControllerTest {

    private val controlador = ProductAdminHealthController()
    private val mvc: MockMvc = MockMvcBuilders.standaloneSetup(controlador).build()

    @Test
    fun `la ruta de salud responde 200 con el nombre del modulo y ok`() {
        mvc.perform(get("/product/admin/health"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.module").value("product.admin"))
            .andExpect(jsonPath("$.status").value("ok"))
    }

    /** No revela nada mas: dos campos exactos, ni version, ni commit, ni estado de dependencias. */
    @Test
    fun `el cuerpo no lleva ningun campo mas`() {
        mvc.perform(get("/product/admin/health"))
            .andExpect(jsonPath("$.*", org.hamcrest.Matchers.hasSize<Any>(2)))
    }

    @Test
    fun `la clase exige los roles del contrato`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            ProductAdminHealthController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "ProductAdminHealthController debe llevar @PreAuthorize (ADR-5-0C-01)")
        assertEquals("hasAnyRole('ADMIN','MASTER')", anotacion!!.value)
    }
}
