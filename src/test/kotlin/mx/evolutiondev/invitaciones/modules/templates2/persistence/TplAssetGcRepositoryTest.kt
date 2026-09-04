package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.data.domain.PageRequest
import org.springframework.test.annotation.DirtiesContext
import org.springframework.transaction.annotation.Transactional
import jakarta.persistence.EntityManager

/**
 * `pollPending`/`markDeleted`/`markFailed` (`02 §7.4`, `02 §10.3`). Las filas las produce
 * exclusivamente el trigger `trg_tpl_asset_gc` (probado aparte en `AssetGcTriggerTest`); aquí se
 * insertan directamente por SQL para aislar el comportamiento de `AssetGcJob` sobre la cola.
 */
@Transactional
@DirtiesContext
class TplAssetGcRepositoryTest : SpringPersistenceTestSupport() {

    @Autowired lateinit var gcRepo: TplAssetGcRepository
    @Autowired lateinit var entityManager: EntityManager

    private fun enqueue(key: String): Long {
        @Suppress("UNCHECKED_CAST")
        val id = (entityManager.createNativeQuery(
            "INSERT INTO tpl_asset_gc (bucket, s3_key, public_id) VALUES ('b', :k, :p) RETURNING id",
        ).setParameter("k", key).setParameter("p", "as_" + "0".repeat(26)).singleResult as Number).toLong()
        entityManager.flush()
        return id
    }

    @Test
    fun `pollPending solo devuelve filas con deleted_at NULL, mas antiguas primero`() {
        val a = enqueue("k-a-" + System.nanoTime())
        Thread.sleep(2)
        val b = enqueue("k-b-" + System.nanoTime())
        gcRepo.markDeleted(a) // ya procesada: no debe salir en pollPending

        val pendientes = gcRepo.pollPending(PageRequest.of(0, 500))
        val ids = pendientes.map { it.id }
        assertTrue(b in ids)
        assertTrue(a !in ids, "una fila con deleted_at ya asignado no debe volver a poll-earse")
    }

    @Test
    fun `markDeleted fija deleted_at`() {
        val id = enqueue("k-deleted-" + System.nanoTime())
        val filas = gcRepo.markDeleted(id)
        assertEquals(1, filas)
        entityManager.clear()
        assertNotNull(gcRepo.findById(id).orElseThrow().deletedAt)
    }

    @Test
    fun `markFailed incrementa attempts y guarda last_error, sin fijar deleted_at`() {
        val id = enqueue("k-failed-" + System.nanoTime())
        gcRepo.markFailed(id, "S3 no disponible")
        gcRepo.markFailed(id, "S3 no disponible otra vez")
        entityManager.clear()

        val fila = gcRepo.findById(id).orElseThrow()
        assertEquals(2, fila.attempts)
        assertEquals("S3 no disponible otra vez", fila.lastError)
        assertEquals(null, fila.deletedAt)
    }
}
