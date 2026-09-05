package mx.evolutiondev.invitaciones.modules.templates2.composition

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * Las 11 operaciones contra `golden/operations/`, con el **fixture base emitido como dato**
 * (`golden/fixtures/operations-base.json`). Cierra la objeción O-01: antes, `expectManifestError` se
 * calculaba contra un `manifestFixture(...)` que vivía solo en `scripts/gen-golden-operations.ts`, así
 * que ni TypeScript ni Kotlin lo verificaban y el lector Kotlin tenía que reimplementar `fixtures.ts`.
 */
class OperationReducerGoldenTest {

    private val base: JsonNode = Golden.leer("fixtures", "operations-base.json")
    private val pkg: TemplatePackage =
        GoldenComposition.paquete(base.get("manifest"), base.get("theme"), base.get("defaults"))
    private val documento: InvitationDocument = DomainJson.document(base.get("documento"))
    private val semilla: String = base.get("ulidSeed").textValue()
    private val metadatos: Map<String, AssetMeta> = base.get("assetMeta").let { n ->
        n.fieldNames().asSequence().associateWith { id ->
            val a = n.get(id)
            AssetMeta(
                bytes = a.get("bytes").longValue(),
                width = a.get("width")?.takeIf { it.isNumber }?.intValue(),
                height = a.get("height")?.takeIf { it.isNumber }?.intValue(),
                contentType = a.get("contentType").textValue(),
            )
        }
    }
    private val ctx = ReducerContext(pkg, { semilla }, { id: AssetId -> metadatos[id.value] })

    private val operaciones = listOf(
        "setBlock", "clearBlock", "addItem", "removeItem", "moveItem", "setItemBlock", "clearItemBlock",
        "setSectionVisible", "setSectionVariant", "reorderSections", "setTheme",
    )

    @Test
    fun `el inventario es de 11 ficheros, clearItemBlock incluida`() {
        assertEquals(
            operaciones.map { "$it.cases.json" }.sorted(),
            Golden.listar("operations"),
            "contratos.md §3: 11 operaciones, no 10 (ADR-1R-X-01)",
        )
    }

