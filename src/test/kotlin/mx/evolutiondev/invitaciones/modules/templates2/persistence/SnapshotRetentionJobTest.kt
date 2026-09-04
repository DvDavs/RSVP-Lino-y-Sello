package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.api.EditorDocumentService
import mx.evolutiondev.invitaciones.modules.templates2.api.EditorTestSupport
import mx.evolutiondev.invitaciones.modules.templates2.api.ReleaseService
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

/**
 * Retención de snapshots (ADR-011, `02 §5.1`). La prueba que importa **no** es que borre, sino que
 * **no borre lo que no debe**: las últimas N revisiones de cada documento, nada de los últimos N días
 * y —sobre todo— ninguna revisión que respalde un `tpl_release`, activo o no.
 */
class SnapshotRetentionJobTest : EditorTestSupport() {

    @Autowired private lateinit var editor: EditorDocumentService
    @Autowired private lateinit var releases: ReleaseService
    @Autowired private lateinit var retention: SnapshotRetention

    private val slug = "prueba-retencion"
    private var customerId = 0L
    private var invitationId = 0L

    @BeforeEach
    fun preparar() {
        limpiarPlantilla(slug)
        registrarVersion(paqueteBase(slug))
        customerId = nuevoCliente()
        invitationId = nuevaInvitacion(customerId)
        editor.chooseTemplate(customerId, invitationId, json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""))
    }

    @AfterEach
    fun limpiar() {
        limpiarInvitacion(invitationId)
        limpiarCliente(customerId)
        limpiarPlantilla(slug)
    }

    @Test
    fun `con la configuracion real no borra nada de un documento recien editado`() {
        repeat(4) { i -> escribir(i.toLong(), "texto-$i", "b_ret_a$i") }
        val antes = snapshots()

        // 30 días / 200 revisiones, los valores de ADR-011.
        val borradas = job(dias = 30, retenidas = 200).purgar()

        assertEquals(0, borradas, "nada tiene 30 días ni sobra de las últimas 200")
        assertEquals(antes, snapshots())
    }

    @Test
    fun `purga solo lo que queda fuera de la ventana de revisiones`() {
        repeat(5) { i -> escribir(i.toLong(), "texto-$i", "b_ret_b$i") } // revisiones 0..5

        // Ventana de 2 revisiones y sin espera de días: sobran 0, 1, 2 y 3.
        val borradas = job(dias = 0, retenidas = 2).purgar()

        assertEquals(4, borradas)
        assertEquals(listOf(4L, 5L), revisionesVivas())
    }

    /**
     * ADR-011, la parte que no se puede romper: un release —activo **o despublicado**— es inmutable y
     * auditable, así que la revisión que publicó tiene que seguir teniendo snapshot.
     */
    @Test
    fun `nunca borra la revision que respalda un release, ni siquiera si ya se despublico`() {
        escribir(0, "Ana y Luis", "b_ret_c0") // revisión 1: la que se publica
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        repeat(4) { i -> escribir((i + 1).toLong(), "texto-$i", "b_ret_c${i + 1}") } // revisiones 2..5

        val borradas = job(dias = 0, retenidas = 2).purgar()

        assertTrue(revisionesVivas().contains(1L), "la revisión publicada no puede desaparecer")
        assertEquals(listOf(1L, 4L, 5L), revisionesVivas())
        assertEquals(3, borradas, "solo 0, 2 y 3 son purgables")

        // Y sigue protegida tras despublicar: la fila del release permanece (03 §3.13).
        releases.unpublish(customerId, invitationId)
        job(dias = 0, retenidas = 2).purgar()
        assertTrue(revisionesVivas().contains(1L), "un release histórico sigue siendo auditable")
    }

    @Test
    fun `no toca los snapshots de OTRO documento`() {
        val otra = nuevaInvitacion(customerId)
        try {
            editor.chooseTemplate(
                customerId, otra,
                json("""{"templateSlug":"$slug","templateVersion":"1.0.0"}"""),
            )
            repeat(3) { i -> escribirEn(otra, i.toLong(), "otro-$i", "b_ret_d$i") }
            repeat(3) { i -> escribir(i.toLong(), "texto-$i", "b_ret_e$i") }

            // Ventana amplia para el otro documento: 4 revisiones (0..3) y `retenidas = 4`.
            job(dias = 0, retenidas = 4).purgar()

            assertEquals(4, contarSnapshots(otra), "el otro documento conserva sus 4 revisiones")
        } finally {
            limpiarInvitacion(otra)
        }
    }

    @Test
    fun `tpl_release nunca se purga`() {
        escribir(0, "Ana y Luis", "b_ret_f0")
        releases.publish(customerId, invitationId, json("""{"baseRevision":1}"""))
        job(dias = 0, retenidas = 1).purgar()
        assertEquals(1L, contar("SELECT count(*) FROM tpl_release WHERE invitation_id = ?", invitationId))
    }

    // ---------------------------------------------------------------------------------------------

    private fun job(dias: Int, retenidas: Int) = SnapshotRetentionJob(retention, dias, retenidas, lote = 5000)

    private fun escribir(base: Long, texto: String, lote: String) = escribirEn(invitationId, base, texto, lote)

    private fun escribirEn(invitacion: Long, base: Long, texto: String, lote: String) {
        editor.applyOperations(
            customerId, invitacion,
            json(
                """{"baseRevision":$base,"clientBatchId":"$lote","operations":[
                   {"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"$texto"}}]}""",
            ),
        )
    }

    private fun snapshots(): Long = contarSnapshots(invitationId)

    private fun contarSnapshots(invitacion: Long): Long = contar(
        "SELECT count(*) FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
            "WHERE d.invitation_id = ?",
        invitacion,
    )

    private fun revisionesVivas(): List<Long> = PgTestCluster.newConnection().use { c ->
        c.autoCommit = true
        c.prepareStatement(
            "SELECT s.revision FROM tpl_document_snapshot s JOIN tpl_document d ON d.id = s.document_id " +
                "WHERE d.invitation_id = ? ORDER BY s.revision",
        ).use { ps ->
            ps.setLong(1, invitationId)
            ps.executeQuery().use { rs ->
                val salida = mutableListOf<Long>()
                while (rs.next()) salida.add(rs.getLong(1))
                salida
            }
        }
    }
}
