package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.sql.SQLException

/**
 * Prueba 3 del brief: integridad referencial (`02 §2`, ADR-1R-B-04, objeción B-01).
 * `ON DELETE CASCADE` hacia `invitation` (`tpl_document`, `tpl_document_snapshot` vía `tpl_document`,
 * `tpl_release`, `tpl_asset`) y `ON DELETE RESTRICT` hacia `tpl_template_version` (`tpl_document`,
 * `tpl_asset`, `tpl_release` la referencian).
 */
class CascadeDeleteTest : IntegrationTestBase() {

    @Test
    fun `borrar una invitacion arrastra su documento, snapshots, release y assets`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("cascade-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)

        val documentId = insertTplDocument(invitationId, versionId)
        conn().use { c ->
            c.prepareStatement("INSERT INTO tpl_document_snapshot (document_id, revision, doc) VALUES (?, 1, '{}'::jsonb)").use { ps ->
                ps.setLong(1, documentId)
                ps.executeUpdate()
            }
        }
        insertTplRelease(invitationId, versionId, isActive = true)
        insertTplAssetForInvitation(invitationId, "d".repeat(64))

        assertEquals(1, countWhere("tpl_document", "invitation_id = $invitationId"))
        assertEquals(1, countWhere("tpl_document_snapshot", "document_id = $documentId"))
        assertEquals(1, countWhere("tpl_release", "invitation_id = $invitationId"))
        assertEquals(1, countWhere("tpl_asset", "invitation_id = $invitationId"))

        deleteInvitation(invitationId)

        assertEquals(0, countWhere("tpl_document", "invitation_id = $invitationId"), "tpl_document debía borrarse en cascada")
        assertEquals(0, countWhere("tpl_document_snapshot", "document_id = $documentId"), "tpl_document_snapshot debía borrarse en cascada (vía tpl_document)")
        assertEquals(0, countWhere("tpl_release", "invitation_id = $invitationId"), "tpl_release debía borrarse en cascada")
        assertEquals(0, countWhere("tpl_asset", "invitation_id = $invitationId"), "tpl_asset debía borrarse en cascada")
    }

    @Test
    fun `ON DELETE RESTRICT impide borrar una tpl_template_version referenciada por un documento`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("restrict-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)
        insertTplDocument(invitationId, versionId)

        val e = try {
            conn().use { c ->
                c.prepareStatement("DELETE FROM tpl_template_version WHERE id = ?").use { ps ->
                    ps.setLong(1, versionId)
                    ps.executeUpdate()
                }
            }
            null
        } catch (ex: SQLException) {
            ex
        }
        assertTrue(e != null, "se esperaba que RESTRICT impidiera el borrado")
        assertEquals("23503", e!!.sqlState, "se esperaba violación de FK (23503): ${e.message}")

        deleteInvitation(invitationId)
    }

    @Test
    fun `ON DELETE SET NULL en referencias a customer no bloquea el borrado del cliente`() {
        // customerId es el dueño de la invitación (invitation.customer_id, FK del módulo antiguo SIN
        // cascada — no se puede borrar mientras la invitación exista). editorId es un segundo cliente,
        // sin ninguna fila que lo referencie salvo tpl_document.updated_by: aísla la prueba del
        // SET NULL de templates2 de esa restricción ajena.
        val customerId = insertCustomer()
        val editorId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("setnull-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)
        val documentId = insertTplDocument(invitationId, versionId)
        conn().use { c ->
            c.prepareStatement("UPDATE tpl_document SET updated_by = ? WHERE id = ?").use { ps ->
                ps.setLong(1, editorId)
                ps.setLong(2, documentId)
                ps.executeUpdate()
            }
        }

        deleteCustomer(editorId)

        val updatedBy = conn().use { c ->
            c.prepareStatement("SELECT updated_by FROM tpl_document WHERE id = ?").use { ps ->
                ps.setLong(1, documentId)
                ps.executeQuery().use { rs -> rs.next(); rs.getObject(1) }
            }
        }
        assertTrue(updatedBy == null, "updated_by debía quedar NULL tras ON DELETE SET NULL, llegó $updatedBy")

        deleteInvitation(invitationId)
    }

    private fun countWhere(table: String, where: String): Int = conn().use { c ->
        c.createStatement().use { st ->
            st.executeQuery("SELECT count(*) FROM $table WHERE $where").use { rs -> rs.next(); rs.getInt(1) }
        }
    }
}
