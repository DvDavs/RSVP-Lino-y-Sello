package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import java.math.BigDecimal
import kotlin.math.abs
import kotlin.math.floor

/**
 * Serialización canónica determinista, **exactamente** como la define `01 §5.5` (ADR-1R-D-02).
 * Subconjunto de RFC 8785 suficiente para nuestros tipos:
 *
 * 1. Sin espacios en blanco entre tokens.
 * 2. Claves de objeto ordenadas ascendentemente por sus unidades de código UTF-16
 *    (`String.compareTo` de Kotlin coincide con el `<` de JavaScript en ese orden).
 * 3. Cadenas: escape mínimo de JSON (comilla, barra invertida y los de control por debajo de U+0020),
 *    **sin** escapar caracteres no ASCII (la `a` acentuada va literal en UTF-8).
 * 4. Enteros sin punto decimal; dobles con la representación decimal más corta que reproduce el valor.
 * 5. Arrays: **nunca** se reordenan (el orden de un array es dato).
 *
 * Los hashes del módulo se calculan siempre sobre esta salida, **nunca sobre los bytes de `jsonb`**
 * (ADR-1R-B-07): Postgres reordena las claves de un `jsonb`.
 */
object CanonicalJson {

    /** JSON canónico de `node`. El `null` de JSON se emite; Jackson no tiene el concepto `undefined`. */
    fun canonical(node: JsonNode): String {
        val sb = StringBuilder()
        write(node, sb)
        return sb.toString()
    }

    private fun write(node: JsonNode, sb: StringBuilder) {
        when {
            node.isObject -> writeObject(node as ObjectNode, sb)
            node.isArray -> writeArray(node as ArrayNode, sb)
            node.isTextual -> writeString(node.textValue(), sb)
            node.isNumber -> sb.append(number(node))
            node.isBoolean -> sb.append(if (node.booleanValue()) "true" else "false")
            else -> sb.append("null")
        }
    }

    private fun writeObject(node: ObjectNode, sb: StringBuilder) {
        sb.append('{')
        val claves = node.fieldNames().asSequence().toMutableList()
        claves.sort()
        var primera = true
        for (k in claves) {
            if (!primera) sb.append(',')
            primera = false
            writeString(k, sb)
            sb.append(':')
            write(node.get(k), sb)
        }
        sb.append('}')
    }

    private fun writeArray(node: ArrayNode, sb: StringBuilder) {
        sb.append('[')
        for ((i, hijo) in node.withIndex()) {
            if (i > 0) sb.append(',')
            write(hijo, sb)
        }
        sb.append(']')
    }

    /**
     * Regla 4. Un doble de valor entero se emite **sin** punto decimal, igual que `JSON.stringify` en
     * JavaScript (`JSON.stringify(1.0) === "1"`): si no, `1.0` daría `"1.0"` en Kotlin y `"1"` en Node,
     * y el mismo documento produciría dos `contentHash` distintos.
     */
    internal fun number(node: JsonNode): String {
        if (node.isIntegralNumber) return node.bigIntegerValue().toString()
        val d = node.doubleValue()
        if (!d.isFinite()) return "null"
        if (d == floor(d) && abs(d) < 1e21) return BigDecimal(d).toBigIntegerExact().toString()
        val texto = d.toString()
        return if (texto.contains('E') || texto.contains('e')) exponencialEstiloJs(texto) else texto
    }

    /**
     * `Double.toString` de Java escribe `1.0E-7`; `JSON.stringify` escribe `1e-7`. Solo afecta a
     * magnitudes que ningún campo del esquema usa hoy (el único `number` no entero es `Focal.x/y`,
     * acotado a 0..1), pero la conversión evita una divergencia latente.
     */
    private fun exponencialEstiloJs(texto: String): String {
        val i = texto.indexOfFirst { it == 'E' || it == 'e' }
        val mantisa = texto.substring(0, i).removeSuffix(".0")
        val exp = texto.substring(i + 1)
        return mantisa + "e" + (if (exp.startsWith("-")) exp else "+$exp")
    }

    private fun writeString(s: String, sb: StringBuilder) {
        sb.append('"')
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\b' -> sb.append("\\b")
                '\u000C' -> sb.append("\\f")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else ->
                    // No ASCII va literal (UTF-8, sin escapes innecesarios); los de control, en \\uXXXX.
                    if (c < ' ') sb.append("\\u").append(String.format("%04x", c.code)) else sb.append(c)
            }
        }
        sb.append('"')
    }
}
