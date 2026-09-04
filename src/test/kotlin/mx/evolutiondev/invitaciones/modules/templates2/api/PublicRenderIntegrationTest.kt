package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Import

/**
 * Rutas 15 y 16 (`03 §3.15`, `§3.16`, `§7`) contra **PostgreSQL real**: casos 29-36 de `03 §12`.
 *
 * Tres de estas pruebas no son de contrato sino de seguridad, y son las que justifican que el render
 * público sea una superficie aparte: que un rollback lo apague (X-09), que deshabilitar o banear
 * retire la invitación de internet (B-07), y que el cuerpo **no lleve datos personales de ningún
 * invitado**.
 */
@Import(Templates2ApiTestConfig::class)
class PublicRenderIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var render: PublicRenderService
    @Autowired private lateinit var esquemas: JsonSchemaValidatorService

    private val slug = "prueba-render"
    private var customerId = 0L
    private var invitationId = 0L
    private lateinit var token: String

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        val creado = editor.chooseTemplate(
            customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
        )
        token = creado.publicToken
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    // =============================================================================================
    // 03 §3.15 — el camino feliz y su ETag
    // =============================================================================================

    /** Caso 29 de `03 §12`. */
    @Test
    fun `el ETag es exactamente el contentHash del release, entre comillas y con prefijo`() {
        val release = publicar()

        val salida = render.render(token)

        assertEquals(release.contentHash, salida.cuerpo.contentHash)
        assertEquals("\"${release.contentHash}\"", salida.etag)
        assertTrue(salida.etag.startsWith("\"sha256:"), "ETag real: ${salida.etag}")
        assertEquals(release.releaseId, contar("SELECT id FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId))
    }

    /** Caso 30 de `03 §12`, en la pieza que decide el `304`. */
    @Test
    fun `If-None-Match casa con el ETag exacto y con la forma debil, no con otro`() {
        val etag = "\"sha256:${"a".repeat(64)}\""
        assertTrue(PublicRenderService.casaIfNoneMatch(etag, etag))
        assertTrue(PublicRenderService.casaIfNoneMatch("W/$etag", etag))
        assertTrue(PublicRenderService.casaIfNoneMatch("\"sha256:otro\", $etag", etag))
        assertTrue(PublicRenderService.casaIfNoneMatch("*", etag))
        assertFalse(PublicRenderService.casaIfNoneMatch("\"sha256:otro\"", etag))
        assertFalse(PublicRenderService.casaIfNoneMatch(null, etag))
        assertFalse(PublicRenderService.casaIfNoneMatch("", etag))
    }

    @Test
    fun `el composed que se sirve es el congelado, sin recomponer`() {
        publicar()
        val guardado = consultar("SELECT composed::text FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId)

        val salida = render.render(token)

        assertEquals(
            Templates2Json.readTree(guardado as String),
            salida.cuerpo.composed,
            "el render no compone: sirve el artefacto congelado en la publicación (ADR-013)",
        )
    }

    /** El cuerpo del render valida contra el esquema emitido desde Zod (`06`, `contratos.md §5`). */
    @Test
    fun `el composed servido valida contra composed-document`() {
        publicar()
        val salida = render.render(token)

        val violaciones = esquemas.validate("composed-document", salida.cuerpo.composed)
        assertTrue(violaciones.isEmpty(), "el render sirve un composed que no valida: $violaciones")
    }

    /**
     * P8 y el motivo por el que el render solo lee `tpl_release`: el cuerpo público **no puede llevar
     * datos de invitados**. `tpl_release.composed` no tiene ninguna vía para contenerlos —el módulo
     * nunca lee `invitation_guest`—, y esta prueba lo afirma con un invitado real en la base.
     */
    @Test
    fun `el cuerpo publico no contiene datos personales de ningun invitado`() {
        val correo = "invitado.secreto@example.test"
        actualizar(
            "INSERT INTO invitation_guest (invitation_id, full_name, email, is_enabled, attendance_status, " +
                "confirmation_token) VALUES (?, ?, ?, true, 'PENDING', 'tok-secreto-de-invitado')",
            invitationId, "Persona Invitada Secreta", correo,
        )
        publicar()

        val texto = Templates2Json.canonical(
            Templates2Json.mapper.valueToTree<com.fasterxml.jackson.databind.JsonNode>(render.render(token).cuerpo),
        )

        assertFalse(texto.contains(correo), "el correo de un invitado apareció en el render público")
        assertFalse(texto.contains("Persona Invitada Secreta"), "el nombre de un invitado apareció en el render")
        assertFalse(texto.contains("tok-secreto-de-invitado"), "se filtró un token de confirmación de invitado")
    }

    /**
     * Caso 36 de `03 §12`: la ruta **jamás** escribe.
     *
     * Se comprueba por las dos vías que este entorno permite. (1) Las dos operaciones son
     * `@Transactional(readOnly = true)`, y con el driver de PostgreSQL eso abre la transacción como
     * `READ ONLY`: cualquier escritura dentro de ella —un contador, un "visto por última vez"— fallaría
     * en la base, así que el hecho de que el render **complete** ya prueba que no escribe. (2) Se
     * fotografía el estado antes y después de varios renders.
     *
     * No se manipula `default_transaction_read_only` a mano: eso solo afecta a sesiones nuevas y las de
     * Hibernate salen del pool ya abiertas, así que la prueba habría medido nada.
     */
    @Test
    fun `el render no escribe - transaccion de solo lectura y estado intacto`() {
        publicar()
        for (metodo in listOf("render", "exists")) {
            val anotacion = PublicRenderService::class.java.methods
                .first { it.name == metodo }
                .getAnnotation(org.springframework.transaction.annotation.Transactional::class.java)
            assertTrue(anotacion != null && anotacion.readOnly, "$metodo debe ser @Transactional(readOnly = true)")
        }

        val antes = fotografia()
        repeat(3) {
            render.render(token)
            render.exists(token)
        }
        assertEquals(antes, fotografia(), "el render público modificó el estado de la base")
    }

    /** Todo lo que un render podría tocar sin querer: revisión, marcas de tiempo y filas. */
    private fun fotografia(): List<Any?> = listOf(
        consultar("SELECT revision FROM tpl_document WHERE invitation_id = ?", invitationId),
        consultar("SELECT updated_at::text FROM tpl_document WHERE invitation_id = ?", invitationId),
        consultar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId),
        consultar("SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
            "WHERE d.invitation_id = ?", invitationId),
        consultar("SELECT public_token FROM tpl_document WHERE invitation_id = ?", invitationId),
    )

    // =============================================================================================
    // 03 §3.15 — todo lo que no se sirve responde igual
    // =============================================================================================

    /** Casos 31 y 35 de `03 §12`. */
    @Test
    fun `token inventado, sin release y despublicado dan la misma respuesta`() {
        val inventado = assertThrows<ReleaseNotFoundException> { render.render("pub_" + "Z".repeat(26)) }
        val sinRelease = assertThrows<ReleaseNotFoundException> { render.render(token) }

        publicar()
        releases.unpublish(customerId, invitationId)
        val despublicado = assertThrows<ReleaseNotFoundException> { render.render(token) }

        assertEquals(TplErrorCode.TPL_RELEASE_NOT_FOUND, inventado.code)
        assertEquals(inventado.message, sinRelease.message)
        assertEquals(inventado.message, despublicado.message)
        assertEquals(inventado.code, despublicado.code)
    }

    @Test
    fun `un token con formato invalido responde igual que uno inexistente, no 400`() {
        val malFormado = assertThrows<ReleaseNotFoundException> { render.render("no-es-un-token") }
        assertEquals(TplErrorCode.TPL_RELEASE_NOT_FOUND, malFormado.code)
        assertEquals(404, malFormado.status)
    }

    /** Caso 32 de `03 §12`. */
    @Test
    fun `tras rotar el enlace, el token viejo deja de resolver y el nuevo sirve`() {
        publicar()
        val viejo = token
        val nuevo = releases.rotatePublicToken(customerId, invitationId).publicToken

        assertEquals(TplErrorCode.TPL_RELEASE_NOT_FOUND, assertThrows<ReleaseNotFoundException> { render.render(viejo) }.code)
        assertTrue(render.render(nuevo).cuerpo.contentHash.startsWith("sha256:"))
        assertFalse(render.exists(viejo).published)
        assertTrue(render.exists(nuevo).published)
    }

    /** Casos 33 y 34 de `03 §12`: las tres banderas de `PublicGuestInfoController.kt:65-75`. */
    @Test
    fun `invitacion deshabilitada, cliente deshabilitado y cliente baneado dan 403`() {
        publicar()

        actualizar("UPDATE invitation SET is_enabled = false WHERE id = ?", invitationId)
        assertEquals(
            TplErrorCode.TPL_INVITATION_UNAVAILABLE,
            assertThrows<InvitationUnavailableException> { render.render(token) }.code,
        )
        assertFalse(render.exists(token).published)
        actualizar("UPDATE invitation SET is_enabled = true WHERE id = ?", invitationId)

        actualizar("UPDATE customer SET is_enabled = false WHERE id = ?", customerId)
        assertThrows<InvitationUnavailableException> { render.render(token) }
        actualizar("UPDATE customer SET is_enabled = true WHERE id = ?", customerId)

        actualizar("UPDATE customer SET is_banned = true WHERE id = ?", customerId)
        assertThrows<InvitationUnavailableException> { render.render(token) }
        actualizar("UPDATE customer SET is_banned = false WHERE id = ?", customerId)

        assertTrue(render.render(token).cuerpo.contentHash.startsWith("sha256:"))
    }

    /**
     * X-09 / ADR-1R-X-04: **la bandera de corte apaga el render aunque el release siga activo**. Es lo
     * que hace barato un rollback: `uses_templates2 = false` y el enlace vuelve al módulo antiguo, sin
     * borrar nada.
     */
    @Test
    fun `con uses_templates2 en false el render es 404 aunque haya release activo`() {
        publicar()
        assertTrue(render.exists(token).published)

        actualizar("UPDATE invitation SET uses_templates2 = false WHERE id = ?", invitationId)

        assertEquals(
            TplErrorCode.TPL_RELEASE_NOT_FOUND,
            assertThrows<ReleaseNotFoundException> { render.render(token) }.code,
        )
        assertFalse(render.exists(token).published, "exists tampoco puede decir true tras un rollback")
        assertEquals(
            1L,
            contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ? AND is_active", invitationId),
            "el rollback no borra nada: el release sigue ahí para volver a activarse",
        )
    }

    // =============================================================================================
    // 03 §3.16 — la sonda
    // =============================================================================================

    @Test
    fun `exists dice false antes de publicar, true despues y false al despublicar`() {
        assertFalse(render.exists(token).published)
        publicar()
        assertTrue(render.exists(token).published)
        releases.unpublish(customerId, invitationId)
        assertFalse(render.exists(token).published)
    }

    @Test
    fun `exists nunca lanza, ni con un token inventado ni con uno mal formado`() {
        assertFalse(render.exists("pub_" + "Z".repeat(26)).published)
        assertFalse(render.exists("cualquier-cosa").published)
        assertFalse(render.exists("").published)
    }

    // =============================================================================================

    private fun publicar(): ReleaseResponse {
        editor.applyOperations(
            customerId, invitationId,
            json(
                """{"baseRevision":0,"clientBatchId":"b_render_01","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Ana y Luis"}}]}""",
            ),
        )
        return releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
    }
}
