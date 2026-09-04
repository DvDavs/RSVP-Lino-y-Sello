package mx.evolutiondev.invitaciones.modules.templates2.persistence

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.PublicToken
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * Resultado de una escritura optimista sobre `tpl_document` (`02 §7.4`).
 *
 * `persistence` **no lanza excepciones de API**: devuelve un resultado tipado y la capa `api` decide el
 * `TplErrorCode` (misma frontera que documenta `TplDocumentRepository.applyRevision`). Así este
 * paquete no importa nada de `api` y la dependencia no se invierte.
 */
sealed interface DocumentWrite {
    /** El `UPDATE … WHERE revision = ?` afectó una fila; [revision] es la nueva. */
    data class Applied(val revision: Long, val snapshotId: Long) : DocumentWrite

    /** 0 filas afectadas: otra pestaña escribió antes → `409 TPL_REVISION_CONFLICT` (ADR-014). */
    data class Conflict(val currentRevision: Long?) : DocumentWrite

    /** El documento serializado supera `ck_tpl_document_doc_bytes` → `422 TPL_DOCUMENT_TOO_LARGE`. */
    data class TooLarge(val bytes: Int, val limit: Int) : DocumentWrite
}

/** Alta del documento de trabajo. `created = false` = ya existía (`ON CONFLICT DO NOTHING`). */
data class DocumentCreation(val document: TplDocumentEntity, val created: Boolean)

/**
 * Operaciones **transaccionales** sobre `tpl_document` y sus snapshots (`02 §7.4`): crear (solo desde
 * `:choose-template`, decisión X-07), aplicar un lote, restaurar y cambiar de plantilla.
 *
 * Tres reglas que este almacén hace cumplir y que nadie más debería repetir:
 *
 * 1. **El `UPDATE` del documento y el `INSERT` del snapshot van en la misma transacción** (`03 §3.4`
 *    punto 7). Por eso los métodos de escritura son `@Transactional` y hacen las dos cosas: separarlos
 *    dejaría revisiones sin snapshot, y con ellas se cae el undo del servidor y la idempotencia del
 *    lote, que se apoya en `ux_tpl_document_snapshot_batch`.
 * 2. **El tamaño se comprueba antes del `UPDATE`** (`02 §2` V32): el `CHECK ≤ 1 MiB` de la base es la
 *    red de seguridad, no el mensaje de error. Sin esto, rebasar el tope saldría como una
 *    `DataIntegrityViolationException` cruda en vez de `422 TPL_DOCUMENT_TOO_LARGE`.
 * 3. **El `doc` viaja serializado con [Templates2Json.canonical]**, nunca con `toString()` de Jackson:
 *    los hashes y las comparaciones del módulo se calculan sobre el JSON canónico de la aplicación,
 *    porque `jsonb` reordena las claves (ADR-1R-B-07).
 */
