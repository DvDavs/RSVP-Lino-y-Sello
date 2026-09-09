package mx.evolutiondev.invitaciones.modules.product.invitations

import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.persistence.BusinessSnapshotReader
import mx.evolutiondev.invitaciones.modules.templates2.persistence.PgTestCluster
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * **R1-12 y R1-15, contra el esquema real ya migrado.** Sin Spring: lo que se prueba es SQL, y lo que
 * lo aplica es Flyway dentro de [PgTestCluster].
 *
 * Las tres cosas que el informe exige y que `V42` no dejaba en pie:
 * 1. cada fila puente cuelga del `event_type` que `BusinessSnapshotReader` traduce al `eventKind` que
 *    la clienta eligió — comprobado **con la propia función que hace la deducción**, no con ids;
 * 2. existe el puente de plan 2 por el que E4 sube la invitación al cobrar;
 * 3. `invitation_template_id_seq` está por encima de la banda de las filas puente.
 */
class ProductInvitationPuenteV44Test {

    private val marcadores: Map<String, EventKind> = mapOf(
        "templates2:wedding" to EventKind.WEDDING,
        "templates2:quince" to EventKind.QUINCE,
        "templates2:baptism" to EventKind.BAPTISM,
        "templates2:communion" to EventKind.COMMUNION,
        "templates2:confirmation" to EventKind.CONFIRMATION,
        "templates2:birthday" to EventKind.BIRTHDAY,
        "templates2:graduation" to EventKind.GRADUATION,
        "templates2:generic" to EventKind.GENERIC,
    )

    init {
        PgTestCluster.ensureReady()
    }

    /**
     * El fondo de R1-12a: si el puente cuelga del tipo de evento equivocado, el `eventKind` que la
     * clienta eligió se pierde **sin ningún error**. Se comprueba con `mapEventKind`, que es
     * literalmente la función que lo deduce en producción (`BusinessSnapshotReader.kt:80-86`).
     */
    @Test
    fun `las ocho filas puente deducen el eventKind que les toca`() {
        marcadores.forEach { (marcador, esperado) ->
            val (nombre, esBoda) = tipoDeEventoDe(marcador)
            assertEquals(
                esperado,
                BusinessSnapshotReader.mapEventKind(esBoda, nombre),
                "$marcador cuelga de «$nombre» (is_wedding=$esBoda) y se deduce mal",
            )
        }
    }

    /**
     * R1-12a de verdad: se rompe el puente a mano —como lo habría dejado un catálogo antiguo que ya
     * ocupara los ids 7 u 8— y se vuelve a aplicar `V44`, que es idempotente. Tiene que repararlo.
     */
    @Test
    fun `V44 repara un puente que apunta al tipo de evento equivocado`() {
        val boda = idDeTipoDeEvento("templates2:wedding")
        PgTestCluster.newConnection().use { conn ->
            conn.createStatement().use {
                it.executeUpdate(
                    "UPDATE invitation_template SET event_type_id = $boda WHERE url = 'templates2:graduation'",
                )
            }
        }
        val roto = tipoDeEventoDe("templates2:graduation")
        assertEquals(
            EventKind.WEDDING,
            BusinessSnapshotReader.mapEventKind(roto.second, roto.first),
            "el montaje de la prueba tiene que dejar el puente roto de verdad",
        )

        aplicarV44()

        val reparado = tipoDeEventoDe("templates2:graduation")
        assertEquals(EventKind.GRADUATION, BusinessSnapshotReader.mapEventKind(reparado.second, reparado.first))
    }

    /** R1-12b: sin estas ocho filas, E4 no tiene por dónde subir la invitación a plan 2 al cobrar. */
    @Test
    fun `existe la gemela de plan 2 de cada puente y es premium`() {
        marcadores.keys.forEach { marcador ->
            PgTestCluster.newConnection().use { conn ->
                conn.prepareStatement(
                    """
                    SELECT p.is_premium, g.event_type_id = b.event_type_id
                      FROM invitation_template g
                      JOIN invitation_plan p ON p.id = g.invitation_plan_id
                      JOIN invitation_template b ON b.url = ?
                     WHERE g.url = ?
                    """.trimIndent(),
                ).use { st ->
                    st.setString(1, marcador)
                    st.setString(2, "$marcador:plan2")
                    st.executeQuery().use { rs ->
                        assertTrue(rs.next(), "falta la fila puente de plan 2 de $marcador")
                        assertTrue(rs.getBoolean(1), "$marcador:plan2 tiene que colgar de un plan premium")
                        assertTrue(rs.getBoolean(2), "$marcador:plan2 tiene que compartir tipo de evento con su hermana")
                    }
                }
            }
        }
    }

    /** R1-15: con la secuencia en 10, la plantilla nº 891 del catálogo antiguo chocaría con las puente. */
    @Test
    fun `la secuencia de invitation_template esta por encima de la banda de las filas puente`() {
        PgTestCluster.newConnection().use { conn ->
            conn.createStatement().use { st ->
                st.executeQuery("SELECT last_value FROM invitation_template_id_seq").use { rs ->
                    rs.next()
                    val ultimo = rs.getLong(1)
                    assertTrue(ultimo >= 908, "la secuencia quedó en $ultimo y las filas puente ocupan 901-908")
                }
                st.executeQuery(
                    "SELECT count(*) FROM invitation_template WHERE id > (SELECT last_value FROM invitation_template_id_seq)",
                ).use { rs ->
                    rs.next()
                    assertEquals(0, rs.getInt(1), "hay filas por encima de la secuencia: el próximo INSERT chocaría")
                }
            }
        }
    }

    private fun tipoDeEventoDe(marcador: String): Pair<String?, Boolean> =
        PgTestCluster.newConnection().use { conn ->
            conn.prepareStatement(
                """
                SELECT et.name, et.is_wedding
                  FROM invitation_template t
                  JOIN event_type et ON et.id = t.event_type_id
                 WHERE t.url = ?
                """.trimIndent(),
            ).use { st ->
                st.setString(1, marcador)
                st.executeQuery().use { rs ->
                    assertTrue(rs.next(), "no existe la fila puente $marcador")
                    rs.getString(1) to rs.getBoolean(2)
                }
            }
        }

    private fun idDeTipoDeEvento(marcador: String): Long = PgTestCluster.newConnection().use { conn ->
        conn.prepareStatement("SELECT event_type_id FROM invitation_template WHERE url = ?").use { st ->
            st.setString(1, marcador)
            st.executeQuery().use { rs ->
                rs.next()
                rs.getLong(1)
            }
        }
    }

    /**
     * Aplica el guion de `V44` tal cual está en el classpath. Va en una sola llamada porque el bloque
     * `DO $$ … $$` no se puede partir por `;`, y PostgreSQL acepta varias sentencias en una.
     */
    private fun aplicarV44() {
        val guion = checkNotNull(javaClass.getResource("/db/migration/$FICHERO_V44")) {
            "no encuentro $FICHERO_V44 en el classpath"
        }.readText()
        PgTestCluster.newConnection().use { conn -> conn.createStatement().use { it.execute(guion) } }
    }

    companion object {
        private const val FICHERO_V44 = "V44__product_invitation_bridge_by_name_and_plan2.sql"
    }
}
