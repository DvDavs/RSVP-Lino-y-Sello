package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.sql.SQLException

/**
 * Prueba 3 del brief: los tres índices de idempotencia (`02 §2`, `contratos.md §5`):
 * `ux_tpl_document_snapshot_batch`, `ux_tpl_asset_invitation_sha`, `ux_tpl_asset_version_sha`.
 */
class IdempotencyIndexesTest : IntegrationTestBase() {

    @Test
    fun `ux_tpl_document_snapshot_batch impide dos snapshots con el mismo document_id y client_batch_id`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("idem-snap-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)
        val documentId = insertTplDocument(invitationId, versionId)

        insertSnapshot(documentId, revision = 1, clientBatchId = "batch-1")
        val e = sqlErrorOf { insertSnapshot(documentId, revision = 2, clientBatchId = "batch-1") }
        assertEquals("23505", e.sqlState, e.message)

        // client_batch_id NULL no está sujeto al índice (parcial WHERE client_batch_id IS NOT NULL):
        // dos revisiones sin lote (choose_template, restore) no chocan entre sí.
        insertSnapshot(documentId, revision = 3, clientBatchId = null)
        insertSnapshot(documentId, revision = 4, clientBatchId = null)

        deleteInvitation(invitationId)
    }

    @Test
    fun `ux_tpl_asset_invitation_sha impide subir dos veces el mismo contenido a la misma invitacion`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val sha = "b".repeat(64)

        insertTplAssetForInvitation(invitationId, sha)
        val e = sqlErrorOf { insertTplAssetForInvitation(invitationId, sha, s3Key = "templates2/invitation/$invitationId/otra-clave.webp") }
        assertEquals("23505", e.sqlState, e.message)

        deleteInvitation(invitationId)
    }

    @Test
    fun `ux_tpl_asset_version_sha impide repetir el mismo contenido en la misma version de plantilla`() {
        val templateId = insertTplTemplate("idem-asset-version-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)
        val sha = "c".repeat(64)

        insertTplAssetForVersion(versionId, sha, s3Key = "templates2/template/x/1.0.0/$sha-1.webp")
        val e = sqlErrorOf { insertTplAssetForVersion(versionId, sha, s3Key = "templates2/template/x/1.0.0/$sha-2.webp") }
        assertEquals("23505", e.sqlState, e.message)
    }

    private fun insertSnapshot(documentId: Long, revision: Long, clientBatchId: String?) = conn().use { c ->
        c.prepareStatement("INSERT INTO tpl_document_snapshot (document_id, revision, doc, client_batch_id) VALUES (?, ?, '{}'::jsonb, ?)").use { ps ->
            ps.setLong(1, documentId)
            ps.setLong(2, revision)
            if (clientBatchId == null) ps.setNull(3, java.sql.Types.VARCHAR) else ps.setString(3, clientBatchId)
            ps.executeUpdate()
        }
    }

    private fun insertTplAssetForVersion(templateVersionId: Long, sha256: String, s3Key: String) = conn().use { c ->
        c.prepareStatement(
            "INSERT INTO tpl_asset (public_id, template_version_id, bucket, s3_key, sha256, content_type, bytes) " +
                "VALUES (?, ?, 'assets-bucket', ?, ?, 'image/webp', 100)",
        ).use { ps ->
            ps.setString(1, randomAssetPublicId())
            ps.setLong(2, templateVersionId)
            ps.setString(3, s3Key)
            ps.setString(4, sha256)
            ps.executeUpdate()
        }
    }

    private fun sqlErrorOf(block: () -> Unit): SQLException {
        try {
            block()
        } catch (e: SQLException) {
            return e
        }
        throw AssertionError("se esperaba SQLException y no se lanzó ninguna")
    }
}
