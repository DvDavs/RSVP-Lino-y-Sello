package mx.evolutiondev.invitaciones.modules.templates2.api

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.RequestMapping

/**
 * `03 §9.1` y ADR-1R-B-10 en forma de prueba: la autorización de estas dos rutas depende de una
 * anotación, y una anotación que alguien borre en un refactor no rompe ninguna prueba funcional. Esta
 * sí.
 *
 * - `/master/` + `**` ya lo cubre `SecurityConfig.kt:44`; el `@PreAuthorize` es defensa en profundidad.
 * - `/editor/` + `**` **no tiene regla** en `SecurityConfig` (cae en `anyRequest().authenticated()`,
 *   `SecurityConfig.kt:47`), así que sin este `@PreAuthorize` el catálogo quedaría accesible a
 *   cualquier usuario autenticado de cualquier rol y **sin** ninguna otra barrera: no hay invitación
 *   que `HierarchyValidationService` pueda validar aquí.
 */
class Templates2AnotacionesSeguridadTest {

    @Test
    fun `el controlador MASTER exige rol MASTER a nivel de clase`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            MasterTemplateRegistryController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "MasterTemplateRegistryController debe llevar @PreAuthorize (03 §3.17)")
        assertEquals("hasRole('MASTER')", anotacion!!.value)
    }

    @Test
    fun `el catalogo exige estar autenticado con uno de los tres roles reales`() {
        val anotacion = AnnotatedElementUtils.findMergedAnnotation(
            CatalogController::class.java, PreAuthorize::class.java,
        )
        assertNotNull(anotacion, "CatalogController debe llevar @PreAuthorize (ADR-1R-B-10)")
        assertEquals("hasAnyRole('USER','ADMIN','MASTER')", anotacion!!.value)
    }

    @Test
    fun `las rutas son las de la tabla de 03 2`() {
        assertEquals(
            listOf("/master/templates2/versions"),
            AnnotatedElementUtils.findMergedAnnotation(
                MasterTemplateRegistryController::class.java, RequestMapping::class.java,
            )!!.value.toList(),
        )
        assertEquals(
            listOf("/editor/templates2"),
            AnnotatedElementUtils.findMergedAnnotation(
                CatalogController::class.java, RequestMapping::class.java,
            )!!.value.toList(),
        )
    }
}
