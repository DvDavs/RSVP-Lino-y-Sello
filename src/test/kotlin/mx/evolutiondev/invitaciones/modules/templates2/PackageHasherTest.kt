package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.PackageHasher
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * `package_hash` de `01 §2.1` con la fórmula corregida por **ADR-1R-D-03**.
 *
 * El fallo exacto que esa ADR corrige: la fórmula anterior (`canonical(manifest)` más el sha256 de
 * cada asset) **no cubría `theme.json` ni `defaults.json`**, así que dos paquetes que solo diferían
 * en los textos de demostración colisionaban y la idempotencia por `package_hash` de ADR-008
 * descartaba el segundo **en silencio**. Las dos primeras pruebas son ese caso, literal.
 */
class PackageHasherTest {

    private val manifest = Golden.Ejemplos.leer("boda-clasica-1.0.0", "template")
    private val theme = Golden.Ejemplos.leer("boda-clasica-1.0.0", "theme")
    private val defaults = Golden.Ejemplos.leer("boda-clasica-1.0.0", "defaults")

    private fun hash(
        m: com.fasterxml.jackson.databind.JsonNode = manifest,
        t: com.fasterxml.jackson.databind.JsonNode = theme,
        d: com.fasterxml.jackson.databind.JsonNode = defaults,
        migraciones: Map<String, com.fasterxml.jackson.databind.JsonNode> = emptyMap(),
        assets: Map<String, ByteArray> = emptyMap(),
    ) = PackageHasher.packageHash(m, t, d, migraciones, assets)

    @Test
    fun `el hash lleva prefijo de algoritmo y 64 hex`() {
        assertTrue(Regex("^sha256:[0-9a-f]{64}$").matches(hash()), hash())
    }

    @Test
    fun `cambiar SOLO theme-json cambia el hash (ADR-1R-D-03)`() {
        val otro = theme.deepCopy<ObjectNode>()
        (otro.get("palettes")[0] as ObjectNode).put("id", "otra-paleta")
        assertNotEquals(hash(), hash(t = otro))
    }

    @Test
    fun `cambiar SOLO defaults-json cambia el hash (ADR-1R-D-03)`() {
        val otro = defaults.deepCopy<ObjectNode>()
        (otro.get("content") as ObjectNode)
            .set<ObjectNode>("cover.title", Templates2Json.mapper.createObjectNode().put("kind", "text").put("value", "Z"))
        assertNotEquals(hash(), hash(d = otro))
    }

    @Test
    fun `cambiar SOLO una migracion o un asset cambia el hash`() {
        val plan = Templates2Json.readTree("""{"templateSlug":"boda-clasica","from":"0.9.0","to":"1.0.0","ops":[]}""")
        assertNotEquals(hash(), hash(migraciones = mapOf("0.9.0-to-1.0.0.json" to plan)))
        assertNotEquals(hash(), hash(assets = mapOf("fondo.webp" to byteArrayOf(1, 2, 3))))
        assertNotEquals(
            hash(assets = mapOf("fondo.webp" to byteArrayOf(1, 2, 3))),
            hash(assets = mapOf("fondo.webp" to byteArrayOf(1, 2, 4))),
        )
    }

    @Test
    fun `es estable ante reordenacion de claves y reformateo`() {
        val reordenado = Templates2Json.readTree(
            Templates2Json.mapper.writerWithDefaultPrettyPrinter().writeValueAsString(
                Templates2Json.readTree(reordenarClaves(manifest.toString())),
            ),
        )
        assertEquals(hash(), hash(m = reordenado))
    }

    /** Reescribe el JSON con las claves de cada objeto en orden inverso, sin tocar el contenido. */
    private fun reordenarClaves(texto: String): String {
        fun rec(n: com.fasterxml.jackson.databind.JsonNode): com.fasterxml.jackson.databind.JsonNode = when {
            n.isObject -> {
                val o = Templates2Json.mapper.createObjectNode()
                n.fieldNames().asSequence().toList().reversed().forEach { o.set<ObjectNode>(it, rec(n.get(it))) }
                o
            }
            n.isArray -> {
                val a = Templates2Json.mapper.createArrayNode()
                n.forEach { a.add(rec(it)) }
                a
            }
            else -> n
        }
        return rec(Templates2Json.readTree(texto)).toString()
    }

    @Test
    fun `las lineas van ordenadas por ruta byte a byte de su UTF-8`() {
        val entradas = listOf(
            PackageHasher.Entrada.Binario("assets/z.webp", byteArrayOf(1)),
            PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1)),
            PackageHasher.Entrada.Json("template.json", manifest),
            PackageHasher.Entrada.Json("migrations/1.0.0-to-2.0.0.json", theme),
        )
        val rutas = PackageHasher.lineas(entradas).map { it.substringBefore('\t') }
        assertEquals(
            listOf("assets/a.webp", "assets/z.webp", "migrations/1.0.0-to-2.0.0.json", "template.json"),
            rutas,
        )
    }

    @Test
    fun `la comparacion de rutas es por bytes UTF-8, no por locale`() {
        // "Z" (0x5A) va antes que "a" (0x61); con una comparación por locale podría ser al revés.
        assertTrue(PackageHasher.ORDEN_RUTA.compare("Z.json", "a.json") < 0)
        // Un prefijo va antes que la cadena más larga que lo contiene.
        assertTrue(PackageHasher.ORDEN_RUTA.compare("a.json", "a.json.bak") < 0)
        // La ñ en UTF-8 son dos bytes (0xC3 0xB1), por encima de cualquier ASCII.
        assertTrue(PackageHasher.ORDEN_RUTA.compare("assets/z.webp", "assets/ñ.webp") < 0)
    }

    @Test
    fun `dos paquetes identicos dan el mismo hash`() {
        assertEquals(hash(), hash())
        val entradas = listOf(PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 2)))
        assertEquals(PackageHasher.packageHash(entradas), PackageHasher.packageHash(entradas))
        assertEquals(
            PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 2)),
            PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 2)),
        )
        assertNotEquals(
            PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 2)).hashCode(),
            PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 3)).hashCode(),
        )
        assertTrue(PackageHasher.Entrada.Binario("assets/a.webp", byteArrayOf(1, 2)).toString().contains("assets"))
    }
}
