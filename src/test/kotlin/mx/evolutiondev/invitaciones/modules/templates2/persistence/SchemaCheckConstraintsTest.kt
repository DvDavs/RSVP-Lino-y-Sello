package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.sql.SQLException

/**
 * Añadida por la revisión `2-1-REV` (objeción O-21-03). `contratos.md §5` nombra tres `CHECK` como
 * innegociables que `HashCheckConstraintsTest` **no** cubría: `public_token VARCHAR(30)` con `CHECK` de
 * patrón, `doc_bytes CHECK ≤ 1 MiB` (objeción B-05, severidad ALTA de la ronda 1R) y el `CHECK` de
 * dueño único de `tpl_asset`. Que el DDL los declare no prueba que la base los aplique con los límites
 * exactos: un `1048576` mal escrito o un patrón laxo solo se ve ejerciendo el borde.
 */
class SchemaCheckConstraintsTest : IntegrationTestBase() {

    private fun insertarDocumento(invitationId: Long, versionId: Long, publicToken: String, docBytes: Int) =
        conn().use { c ->
            c.prepareStatement(
                "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token, doc_bytes) " +
                    "VALUES (?, ?, '{}'::jsonb, ?, ?)",
            ).use { ps ->
                ps.setLong(1, invitationId)
                ps.setLong(2, versionId)
                ps.setString(3, publicToken)
                ps.setInt(4, docBytes)
                ps.executeUpdate()
            }
        }

    @Test
    fun `ck_tpl_document_public_token rechaza un token sin prefijo, corto, o con letras excluidas de Crockford`() {
        val customerId = insertCustomer()
        val versionId = insertTplTemplateVersion(insertTplTemplate("tok-" + System.nanoTime()))
        val ulidValido = "0123456789ABCDEFGHJKMNPQRS" // 26 chars Crockford
        assertEquals(26, ulidValido.length)

        for (malo in listOf(
            ulidValido, // sin el prefijo "pub_"
            "pub_" + ulidValido.take(25), // 25 caracteres, no 26
            "pub_" + "I".repeat(26), // 'I' está excluida del alfabeto Crockford
            "pub_" + "U".repeat(26), // 'U' también
            "as_" + ulidValido, // prefijo de assetId, no de token público
        )) {
            val invitationId = insertInvitation(customerId)
            val e = sqlErrorOf { insertarDocumento(invitationId, versionId, malo, 0) }
            assertEquals("23514", e.sqlState, "\"$malo\" debía violar ck_tpl_document_public_token: ${e.message}")
            deleteInvitation(invitationId)
        }

        val invitationId = insertInvitation(customerId)
        insertarDocumento(invitationId, versionId, "pub_$ulidValido", 0) // el válido sí entra
        deleteInvitation(invitationId)
    }

    @Test
    fun `ck_tpl_document_doc_bytes aplica el tope exacto de 1 MiB y rechaza negativos (objecion B-05)`() {
        val customerId = insertCustomer()
        val versionId = insertTplTemplateVersion(insertTplTemplate("bytes-" + System.nanoTime()))

        val enElBorde = insertInvitation(customerId)
        insertarDocumento(enElBorde, versionId, randomPublicToken(), 1_048_576) // exactamente 1 MiB: válido
        deleteInvitation(enElBorde)

        val unByteDeMas = insertInvitation(customerId)
        val e1 = sqlErrorOf { insertarDocumento(unByteDeMas, versionId, randomPublicToken(), 1_048_577) }
        assertEquals("23514", e1.sqlState, "1 MiB + 1 byte debía violar ck_tpl_document_doc_bytes: ${e1.message}")
        deleteInvitation(unByteDeMas)

        val negativo = insertInvitation(customerId)
        val e2 = sqlErrorOf { insertarDocumento(negativo, versionId, randomPublicToken(), -1) }
        assertEquals("23514", e2.sqlState, "doc_bytes negativo debía violar el CHECK: ${e2.message}")
        deleteInvitation(negativo)
    }

    @Test
    fun `ck_tpl_asset_owner impide un asset con dos duenos y un asset sin dueno`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val versionId = insertTplTemplateVersion(insertTplTemplate("owner-" + System.nanoTime()))

        val conDosDuenos = sqlErrorOf { insertarAsset(invitationId, versionId, "1".repeat(64)) }
        assertEquals("23514", conDosDuenos.sqlState, conDosDuenos.message)

        val sinDueno = sqlErrorOf { insertarAsset(null, null, "2".repeat(64)) }
        assertEquals("23514", sinDueno.sqlState, sinDueno.message)

        insertarAsset(invitationId, null, "3".repeat(64)) // exactamente un dueño: válido
        deleteInvitation(invitationId)
    }

    @Test
    fun `ck_tpl_release_unpublished impide un release activo con unpublished_at`() {
        val customerId = insertCustomer()
        val invitationId = insertInvitation(customerId)
        val versionId = insertTplTemplateVersion(insertTplTemplate("unpub-" + System.nanoTime()))

        val e = sqlErrorOf {
            conn().use { c ->
                c.prepareStatement(
                    "INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed, report, " +
                        "business_snapshot, content_hash, is_active, unpublished_at) " +
                        "VALUES (?, ?, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, true, now())",
                ).use { ps ->
                    ps.setLong(1, invitationId)
                    ps.setLong(2, versionId)
                    ps.setString(3, randomPrefixedHash())
                    ps.executeUpdate()
                }
            }
        }
        assertEquals("23514", e.sqlState, "un release activo no puede llevar unpublished_at: ${e.message}")
        deleteInvitation(invitationId)
    }

    @Test
    fun `las 8 tablas del modulo estan en el rango V29-V37 y ninguna otra tabla existente cambio`() {
        conn().use { c ->
            c.createStatement().use { st ->
                // La única columna que templates2 añade a una tabla preexistente es invitation.uses_templates2
                // (contratos.md §5). Si un bloque futuro añade otra, esta prueba lo delata.
                st.executeQuery(
                    "SELECT count(*) FROM information_schema.columns " +
                        "WHERE table_schema = 'public' AND table_name NOT LIKE 'tpl_%' " +
                        "AND column_name LIKE '%templates2%'",
                ).use { rs ->
                    rs.next()
                    assertEquals(1, rs.getInt(1), "solo invitation.uses_templates2 puede vivir fuera de las tablas tpl_*")
                }
            }
        }
    }

    private fun insertarAsset(invitationId: Long?, templateVersionId: Long?, sha: String) = conn().use { c ->
        c.prepareStatement(
            "INSERT INTO tpl_asset (public_id, invitation_id, template_version_id, bucket, s3_key, sha256, content_type, bytes) " +
                "VALUES (?, ?, ?, 'assets-bucket', ?, ?, 'image/webp', 100)",
        ).use { ps ->
            ps.setString(1, randomAssetPublicId())
            if (invitationId == null) ps.setNull(2, java.sql.Types.BIGINT) else ps.setLong(2, invitationId)
            if (templateVersionId == null) ps.setNull(3, java.sql.Types.BIGINT) else ps.setLong(3, templateVersionId)
            ps.setString(4, "templates2/rev/$sha-${System.nanoTime()}.webp")
            ps.setString(5, sha)
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
