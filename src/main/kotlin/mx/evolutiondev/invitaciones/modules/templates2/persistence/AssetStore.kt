package mx.evolutiondev.invitaciones.modules.templates2.persistence

import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import mx.evolutiondev.invitaciones.core.s3.S3Service
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.net.URL
import java.time.Duration
import org.springframework.stereotype.Repository as SpringRepository

/**
 * Listado paginado de los assets de una invitación (`03 §3.8`). Interfaz nueva sobre la entidad ya
 * existente, igual que `TplAssetEditorRepository` (2-4) y `TplTemplateVersionQueryRepository` (2-3):
 * `handoffs/2-1.md` prohíbe modificar los repositorios entregados y Spring Data admite varias
 * interfaces sobre la misma entidad sin ambigüedad.
 *
 * No declara `@Transactional`: la abre [AssetStore].
 */
@SpringRepository
interface TplAssetStoreRepository : JpaRepository<TplAssetEntity, Long> {

    fun findByInvitationIdOrderByCreatedAtDescIdDesc(invitationId: Long, pageable: Pageable): List<TplAssetEntity>

    fun findByPublicIdAndInvitationId(publicId: String, invitationId: Long): TplAssetEntity?
}

/**
 * Puerta única a S3 para los assets **de una invitación** (`02 §10.1`), hermana de
 * `catalog.TemplateAssetStorage` y por las mismas dos razones, ninguna estética: `R-S3-1` obliga a
 * subir el objeto **antes** de abrir la transacción, así que hay que poder ejercitar el fallo parcial
 * (`02 §10.5`), y las pruebas de este módulo corren contra PostgreSQL real pero **sin** credenciales
 * de AWS.
 *
 * No duplica `S3Service`: [S3InvitationAssetStorage] delega en él.
 */
interface InvitationAssetStorage {

    /** Sube el objeto. Cualquier fallo sale como una excepción del llamador, nunca en silencio. */
    fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String)

    /**
     * URL firmada de **15 minutos** (`03 §3.7`). La duración se pasa explícitamente porque el valor
     * por defecto de `S3Service.generatePresignedUrl` es **7 días** (`S3Service.kt:33`), que como "URL
     * de corta duración" es sencillamente falso.
     */
    fun previewUrl(bucket: String, key: String, duracion: Duration): String

    /** Borrado diferido del objeto; lo llama [AssetGcJob] leyendo la cola, nunca la ruta HTTP. */
    fun delete(bucket: String, key: String)
}

/** Implementación real sobre `core/s3/S3Service` (`S3Service.kt:21-69`), sin duplicar nada. */
@Service
class S3InvitationAssetStorage(private val s3: S3Service) : InvitationAssetStorage {

    override fun upload(bucket: String, key: String, bytes: ByteArray, contentType: String) {
        s3.uploadPublicFile(bucket, key, bytes, contentType)
    }

    override fun previewUrl(bucket: String, key: String, duracion: Duration): String =
        url(s3.generatePresignedUrl(bucket, key, duracion))

    override fun delete(bucket: String, key: String) {
        s3.deleteFile(bucket, key)
    }

    private fun url(u: URL): String = u.toString()
}

/**
 * Escrituras y consultas transaccionales sobre `tpl_asset` (`02 §7.4`).
 *
 * **Las dos reglas de S3 de `02 §10` viven aquí, no en el controlador:**
 *
 * - **R-S3-1, al crear**: primero el objeto en S3 y después la fila. Un objeto sin fila es basura
 *   barata y determinista (la clave se deriva del `sha256`, así que el reintento reescribe **el
 *   mismo** objeto); una fila sin objeto es una imagen rota en una invitación publicada. Por eso
 *   [registrar] **solo** escribe la fila: subir es cosa del servicio, antes de llamar aquí.
 * - **R-S3-2, al borrar**: primero la fila, dentro de la transacción; el objeto después, fuera, por la
 *   cola. Borrar en S3 antes del commit deja rotas las invitaciones si la transacción se revierte. El
 *   `DELETE` de [borrar] dispara `trg_tpl_asset_gc` (`02 §2` V37), que encola la clave; ninguna ruta
 *   inserta en `tpl_asset_gc` a mano.
 */
