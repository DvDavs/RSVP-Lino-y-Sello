package mx.evolutiondev.invitaciones.modules.templates2.api

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.core.annotation.AnnotatedElementUtils
import org.springframework.web.bind.annotation.RequestMapping

/**
 * **Las 19 rutas de `03 §2`, ninguna más y ninguna menos.**
 *
 * Es el inventario que cierra la superficie HTTP del módulo. Sirve para dos cosas distintas y las dos
 * importan: que no falte ninguna ruta del contrato (la fase 3 construye el frontend contra esta lista)
 * y que **no sobre ninguna** — una ruta añadida sin contrato es superficie de ataque que nadie revisó.
 *
 * Se lee de las anotaciones de Spring, no de una lista escrita a mano: renombrar una ruta rompe aquí.
 */
class Templates2RouteInventoryTest {

    /** La tabla de `03 §2`, con el método y la ruta exactos. */
    private val esperadas = listOf(
        "GET /editor/templates2/catalog",
        "POST /editor/invitations/{invitationId}/document:choose-template",
        "GET /editor/invitations/{invitationId}/document",
        "POST /editor/invitations/{invitationId}/document/operations",
        "GET /editor/invitations/{invitationId}/document/history",
        "POST /editor/invitations/{invitationId}/document/restore",
        "POST /editor/invitations/{invitationId}/assets",
        "GET /editor/invitations/{invitationId}/assets",
        "DELETE /editor/invitations/{invitationId}/assets/{assetId}",
        "GET /editor/invitations/{invitationId}/release/preflight",
        "POST /editor/invitations/{invitationId}/release",
        "DELETE /editor/invitations/{invitationId}/release",
        "GET /editor/invitations/{invitationId}/releases",
        "POST /editor/invitations/{invitationId}/public-token:rotate",
        "GET /public/i/{publicToken}/render",
        "GET /public/i/{publicToken}/exists",
        "POST /master/templates2/versions",
        "GET /master/templates2/versions",
        "POST /master/templates2/versions/{templateVersionId}:deprecate",
    )

    private val controladores = listOf(
        CatalogController::class.java,
        EditorDocumentController::class.java,
        EditorAssetController::class.java,
        EditorReleaseController::class.java,
        PublicRenderController::class.java,
        MasterTemplateRegistryController::class.java,
    )

    @Test
    fun `los controladores publican exactamente las 19 rutas de 03 2`() {
        assertEquals(19, esperadas.size, "la tabla de 03 §2 tiene 19 filas")
        assertEquals(esperadas.sorted(), rutasDeclaradas().sorted())
    }

    /** Recorre `@RequestMapping` de clase y de método y arma `"MÉTODO /ruta"`. */
    private fun rutasDeclaradas(): List<String> = controladores.flatMap { clase ->
        val base = AnnotatedElementUtils.findMergedAnnotation(clase, RequestMapping::class.java)
            ?.value?.firstOrNull().orEmpty()
        clase.declaredMethods
            .mapNotNull { metodo ->
                val mapeo = AnnotatedElementUtils.findMergedAnnotation(metodo, RequestMapping::class.java)
                    ?: return@mapNotNull null
                val verbo = mapeo.method.firstOrNull()?.name ?: "GET"
                val sufijo = mapeo.value.firstOrNull().orEmpty()
                "$verbo $base$sufijo"
            }
    }
}
