package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Prueba 4 del brief: el trigger `trg_tpl_asset_gc` (`02 §2` V37, ADR-1R-B-03, objeción B-02). Al
 * borrar una fila de `tpl_asset`, por cualquier vía — explícita o en cascada desde
 * `DELETE FROM invitation` —, debe quedar encolado el objeto S3 correspondiente en `tpl_asset_gc`.
 */
class AssetGcTriggerTest : IntegrationTestBase() {

    @Test
    fun `borrar un asset explicitamente encola su objeto S3 en tpl_asset_gc`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val sha = "e".repeat(64)
        val s3Key = "templates2/invitation/$invitationId/$sha.webp"
        val assetId = insertTplAssetForInvitation(invitationId, sha, s3Key)
        val (bucket, publicId) = conn().use { c ->
            c.prepareStatement("SELECT bucket, public_id FROM tpl_asset WHERE id = ?").use { ps ->
                ps.setLong(1, assetId)
                ps.executeQuery().use { rs -> rs.next(); rs.getString(1) to rs.getString(2) }
            }
        }

        conn().use { c ->
            c.prepareStatement("DELETE FROM tpl_asset WHERE id = ?").use { ps -> ps.setLong(1, assetId); ps.executeUpdate() }
        }

        val encolado = conn().use { c ->
            c.prepareStatement(
                "SELECT bucket, s3_key, public_id, reason, deleted_at FROM tpl_asset_gc WHERE s3_key = ?",
            ).use { ps ->
                ps.setString(1, s3Key)
                ps.executeQuery().use { rs ->
                    assertTrue(rs.next(), "no se encoló ninguna fila en tpl_asset_gc para $s3Key")
                    Triple(rs.getString(1), rs.getString(3), rs.getString(4)) to (rs.getTimestamp(5) == null)
                }
            }
        }
        val (datos, sinBorrar) = encolado
        val (bucketEncolado, publicIdEncolado, reason) = datos
        assertEquals(bucket, bucketEncolado)
        assertEquals(publicId, publicIdEncolado)
        assertEquals("row_deleted", reason)
        assertTrue(sinBorrar, "deleted_at debía ser NULL: la fila acaba de encolarse, aún no la procesó AssetGcJob")

        deleteInvitation(invitationId)
    }

    @Test
    fun `borrar una invitacion en cascada tambien encola sus assets (no solo el borrado explicito)`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val sha = "f".repeat(64)
        val s3Key = "templates2/invitation/$invitationId/$sha.webp"
        insertTplAssetForInvitation(invitationId, sha, s3Key)

        deleteInvitation(invitationId) // borrado en cascada de tpl_asset, no un DELETE FROM tpl_asset directo

        val hayFila = conn().use { c ->
            c.prepareStatement("SELECT count(*) FROM tpl_asset_gc WHERE s3_key = ?").use { ps ->
                ps.setString(1, s3Key)
                ps.executeQuery().use { rs -> rs.next(); rs.getInt(1) > 0 }
            }
        }
        assertTrue(hayFila, "el trigger debía disparar también cuando tpl_asset se borra por cascada desde invitation")
    }
}