    @TestFactory
    fun `el reductor de Kotlin reproduce reducerResult de TypeScript`(): List<DynamicTest> =
        Golden.listar("operations").flatMap { fichero ->
            Golden.leer("operations", fichero).mapIndexed { i, caso ->
                DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                    val esperado = caso.get("reducerResult")
                    if (esperado == null || esperado.isNull) {
                        // Forma inválida: la para el JSON Schema antes de llegar al reductor.
                        assertTrue(!caso.get("expectZodValid").booleanValue(), "reducerResult nulo con forma válida")
                        return@dynamicTest
                    }
                    val op = DomainJson.operation(caso.get("operation"), "operation")
                    val obtenido = GoldenComposition.encode(DefaultOperationReducer.apply(documento, op, ctx))
                    assertEquals(
                        GoldenComposition.canonical(GoldenComposition.sinDetail(esperado)),
                        GoldenComposition.canonical(GoldenComposition.sinDetail(obtenido)),
                        "operación: ${caso.get("operation")}",
                    )
                }
            }
        }

    /** El reductor es puro: el documento de entrada no se muta nunca. */
    @Test
    fun `aplicar una operacion no muta el documento de entrada`() {
        val antes = GoldenComposition.canonical(DomainJson.encode(documento))
        for (fichero in Golden.listar("operations")) {
            for (caso in Golden.leer("operations", fichero)) {
                if (!caso.get("expectZodValid").booleanValue()) continue
                DefaultOperationReducer.apply(documento, DomainJson.operation(caso.get("operation"), "op"), ctx)
            }
        }
        assertEquals(antes, GoldenComposition.canonical(DomainJson.encode(documento)))
    }

    /**
     * Las tres restricciones de asset que **ningún validador de valor puede ver** (X-06): `ImageValue`
     * y `AudioValue` solo llevan `assetId`. Son los tres `it.todo` que la revisión dejó visibles en
     * `invariant-gaps.contract.test.ts` porque el reductor no existía.
     */
    @Test
    fun `las tres restricciones de asset se validan en el reductor`() {
        val casos = Golden.leer("operations", "setBlock.cases.json")
        val codigos = casos.mapNotNull { it.get("reducerResult")?.get("error")?.get("code")?.textValue() }
        assertTrue(codigos.contains("TPL_ASSET_NOT_OWNED"), "pertenencia del asset (ADR-030)")
        assertTrue(codigos.count { it == "TPL_ASSET_SPEC_MISMATCH" } >= 2, "maxBytes y aspect (X-06)")
        val restricciones = casos.mapNotNull { it.get("reducerResult")?.get("error") }
            .filter { it.get("code").textValue() == "TPL_ASSET_SPEC_MISMATCH" }
            .map { it.get("constraint").textValue() }.toSet()
        assertEquals(setOf("maxBytes", "aspect"), restricciones)
    }

    /**
     * **I-01 / H-ADV-01**: un `RichSpan` con `marks` tiene que llegar al CODIFICADOR, no sólo al
     * validador de esquema. `DomainJson.encode(RichSpan)` hacía `o.set<ArrayNode>("marks", arr)`;
     * como `ObjectNode.set()` devuelve `this` y esa expresión era el valor de retorno del lambda de
     * `s.marks?.let {}`, Kotlin insertaba un `CHECKCAST` a `ArrayNode` → `ClassCastException` →
     * `500 TPL_INTERNAL` al escribir negrita o cursiva en el editor.
     *
     * Las 2 390 pruebas de la fase 3 no lo veían porque `marks` sólo aparecía en
     * `golden/blocks/richText.cases.json`, un fichero de casos de ESQUEMA que **nunca** pasa por
     * `DomainJson.encode`. Esta prueba recorre el camino real del editor —reductor y después
     * codificación del documento resultante— y ancla el caso: si desapareciera del generador,
     * fallaría aquí en vez de esfumarse en silencio.
     */
    @Test
    fun `un richText con marks pasa por el reductor y por el codificador (I-01)`() {
        val casos = Golden.leer("operations", "setBlock.cases.json")
            .filter { it.get("operation").toString().contains("\"marks\"") }
        assertTrue(casos.isNotEmpty(), "golden/operations/setBlock.cases.json sin ningún caso con `marks` (I-01)")

        for (caso in casos) {
            val op = DomainJson.operation(caso.get("operation"), "operation")
            val resultado = DefaultOperationReducer.apply(documento, op, ctx)
            assertTrue(resultado is OperationResult.Ok, "el reductor rechazó el caso: ${caso.get("name")}")

            // `GoldenComposition.encode` llama a `DomainJson.encode(doc)`: AQUÍ reventaba.
            val json = GoldenComposition.encode(resultado).toString()
            for (marca in listOf("[\"bold\"]", "[\"italic\"]", "[\"bold\",\"italic\"]"))
                assertTrue(json.contains("\"marks\":$marca"), "falta marks:$marca en el documento codificado")
            assertTrue(json.contains("\"href\":\"https://ejemplo.mx/mapa\""), "falta el href del span enlazado")

            // Y el resultado codificado es exactamente el `reducerResult` que emitió TypeScript.
            assertEquals(
                GoldenComposition.canonical(GoldenComposition.sinDetail(caso.get("reducerResult"))),
                GoldenComposition.canonical(GoldenComposition.sinDetail(GoldenComposition.encode(resultado))),
            )
        }
    }

    /** ADR-1R-F-04: la inversa de `setBlock` sobre un default es `clearBlock`, que BORRA la clave. */
    @Test
    fun `clearBlock borra la clave y no promueve el default a contenido de usuario`() {
        val op = DomainJson.operation(
            mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
                .readTree("""{"op":"clearBlock","blockId":"cover.title"}"""),
            "op",
        )
        val r = DefaultOperationReducer.apply(documento, op, ctx)
        assertTrue(r is OperationResult.Ok)
        val doc = (r as OperationResult.Ok).doc
        assertTrue(
            !doc.content.containsKey(mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId("cover.title")),
            "la clave desaparece de `content`: el bloque vuelve a resolverse por el escalón `default` (R2) " +
                "con `provenance:\"default\"`, que es lo que bloquea publicar (H-03)",
        )
    }
}
