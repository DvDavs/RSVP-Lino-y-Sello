package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/** `tpl_asset` (`02 §7.4`). */
@Repository
interface TplAssetRepository : JpaRepository<TplAssetEntity, Long> {

    fun findByPublicId(publicId: String): TplAssetEntity?

    /** Idempotencia por contenido de la subida de assets del editor (`02 §10.1` paso 5,
     * `ux_tpl_asset_invitation_sha`). */
    fun findByInvitationIdAndSha256(invitationId: Long, sha256: String): TplAssetEntity?

    /** Idempotencia por contenido de los assets de un paquete de plantilla (`02 §10.2`,
     * `ux_tpl_asset_version_sha`). */
    fun findByTemplateVersionIdAndSha256(templateVersionId: Long, sha256: String): TplAssetEntity?

    /** Cuota blanda de `02 §10.1` paso 6 (≥ 200 → `409 TPL_ASSET_QUOTA_EXCEEDED`). */
    fun countByInvitationId(invitationId: Long): Long

    /** Verificación de pertenencia (ADR-030): `publicId` pertenece a la invitación o a la versión de
     * plantilla dados. Exactamente uno de los dos parámetros es no nulo en cada llamada, reflejo del
     * `CHECK ck_tpl_asset_owner` de la migración — no repetido aquí como regla, solo como condición de
     * búsqueda tolerante a que el otro llegue `null`. */
    @Query(
        "select (count(a) > 0) from TplAssetEntity a where a.publicId = :publicId " +
            "and ((:invitationId is not null and a.invitationId = :invitationId) " +
            "  or (:templateVersionId is not null and a.templateVersionId = :templateVersionId))",
    )
    fun existsOwned(
        @Param("publicId") publicId: String,
        @Param("invitationId") invitationId: Long?,
        @Param("templateVersionId") templateVersionId: Long?,
    ): Boolean
}
