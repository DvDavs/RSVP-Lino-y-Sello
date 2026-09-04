package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.sql.SQLException

/**
 * Prueba 3 del brief: los `CHECK` de hashes con prefijo de algoritmo (`02 §2`, `VARCHAR(71) CHECK ~
 * '^sha256:[0-9a-f]{64}$'`). Se prueba sobre `tpl_template_version.package_hash`
 * (`ck_tpl_template_version_hash`) por ser el más simple de aislar (una sola fila, sin FK adicionales
 * más allá de `template_id`); el mismo patrón rige `tpl_document_snapshot`/`tpl_release`.`content_hash`
 * y `tpl_template_registration.requested_hash` — mismo `CHECK`, no se repite la prueba tres veces.
 */
class HashCheckConstraintsTest : IntegrationTestBase() {

    @Test
    fun `un hash sin el prefijo sha256 dos puntos es rechazado`() {
        val templateId = insertTplTemplate("hash-check-" + System.nanoTime())
        val e = assertFails { insertTplTemplateVersion(templateId, packageHash = "a".repeat(64)) }
        assertTrue(e.sqlState == "23514", "se esperaba violación de CHECK (23514), llegó ${e.sqlState}: ${e.message}")
    }

    @Test
    fun `un hash con longitud incorrecta es rechazado`() {
        val templateId = insertTplTemplate("hash-check-" + System.nanoTime())
        val e = assertFails { insertTplTemplateVersion(templateId, packageHash = "sha256:" + "a".repeat(63)) } // 63, no 64
        assertTrue(e.sqlState == "23514", "se esperaba violación de CHECK (23514), llegó ${e.sqlState}: ${e.message}")
    }

    @Test
    fun `un hash con mayusculas es rechazado (el patron exige hex en minusculas)`() {
        val templateId = insertTplTemplate("hash-check-" + System.nanoTime())
        val e = assertFails { insertTplTemplateVersion(templateId, packageHash = "sha256:" + "A".repeat(64)) }
        assertTrue(e.sqlState == "23514", "se esperaba violación de CHECK (23514), llegó ${e.sqlState}: ${e.message}")
    }

    @Test
    fun `un hash valido con prefijo y 64 hex en minusculas se acepta`() {
        val templateId = insertTplTemplate("hash-check-" + System.nanoTime())
        val id = insertTplTemplateVersion(templateId, packageHash = "sha256:" + "a".repeat(64))
        assertTrue(id > 0)
    }

    private fun assertFails(block: () -> Unit): SQLException {
        try {
            block()
        } catch (e: SQLException) {
            return e
        }
        throw AssertionError("se esperaba SQLException y no se lanzó ninguna")
    }
}
