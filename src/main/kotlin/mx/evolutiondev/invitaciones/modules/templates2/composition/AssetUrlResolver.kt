package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception

/**
 * `AssetId → URL pública`, **puro**: recibe el mapa `assetId → s3Key` ya cargado desde `tpl_asset` y
 * construye la URL por patrón, **sin llamar a S3** (`02 §7.3` y `§10.4`). Componer no puede depender
 * de la disponibilidad de S3: R6 exige que `compose` sea pura y sin E/S.
 *
 * **AVISO (objeción O-06 de `bitacora/2-0a-REV.md`).** Los golden de `golden/templates/` se
 * generaron con `url = cdn + assetId.slice(3) + ".webp"`. Eso es una **convención de fixture** de la
 * ronda 1R, NO la regla de producción: llevarla aquí rompería todo asset cuya clave S3 no sea
 * `<ULID>.webp`, que son todas las reales (`templates2/invitation/{id}/{sha256}.{ext}`, `02 §10.1`).
 * Por eso el `AssetIndex` de cada golden se emite ahora como **dato** (`assets.json`) y este resolutor
 * deriva la URL **de la clave almacenada**, nunca del `assetId`.
 *
 * **Bucket único (objeción ADV-10 de la revisión adversarial global, bloque 2-6).** `StoredAsset` ya
 * **no** transporta `bucket`. Antes lo llevaba, se cargaba desde `tpl_asset.bucket` y **no se leía
 * nunca**: la URL siempre salía de un `publicBaseUrl` global, así que una fila cuyo `bucket` no fuera
 * el configurado producía una URL rota **en silencio** — justo lo que P1 prohíbe, y la raíz que hizo
 * posible ADV-01. No se resolvió haciendo que `url()` usara el `bucket` de la fila porque
 * `templates2.assets.public-base-url` es, por contrato (`02 §10.4`), una **URL de CDN configurable**:
 * en cuanto apunta a un CDN, el nombre del bucket deja de aparecer en la URL y reconstruirla desde él
 * rompería precisamente el despliegue que la propiedad existe para permitir. El módulo asume, y ahora
 * **exige**, un bucket único; la comprobación es [almacenado] y falla en voz alta.
 */
object AssetUrlResolver {

    /**
     * Fila de `tpl_asset` reducida a lo que hace falta para construir la URL (`02 §2` V31). Lo que
     * NO está aquí es tan importante como lo que está: `bucket` se comprueba en [almacenado] y no
     * viaja, para que sea imposible volver a transportarlo sin usarlo.
     */
    data class StoredAsset(
        val s3Key: String,
        val width: Int? = null,
        val height: Int? = null,
    )

    /**
     * Única puerta de entrada desde una fila de `tpl_asset`: comprueba **en voz alta** que la fila
     * vive en el bucket que este módulo sabe direccionar y solo entonces construye [StoredAsset].
     *
     * Falla con `500 TPL_INTERNAL` en vez de devolver una URL que no resuelve. Es deliberado: el caso
     * solo puede darse por un error de operación (mover objetos de bucket, o cambiar
     * `templates2.assets.bucket` con filas ya escritas), y `contratos.md` P1 prohíbe descartar la
     * discrepancia en silencio. Una imagen rota dentro de un `composed` ya congelado en `tpl_release`
     * es indetectable; un `500` con la fila señalada, no. El mensaje no lleva dato de cliente: solo
     * el `assetId` público y los dos nombres de bucket.
     */
    fun almacenado(
        bucketEsperado: String,
        assetId: String,
        bucketDeLaFila: String,
        s3Key: String,
        width: Int? = null,
        height: Int? = null,
    ): StoredAsset {
        if (bucketDeLaFila != bucketEsperado) {
            throw Templates2Exception.Internal(
                "tpl_asset.public_id=$assetId está en el bucket \"$bucketDeLaFila\" y este módulo " +
                    "direcciona \"$bucketEsperado\": la URL pública no resolvería (02 §10.4, ADV-10)",
            )
        }
        return StoredAsset(s3Key, width, height)
    }

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
