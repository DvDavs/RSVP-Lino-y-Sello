package mx.evolutiondev.invitaciones.modules.templates2

import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * `contratos.md §5` / `02 §9.3` (cierre 2): los `.schema.json` emitidos tienen que estar en el
 * classpath, con su `$schema` de draft 2020-12 y su `$id` bajo el dominio del proyecto. Falla si
 * alguien añade un esquema al paquete TypeScript y no lo publica, o al revés.
 */
class JsonSchemaPresenceTest {

    private val registry = JsonSchemaRegistry()

    @Test
    fun `los 11 esquemas estan en el classpath`() {
        assertEquals(11, JsonSchemaRegistry.NOMBRES.size)
        for (nombre in JsonSchemaRegistry.NOMBRES) {
            val ruta = JsonSchemaRegistry.recurso(nombre)
            assertNotNull(javaClass.getResourceAsStream(ruta), "falta $ruta en el classpath")
        }
    }

    @Test
    fun `cada esquema declara draft 2020-12 y su id bajo el dominio del proyecto`() {
        for (nombre in JsonSchemaRegistry.NOMBRES) {
            val node = Templates2Json.readTree(registry.fuentes.getValue(nombre))
            assertEquals(
                "https://json-schema.org/draft/2020-12/schema", node.get("\$schema").textValue(),
                "$nombre: draft equivocado",
            )
            assertEquals(JsonSchemaRegistry.iri(nombre), node.get("\$id").textValue(), "$nombre: \$id equivocado")
        }
    }

    /** Un puntero es exactamente tres claves: `$schema`, `$id` y `$ref` al bundle (ADR-1R-D-08). */
    @Test
    fun `los punteros son de tres claves y apuntan al bundle`() {
        for (nombre in JsonSchemaRegistry.PUNTEROS) {
            val node = Templates2Json.readTree(registry.fuentes.getValue(nombre))
            assertEquals(
                setOf("\$schema", "\$id", "\$ref"),
                node.fieldNames().asSequence().toSet(),
                "$nombre no es un puntero de tres claves",
            )
            assertTrue(node.get("\$ref").textValue().startsWith(JsonSchemaRegistry.BUNDLE_ID + "#/\$defs/"))
        }
    }

    /** El bundle no debe existir por duplicado: las 15 definiciones viven **solo** ahí (decisión X-11). */
    @Test
    fun `las definiciones compartidas viven solo en el bundle`() {
        val bundle = Templates2Json.readTree(registry.fuentes.getValue(JsonSchemaRegistry.BUNDLE))
        assertEquals(15, bundle.get("\$defs").size())
        for (nombre in JsonSchemaRegistry.PUNTEROS) {
            val node = Templates2Json.readTree(registry.fuentes.getValue(nombre))
            assertTrue(node.get("\$defs") == null, "$nombre no puede traer \$defs propios")
        }
    }
}