@Service
class DocumentStore(
    private val documents: TplDocumentRepository,
    private val editorDocuments: TplDocumentEditorRepository,
    private val snapshots: TplDocumentSnapshotRepository,
    private val snapshotQueries: TplDocumentSnapshotQueryRepository,
    private val publicTokens: PublicTokenGenerator,
) {

    @Transactional(readOnly = true)
    fun find(invitationId: Long): TplDocumentEntity? = documents.findByInvitationId(invitationId)

    /** `SELECT … FOR UPDATE` (`02 §11.2`); exige transacción abierta por el llamador. */
    @Transactional
    fun lock(invitationId: Long): TplDocumentEntity? = documents.lockByInvitationId(invitationId)

    /**
     * `INSERT … ON CONFLICT (invitation_id) DO NOTHING` + `SELECT` (`02 §11.5`): la exclusión la da el
     * índice único, no un lock en memoria (mata H-44). El `public_token` lo acuña
     * [PublicTokenGenerator] con `SecureRandom`, **no** el ULID monótono (ADR-2-ORQ-01).
     *
     * Si la fila se crea, deja además el snapshot de la revisión 0 con `origin = 'choose_template'`:
     * sin él, `restore` no podría volver al documento recién creado y el historial empezaría en 1.
     */
    @Transactional
    fun createIfAbsent(
        invitationId: Long,
        templateVersionId: Long,
        doc: JsonNode,
        createdBy: Long?,
    ): DocumentCreation {
        val texto = Templates2Json.canonical(doc)
        val bytes = texto.toByteArray(Charsets.UTF_8).size
        if (bytes > MAX_DOC_BYTES) {
            // Inalcanzable con `content = {}` y ≤ 16 secciones, pero el `CHECK` de la base saldría
            // como una violación de integridad cruda; esto lo convierte en un fallo con nombre (P1).
            throw Templates2Exception.Internal(
                "el documento inicial de invitation_id=$invitationId ocupa $bytes B, por encima de $MAX_DOC_BYTES",
            )
        }
        val filas = documents.insertIfAbsent(
            invitationId = invitationId,
            templateVersionId = templateVersionId,
            doc = texto,
            docBytes = bytes,
            publicToken = publicTokens.next().value,
        )
        val entidad = documents.findByInvitationId(invitationId)
            ?: throw Templates2Exception.Internal(
                "tpl_document de invitation_id=$invitationId no existe tras INSERT … ON CONFLICT DO NOTHING",
            )
        if (filas == 1) {
            snapshots.save(
                TplDocumentSnapshotEntity(
                    documentId = entidad.id,
                    revision = 0,
                    doc = doc,
                    clientBatchId = null,
                    origin = ORIGEN_CHOOSE_TEMPLATE,
                    createdBy = createdBy,
                ),
            )
        }
        return DocumentCreation(entidad, filas == 1)
    }

    /**
     * Escritura optimista + snapshot, en una transacción (`03 §3.4` puntos 5 y 7).
     *
     * @param templateVersionId no nulo solo cuando la escritura **cambia de versión o de plantilla**
     *   (`:choose-template`): entonces el `UPDATE` mueve `template_version_id` y `doc` a la vez.
     * @param clientBatchId clave de idempotencia del lote (`ux_tpl_document_snapshot_batch`); `null`
     *   para `choose_template` y `restore`, que no son reintentables por diseño (`03 §8`).
     */
    @Transactional
    fun applyRevision(
        documentId: Long,
        expectedRevision: Long,
        doc: JsonNode,
        origin: String,
        clientBatchId: String? = null,
        updatedBy: Long? = null,
        templateVersionId: Long? = null,
    ): DocumentWrite {
        val texto = Templates2Json.canonical(doc)
        val bytes = texto.toByteArray(Charsets.UTF_8).size
        if (bytes > MAX_DOC_BYTES) return DocumentWrite.TooLarge(bytes, MAX_DOC_BYTES)

        val filas = if (templateVersionId == null) {
            documents.applyRevision(documentId, texto, bytes, expectedRevision, updatedBy)
        } else {
            editorDocuments.applyRevisionWithVersion(
                documentId, texto, bytes, templateVersionId, expectedRevision, updatedBy,
            )
        }
        if (filas == 0) {
            val actual = documents.findById(documentId).orElse(null)?.revision
            return DocumentWrite.Conflict(actual)
        }
        val nueva = expectedRevision + 1
        val snapshot = snapshots.save(
            TplDocumentSnapshotEntity(
                documentId = documentId,
                revision = nueva,
                doc = doc,
                clientBatchId = clientBatchId,
                origin = origin,
                createdBy = updatedBy,
            ),
        )
        return DocumentWrite.Applied(nueva, snapshot.id)
    }

    /** Revocar un enlace filtrado (`03 §3.10`): token nuevo, `revision` y `doc` intactos. */
    @Transactional
    fun rotatePublicToken(documentId: Long): PublicToken {
        val nuevo = publicTokens.next()
        val filas = documents.rotatePublicToken(documentId, nuevo.value)
        if (filas == 0) throw Templates2Exception.Internal("tpl_document.id=$documentId no existe al rotar el token")
        return nuevo
    }

    // ---------------------------------------------------------------------------------------------
    // Snapshots
    // ---------------------------------------------------------------------------------------------

    /** Idempotencia real del lote (`03 §3.4` punto 6): ¿este `clientBatchId` ya produjo revisión? */
    @Transactional(readOnly = true)
    fun snapshotOfBatch(documentId: Long, clientBatchId: String): TplDocumentSnapshotEntity? =
        snapshots.findByDocumentIdAndClientBatchId(documentId, clientBatchId)

    /** Las snapshots se resuelven **siempre** por `document_id` derivado del `invitationId` ya
     * autorizado (`03 §9.2`, fila "Restaurar la revisión de otro documento"). */
    @Transactional(readOnly = true)
    fun snapshot(documentId: Long, revision: Long): TplDocumentSnapshotEntity? =
        snapshots.findByDocumentIdAndRevision(documentId, revision)

    /** Historial descendente (`03 §3.5`). `cursor` es la revisión desde la que seguir, inclusive. */
    @Transactional(readOnly = true)
    fun history(
        documentId: Long,
        limit: Int,
        cursor: Long?,
        clientBatchId: String?,
    ): List<TplDocumentSnapshotEntity> {
        val pagina = PageRequest.of(0, limit)
        return when {
            clientBatchId != null ->
                snapshotQueries.findByDocumentIdAndClientBatchIdOrderByRevisionDesc(documentId, clientBatchId, pagina)
            cursor != null ->
                snapshotQueries.findByDocumentIdAndRevisionLessThanEqualOrderByRevisionDesc(documentId, cursor, pagina)
            else -> snapshotQueries.findByDocumentIdOrderByRevisionDesc(documentId, pagina)
        }
    }

    companion object {
        /** `ck_tpl_document_doc_bytes` (`02 §2` V32). */
        const val MAX_DOC_BYTES = 1_048_576

        /** Valores de `ck_tpl_document_snapshot_origin` que este bloque escribe (`02 §2` V33). */
        const val ORIGEN_OPERATIONS = "operations"
        const val ORIGEN_CHOOSE_TEMPLATE = "choose_template"
        const val ORIGEN_RESTORE = "restore"
    }
}
