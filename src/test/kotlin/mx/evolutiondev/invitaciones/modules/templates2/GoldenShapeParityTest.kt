package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * Paridad de **forma** entre Zod (`expectZodValid` de los golden) y el JSON Schema emitido, que es lo
 * que Kotlin ejecuta. Cubre las 11 operaciones y las 11 `MigrationOp`: si el bundle aceptara una
 * operación que Zod rechaza —o al revés— TypeScript y Kotlin admitirían cuerpos distintos y P1 caería.
 *
 * Las operaciones y las `MigrationOp` no tienen esquema raíz propio (`emit-json-schema.ts` `RAICES`),
 * así que se envuelven en su contenedor real: `OperationBatch` y `MigrationPlan`.
 */
class GoldenShapeParityTest {

    private val validador = JsonSchemaValidatorService(JsonSchemaRegistry())

    private fun loteCon(op: JsonNode): JsonNode {
        val lote = Templates2Json.mapper.createObjectNode()
        lote.put("baseRevision", 0)
        lote.put("clientBatchId", "abcdefgh12345678")
        lote.set<JsonNode>("operations", Templates2Json.mapper.createArrayNode().add(op))
        return lote
    }

    private fun planCon(op: JsonNode): JsonNode {
        val plan = Templates2Json.mapper.createObjectNode()
        plan.put("templateSlug", "boda-clasica")
        plan.put("from", "1.0.0")
        plan.put("to", "2.0.0")
        plan.set<JsonNode>("ops", Templates2Json.mapper.createArrayNode().add(op))
        return plan
    }

    @TestFactory
    fun `las 11 operaciones - el bundle da el mismo veredicto que Zod`(): List<DynamicTest> =
        Golden.listar("operations").flatMap { fichero ->
            Golden.leer("operations", fichero).mapIndexed { i, caso ->
                DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                    assertEquals(
                        caso.get("expectZodValid").booleanValue(),
                        validador.isValid("operation-batch", loteCon(caso.get("operation"))),
                        "operación: ${caso.get("operation")}",
                    )
                }
            }
        }

    @TestFactory
    fun `las 11 MigrationOp - el bundle da el mismo veredicto que Zod`(): List<DynamicTest> =
        Golden.leer("migrations", "op-shapes.cases.json").mapIndexed { i, caso ->
            DynamicTest.dynamicTest("[$i] ${caso.get("name").textValue()}") {
                assertEquals(
                    caso.get("expectZodValid").booleanValue(),
                    validador.isValid("migration-plan", planCon(caso.get("op"))),
                    "op: ${caso.get("op")}",
                )
            }
        }
}
