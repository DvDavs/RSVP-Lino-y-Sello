package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional

/**
 * `TplDocumentSnapshotRepository` (`02 §7.4`). Añadida por la revisión `2-1-REV` (objeción O-21-04).
 * `findByDocumentIdAndClientBatchId` es la consulta con la que `03 §3.3` decide el
 * `200 {applied:false, revision:…}` de un lote reenviado — la mitad legible de la idempotencia que la
 * ronda 1R clasificó **ALTA** (objeción B-03); la otra mitad es `ux_tpl_document_snapshot_batch`, que
 * `IdempotencyIndexesTest` ya cubre por SQL. Sin esta prueba, la vía Spring Data no estaba ejercitada.
 */
@Transactional
@DirtiesContext
class TplDocumentSnapshotRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var snapshotRepo: TplDocumentSnapshotRepository
    @Autowired lateinit var documentRepo: TplDocumentRepository
    @Autowired lateinit var templateRepo: TplTemplateRepository
    @Autowired lateinit var versionRepo: TplTemplateVersionRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun nuevoDocumentoId(): Long {
        val t = templateRepo.save(TplTemplateEntity(slug = "snap-repo-" + System.nanoTime()))
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
        val customerId = (
            entityManager.createNativeQuery(
                "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (:e, false, true, 'x', 'USER') RETURNING id",
            ).setParameter("e", "snaprepo-${System.nanoTime()}@test.mx").singleResult as Number
            ).toLong()
        val legacyTemplateId = (
            entityManager.createNativeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").singleResult as Number
            ).toLong()
        val invitationId = (
            entityManager.createNativeQuery(
                "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location) " +
                    "VALUES (:c, :t, true, false, false) RETURNING id",
            ).setParameter("c", customerId).setParameter("t", legacyTemplateId).singleResult as Number
            ).toLong()
        entityManager.flush()
        documentRepo.insertIfAbsent(invitationId, v.id, "{}", 2, tokenUnico())
        return documentRepo.findByInvitationId(invitationId)!!.id
    }

    /** Cada documento necesita su propio `public_token` (`uq_tpl_document_public_token`). */
    private fun tokenUnico(): String {
        val alfabeto = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
        return "pub_" + (1..26).map { alfabeto.random() }.joinToString("")
    }

    private fun guardar(documentId: Long, revision: Long, clientBatchId: String?, origin: String = "operations") =
        snapshotRepo.save(
            TplDocumentSnapshotEntity(
                documentId = documentId, revision = revision,
                doc = Templates2Json.mapper.readTree("""{"rev":$revision}"""),
                clientBatchId = clientBatchId, origin = origin,
            ),
        ).also { entityManager.flush() }

    @Test
    fun `findByDocumentIdAndClientBatchId localiza el lote ya aplicado (objecion B-03)`() {
        val documentId = nuevoDocumentoId()
        guardar(documentId, revision = 1, clientBatchId = "lote-abc")
        guardar(documentId, revision = 2, clientBatchId = "lote-def")
        entityManager.clear()

        assertEquals(1L, snapshotRepo.findByDocumentIdAndClientBatchId(documentId, "lote-abc")?.revision)
        assertNull(
            snapshotRepo.findByDocumentIdAndClientBatchId(documentId, "lote-nunca-visto"),
            "un clientBatchId nuevo no debe resolver ningún snapshot: el lote es aplicable",
        )
        assertNull(
            snapshotRepo.findByDocumentIdAndClientBatchId(nuevoDocumentoId(), "lote-abc"),
            "la clave es (document_id, client_batch_id): el mismo lote en otro documento no colisiona",
        )
    }

    @Test
    fun `findByDocumentIdAndRevision devuelve el snapshot exacto que respalda un restore`() {
        val documentId = nuevoDocumentoId()
        guardar(documentId, revision = 7, clientBatchId = null, origin = "choose_template")
        entityManager.clear()

        val s = snapshotRepo.findByDocumentIdAndRevision(documentId, 7)
        assertNotNull(s)
        assertEquals("choose_template", s!!.origin)
        assertEquals(Templates2Json.mapper.readTree("""{"rev":7}"""), s.doc)
        assertNull(snapshotRepo.findByDocumentIdAndRevision(documentId, 8))
    }

    @Test
    fun `el historial pagina por revision descendente`() {
        val documentId = nuevoDocumentoId()
        (1L..5L).forEach { guardar(documentId, it, clientBatchId = "b$it") }
        entityManager.clear()

        val pagina = snapshotRepo.findByDocumentIdOrderByRevisionDesc(documentId, PageRequest.of(0, 3))
        assertEquals(5, pagina.totalElements)
        assertEquals(listOf(5L, 4L, 3L), pagina.content.map { it.revision })
    }
}
