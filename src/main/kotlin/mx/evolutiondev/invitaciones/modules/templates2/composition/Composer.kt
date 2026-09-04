package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage

/**
 * Asset ya resuelto: la URL **pública y estable** más las dimensiones si se conocen. Espejo de
 * `composed.ts` `AssetIndex`.
 *
 * La URL no puede llevar firma temporal (`01 §5.5`): el `contentHash` se calcula sobre la salida de
 * `compose`, así que una URL firmada cambiaría el `ETag` en cada petición y la caché del render
 * público dejaría de servir. Si hiciera falta firmar, se firma **después** de calcular el hash.
 */
data class ResolvedAsset(val url: String, val width: Int? = null, val height: Int? = null)

/**
 * `assetId → asset resuelto`. Es una **ENTRADA** de `compose`, nunca parte del `ComposedDocument`
 * (ADR-1R-D-01): dentro del documento compuesto las URL viajan ya resueltas en cada `ResolvedValue` y
 * ningún `assetId` sale al render público. El backend lo construye desde `tpl_asset` **antes** de
 * llamar, de modo que `compose` sigue siendo pura y sin E/S (R6).
 */
typealias AssetIndex = Map<AssetId, ResolvedAsset>

/**
 * Firma de `01 §5.1`. **`compose` NO lanza**: un documento inválido llega aquí ya rechazado por
 * `validateInvariants` (`03 §3.3`); todo lo que pueda salir mal en composición es una entrada del
 * `CompositionReport`.
 */
fun interface Composer {
    fun compose(
        pkg: TemplatePackage,
        doc: InvitationDocument,
        business: BusinessSnapshot,
        assets: AssetIndex,
        locale: Locale,
    ): CompositionResult
}
