package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/** Prueba 3 del brief: como máximo un `tpl_release.is_active` por invitación
 * (`ux_tpl_release_active_per_invitation`, `02 §2` V34, objeción B-11). */
class ReleaseActiveConstraintTest : IntegrationTestBase() {

    @Test
    fun `un segundo release activo para la misma invitacion viola el indice unico parcial`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("release-active-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)

        insertTplRelease(invitationId, versionId, isActive = true)

        val e = try {
            insertTplRelease(invitationId, versionId, isActive = true)
            null
        } catch (ex: java.sql.SQLException) {
            ex
        }
        assertTrue(e != null, "se esperaba que el segundo INSERT con is_active=true violara el índice único")
        assertEquals("23505", e!!.sqlState, "se esperaba violación de UNIQUE (23505): ${e.message}")

        deleteInvitation(invitationId)
    }

    @Test
    fun `dos releases inactivos y uno activo para la misma invitacion son validos`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val templateId = insertTplTemplate("release-active-ok-" + System.nanoTime())
        val versionId = insertTplTemplateVersion(templateId)

        insertTplRelease(invitationId, versionId, isActive = false)
        insertTplRelease(invitationId, versionId, isActive = false)
        val activeId = insertTplRelease(invitationId, versionId, isActive = true)

        assertTrue(activeId > 0)
        deleteInvitation(invitationId)
    }
}
