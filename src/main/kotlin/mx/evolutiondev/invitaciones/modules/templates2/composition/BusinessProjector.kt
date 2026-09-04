package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedBoolean
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedDate
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedImage
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedTime
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedValue

/**
 * R4 de `01 §5.2`: los bloques con `source = "business"` toman su valor de `BusinessSnapshot` **por
 * rol declarado (`businessField`), nunca por posición**, y **`doc.content` no se consulta jamás** —
 * I-21 impide siquiera escribirlo.
 *
 * R5: si el manifiesto no declara bloque para un dato de negocio, ese dato no se renderiza. Nada se
 * fabrica: un campo nulo produce `provenance: "empty"`, nunca un valor inventado.
 */
object BusinessProjector {

    fun project(spec: BlockSpec, business: BusinessSnapshot, locale: Locale): ResolvedValue? =
        when (spec.businessField) {
            BusinessField.INVITATION_DATE -> business.date?.let {
                ResolvedDate(it, DateFormatting.formatDate(it, ValueResolver.formatIdDe(spec) ?: "long", locale))
            }
            BusinessField.INVITATION_TIME -> business.time?.let {
                ResolvedTime(it, DateFormatting.formatDate(it, ValueResolver.formatIdDe(spec) ?: "h12", locale))
            }
            BusinessField.INVITATION_HASHTAG -> business.hashtag?.let { ResolvedText(it) }
            // La URL de portada del módulo antiguo es una URL externa ya resuelta: no pasa por AssetIndex.
            BusinessField.INVITATION_COVER_PHOTO_URL -> business.coverPhotoUrl?.let {
                ResolvedImage(it, "", Focal(0.5, 0.5))
            }
            BusinessField.INVITATION_CHILDREN_ALLOWED -> ResolvedBoolean(business.childrenAllowed)
            BusinessField.INVITATION_YOUNG_ALLOWED -> ResolvedBoolean(business.youngAllowed)
            // `source: "business"` sin `businessField` es I-05: aquí no se lanza, se deja vacío.
            null -> null
        }
}
