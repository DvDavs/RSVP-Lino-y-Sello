package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.InvariantCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Violation
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * **La segunda de las dos verificaciones que la fase 1 dejó pendientes** (contratos.md §7): que el
 * espejo Kotlin de `I-01`…`I-30` case exactamente con el de TypeScript sobre la **misma** tabla de
 * casos, `frontend/packages/schema/golden/invariants/` (30 ficheros, 102 casos).
 *
 * La prueba falla si falta una invariante **o si un código sobra**: se compara la lista completa de
 * códigos ordenada, conservando duplicados (hay casos de I-29 con el mismo código dos veces).
 *
 * `expect` solo lleva códigos; el `path` se descarta a ambos lados (desviación de `06 §4`, objeción
 * O-11 de `bitacora/2-0a-REV.md`). Por eso las rutas se prueban aparte en [InvariantPathTest].
 */
class InvariantParityTest {

    private fun codigos(vs: List<Violation>): List<String> = vs.map { it.wire }.sorted()

    private fun esperados(caso: JsonNode): List<String> =
        caso.get("expect").map { it.textValue() }.sorted()

    private fun ejecutar(caso: JsonNode): List<Violation> = when (val fn = caso.get("fn").textValue()) {
        "validateValueAgainstSpec" -> Invariants.validateValueAgainstSpec(
            DomainJson.blockSpec(caso.get("spec"), "spec"),
            DomainJson.blockValue(caso.get("input"), "input"),
            caso.get("path").textValue(),
        )
        "validateManifest" -> Invariants.validateManifest(
            DomainJson.manifest(caso.get("manifest")),
            DomainJson.theme(caso.get("theme")),
            DomainJson.defaults(caso.get("defaults")),
        )
        "validateDocument" -> Invariants.validateDocument(
            DomainJson.document(caso.get("doc")),
            DomainJson.manifest(caso.get("manifest")),
            DomainJson.theme(caso.get("theme")),
        )
        "validateReorder" -> Invariants.validateReorder(
            caso.get("order").map { it.textValue() },
            caso.get("actuales").map { it.textValue() },
        )
        // I-29 corre sobre el JSON CRUDO, antes de cualquier `parse` (contratos.md §3).
        "assertNoReservedKeys" -> Invariants.assertNoReservedKeys(caso.get("raw"))
        else -> error("`fn` desconocida en el golden: $fn")
    }

    @TestFactory
    fun `los 102 casos de golden-invariants dan el mismo veredicto que TypeScript`(): List<DynamicTest> =
        Golden.listar("invariants").flatMap { fichero ->
            Golden.leer("invariants", fichero).mapIndexed { i, caso ->
                DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                    assertEquals(esperados(caso), codigos(ejecutar(caso)))
                }
            }
        }

    @Test
    fun `el inventario de golden-invariants es 30 ficheros y 102 casos`() {
        val ficheros = Golden.listar("invariants")
        assertEquals(30, ficheros.size, "contratos.md §3: 30 invariantes, un fichero cada una")
        val total = ficheros.sumOf { Golden.leer("invariants", it).size() }
        assertEquals(102, total, "handoffs/2-0a.md: 102 casos")
    }

    /** `06 §4.2`: cada código del enum tiene su fichero, y cada fichero un caso que viola y otro que no. */
    @Test
    fun `cada InvariantCode tiene fichero con caso que viola y caso que no`() {
        val ficheros = Golden.listar("invariants")
        for (codigo in InvariantCode.entries) {
            val prefijo = codigo.wire.substringBefore("_") + "-"
            val fichero = ficheros.firstOrNull { it.startsWith(prefijo) }
                ?: error("sin fichero de casos para ${codigo.wire} (06 §4.2)")
            val casos = Golden.leer("invariants", fichero)
            assertTrue(casos.any { it.get("expect").size() > 0 }, "$fichero sin caso que viola")
            assertTrue(casos.any { it.get("expect").size() == 0 }, "$fichero sin caso que no viola")
        }
    }

    /**
     * `I-31_PALETTE_CONTRAST_BELOW_AA` está **reservado** y no debe declararse hasta que se acepte
     * ADR-1R-F-06 (decisión X-03): un código sin fichero de casos rompería la prueba anterior.
     */
    @Test
    fun `I-31 no esta declarada`() {
        assertEquals(30, InvariantCode.entries.size)
        assertTrue(InvariantCode.entries.none { it.wire.startsWith("I-31") })
    }
}
