package mx.evolutiondev.invitaciones.modules.templates2.api

import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired

/**
 * `03 §3.2` contra PostgreSQL real: `:choose-template` es **el único creador** del documento (decisión
 * X-07) y el único camino de cambio de plantilla o de versión.
 */
class ChooseTemplateIntegrationTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var sonda: SondaFalsa

    private val slugA = "prueba-choose-a"
    private val slugB = "prueba-choose-b"
    private var customerId = 0L
    private var invitationId = 0L
    private lateinit var pkgA: TemplatePackage

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slugA)
        limpiarPlantilla(slugB)
        pkgA = paqueteBase(slugA)
        registrarVersion(pkgA)
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId, usaTemplates2 = true)
        sonda.respuesta = null
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slugA)
        limpiarPlantilla(slugB)
    }

    @Test
    fun `crea el documento en la revision 0 con estructura del manifiesto y contenido vacio`() {
        val r = editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))

        assertTrue(r.created)
        assertEquals(0L, r.revision)
        assertEquals(0, r.document.get("content").size(), "el documento nuevo no trae contenido de usuario")
        assertEquals(listOf("cover", "gallery"), r.document.get("structure").get("sections").map { it.get("key").asText() })
        assertTrue(r.publicToken.startsWith("pub_"), "el token público sale del servidor (P8)")
        assertEquals("${EditorTestConfig.FRONTEND}/i/${r.publicToken}", r.publicUrl)
        assertEquals(1L, contar("SELECT count(*) FROM tpl_document WHERE invitation_id = ?", invitationId))
        // La revisión 0 deja snapshot: sin él, `restore` no podría volver al documento recién creado.
        assertEquals(
            1L,
            contar(
                "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
                    "WHERE d.invitation_id = ? AND s.revision = 0 AND s.origin = 'choose_template'",
                invitationId,
            ),
        )
    }

    @Test
    fun `el bloque obligatorio arranca en su valor de demostracion y el informe lo denuncia`() {
        val r = editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        val stillDefault = r.report.get("stillDefault").map { it.asText() }
        assertEquals(listOf("cover.title"), stillDefault, "R3: el default de la plantilla no es contenido del cliente")
    }

    @Test
    fun `repetir con la misma version es un no-op que no incrementa revision ni crea snapshot`() {
        editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        val r = editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0", baseRevision = 0))

        assertFalse(r.created)
        assertFalse(r.changed)
        assertEquals(0L, r.revision)
        assertEquals(1L, contarSnapshots())
    }

    @Test
    fun `sin baseRevision sobre un documento existente es 400 y no 409`() {
        editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        val e = assertThrows<Templates2Exception.MalformedJson> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        }
        assertEquals(TplErrorCode.TPL_MALFORMED_JSON, e.code)
    }

    @Test
    fun `con baseRevision vieja es 409 TPL_REVISION_CONFLICT`() {
        editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        registrarVersion(paqueteBase(slugB))
        val e = assertThrows<RevisionConflictException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugB, "1.0.0", baseRevision = 99))
        }
        assertEquals(TplErrorCode.TPL_REVISION_CONFLICT, e.code)
        assertEquals(0L, e.details["currentRevision"])
    }

    @Test
    fun `enviar baseRevision sin documento no crea nada y avisa`() {
        val e = assertThrows<RevisionConflictException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0", baseRevision = 3))
        }
        assertEquals("document_not_started", e.details["reason"])
        assertEquals(0L, contar("SELECT count(*) FROM tpl_document WHERE invitation_id = ?", invitationId))
    }

    @Test
    fun `cambiar de plantilla transporta por rol singleton y manda los grupos al attic`() {
        editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        // El cliente escribe el título (rol singleton `coverTitle`) y añade una foto al grupo.
        editor.applyOperations(customerId, invitationId, loteConTituloYFoto(baseRevision = 0))

        registrarVersion(paqueteBase(slugB))
        val r = editor.chooseTemplate(customerId, invitationId, cuerpo(slugB, "1.0.0", baseRevision = 1))

        assertTrue(r.changed)
        assertEquals(2L, r.revision)
        val contenido = contenidoDelDocumento(invitationId)
        // Transportado por rol singleton (ADR-1R-D-07)…
        assertNotNull(contenido["cover.title"], "el título debía transportarse por rol singleton")
        // …y el grupo, SIEMPRE al attic: un `galleryPhotos` de otra plantilla tiene otros itemBlocks.
        assertFalse(contenido.containsKey("gallery.photos"), "un grupo nunca se transporta")
        assertTrue(r.movedToAttic.contains("gallery.photos"), "movedToAttic debe nombrar el grupo")
        val attic = consultar(
            "SELECT doc -> 'attic' -> ? ->> 'gallery.photos' FROM tpl_document WHERE invitation_id = ?",
            "$slugA@1.0.0", invitationId,
        )
        assertNotNull(attic, "el contenido del grupo tiene que seguir existiendo en el attic (ADR-006)")
    }

    @Test
    fun `subir de version sin MigrationPlan registrado es 409 TPL_MIGRATION_PLAN_MISSING`() {
        editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.0.0"))
        registrarVersion(paqueteBase(slugA, "1.1.0"))

        val e = assertThrows<MigrationPlanMissingException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "1.1.0", baseRevision = 0))
        }
        assertEquals(TplErrorCode.TPL_MIGRATION_PLAN_MISSING, e.code)
        assertEquals(0L, revisionDe(invitationId), "un cambio rechazado no toca la revisión")
    }

    @Test
    fun `una version que no existe es 404 y una deprecated no puede iniciar documento`() {
        assertThrows<mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateVersionNotFoundException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugA, "9.9.9"))
        }
        registrarVersion(paqueteBase(slugB), status = "deprecated")
        val e = assertThrows<mx.evolutiondev.invitaciones.modules.templates2.catalog.TemplateVersionNotFoundException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugB, "1.0.0"))
        }
        assertEquals(TplErrorCode.TPL_TEMPLATE_VERSION_NOT_FOUND, e.code)
    }

    @Test
    fun `una plantilla por encima del plan es 403 TPL_PLAN_TIER_INSUFFICIENT`() {
        limpiarPlantilla(slugB)
        registrarVersion(paqueteBase(slugB), minPlanTier = 3)
        val e = assertThrows<PlanTierInsufficientException> {
            editor.chooseTemplate(customerId, invitationId, cuerpo(slugB, "1.0.0"))
        }
        assertEquals(TplErrorCode.TPL_PLAN_TIER_INSUFFICIENT, e.code)
        assertEquals(0L, contar("SELECT count(*) FROM tpl_document WHERE invitation_id = ?", invitationId))
    }

    // ---------------------------------------------------------------------------------------------
    // Bandera de corte (`02 §6`, ADR-2-4-02)
    // ---------------------------------------------------------------------------------------------

    @Test
    fun `sin bandera y sin poder consultar Mongo es 409 TPL_NOT_MIGRATED, nunca un estado mixto`() {
        val otra = nuevaInvitacion(customerId, usaTemplates2 = false)
        try {
            sonda.respuesta = null // la sonda por defecto: "no lo sé"
            val e = assertThrows<NotMigratedException> {
                editor.chooseTemplate(customerId, otra, cuerpo(slugA, "1.0.0"))
            }
            assertEquals("legacy_config_unknown", e.details["reason"])
            assertEquals(0L, contar("SELECT count(*) FROM tpl_document WHERE invitation_id = ?", otra))
        } finally {
            limpiarInvitacion(otra)
        }
    }

    @Test
    fun `sin bandera y con configuracion antigua confirmada es 409 TPL_NOT_MIGRATED`() {
        val otra = nuevaInvitacion(customerId, usaTemplates2 = false)
        try {
            sonda.respuesta = true
            val e = assertThrows<NotMigratedException> {
                editor.chooseTemplate(customerId, otra, cuerpo(slugA, "1.0.0"))
            }
            assertEquals("legacy_config_present", e.details["reason"])
        } finally {
            limpiarInvitacion(otra)
        }
    }

    @Test
    fun `una invitacion nueva verificada crea el documento y activa la bandera`() {
        val otra = nuevaInvitacion(customerId, usaTemplates2 = false)
        try {
            sonda.respuesta = false
            val r = editor.chooseTemplate(customerId, otra, cuerpo(slugA, "1.0.0"))
            assertTrue(r.created)
            assertEquals(true, consultar("SELECT uses_templates2 FROM invitation WHERE id = ?", otra))
        } finally {
            limpiarInvitacion(otra)
        }
    }

    // ---------------------------------------------------------------------------------------------

    private fun cuerpo(slug: String, version: String, baseRevision: Long? = null) = json(
        buildString {
            append("""{"templateSlug":"$slug","templateVersion":"$version"""")
            if (baseRevision != null) append(""","baseRevision":$baseRevision""")
            append("}")
        },
    )

    private fun loteConTituloYFoto(baseRevision: Long) = json(
        """
        {"baseRevision":$baseRevision,"clientBatchId":"b_switch_1","operations":[
          {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Ana y Luis"}},
          {"op":"addItem","groupId":"gallery.photos","tempId":"tmp:abcd1234",
           "values":{"caption":{"kind":"text","value":"Primera cita"}}}
        ]}
        """.trimIndent(),
    )

    private fun contarSnapshots(): Long = contar(
        "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id WHERE d.invitation_id = ?",
        invitationId,
    )
}
