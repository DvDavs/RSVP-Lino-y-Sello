package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Prueba 2 del brief: "arranque de contexto [de base de datos] con las 9 migraciones Flyway
 * aplicadas". Deliberadamente **no** pasa por Spring aquí (eso lo cubre `DdlValidateTest`, que además
 * valida Hibernate): esta prueba aísla el paso de Flyway en sí — que `V29`-`V37` apliquen limpio sobre
 * el esquema real (`V1`-`V28`) y que las 8 tablas + el trigger existan — de cualquier otro efecto de
 * arrancar un `ApplicationContext`.
 */
class FlywayMigrationTest : IntegrationTestBase() {

    private val tablasDelModulo = listOf(
        "tpl_template", "tpl_template_version", "tpl_asset", "tpl_document",
        "tpl_document_snapshot", "tpl_release", "tpl_template_registration", "tpl_asset_gc",
    )

    @Test
    fun `las 9 migraciones V29 a V37 quedan registradas en el historial de Flyway`() {
        conn().use { c ->
            c.createStatement().use { st ->
                st.executeQuery(
                    "SELECT version FROM flyway_schema_history " +
                        "WHERE version ~ '^[0-9]+$' AND version::int BETWEEN 29 AND 37 AND success = true " +
                        "ORDER BY version::int",
                ).use { rs ->
                    val versiones = generateSequence { if (rs.next()) rs.getString(1) else null }.toList()
                    assertEquals((29..37).map { it.toString() }, versiones, "se esperaban V29..V37 aplicadas con éxito")
                }
            }
        }
    }

    @Test
    fun `las 8 tablas del modulo existen`() {
        conn().use { c ->
            c.createStatement().use { st ->
                for (tabla in tablasDelModulo) {
                    st.executeQuery("SELECT to_regclass('public.$tabla')").use { rs ->
                        rs.next()
                        assertTrue(rs.getString(1) != null, "falta la tabla $tabla")
                    }
                }
            }
        }
    }

    @Test
    fun `invitation tiene la columna uses_templates2 con DEFAULT false`() {
        conn().use { c ->
            c.createStatement().use { st ->
                st.executeQuery(
                    "SELECT column_default, is_nullable FROM information_schema.columns " +
                        "WHERE table_name = 'invitation' AND column_name = 'uses_templates2'",
                ).use { rs ->
                    assertTrue(rs.next(), "falta invitation.uses_templates2")
                    assertTrue(rs.getString(1)?.contains("false") == true, "DEFAULT debe ser false: ${rs.getString(1)}")
                    assertEquals("NO", rs.getString(2), "uses_templates2 debe ser NOT NULL")
                }
            }
        }
    }

    @Test
    fun `el trigger trg_tpl_asset_gc existe sobre tpl_asset`() {
        conn().use { c ->
            c.createStatement().use { st ->
                st.executeQuery(
                    "SELECT tgname FROM pg_trigger WHERE tgrelid = 'tpl_asset'::regclass AND tgname = 'trg_tpl_asset_gc'",
                ).use { rs -> assertTrue(rs.next(), "falta el trigger trg_tpl_asset_gc") }
            }
        }
    }

    @Test
    fun `re-migrar es idempotente (no vuelve a aplicar nada)`() {
        // Flyway.migrate() ya se llamó en el init de PgTestCluster; llamarlo otra vez no debe fallar
        // ni reintentar V29-V37 (checksum coincide con el mismo fichero).
        val flyway = org.flywaydb.core.Flyway.configure()
            .dataSource(PgTestCluster.jdbcUrl, PgTestCluster.user, PgTestCluster.password)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
        val result = flyway.migrate()
        assertEquals(0, result.migrationsExecuted, "una segunda pasada no debería ejecutar migraciones nuevas")
    }
}
