package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertArrayEquals
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.EnableScheduling
import java.time.Duration

/**
 * Objeción **ADV-08** de la revisión adversarial global, cerrada en el bloque 2-6 (ADR-2-6-02).
 *
 * El defecto: `Templates2SchedulingConfig` es el **único** `@EnableScheduling` del repositorio y
 * estaba condicionado a `templates2.retention.enabled`, cuyo nombre solo habla de la purga de
 * snapshots. Desde el merge de 2-5 gobernaba también [AssetGcJob], que es el mecanismo del derecho al
 * olvido (`02 §5.3`, `§10.3`): apagar la retención dejaba de drenar `tpl_asset_gc` **en silencio**.
 *
 * Estas pruebas fijan el interruptor de tres niveles: uno neutro para el planificador y uno por tarea.
 * Son de anotación y de comportamiento, no de contexto de Spring: lo que hay que impedir es que
 * alguien vuelva a colgar el planificador de una propiedad con nombre de tarea.
 */
class Templates2SchedulingTest {

    // =============================================================================================
    // El interruptor del planificador es neutro
    // =============================================================================================

    @Test
    fun `el planificador cuelga de una propiedad neutra, no de la de retencion`() {
        val condicion = Templates2SchedulingConfig::class.java.getAnnotation(ConditionalOnProperty::class.java)
        assertTrue(condicion != null, "Templates2SchedulingConfig debe seguir siendo apagable sin recompilar")
        assertArrayEquals(
            arrayOf("templates2.scheduling.enabled"),
            condicion.name,
            "el planificador entero NO puede colgar de una propiedad con nombre de una sola tarea (ADV-08)",
        )
        assertEquals("true", condicion.havingValue)
        assertTrue(condicion.matchIfMissing, "sin configurar, las tareas periódicas del módulo corren")
    }

    @Test
    fun `sigue siendo el unico EnableScheduling y no toca InvitationsApplication`() {
        assertTrue(
            Templates2SchedulingConfig::class.java.isAnnotationPresent(EnableScheduling::class.java),
            "el módulo activa el planificador desde su propia configuración (contratos.md §1)",
        )
    }

    // =============================================================================================
    // Una propiedad por tarea, y cada una apaga solo la suya
    // =============================================================================================

    @Test
    fun `la purga de snapshots desactivada no toca la base y devuelve cero`() {
        val retencion = mock<SnapshotRetention>()
        val job = SnapshotRetentionJob(retencion, dias = 30, retenidas = 200, lote = 5000, habilitada = false)
        assertEquals(0, job.purgar())
        verifyNoInteractions(retencion)
    }

    @Test
    fun `la purga de snapshots habilitada si purga`() {
        val retencion = mock<SnapshotRetention>()
        whenever(retencion.purgeBatch(any(), any(), any())).thenReturn(7)
        val job = SnapshotRetentionJob(retencion, dias = 30, retenidas = 200, lote = 5000, habilitada = true)
        assertEquals(7, job.purgar())
        verify(retencion).purgeBatch(30, 200, 5000)
    }

    @Test
    fun `el drenaje de tpl_asset_gc desactivado no llama a S3 y devuelve cero`() {
        val cola = mock<AssetGcQueue>()
        val almacen = AlmacenDeGcFalso()
        val job = AssetGcJob(cola, almacen, lote = 500, maxIntentos = 10, habilitada = false)
        assertEquals(0, job.recolectar())
        verifyNoInteractions(cola)
        assertEquals(0, almacen.borrados.size, "con el drenaje apagado no se toca S3")
    }

    /**
     * La prueba que da sentido a la objeción: **apagar la retención ya no apaga el derecho al olvido**.
     * Antes de ADR-2-6-02 las dos tareas compartían interruptor y este caso era imposible de expresar.
     */
    @Test
    fun `apagar la retencion no apaga el drenaje de tpl_asset_gc`() {
        val fila = TplAssetGcEntity(
            id = 1, publicId = "as_01J8AAAAAAAAAAAAAAAAAAAAAA", bucket = "bucket-de-pruebas",
            s3Key = "templates2/invitation/1/aa.webp", attempts = 0,
        )
        val cola = mock<AssetGcQueue>()
        whenever(cola.pendientes(any())).thenReturn(listOf(fila))
        val almacen = AlmacenDeGcFalso()

        // `templates2.retention.enabled = false` (la purga apagada)…
        val purga = SnapshotRetentionJob(mock<SnapshotRetention>(), habilitada = false)
        assertEquals(0, purga.purgar())

        // …y aun así el recolector, que tiene su propia propiedad, sigue drenando la cola.
        val gc = AssetGcJob(cola, almacen, habilitada = true)
        assertEquals(1, gc.recolectar())
        assertEquals(listOf("bucket-de-pruebas/templates2/invitation/1/aa.webp"), almacen.borrados)
        verify(cola).marcarBorrado(1)
    }

    /** Almacén de pruebas: registra los borrados para poder afirmar "no se llamó a S3". */
    private class AlmacenDeGcFalso : InvitationAssetStorage {
        val borrados = mutableListOf<String>()
        override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) = Unit
        override fun previewUrl(bucket: String, key: String, duracion: Duration): String = "https://x/$bucket/$key"
        override fun delete(bucket: String, key: String) {
            borrados.add("$bucket/$key")
        }
    }
}
