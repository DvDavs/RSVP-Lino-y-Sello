package mx.evolutiondev.invitaciones.modules.templates2.persistence

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

/**
 * `tpl_asset_gc` (`02 §7.4`, `02 §10.3`). Ninguna ruta de la aplicación hace `INSERT` sobre esta
 * tabla: la alimenta **exclusivamente** el trigger `trg_tpl_asset_gc` (`02 §2` V37). `pollPending`
 * toma `pageable` en vez de un `Int` de límite porque Spring Data ya resuelve `LIMIT`/`OFFSET` a partir
 * de un `Pageable`; el llamador construye `PageRequest.of(0, 500)` (el tamaño de lote de `AssetGcJob`,
 * `02 §10.3`).
 */
@Repository
interface TplAssetGcRepository : JpaRepository<TplAssetGcEntity, Long> {

    @Query("select g from TplAssetGcEntity g where g.deletedAt is null order by g.enqueuedAt asc")
    fun pollPending(pageable: Pageable): List<TplAssetGcEntity>

    @Modifying(clearAutomatically = true)
    @Query("update TplAssetGcEntity g set g.deletedAt = CURRENT_TIMESTAMP where g.id = :id")
    fun markDeleted(@Param("id") id: Long): Int

    @Modifying(clearAutomatically = true)
    @Query("update TplAssetGcEntity g set g.attempts = g.attempts + 1, g.lastError = :error where g.id = :id")
    fun markFailed(@Param("id") id: Long, @Param("error") error: String): Int
}
