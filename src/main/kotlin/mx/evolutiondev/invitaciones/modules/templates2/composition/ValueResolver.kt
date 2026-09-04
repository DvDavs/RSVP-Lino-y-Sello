package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BooleanValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.LinkValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocationValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.PersonValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedAudio
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedBoolean
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedDate
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedDateTimeRange
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedImage
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedLink
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedListText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedLocation
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedPerson
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedRichText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedTime
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.TimeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TimeValue

/**
 * R2/R3 de `01 §5.2`: la cascada `user → default → empty` la aplica [DefaultComposer]; aquí vive la
 * **resolución del valor** (`assetId → url`, texto formateado, etiqueta de opción).
 *
 * Espejo literal de `resolveScalar` de `packages/schema/src/compose.ts`, incluidos sus dos detalles
 * fáciles de perder: el `formatId` se lee del spec **sea cual sea su tipo** (un `TimeSpec` bajo un
 * valor `date` aporta su `formatId`), y una `choice` cuyo `optionId` no está en `options` se resuelve
 * con el propio `optionId` como etiqueta en vez de desaparecer.
 */
object ValueResolver {

    /** `formatId` declarado por el spec, sea `date`, `time` o `dateTimeRange`; `null` en el resto. */
    fun formatIdDe(spec: BlockSpec): String? = when (spec) {
        is DateSpec -> spec.formatId
        is TimeSpec -> spec.formatId
        is DateTimeRangeSpec -> spec.formatId
        else -> null
    }

    /**
     * Resuelve un valor escalar contra su spec. Devuelve `null` cuando el valor no puede resolverse
     * —un `assetId` que no está en el `AssetIndex` (asset borrado: **no se inventa una URL**, R5), o
     * un valor que no es escalar—, y entonces el bloque queda `provenance: "empty"`.
     */
    fun resolve(spec: BlockSpec, value: BlockValue, assets: AssetIndex, locale: Locale): ResolvedValue? =
        when (value) {
            is TextValue -> ResolvedText(value.value)
            is RichTextValue -> ResolvedRichText(value.doc)
            is ListTextValue -> ResolvedListText(value.items)
            is ImageValue -> assets[value.assetId]?.let { ResolvedImage(it.url, value.alt, value.focal) }
            is AudioValue -> assets[value.assetId]?.let { ResolvedAudio(it.url) }
            is DateValue -> ResolvedDate(
                value.value, DateFormatting.formatDate(value.value, formatIdDe(spec) ?: "long", locale),
            )
            is TimeValue -> ResolvedTime(
                value.value, DateFormatting.formatDate(value.value, formatIdDe(spec) ?: "h12", locale),
            )
            is DateTimeRangeValue -> ResolvedDateTimeRange(
                start = value.start,
                end = value.end,
                formatted = DateFormatting.formatRange(value.start, value.end, formatIdDe(spec) ?: "long-h12", locale),
            )
            is LinkValue -> ResolvedLink(value.href, value.label)
            is LocationValue -> ResolvedLocation(value.name, value.address, value.mapHref)
            is ChoiceValue -> {
                val opcion = (spec as? ChoiceSpec)?.options?.firstOrNull { it.id == value.optionId }
                ResolvedChoice(value.optionId, opcion?.label?.resolve(locale) ?: value.optionId)
            }
            is BooleanValue -> ResolvedBoolean(value.value)
            is PersonValue -> ResolvedPerson(value.name, value.note)
            // Un `group` bajo un spec escalar no se resuelve: se registra en `report.invalidValues`.
            else -> null
        }
}
