package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId

/**
 * `AssetId → URL pública`, **puro**: recibe el mapa `assetId → (bucket, key)` ya cargado desde
 * `tpl_asset` y construye la URL por patrón, **sin llamar a S3** (`02 §7.3` y `§10.4`). Componer no
 * puede depender de la disponibilidad de S3: R6 exige que `compose` sea pura y sin E/S.
 *
 * **AVISO (objeción O-06 de `bitacora/2-0a-REV.md`).** Los golden de `golden/templates/` se
 * generaron con `url = cdn + assetId.slice(3) + ".webp"`. Eso es una **convención de fixture** de la
 * ronda 1R, NO la regla de producción: llevarla aquí rompería todo asset cuya clave S3 no sea
 * `<ULID>.webp`, que son todas las reales (`templates2/invitation/{id}/{sha256}.{ext}`, `02 §10.1`).
 * Por eso el `AssetIndex` de cada golden se emite ahora como **dato** (`assets.json`) y este resolutor
 * deriva la URL **de la clave almacenada**, nunca del `assetId`.
 */
object AssetUrlResolver {

    /** Fila de `tpl_asset` reducida a lo que hace falta para construir la URL (`02 §2` V31). */
    data class StoredAsset(
        val bucket: String,
        val s3Key: String,
        val width: Int? = null,
        val height: Int? = null,
    )

    /**
     * `"{publicBaseUrl}/{s3_key}"`. `publicBaseUrl` es `templates2.assets.public-base-url`, cuyo valor
     * por defecto es `https://{bucket}.s3.{aws.region}.amazonaws.com` (`02 §10.4`); se pasa ya
     * resuelto para que esta función no lea configuración y siga siendo pura.
     */
    fun url(publicBaseUrl: String, asset: StoredAsset): String =
        publicBaseUrl.trimEnd('/') + "/" + asset.s3Key.trimStart('/')

    /**
     * Construye el `AssetIndex` que `compose` recibe como cuarto parámetro (ADR-1R-D-01). La URL debe
     * ser **estable** (CDN sin token): una URL firmada cambiaría el `contentHash` en cada petición
     * (`01 §5.5`). Si hace falta firmar, se firma después de calcular el hash, en la capa HTTP.
     */
    fun index(publicBaseUrl: String, almacenados: Map<AssetId, StoredAsset>): AssetIndex =
        almacenados.mapValues { (_, a) -> ResolvedAsset(url(publicBaseUrl, a), a.width, a.height) }
}
