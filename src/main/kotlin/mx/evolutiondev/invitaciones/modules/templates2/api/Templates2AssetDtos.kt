package mx.evolutiondev.invitaciones.modules.templates2.api

import com.fasterxml.jackson.annotation.JsonInclude
import java.time.Instant

/**
 * DTO de las rutas 7-9 de `03 §2` (assets del editor).
 *
 * **Ninguna lleva `s3Key` ni `bucket`.** El documento solo guarda `assetId` (ADR-021) y el cliente no
 * tiene por qué conocer la disposición del almacenamiento: publicarla le daría material para construir
 * URLs a mano y ataría el contrato a S3.
 */

/**
 * `03 §3.7`. `201` en una subida nueva; `200` con `reused = true` cuando ya existía un asset de esta
 * invitación con el mismo `sha256` — idempotencia **por contenido**, no por código de estado
 * (`ux_tpl_asset_invitation_sha`, `02 §2` V31).
 *
 * `previewUrl` es una URL **firmada de 15 minutos** y por eso nunca se persiste ni entra en el
 * documento: una URL firmada dentro de `composed` cambiaría el `contentHash` en cada petición y
 * rompería el `ETag` del render público (`01 §5.5`).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AssetUploadResponse(
    val assetId: String,
    val bytes: Long,
    val contentType: String,
    val sha256: String,
    val width: Int?,
    val height: Int?,
    val previewUrl: String,
    val reused: Boolean,
)

/**
 * Una fila de `GET …/assets` (`03 §3.8`).
 *
 * `referenced` responde a la única pregunta que el editor necesita antes de ofrecer el borrado: si el
 * `assetId` aparece hoy en `doc.content` (o en su `attic`) **o** en el `composed` de algún release de
 * esta invitación. Un asset referenciado por un release no se puede borrar aunque el documento ya no
 * lo use: el release es inmutable y tiene que seguir renderizando (`03 §3.9`).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AssetItemResponse(
    val assetId: String,
    val bytes: Long,
    val contentType: String,
    val width: Int?,
    val height: Int?,
    val createdAt: Instant?,
    val referenced: Boolean,
    val previewUrl: String,
)

/** `03 §3.8`. */
@JsonInclude(JsonInclude.Include.NON_NULL)
data class AssetListResponse(val items: List<AssetItemResponse>, val nextCursor: String?)
