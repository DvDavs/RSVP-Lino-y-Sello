package mx.evolutiondev.invitaciones.modules.product.guests.rsvp

import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.mock
import java.sql.Connection
import java.sql.ResultSet

/**
 * **El puente del RSVP contra una base de datos de verdad.**
 *
 * Hasta esta sesión, la consulta que traduce el `confirmation_token` de un invitado a su invitación
 * publicada solo tenía pruebas sobre el **texto** del SQL, y su resultado se mapeaba **por posición**
 * (`fila[0]`, `fila[1]`, …). Dos agujeros a la vez: nadie comprobaba que la consulta corriera contra
 * el esquema real —una columna mal escrita se descubriría en producción— y un `SELECT` reordenado
 * habría cruzado valores en silencio, sirviéndole a un invitado anónimo la ficha equivocada.
 *
 * Esta prueba cierra los dos. Levanta el Postgres efímero con las migraciones aplicadas
 * (`PgTestCluster`, el mismo que usan las pruebas de persistencia de `templates2`), siembra el grafo
 * completo —cliente, invitación, documento, release activo e invitado—, ejecuta **el SQL literal de
 * [RsvpGuestReader]** y mapea con **su propia función de mapeo**. Si alguien reordena la proyección,
 * renombra un alias o cambia una columna, aquí se cae.
 *
 * Los valores sembrados son deliberadamente **distintos entre sí** (2, 3, 4, 5, 6, 7): con cifras
 * repetidas, un cruce de columnas pasaría desapercibido.
 */
class RsvpPuenteRealTest {

    private val lector = RsvpGuestReader(mock())

    @Test
    fun `la consulta corre contra el esquema real y cada columna cae en su campo`() {
        PgTestCluster.newConnection().use { cx ->
            val token = sembrar(cx, sufijo = "ok")

            val fila = leer(cx, token)

            requireNotNull(fila) { "el invitado sembrado tiene que resolverse" }
            assertEquals("Ana y Diego López", fila.fullName)
            assertEquals(2, fila.adults, "adults_count")
            assertEquals(3, fila.children, "children_count")
            assertEquals(4, fila.young, "young_count")
            assertEquals(5, fila.adultsConfirmed, "adults_count_confirmed")
            assertEquals(6, fila.childrenConfirmed, "children_count_confirmed")
            assertEquals(7, fila.youngConfirmed, "young_count_confirmed")
            assertEquals("CONFIRMED", fila.status)
            assertTrue(fila.hasEmail, "el invitado sembrado sí tiene correo")
            assertTrue(fila.publicToken.startsWith("pub_"), "el publicToken sale del documento")
            assertTrue(fila.childrenAllowed, "children_allowed de la invitación")
            assertFalse(fila.youngAllowed, "young_allowed de la invitación")
            assertEquals("2099-04-18", fila.eventDate)
            assertEquals("17:00", fila.eventTime)
        }
    }

    /**
     * Los alias de la proyección son el contrato del mapeo por nombre: si uno desaparece, el mapeo
     * revienta. Se comprueba contra los metadatos del `ResultSet` real, no contra el texto del SQL.
     */
    @Test
    fun `la proyeccion real trae exactamente los catorce alias que el mapeo pide`() {
        PgTestCluster.newConnection().use { cx ->
            val token = sembrar(cx, sufijo = "alias")

            cx.prepareStatement(sqlConParametro()).use { ps ->
                ps.setString(1, token)
                ps.executeQuery().use { rs ->
                    val etiquetas = (1..rs.metaData.columnCount).map { rs.metaData.getColumnLabel(it) }
                    assertEquals(RsvpGuestReader.COLUMNAS, etiquetas)
                }
            }
        }
    }

    /**
     * Un invitado cuya invitación **no** tiene release activo da cero filas, igual que un token
     * inventado: es el `404` único del contrato §0.5, comprobado ahora contra la base real y no
     * contra la forma del SQL.
     */
    @Test
    fun `sin release activo la consulta no devuelve nada, igual que un token inventado`() {
        PgTestCluster.newConnection().use { cx ->
            val token = sembrar(cx, sufijo = "sinrelease", releaseActivo = false)

            assertNull(leer(cx, token), "una invitación sin publicar es indistinguible de un token falso")
            assertNull(leer(cx, "estoNoEsUnTokenReal01"))
        }
    }

    // =============================================================================================
    // Siembra
    // =============================================================================================

    /** El SQL real, con el parámetro con nombre traducido a `?` para JDBC puro. */
    private fun sqlConParametro() = lector.sql.replace(":confirmationToken", "?")

    private fun leer(cx: Connection, token: String): RsvpGuestRow? =
        cx.prepareStatement(sqlConParametro()).use { ps ->
            ps.setString(1, token)
            ps.executeQuery().use { rs ->
                if (!rs.next()) null else lector.mapear { columna -> rs.valor(columna) }
            }
        }

    /** `getObject` por **nombre**, que es exactamente lo que hace el mapeo con la `Tuple` de JPA. */
    private fun ResultSet.valor(columna: String): Any? = getObject(columna)

