package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

/**
 * `tpl_document_snapshot` (`02 §7.4`). `insertSnapshot` **no** es un método propio: es `save()`
 * (heredado de `JpaRepository`), documentado aquí porque `02 §7.4` lo nombra — un `INSERT` plano no
 * necesita `ON CONFLICT`, y la idempotencia del lote la da `ux_tpl_document_snapshot_batch`
 * directamente: un `INSERT` que la viola lanza `DataIntegrityViolationException`, que la capa de
 * servicio traduce a "200 con la revisión ya producida" (`02 §2` V33, objeción B-03).
 */
@Repository
interface TplDocumentSnapshotRepository : JpaRepository<TplDocumentSnapshotEntity, Long> {

    fun findByDocumentIdAndRevision(documentId: Long, revision: Long): TplDocumentSnapshotEntity?

    /** Detecta el reenvío del mismo lote (`ux_tpl_document_snapshot_batch`) sin esperar a la
     * violación de índice — usado para decidir el `200 {applied:false, revision:…}` de `03 §3.3`. */
    fun findByDocumentIdAndClientBatchId(documentId: Long, clientBatchId: String): TplDocumentSnapshotEntity?

    fun findByDocumentIdOrderByRevisionDesc(documentId: Long, pageable: Pageable): Page<TplDocumentSnapshotEntity>
}