@Service
class AssetStore(
    private val assets: TplAssetRepository,
    private val consultas: TplAssetStoreRepository,
    @PersistenceContext private val entityManager: EntityManager,
) {

    @Transactional(readOnly = true)
    fun porContenido(invitationId: Long, sha256: String): TplAssetEntity? =
        assets.findByInvitationIdAndSha256(invitationId, sha256)

    /** Cuota **blanda** de `02 §10.1` paso 6: dos subidas simultáneas pueden dejar 201 (asumido). */
    @Transactional(readOnly = true)
    fun cuantos(invitationId: Long): Long = assets.countByInvitationId(invitationId)

    @Transactional(readOnly = true)
    fun listar(invitationId: Long, pageable: Pageable): List<TplAssetEntity> =
        consultas.findByInvitationIdOrderByCreatedAtDescIdDesc(invitationId, pageable)

    /**
     * Búsqueda por `publicId` **filtrada por invitación** (`03 §9.2` fila 4): un `assetId` de otra
     * invitación no se distingue de uno inexistente, ni aquí ni en la respuesta.
     */
    @Transactional(readOnly = true)
    fun propio(invitationId: Long, publicId: String): TplAssetEntity? =
        consultas.findByPublicIdAndInvitationId(publicId, invitationId)

    /** Paso 9 de `02 §10.1`: la fila, ya con el objeto en S3. */
    @Transactional
    @Suppress("LongParameterList")
    fun registrar(
        invitationId: Long,
        publicId: String,
        bucket: String,
        s3Key: String,
        sha256: String,
        contentType: String,
        bytes: Long,
        width: Int?,
        height: Int?,
        createdBy: Long?,
    ): TplAssetEntity = assets.saveAndFlush(
        TplAssetEntity(
            publicId = publicId,
            invitationId = invitationId,
            templateVersionId = null,
            bucket = bucket,
            s3Key = s3Key,
            sha256 = sha256,
            contentType = contentType,
            bytes = bytes,
            width = width,
            height = height,
            createdBy = createdBy,
        ),
    )

    /** `03 §3.9`: la fila se borra dentro de la transacción y el trigger encola la clave de S3. */
    @Transactional
    fun borrar(asset: TplAssetEntity) {
        assets.delete(asset)
        assets.flush()
    }

    /**
     * ¿Lo referencia algún `tpl_release` de esta invitación (`03 §3.8`, `§3.9`)?
     *
     * Se busca la **`s3_key`** dentro de `composed`, no el `assetId`: `ResolvedImage`/`ResolvedAudio`
     * llevan la URL ya resuelta y **no** el `assetId` (`composed.ts`; la URL es
     * `{public-base-url}/{s3_key}`, `02 §10.4`), así que la clave es el único rastro que el asset deja
     * en un release. La clave contiene el `sha256`, de modo que la coincidencia no es ambigua.
     *
     * Un release es inmutable y tiene que seguir renderizando aunque el cliente ya no use la imagen en
     * el documento vigente: por eso esta comprobación mira **todos** los releases, activos o no.
     */
    @Transactional(readOnly = true)
    fun referenciadoPorAlgunRelease(invitationId: Long, s3Key: String): Boolean =
        referenciadosPorReleases(invitationId, listOf(s3Key)).isNotEmpty()

    /**
     * La misma pregunta para una página entera de assets, en **una sola** consulta: `GET …/assets`
     * devuelve hasta 100 filas y una consulta por fila convertiría un listado en una tormenta.
     *
     * Las claves viajan unidas por coma y se parten en SQL con `string_to_array`; una `s3_key` de
     * `Templates2S3KeyService` es `templates2/invitation/{id}/{sha256}.{ext}` y **no puede contener una
     * coma**, así que la unión es reversible sin ambigüedad.
     */
    @Transactional(readOnly = true)
    fun referenciadosPorReleases(invitationId: Long, s3Keys: List<String>): Set<String> {
        if (s3Keys.isEmpty()) return emptySet()
        val filas = entityManager
            .createNativeQuery(SQL_REFERENCIADOS)
            .setParameter("invitationId", invitationId)
            .setParameter("claves", s3Keys.joinToString(SEPARADOR))
            .resultList
        return filas.mapNotNull { it?.toString() }.toSet()
    }

    companion object {
        /** `03 §8`: cuota blanda de 200 assets por invitación. */
        const val CUOTA_POR_INVITACION = 200

        private const val SEPARADOR = ","

        private val SQL_REFERENCIADOS = """
            SELECT k FROM unnest(string_to_array(:claves, '$SEPARADOR')) AS k
            WHERE EXISTS (
                SELECT 1 FROM tpl_release r
                WHERE r.invitation_id = :invitationId AND strpos(r.composed::text, k) > 0
            )
        """.trimIndent()
    }
}
