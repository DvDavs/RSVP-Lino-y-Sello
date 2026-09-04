package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.EntityManager
import jakarta.persistence.LockModeType

/**
 * Consultas nativas de `TplDocumentRepository` (`02 §7.4`): `insertIfAbsent`
 * (`ON CONFLICT (invitation_id) DO NOTHING`, único camino de creación desde `:choose-template`,
 * decisión X-07), `applyRevision` (escritura optimista, ADR-014) y `rotatePublicToken`.
 */
@Transactional
@DirtiesContext
class TplDocumentRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var documentRepo: TplDocumentRepository
    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun fixtureVersionId(): Long {
        val t = templateRepo.save(TplTemplateEntity(slug = "doc-repo-" + System.nanoTime()))
        val v = versionRepo.save(
            TplTemplateVersionEntity(
                templateId = t.id, version = "1.0.0", versionMajor = 1, versionMinor = 0, versionPatch = 0,
                manifest = Templates2Json.mapper.createObjectNode(),
                theme = Templates2Json.mapper.createObjectNode(),
                defaults = Templates2Json.mapper.createObjectNode(),
                packageHash = "sha256:" + System.nanoTime().toString().padStart(64, '0').takeLast(64),
                eventKinds = Templates2Json.mapper.readTree("""["wedding"]"""),
            ),
        )
        entityManager.flush()
        return v.id
    }

    private fun fixtureInvitationId(): Long {
        @Suppress("UNCHECKED_CAST")
        val customerId = (entityManager.createNativeQuery(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (:e, false, true, 'x', 'USER') RETURNING id",
        ).setParameter("e", "docrepo-${System.nanoTime()}@test.mx").singleResult as Number).toLong()
        @Suppress("UNCHECKED_CAST")
        val templateId = (entityManager.createNativeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").singleResult as Number).toLong()
        @Suppress("UNCHECKED_CAST")
        val invitationId = (entityManager.createNativeQuery(
            "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location) VALUES (:c, :t, true, false, false) RETURNING id",
        ).setParameter("c", customerId).setParameter("t", templateId).singleResult as Number).toLong()
        entityManager.flush()
        return invitationId
    }

    @Test
    fun `insertIfAbsent crea la fila la primera vez y no hace nada la segunda (ON CONFLICT DO NOTHING)`() {
        val invitationId = fixtureInvitationId()
        val versionId = fixtureVersionId()

        val filas1 = documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, "pub_" + "A".repeat(26))
        assertEquals(1, filas1)

        val filas2 = documentRepo.insertIfAbsent(invitationId, versionId, "{\"x\":1}", 9, "pub_" + "B".repeat(26))
        assertEquals(0, filas2, "un segundo insertIfAbsent para la misma invitación no debe insertar nada")

        val doc = documentRepo.findByInvitationId(invitationId)
        assertNotNull(doc)
        assertEquals("pub_" + "A".repeat(26), doc!!.publicToken, "el public_token debe ser el de la PRIMERA inserción, no el de la segunda")
        assertEquals(0L, doc.revision)
    }

    @Test
    fun `applyRevision con la revision esperada actualiza y devuelve 1 fila afectada`() {
        val invitationId = fixtureInvitationId()
        val versionId = fixtureVersionId()
        documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, "pub_" + "C".repeat(26))
        val doc = documentRepo.findByInvitationId(invitationId)!!

        val nuevoDoc = Templates2Json.mapper.readTree("""{"hola":"mundo"}""")
        val filas = documentRepo.applyRevision(doc.id, Templates2Json.canonical(nuevoDoc), 15, expectedRevision = 0, updatedBy = null)
        assertEquals(1, filas)

        entityManager.clear()
        val releido = documentRepo.findById(doc.id).orElseThrow()
        assertEquals(1L, releido.revision)
        assertEquals(15, releido.docBytes)
        assertEquals(nuevoDoc, releido.doc)
    }

    @Test
    fun `applyRevision con una revision desactualizada no toca nada (0 filas, seria 409 en la API)`() {
        val invitationId = fixtureInvitationId()
        val versionId = fixtureVersionId()
        documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, "pub_" + "D".repeat(26))
        val doc = documentRepo.findByInvitationId(invitationId)!!

        val filas = documentRepo.applyRevision(doc.id, "{}", 2, expectedRevision = 99, updatedBy = null)
        assertEquals(0, filas, "una revision base incorrecta no debe afectar ninguna fila")

        entityManager.clear()
        val releido = documentRepo.findById(doc.id).orElseThrow()
        assertEquals(0L, releido.revision, "la revision no debía cambiar")
    }

    @Test
    fun `rotatePublicToken cambia el token sin tocar revision ni doc`() {
        val invitationId = fixtureInvitationId()
        val versionId = fixtureVersionId()
        documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, "pub_" + "E".repeat(26))
        val doc = documentRepo.findByInvitationId(invitationId)!!

        val nuevoToken = "pub_" + "F".repeat(26)
        val filas = documentRepo.rotatePublicToken(doc.id, nuevoToken)
        assertEquals(1, filas)

        entityManager.clear()
        assertNull(documentRepo.findByPublicToken("pub_" + "E".repeat(26)), "el token viejo ya no debe resolver nada")
        val porTokenNuevo = documentRepo.findByPublicToken(nuevoToken)
        assertNotNull(porTokenNuevo)
        assertEquals(0L, porTokenNuevo!!.revision, "rotar el token no debe alterar revision")
    }

    @Test
    fun `lockByInvitationId toma de verdad un PESSIMISTIC_WRITE (el FOR UPDATE de 02 §11-2)`() {
        val invitationId = fixtureInvitationId()
        val versionId = fixtureVersionId()
        documentRepo.insertIfAbsent(invitationId, versionId, "{}", 2, "pub_" + "G".repeat(26))

        val bloqueado = documentRepo.lockByInvitationId(invitationId)
        assertNotNull(bloqueado)
        assertEquals(invitationId, bloqueado!!.invitationId)
        // Añadido por la revisión 2-1-REV (objeción O-21-05): que el método devuelva la fila NO prueba
        // que Hibernate haya emitido `FOR UPDATE`. Sin ese bloqueo, `02 §11.2` advierte que
        // `tpl_release.document_revision` puede no corresponder al `composed` congelado. `getLockMode`
        // devuelve el modo realmente aplicado a la entidad gestionada.
        assertEquals(
            LockModeType.PESSIMISTIC_WRITE,
            entityManager.getLockMode(bloqueado),
            "lockByInvitationId debe mantener un bloqueo pesimista de escritura sobre la fila",
        )
    }

    @Test
    fun `lockByInvitationId sobre una invitacion sin documento devuelve null, no lanza`() {
        assertNull(documentRepo.lockByInvitationId(-1L))
    }
}
