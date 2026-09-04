package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * Ida y vuelta `JsonNode` -> dominio -> `JsonNode` sobre **todos** los golden. Es la prueba que
 * garantiza a los bloques 2-1, 2-2 y 2-3 que los tipos de `templates2.domain` representan el esquema
 * **sin pérdida**: si algún campo se cayera al decodificar, la comparación canónica lo delataría.
 *
 * Se compara con [CanonicalJson] y no con `toString()` porque el orden de claves es irrelevante:
 * lo que no puede cambiar es el contenido.
 */
class DomainRoundTripTest {

    private fun ida(node: JsonNode, f: (JsonNode) -> JsonNode) =
        assertEquals(CanonicalJson.canonical(node), CanonicalJson.canonical(f(node)))

    @TestFactory
    fun `manifiesto, tema, defaults, documento, negocio, compuesto e informe`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.flatMap { plantilla ->
            val dir = "templates/$plantilla"
            listOf(
                DynamicTest.dynamicTest("$plantilla/template.json") {
                    ida(Golden.leer(dir, "template.json")) { DomainJson.encode(DomainJson.manifest(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/theme.json") {
                    ida(Golden.leer(dir, "theme.json")) { DomainJson.encode(DomainJson.theme(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/defaults.json") {
                    ida(Golden.leer(dir, "defaults.json")) { DomainJson.encode(DomainJson.defaults(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/documento.json") {
                    ida(Golden.leer(dir, "documento.json")) { DomainJson.encode(DomainJson.document(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/business.json") {
                    ida(Golden.leer(dir, "business.json")) { DomainJson.encode(DomainJson.businessSnapshot(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/compuesto.json") {
                    ida(Golden.leer(dir, "compuesto.json")) { DomainJson.encode(DomainJson.composedDocument(it)) }
                },
                DynamicTest.dynamicTest("$plantilla/reporte.json") {
                    ida(Golden.leer(dir, "reporte.json")) { DomainJson.encode(DomainJson.compositionReport(it)) }
                },
            )
        }

    /** Las 11 operaciones del catálogo cerrado, con las formas válidas de `golden/operations/`. */
    @TestFactory
    fun `las 11 operaciones van y vuelven sin perder nada`(): List<DynamicTest> =
        Golden.listar("operations").flatMap { fichero ->
            Golden.leer("operations", fichero).mapIndexed { i, caso -> i to caso }
                .filter { (_, c) -> c.get("expectZodValid").booleanValue() }
                .map { (i, caso) ->
                    DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                        ida(caso.get("operation")) { DomainJson.encode(DomainJson.operation(it, "op")) }
                    }
                }
        }

    /**
     * Las 11 `MigrationOp` con las formas VALIDAS de `golden/migrations/op-shapes.cases.json`.
     * Las formas invalidas no son cosa del codec sino del JSON Schema: `DomainJson` valida los
     * identificadores tipados (`BlockId`, `SectionKey`, ...) porque son value classes que rechazan en
     * el constructor, pero no los patrones de `Ident` ni los rangos numericos, que son restricciones
     * del esquema. La paridad de esas dos vive en `GoldenShapeParityTest`.
     */
    @TestFactory
    fun `las 11 MigrationOp validas van y vuelven`(): List<DynamicTest> =
        Golden.leer("migrations", "op-shapes.cases.json").mapIndexed { i, caso -> i to caso }
            .filter { (_, c) -> c.get("expectZodValid").booleanValue() }
            .map { (i, caso) ->
                DynamicTest.dynamicTest("[$i] ${caso.get("name").textValue()}") {
                    ida(caso.get("op")) { DomainJson.encode(DomainJson.migrationOp(it, "op")) }
                }
            }

    /** Un `op` que no esta en el catalogo cerrado de 11 se rechaza con codigo tipado, nunca en silencio. */
    @Test
    fun `una MigrationOp fuera del catalogo se rechaza con TPL_MALFORMED_JSON`() {
        val e = runCatching {
            DomainJson.migrationOp(Templates2Json.readTree("""{"op":"inventada","id":"a.b"}"""), "op")
        }.exceptionOrNull()
        assertTrue(e is Templates2Exception.MalformedJson, e.toString())
    }

    @Test
    fun `un lote de operaciones y una propuesta de IA van y vuelven`() {
        val lote = Templates2Json.readTree(
            """
            {"baseRevision": 7, "clientBatchId": "abcdefgh12345678",
             "operations": [{"op":"clearBlock","blockId":"cover.title"}]}
            """.trimIndent(),
        )
        val decodificado = DomainJson.operationBatch(lote)
        assertEquals(7L, decodificado.baseRevision)
        assertEquals(1, decodificado.operations.size)

        val propuesta = Templates2Json.readTree(
            """
            {"sectionKey":"cover","rationale":"mejorar el titulo",
             "operations":[{"op":"setBlock","blockId":"cover.title","value":{"kind":"text","value":"Hola"}}]}
            """.trimIndent(),
        )
        assertEquals("cover", DomainJson.editProposal(propuesta).sectionKey.value)
    }

    @Test
    fun `un plan de migracion completo va y vuelve`() {
        val plan = Templates2Json.readTree(
            """
            {"templateSlug":"boda-clasica","from":"1.0.0","to":"2.0.0","ops":[
              {"op":"renameBlock","from":"a.old","to":"a.new"},
              {"op":"removeBlock","id":"b.old"},
              {"op":"addBlock","id":"c.new"},
              {"op":"renameSection","from":"cover","to":"portada"},
              {"op":"removeSection","key":"gallery"},
              {"op":"renamePalette","from":"olive","to":"olivo"},
              {"op":"renameFontSet","from":"clasica","to":"clasico"},
              {"op":"changeBlockType","id":"d.txt","converterId":"textToRichText"},
              {"op":"moveIntoGroup","blockId":"e.one","groupId":"g.all","itemBlockId":"one"},
              {"op":"flattenGroup","groupId":"g.all","itemBlockId":"one","toBlockId":"e.one"},
              {"op":"shrinkGroup","groupId":"g.all","max":3}
            ]}
            """.trimIndent(),
        )
        ida(plan) { DomainJson.encode(DomainJson.migrationPlan(it)) }
        assertEquals(11, DomainJson.migrationPlan(plan).ops.size)
    }
}
