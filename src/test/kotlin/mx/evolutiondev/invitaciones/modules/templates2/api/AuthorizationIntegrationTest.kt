package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.core.auth.service.HierarchyValidationService
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired

/**
 * `03 §12` caso 14: **cada una** de las rutas de invitación responde `403 TPL_FORBIDDEN` cuando
 * `HierarchyValidationService.validateInvitationAccess` dice que no (ADR-015). Una ruta nueva que
 * olvide la comprobación se cuela sin esta prueba.
 */
class AuthorizationIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var hierarchy: HierarchyValidationService

    private val slug = "prueba-authz"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
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
    }

    @Test
    fun `sin acceso a la invitacion, las diez rutas responden 403 TPL_FORBIDDEN`() {
        whenever(hierarchy.validateInvitationAccess(any(), any())).thenReturn(false)
        val ajeno = 999L

        val rutas: List<Pair<String, () -> Unit>> = listOf(
            ":choose-template" to {
                editor.chooseTemplate(ajeno, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
            },
            "GET /document" to { editor.getDocument(ajeno, invitationId) },
            "POST /document/operations" to {
                editor.applyOperations(
                    ajeno, invitationId,
                    json(
                        """{"baseRevision":0,"clientBatchId":"b_authz_001","operations":[
                           {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"x"}}]}""",
                    ),
                )
            },
            "GET /document/history" to { editor.history(ajeno, invitationId, null, null, null) },
            "POST /document/restore" to { editor.restore(ajeno, invitationId, json("""{"revision":0,"baseRevision":0}""")) },
            "GET /release/preflight" to { releases.preflight(ajeno, invitationId) },
            "POST /release" to { releases.publish(ajeno, invitationId, json("""{"baseRevision":0}""")) },
            "DELETE /release" to { releases.unpublish(ajeno, invitationId) },
            "GET /releases" to { releases.list(ajeno, invitationId, null, null) },
            "POST /public-token:rotate" to { releases.rotatePublicToken(ajeno, invitationId) },
        )

        for ((nombre, llamada) in rutas) {
            val e = assertThrows<ForbiddenException>(nombre) { llamada() }
            assertEquals(TplErrorCode.TPL_FORBIDDEN, e.code, nombre)
        }
        // Y nada de eso escribió: la autorización va **antes** de tocar cualquier tabla `tpl_*`.
        assertEquals(0L, revisionDe(invitationId))
        assertEquals(0L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }
}
