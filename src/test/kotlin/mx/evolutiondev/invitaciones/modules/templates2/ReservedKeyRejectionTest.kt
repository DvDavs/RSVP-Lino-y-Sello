package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.InvariantCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * **I-29 sobre el JSON crudo** (contratos.md §3). Motivo verificado en la fase 1: `z.record` de
 * `zod@4.5.4` acepta y **descarta en silencio** la clave `"__proto__"`, mientras ajv la rechaza; sin
 * `I-29` antes del parseo, TypeScript y Kotlin discreparían sobre el mismo documento.
 *
 * Aquí se comprueban las **dos** barreras que el módulo pone: la invariante sobre el árbol crudo y el
 * JSON Schema (`propertyNames.pattern`), que es la que ajv aplica del lado TypeScript.
 */
class ReservedKeyRejectionTest {

    private val validador = JsonSchemaValidatorService(JsonSchemaRegistry())

    private fun documentoConClave(clave: String): ObjectNode {
        val doc = Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento") as ObjectNode
        val content = doc.get("content") as ObjectNode
        content.set<ObjectNode>(clave, Templates2Json.mapper.createObjectNode().put("kind", "text").put("value", "x"))
        return doc
    }

    @Test
    fun `un documento con __proto__ en content es rechazado por I-29`() {
        val v = Invariants.assertNoReservedKeys(documentoConClave("__proto__"))
        assertEquals(listOf(InvariantCode.I_29_RESERVED_OBJECT_KEY), v.map { it.code })
        assertEquals("$.content.__proto__", v.single().path)
    }

    @Test
    fun `constructor y prototype tambien violan`() {
        for (clave in listOf("constructor", "prototype")) {
            val v = Invariants.assertNoReservedKeys(documentoConClave(clave))
            assertTrue(v.any { it.code == InvariantCode.I_29_RESERVED_OBJECT_KEY }, clave)
        }
    }

    @Test
    fun `el JSON Schema tambien rechaza __proto__ en content`() {
        val violaciones = validador.validate("invitation-document", documentoConClave("__proto__"))
        assertTrue(violaciones.isNotEmpty(), "propertyNames.pattern debe rechazar \"__proto__\"")
    }

    /**
     * El documento sin claves reservadas no viola: si la invariante disparase siempre, las pruebas
     * anteriores no probarían nada.
     */
    @Test
    fun `un documento limpio no viola I-29`() {
        assertTrue(Invariants.assertNoReservedKeys(Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento")).isEmpty())
        assertTrue(Invariants.assertNoReservedKeys(null).isEmpty())
        assertTrue(Invariants.assertNoReservedKeys(Templates2Json.readTree("[1,2,3]")).isEmpty())
    }

    /** La clave reservada también se detecta dentro de un array y anidada. */
    @Test
    fun `I-29 recorre arrays y objetos anidados`() {
        val raw = Templates2Json.readTree("""{"a":[{"b":{"prototype":1}}]}""")
        val v = Invariants.assertNoReservedKeys(raw)
        assertEquals(1, v.size)
        assertEquals("$.a[0].b.prototype", v.single().path)
    }
}
