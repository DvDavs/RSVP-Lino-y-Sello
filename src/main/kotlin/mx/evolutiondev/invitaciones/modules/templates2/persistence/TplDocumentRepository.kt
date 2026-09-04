package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/**
 * `tpl_document` (`02 §7.4`). Los métodos nativos reciben el `doc` ya serializado como texto JSON
 * (`Templates2Json.canonical(node)` en la capa de servicio, no aquí — este repositorio no conoce el
 * dominio) y lo castean con `CAST(:doc AS jsonb)`: pasar un `JsonNode` como parámetro posicional de una
 * `@Query(nativeQuery = true)` no tiene un camino de conversión fiable en Hibernate 6.6 sin registrar
 * un `UserType` adicional, que `02 §8.1` prohíbe explícitamente ("sin dependencias nuevas").
 */
@Repository
interface TplDocumentRepository : JpaRepository<TplDocumentEntity, Long> {

    fun findByInvitationId(invitationId: Long): TplDocumentEntity?

    fun findByPublicToken(publicToken: String): TplDocumentEntity?

    /**
     * `INSERT … ON CONFLICT (invitation_id) DO NOTHING` (`02 §2` V32, decisión X-07): **el único**
     * camino de creación desde la API es `:choose-template`; lo llama exclusivamente ese flujo, nunca
     * un `GET`. Tras esta llamada, el creador hace un `findByInvitationId` propio para leer la fila
     * (ganadora o preexistente) — la exclusión la da el índice único `uq_tpl_document_invitation`, no
     * un lock en memoria (mata H-44).
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = """
            INSERT INTO tpl_document (invitation_id, template_version_id, doc, doc_bytes, public_token)
            VALUES (:invitationId, :templateVersionId, CAST(:doc AS jsonb), :docBytes, :publicToken)
            ON CONFLICT (invitation_id) DO NOTHING
        """,
        nativeQuery = true,
    )
    fun insertIfAbsent(
        @Param("invitationId") invitationId: Long,
        @Param("templateVersionId") templateVersionId: Long,
        @Param("doc") doc: String,
        @Param("docBytes") docBytes: Int,
        @Param("publicToken") publicToken: String,
    ): Int

    /** `SELECT … FOR UPDATE` (`02 §11.2`): abre la transacción de publicación para que ningún
     * `OperationBatch` concurrente pueda colarse entre "leo la revisión" y "escribo el release". */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from TplDocumentEntity d where d.invitationId = :invitationId")
    fun lockByInvitationId(@Param("invitationId") invitationId: Long): TplDocumentEntity?

    /**
     * Escritura optimista de `revision` (ADR-014, `02 §2` V32): `WHERE id = ? AND revision = ?`.
     * Devuelve las filas afectadas — **0 significa `409 TPL_REVISION_CONFLICT`**, responsabilidad de
     * quien llama, no de este repositorio (`templates2.persistence` no lanza excepciones de API).
     */
    @Modifying(clearAutomatically = true)
    @Query(
        value = """
            UPDATE tpl_document
            SET doc = CAST(:doc AS jsonb), doc_bytes = :docBytes, revision = revision + 1,
                updated_at = now(), updated_by = :updatedBy
            WHERE id = :id AND revision = :expectedRevision
        """,
        nativeQuery = true,
    )
    fun applyRevision(
        @Param("id") id: Long,
        @Param("doc") doc: String,
        @Param("docBytes") docBytes: Int,
        @Param("expectedRevision") expectedRevision: Long,
        @Param("updatedBy") updatedBy: Long?,
    ): Int

    /** Revocar un enlace filtrado (`03 §3.10`, ADR-1R-B-05): cambia `public_token` sin tocar
     * `revision` ni `doc`. Devuelve las filas afectadas (0 si el `id` no existe). */
    @Modifying(clearAutomatically = true)
    @Query(value = "UPDATE tpl_document SET public_token = :newPublicToken WHERE id = :id", nativeQuery = true)
    fun rotatePublicToken(@Param("id") id: Long, @Param("newPublicToken") newPublicToken: String): Int
}