    private fun sembrar(cx: Connection, sufijo: String, releaseActivo: Boolean = true): String {
        val marca = "${System.nanoTime()}-$sufijo"
        val token = "tok-$marca".take(60)

        cx.autoCommit = true
        val eventType = insertar(cx, "event_type")
        val plan = insertar(cx, "invitation_plan")
        val plantilla = cx.prepareStatement(
            "INSERT INTO invitation_template (price, event_type_id, invitation_plan_id) VALUES (0, ?, ?) RETURNING id",
        ).use { ps ->
            ps.setLong(1, eventType)
            ps.setLong(2, plan)
            ps.executeQuery().use { it.next(); it.getLong(1) }
        }
        val cliente = cx.prepareStatement(
            """
            INSERT INTO customer (id, email, password, role, is_enabled, is_banned)
            VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM customer), ?, 'x', 'USER', TRUE, FALSE) RETURNING id
            """.trimIndent(),
        ).use { ps ->
            ps.setString(1, "puente-$marca@example.com")
            ps.executeQuery().use { it.next(); it.getLong(1) }
        }
        val invitacion = cx.prepareStatement(
            """
            INSERT INTO invitation (id, customer_id, template_id, date, "time",
                                    children_allowed, young_allowed, is_enabled)
            VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM invitation), ?, ?, '2099-04-18', '17:00', TRUE, FALSE, TRUE)
            RETURNING id
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, cliente)
            ps.setLong(2, plantilla)
            ps.executeQuery().use { it.next(); it.getLong(1) }
        }
        val version = cx.prepareStatement(
            """
            INSERT INTO tpl_template_version (template_id, version, version_major, version_minor,
                                              version_patch, manifest, theme, defaults, package_hash, event_kinds)
            SELECT (SELECT id FROM tpl_template WHERE slug = ?), ?, 1, 0, 0,
                   '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, '["boda"]'::jsonb
            RETURNING id
            """.trimIndent(),
        ).let { ps ->
            cx.prepareStatement("INSERT INTO tpl_template (slug) VALUES (?) ON CONFLICT DO NOTHING").use { t ->
                t.setString(1, "puente-rsvp")
                t.executeUpdate()
            }
            ps.use {
                it.setString(1, "puente-rsvp")
                // La versión es única por plantilla (`uq_tpl_template_version`): una por siembra.
                it.setString(2, "1.0.${System.nanoTime() % 1_000_000}")
                // El hash también es único por plantilla (`uq_tpl_template_version_hash`).
                it.setString(3, "sha256:" + marca.filter { c -> c.isDigit() }.padStart(64, '0').takeLast(64))
                it.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
            }
        }
        cx.prepareStatement(
            """
            INSERT INTO tpl_document (invitation_id, template_version_id, doc, public_token, doc_bytes)
            VALUES (?, ?, '{}'::jsonb, ?, 2)
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, invitacion)
            ps.setLong(2, version)
            ps.setString(3, publicTokenValido())
            ps.executeUpdate()
        }
        cx.prepareStatement(
            """
            INSERT INTO tpl_release (invitation_id, template_version_id, document_revision, composed,
                                     report, business_snapshot, content_hash, is_active)
            VALUES (?, ?, 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ?, ?)
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, invitacion)
            ps.setLong(2, version)
            ps.setString(3, "sha256:" + "1".repeat(64))
            ps.setBoolean(4, releaseActivo)
            ps.executeUpdate()
        }
        cx.prepareStatement(
            """
            INSERT INTO invitation_guest (invitation_id, full_name, email, phone, adults_count,
                                          children_count, young_count, adults_count_confirmed,
                                          children_count_confirmed, young_count_confirmed,
                                          confirmation_token, attendance_status, is_enabled)
            VALUES (?, 'Ana y Diego López', ?, '5512345678', 2, 3, 4, 5, 6, 7, ?, 'CONFIRMED', TRUE)
            """.trimIndent(),
        ).use { ps ->
            ps.setLong(1, invitacion)
            ps.setString(2, "invitada-$marca@example.com")
            ps.setString(3, token)
            ps.executeUpdate()
        }
        return token
    }

    /**
     * `customer`, `invitation`, `event_type` e `invitation_plan` vienen del dump heredado y **no**
     * tienen `DEFAULT` en su `id` (`V1__initial_schema.sql`), así que hay que darlo. Se toma el
     * siguiente libre en vez de un número fijo para no chocar con lo que siembre otra prueba.
     */
    private fun insertar(cx: Connection, tabla: String): Long =
        cx.prepareStatement(
            "INSERT INTO $tabla (id) VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM $tabla)) RETURNING id",
        ).use { ps -> ps.executeQuery().use { it.next(); it.getLong(1) } }

    /** `ck_tpl_document_public_token` exige `pub_` + 26 caracteres de Crockford (V32:18). */
    private fun publicTokenValido(): String {
        val alfabeto = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
        return "pub_" + (1..26).map { alfabeto.random() }.joinToString("")
    }
}
