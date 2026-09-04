package mx.evolutiondev.invitaciones.modules.templates2.persistence

import java.sql.Connection
import java.sql.ResultSet
import java.util.UUID

/**
 * Base común de las pruebas de `templates2.persistence` que hablan SQL directo contra el clúster real
 * (`06 §6.1`, `PgTestCluster`). Provee fixtures mínimos de `customer`/`invitation` (necesarios por las
 * FK `NOT NULL` hacia esas tablas) usando JDBC plano en modo `autoCommit = true`: cada sentencia es su
 * propia transacción, así que un `CHECK` o un `UNIQUE` que falla en un test no envenena las sentencias
 * siguientes del mismo test (Postgres aborta la transacción entera tras un error; con `autoCommit`
 * cada `execute()` ya es su propia transacción y no hace falta gestionar *savepoints* a mano).
 *
 * Ningún test de esta suite depende del orden de ejecución: cada uno crea sus propias filas de
 * `customer`/`invitation`/`tpl_*` y las limpia en `@AfterEach` (o confía en `ON DELETE CASCADE` al
 * borrar la invitación). No se hace `TRUNCATE` global entre pruebas para no interferir con otra suite
 * que comparta el mismo clúster efímero si alguna vez se reutiliza el `STATE_DIR` (no es el caso con
 * `TPL_TEST_STATE_DIR` propio, pero es más barato no depender de ello).
 */
abstract class IntegrationTestBase {

    init {
        PgTestCluster.ensureReady()
    }

    protected fun conn(): Connection = PgTestCluster.newConnection().apply { autoCommit = true }

    protected fun insertCustomer(): Long = conn().use { c ->
        c.prepareStatement(
            "INSERT INTO customer (email, is_banned, is_enabled, password, role) VALUES (?, false, true, 'x', 'USER') RETURNING id",
        ).use { ps ->
            ps.setString(1, "t2-1-${UUID.randomUUID()}@example.test")
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    /** Reutiliza la primera plantilla ya sembrada por las migraciones del módulo antiguo (V25):
     * `invitation.template_id` es `NOT NULL REFERENCES invitation_template(id)` y este bloque no
     * inserta filas en ese catálogo, ajeno a `templates2` (`02 §3`). */
    private var cachedLegacyTemplateId: Long? = null

    protected fun legacyTemplateId(): Long = cachedLegacyTemplateId ?: conn().use { c ->
        c.createStatement().use { st ->
            st.executeQuery("SELECT id FROM invitation_template ORDER BY id LIMIT 1").use { rs ->
                check(rs.next()) { "invitation_template está vacía: las migraciones del módulo antiguo no sembraron nada" }
                rs.getLong(1).also { cachedLegacyTemplateId = it }
            }
        }
    }

    protected fun insertInvitation(customerId: Long, usesTemplates2: Boolean = false): Long = conn().use { c ->
        c.prepareStatement(
            "INSERT INTO invitation (customer_id, template_id, is_enabled, is_finished, all_events_same_location, uses_templates2) " +
                "VALUES (?, ?, true, false, false, ?) RETURNING id",
        ).use { ps ->
            ps.setLong(1, customerId)
            ps.setLong(2, legacyTemplateId())
            ps.setBoolean(3, usesTemplates2)
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    protected fun deleteInvitation(id: Long) = conn().use { c ->
        c.prepareStatement("DELETE FROM invitation WHERE id = ?").use { ps -> ps.setLong(1, id); ps.executeUpdate() }
    }

    protected fun deleteCustomer(id: Long) = conn().use { c ->
        c.prepareStatement("DELETE FROM customer WHERE id = ?").use { ps -> ps.setLong(1, id); ps.executeUpdate() }
    }

    protected fun insertTplTemplate(slug: String): Long = conn().use { c ->
        c.prepareStatement("INSERT INTO tpl_template (slug) VALUES (?) RETURNING id").use { ps ->
            ps.setString(1, slug)
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    protected fun insertTplTemplateVersion(
        templateId: Long,
        version: String = "1.0.0",
        packageHash: String = randomPrefixedHash(),
        eventKindsJson: String = "[\"wedding\"]",
    ): Long = conn().use { c ->
        val (major, minor, patch) = version.split(".").map(String::toInt)
        c.prepareStatement(
            """
            INSERT INTO tpl_template_version
                (template_id, version, version_major, version_minor, version_patch, manifest, theme, defaults, package_hash, event_kinds)
            VALUES (?, ?, ?, ?, ?, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, CAST(? AS jsonb))
            RETURNING id
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, templateId)
            ps.setString(2, version)
            ps.setInt(3, major)
            ps.setInt(4, minor)
            ps.setInt(5, patch)
            ps.setString(6, packageHash)
            ps.setString(7, eventKindsJson)
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    protected fun randomPrefixedHash(): String = "sha256:" + "0".repeat(64 - 8) + UUID.randomUUID().toString().replace("-", "").take(8)

    protected fun randomPublicToken(): String = "pub_" + randomUlidLike()
    protected fun randomAssetPublicId(): String = "as_" + randomUlidLike()

    /** No usa `UlidGenerator` (es de `src/main`, y estas pruebas son de SQL, no de esa clase): genera
     * 26 caracteres del alfabeto Crockford válidos para casar `Patterns.ULID`/`ck_..._format`. */
    private fun randomUlidLike(): String {
        val alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
        return (1..26).map { alphabet.random() }.joinToString("")
    }

    protected fun insertTplDocument(invitationId: Long, templateVersionId: Long, publicToken: String = randomPublicToken()): Long =
        conn().use { c ->
            c.prepareStatement(
                "INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token) " +
                    "VALUES (?, ?, '{}'::jsonb, ?) RETURNING id",
            ).use { ps ->
                ps.setLong(1, invitationId)
                ps.setLong(2, templateVersionId)
                ps.setString(3, publicToken)
                ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
            }
        }

    protected fun insertTplRelease(
        invitationId: Long,
        templateVersionId: Long,
        isActive: Boolean = true,
        contentHash: String = randomPrefixedHash(),
    ): Long = conn().use { c ->
        c.prepareStatement(
            "INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed, report, business_snapshot, content_hash, is_active) " +
                "VALUES (?, ?, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, ?) RETURNING id",
        ).use { ps ->
            ps.setLong(1, invitationId)
            ps.setLong(2, templateVersionId)
            ps.setString(3, contentHash)
            ps.setBoolean(4, isActive)
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    protected fun insertTplAssetForInvitation(invitationId: Long, sha256: String, s3Key: String = "templates2/invitation/$invitationId/${sha256}.webp"): Long =
        conn().use { c ->
            c.prepareStatement(
                "INSERT INTO tpl_asset (public_id, invitation_id, bucket, s3_key, sha256, content_type, bytes) " +
                    "VALUES (?, ?, 'assets-bucket', ?, ?, 'image/webp', 100) RETURNING id",
            ).use { ps ->
                ps.setString(1, randomAssetPublicId())
                ps.setLong(2, invitationId)
                ps.setString(3, s3Key)
                ps.setString(4, sha256)
                ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
            }
        }

    protected fun oneLong(rs: ResultSet): Long { rs.next(); return rs.getLong(1) }
}
