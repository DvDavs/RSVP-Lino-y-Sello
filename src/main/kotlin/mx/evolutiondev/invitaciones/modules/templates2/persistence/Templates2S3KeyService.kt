package mx.evolutiondev.invitaciones.modules.templates2.persistence

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import org.springframework.stereotype.Service

/**
 * Claves S3 **deterministas por contenido** de `02 §10.1`/`§10.2`:
 *
 * - asset de plantilla: `templates2/template/{slug}/{version}/{sha256}.{ext}`
 * - asset de invitación: `templates2/invitation/{invitationId}/{sha256}.{ext}`
 *
 * Determinista importa: un reintento tras un fallo reescribe **el mismo objeto**, así que un registro
 * revertido no acumula copias huérfanas (`02 §4` paso 8, `§10.5`).
 *
 * **No** reutiliza `core/s3/S3KeyService.generateInvitationAssetKey` (objeción B-09 de `02 §14`): esa
 * clave incluye un `UUID` aleatorio y perdería la idempotencia por contenido.
 */
@Service
class Templates2S3KeyService {

    fun templateAssetKey(slug: String, version: String, sha256: String, contentType: AssetContentType): String =
        "$PREFIJO/template/$slug/$version/$sha256.${extension(contentType)}"

    fun invitationAssetKey(invitationId: Long, sha256: String, contentType: AssetContentType): String =
        "$PREFIJO/invitation/$invitationId/$sha256.${extension(contentType)}"

    /** Prefijo que barre `AssetGcJob` en modo *scan* (`02 §10.3`). */
    fun templateVersionPrefix(slug: String, version: String): String = "$PREFIJO/template/$slug/$version/"

    fun extension(contentType: AssetContentType): String = when (contentType) {
        AssetContentType.IMAGE_WEBP -> "webp"
        AssetContentType.IMAGE_PNG -> "png"
        AssetContentType.IMAGE_JPEG -> "jpg"
        AssetContentType.IMAGE_SVG -> "svg"
        AssetContentType.AUDIO_MPEG -> "mp3"
        AssetContentType.FONT_WOFF2 -> "woff2"
    }

    companion object {
        const val PREFIJO = "templates2"
    }
}
