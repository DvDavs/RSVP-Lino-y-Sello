package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode

/**
 * `package_hash` **exactamente** como lo fija `01 §2.1` (`buildPackageHash`), con el prefijo de
 * algoritmo de la decisión X-01/X-05: `"sha256:" + 64 hex`.
 *
 * ```
 * lineas = [ "<ruta>\t<sha256hex del contenido>" por cada archivo del paquete ]
 *          ordenadas por `ruta` con comparacion byte a byte de su codificacion UTF-8
 * package_hash = "sha256:" + hex( SHA-256( "\n".join(lineas) ) )      // sin \n final
 * ```
 *
 * - Para los `.json` (manifiesto, `theme.json`, `defaults.json` y cada plan) el contenido hasheado es
 *   `canonicalJson(parse(archivo))` en UTF-8: un reformateo o un reordenamiento de claves **no** puede
 *   producir un paquete distinto.
 * - Para los assets son sus bytes literales.
 *
 * La fórmula anterior (`canonical(manifest)` mas el sha256 de cada asset) queda **derogada**
 * (ADR-1R-D-03): no cubría `theme.json` ni `defaults.json`, así que dos paquetes que solo diferían en
 * los textos de demostración colisionaban y la idempotencia de ADR-008 descartaba el segundo **en
 * silencio**.
 */
object PackageHasher {

    /** Un archivo del paquete, ya clasificado en "JSON canonicalizable" o "bytes literales". */
    sealed interface Entrada {
        val path: String

        data class Json(override val path: String, val node: JsonNode) : Entrada

        class Binario(override val path: String, val bytes: ByteArray) : Entrada {
            override fun equals(other: Any?): Boolean =
                other is Binario && other.path == path && other.bytes.contentEquals(bytes)
            override fun hashCode(): Int = 31 * path.hashCode() + bytes.contentHashCode()
            override fun toString(): String = "Binario(path=" + path + ", bytes=" + bytes.size + ")"
        }
    }

    /** Comparación byte a byte de la codificación UTF-8 de la ruta (no por locale), `01 §2.1`. */
    internal val ORDEN_RUTA: Comparator<String> = Comparator { a, b ->
        val x = a.toByteArray(Charsets.UTF_8)
        val y = b.toByteArray(Charsets.UTF_8)
        var i = 0
        var r = 0
        while (r == 0 && i < x.size && i < y.size) {
            r = (x[i].toInt() and 0xFF) - (y[i].toInt() and 0xFF)
            i++
        }
        if (r != 0) r else x.size - y.size
    }

    /** Las líneas `"<ruta>\t<sha256hex>"` ya ordenadas. Expuesto para poder diagnosticar una colisión. */
    fun lineas(entradas: List<Entrada>): List<String> =
        entradas.sortedWith(compareBy(ORDEN_RUTA) { it.path }).map { e ->
            val contenido = when (e) {
                is Entrada.Json -> CanonicalJson.canonical(e.node).toByteArray(Charsets.UTF_8)
                is Entrada.Binario -> e.bytes
            }
            e.path + "\t" + Templates2Json.hex(Templates2Json.sha256(contenido))
        }

    /** `"sha256:" + 64 hex` del paquete completo. */
    fun packageHash(entradas: List<Entrada>): String =
        "sha256:" + Templates2Json.hex(
            Templates2Json.sha256(lineas(entradas).joinToString("\n").toByteArray(Charsets.UTF_8)),
        )

    /**
     * Atajo con la disposición en disco de `01 §2.1`. `migraciones` va indexado por nombre de archivo
     * (`<from>-to-<version>.json`) y `assets` por nombre dentro de `assets/`.
     */
    fun packageHash(
        manifest: JsonNode,
        theme: JsonNode,
        defaults: JsonNode,
        migraciones: Map<String, JsonNode> = emptyMap(),
        assets: Map<String, ByteArray> = emptyMap(),
    ): String {
        val entradas = buildList {
            add(Entrada.Json("template.json", manifest))
            add(Entrada.Json("theme.json", theme))
            add(Entrada.Json("defaults.json", defaults))
            migraciones.forEach { (nombre, node) -> add(Entrada.Json("migrations/" + nombre, node)) }
            assets.forEach { (nombre, bytes) -> add(Entrada.Binario("assets/" + nombre, bytes)) }
        }
        return packageHash(entradas)
    }
}
