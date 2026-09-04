package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.JsonNode
import com.networknt.schema.SchemaLocation
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * `golden/blocks/` — los 14 tipos de bloque, uno por uno (`06 §5.2`). Cada caso trae la respuesta de
 * TypeScript en dos campos y Kotlin debe reproducir **los dos**:
 *
 * - `expectZodValid`: si `BlockValue.safeParse(value)` tiene éxito. En Kotlin lo comprueba el **JSON
 *   Schema emitido** contra la definición compartida `#/$defs/BlockValue` del bundle, que es la misma
 *   pieza que ajv usa del lado TypeScript.
 * - `expectViolations`: los códigos de `validateValueAgainstSpec(spec, value, path)`, solo cuando el
 *   valor es válido de forma y hay `spec`.
 */
class GoldenBlocksParityTest {

    private val registry = JsonSchemaRegistry()
    private val blockValueSchema =
        registry.factory.getSchema(SchemaLocation.of(JsonSchemaRegistry.BUNDLE_ID + "#/\$defs/BlockValue"))

    private fun formaValida(value: JsonNode): Boolean = blockValueSchema.validate(value).isEmpty()

    @TestFactory
    fun `el JSON Schema da el mismo veredicto de forma que Zod`(): List<DynamicTest> =
        Golden.listar("blocks").flatMap { fichero ->
            Golden.leer("blocks", fichero).mapIndexed { i, caso ->
                DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                    assertEquals(
                        caso.get("expectZodValid").booleanValue(),
                        formaValida(caso.get("value")),
                        "el bundle y Zod discrepan sobre la forma de ${caso.get("value")}",
                    )
                }
            }
        }

    @TestFactory
    fun `validateValueAgainstSpec reproduce expectViolations`(): List<DynamicTest> =
        Golden.listar("blocks").flatMap { fichero ->
            Golden.leer("blocks", fichero).mapIndexed { i, caso -> i to caso }
                .filter { (_, c) -> c.get("expectZodValid").booleanValue() && !c.get("spec").isNull }
                .map { (i, caso) ->
                    DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                        val violaciones = Invariants.validateValueAgainstSpec(
                            DomainJson.blockSpec(caso.get("spec"), "spec"),
                            DomainJson.blockValue(caso.get("value"), "value"),
                            caso.get("path").textValue(),
                        )
                        assertEquals(
                            caso.get("expectViolations").map { it.textValue() }.sorted(),
                            violaciones.map { it.wire }.sorted(),
                        )
                    }
                }
        }
}
