package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale

/**
 * R6 de `01 §5.2`, punto 2 del determinismo: **prohibido `java.time.format` con locale del sistema**.
 * ICU difiere entre la JVM y Node y entre versiones, así que el mismo documento daría dos
 * `contentHash` distintos. Aquí, igual que en `compose.ts`, hay **tablas de meses literales**.
 *
 * Espejo literal de `packages/schema/src/compose.ts` (`fLong`, `fMonthYear`, `fH12`, `formatDate`,
 * `formatRange`). Resuelve H-27 (fechas inconsistentes entre `couple` y `cover`): un solo formateador
 * con el patrón declarado en el `BlockSpec`.
 */
object DateFormatting {

    private val MESES: Map<Locale, List<String>> = mapOf(
        Locale.ES_MX to listOf("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"),
        Locale.ES_ES to listOf("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"),
        Locale.EN_US to listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"),
    )

    /** `Number(x)` de JavaScript sobre un segmento: entero o nada. No acepta signos ni espacios. */
    private fun entero(texto: String): Int? = texto.toIntOrNull()

    /**
     * Los tres formateadores devuelven el valor **crudo** cuando la entrada no tiene la forma que ese
     * formato espera. `formatId` es un `Ident` libre, así que un `DateSpec` puede declarar
     * `formatId: "h12"` con datos perfectamente válidos; sin esta guarda JavaScript producía
     * `"NaN:undefined pm"` y Kotlin lanzaría `NumberFormatException` sobre el MISMO documento, que es
     * exactamente lo que P1 prohíbe.
     */
    internal fun largo(d: String, loc: Locale): String {
        val p = d.split("-")
        if (p.size != 3) return d
        val y = entero(p[0]); val m = entero(p[1]); val dia = entero(p[2])
        if (y == null || m == null || dia == null || m < 1 || m > 12) return d
        val mes = MESES.getValue(loc)[m - 1]
        return if (loc == Locale.EN_US) "$mes $dia, $y" else "$dia de $mes de $y"
    }

    internal fun mesAnio(d: String, loc: Locale): String {
        val p = d.split("-")
        if (p.size != 3) return d
        val y = entero(p[0]); val m = entero(p[1])
        if (y == null || m == null || m < 1 || m > 12) return d
        val mes = MESES.getValue(loc)[m - 1]
        return if (loc == Locale.EN_US) "$mes $y" else "$mes de $y"
    }

    internal fun h12(t: String): String {
        val p = t.split(":")
        if (p.size != 2) return t
        val h24 = entero(p[0]); val min = entero(p[1])
        if (h24 == null || min == null) return t
        val h = if (h24 % 12 == 0) 12 else h24 % 12
        val mm = min.toString().padStart(2, '0')
        return "$h:$mm " + if (h24 < 12) "am" else "pm"
    }

    /** Catálogo cerrado de `formatId`; uno desconocido cae a `long` (R6, punto 2). */
    fun formatDate(value: String, formatId: String, locale: Locale): String = when (formatId) {
        "long" -> largo(value, locale)
        "month-year" -> mesAnio(value, locale)
        "h12" -> h12(value)
        "iso" -> value
        else -> largo(value, locale)
    }

    /** El `formatId` no interviene: el rango tiene una sola forma (espejo de `compose.ts`). */
    fun formatRange(start: String, end: String?, formatId: String, locale: Locale): String {
        val ps = start.split("T")
        if (ps.size != 2) return start
        val cabeza = largo(ps[0], locale) + ", " + h12(ps[1])
        if (end.isNullOrEmpty()) return cabeza
        val pe = end.split("T")
        if (pe.size != 2) return cabeza
        return if (pe[0] == ps[0]) "$cabeza – " + h12(pe[1])
        else "$cabeza – " + largo(pe[0], locale) + ", " + h12(pe[1])
    }
}
