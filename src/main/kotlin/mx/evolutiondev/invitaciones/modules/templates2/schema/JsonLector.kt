package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.WireEnum

/** Lanza siempre `TPL_MALFORMED_JSON`: `contratos.md §4` prohíbe `require`/`check`/`error()` aquí. */
internal fun malformado(path: String, mensaje: String): Nothing =
    throw Templates2Exception.MalformedJson("$path: $mensaje", mapOf("path" to path))

/**
 * Lector estricto de objetos JSON. Equivale a `z.strictObject`: al cerrar con [fin] falla si quedó
 * alguna clave que nadie leyó. Es P1 en la frontera de deserialización — nada se descarta en silencio.
 */
internal class Obj(private val node: JsonNode, val path: String) {
    private val leidas = LinkedHashSet<String>()

    init {
        if (!node.isObject) malformado(path, "se esperaba un objeto y llegó ${tipo(node)}")
    }

    private fun campo(nombre: String): JsonNode? {
        leidas.add(nombre)
        val n = node.get(nombre)
        return if (n == null || n.isNull) null else n
    }

    fun bruto(nombre: String): JsonNode? = campo(nombre)

    fun obligatorio(nombre: String): JsonNode =
        campo(nombre) ?: malformado(path, "falta el campo obligatorio '$nombre'")

    fun texto(nombre: String): String = textoDe(obligatorio(nombre), "$path.$nombre")

    fun textoOpcional(nombre: String): String? = campo(nombre)?.let { textoDe(it, "$path.$nombre") }

    fun entero(nombre: String): Int = enteroDe(obligatorio(nombre), "$path.$nombre")

    fun entero(nombre: String, porDefecto: Int): Int =
        campo(nombre)?.let { enteroDe(it, "$path.$nombre") } ?: porDefecto

    fun largo(nombre: String): Long {
        val n = obligatorio(nombre)
        if (!n.isIntegralNumber) malformado("$path.$nombre", "se esperaba un entero y llegó ${tipo(n)}")
        return n.longValue()
    }

    fun booleano(nombre: String): Boolean = booleanoDe(obligatorio(nombre), "$path.$nombre")

    fun booleano(nombre: String, porDefecto: Boolean): Boolean =
        campo(nombre)?.let { booleanoDe(it, "$path.$nombre") } ?: porDefecto

    fun objeto(nombre: String): Obj = Obj(obligatorio(nombre), "$path.$nombre")

    fun objetoOpcional(nombre: String): Obj? = campo(nombre)?.let { Obj(it, "$path.$nombre") }

    fun <T> lista(nombre: String, f: (JsonNode, String) -> T): List<T> {
        val n = obligatorio(nombre)
        if (!n.isArray) malformado("$path.$nombre", "se esperaba un array y llegó ${tipo(n)}")
        return n.mapIndexed { i, hijo -> f(hijo, "$path.$nombre[$i]") }
    }

    fun <T> lista(nombre: String, porDefecto: List<T>, f: (JsonNode, String) -> T): List<T> =
        if (bruto(nombre) == null) porDefecto else lista(nombre, f)

    /** Mapa de claves libres. `clave` valida y convierte cada clave; `valor` cada valor. */
    fun <K, V> mapa(nombre: String, clave: (String, String) -> K, valor: (JsonNode, String) -> V): Map<K, V> {
        val n = obligatorio(nombre)
        if (!n.isObject) malformado("$path.$nombre", "se esperaba un objeto y llegó ${tipo(n)}")
        val salida = LinkedHashMap<K, V>()
        for (k in n.fieldNames()) salida[clave(k, "$path.$nombre.$k")] = valor(n.get(k), "$path.$nombre.$k")
        return salida
    }

    fun <K, V> mapa(
        nombre: String,
        porDefecto: Map<K, V>,
        clave: (String, String) -> K,
        valor: (JsonNode, String) -> V,
    ): Map<K, V> = if (bruto(nombre) == null) porDefecto else mapa(nombre, clave, valor)

    /** Cierra el objeto: cualquier clave no leída es un error de contrato (P1). */
    fun fin() {
        val sobrantes = node.fieldNames().asSequence().filterNot { leidas.contains(it) }.toList()
        if (sobrantes.isNotEmpty()) malformado(path, "claves desconocidas: $sobrantes")
    }
}

internal fun tipo(n: JsonNode): String = n.nodeType.name.lowercase()

internal fun textoDe(n: JsonNode, path: String): String =
    if (n.isTextual) n.textValue() else malformado(path, "se esperaba un string y llegó ${tipo(n)}")

internal fun enteroDe(n: JsonNode, path: String): Int =
    if (n.isIntegralNumber) n.intValue() else malformado(path, "se esperaba un entero y llegó ${tipo(n)}")

internal fun booleanoDe(n: JsonNode, path: String): Boolean =
    if (n.isBoolean) n.booleanValue() else malformado(path, "se esperaba un booleano y llegó ${tipo(n)}")

internal fun decimalDe(n: JsonNode, path: String): Double =
    if (n.isNumber) n.doubleValue() else malformado(path, "se esperaba un número y llegó ${tipo(n)}")

/** Convierte el literal de JSON al enumerado cerrado correspondiente, o falla nombrando el catálogo. */
internal fun <E : WireEnum> wire(valores: Array<E>, texto: String, path: String, nombreCatalogo: String): E =
    valores.firstOrNull { it.wire == texto }
        ?: malformado(path, "\"$texto\" no pertenece al catálogo cerrado $nombreCatalogo")
