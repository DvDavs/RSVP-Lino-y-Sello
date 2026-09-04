package mx.evolutiondev.invitaciones.modules.templates2.composition

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.TestFactory

/**
 * Lotes: resolución de `tempId` **dentro** del lote y en orden, y política **todo o nada** del editor
 * humano (`01 §6.5`, ADR-014). El cliente nunca aporta ULIDs (ADR-020, P8): `addItem` los genera el
 * servidor y las operaciones posteriores del mismo lote los resuelven contra `idMap`.
 *
 * Los casos viven en `golden/fixtures/` para no alterar el recuento contractual de 11 ficheros de
 * `golden/operations/` (`contratos.md §6`).
 */
class OperationBatchGoldenTest {

    private val base: JsonNode = Golden.leer("fixtures", "operations-base.json")
    private val lotes: JsonNode = Golden.leer("fixtures", "operations-batches.json")
    private val pkg: TemplatePackage =
        GoldenComposition.paquete(base.get("manifest"), base.get("theme"), base.get("defaults"))
    private val documento: InvitationDocument = DomainJson.document(base.get("documento"))
    private val ulids: List<String> = lotes.get("ulidsDelLote").map { it.textValue() }
    private val metadatos: Map<String, AssetMeta> = base.get("assetMeta").let { n ->
        n.fieldNames().asSequence().associateWith { id ->
            val a = n.get(id)
            AssetMeta(a.get("bytes").longValue(), a.get("width")?.intValue(), a.get("height")?.intValue(), a.get("contentType").textValue())
        }
    }

    private fun contexto(): ReducerContext {
        var i = 0
        return ReducerContext(pkg, { ulids[i++] }, { id: AssetId -> metadatos[id.value] })
    }

    @TestFactory
    fun `applyBatch reproduce el resultado de TypeScript`(): List<DynamicTest> =
        lotes.get("casos").map { caso ->
            DynamicTest.dynamicTest(caso.get("name").textValue()) {
                val ops: List<Operation> = caso.get("operations").map { DomainJson.operation(it, "op") }
                val obtenido = GoldenComposition.encode(DefaultOperationReducer.applyBatch(documento, ops, contexto()))
                assertEquals(
                    GoldenComposition.canonical(GoldenComposition.sinDetail(caso.get("expect"))),
                    GoldenComposition.canonical(GoldenComposition.sinDetail(obtenido)),
                    caso.get("descripcion").textValue(),
                )
            }
        }

    @TestFactory
    fun `ningun lote muta el documento de entrada`(): List<DynamicTest> =
        lotes.get("casos").map { caso ->
            DynamicTest.dynamicTest(caso.get("name").textValue()) {
                val antes = GoldenComposition.canonical(DomainJson.encode(documento))
                DefaultOperationReducer.applyBatch(
                    documento, caso.get("operations").map { DomainJson.operation(it, "op") }, contexto(),
                )
                assertEquals(antes, GoldenComposition.canonical(DomainJson.encode(documento)))
            }
        }

    @TestFactory
    fun `los casos cubren tempId resuelto, sin resolver, duplicado y el todo-o-nada`(): List<DynamicTest> =
        listOf(
            "tempId resuelto dentro del lote" to true,
            "tempId sin resolver" to false,
            "tempId duplicado en el mismo lote" to false,
            "todo o nada: la segunda operación falla y NADA se aplica" to false,
            "lote válido de tres operaciones" to true,
        ).map { (nombre, ok) ->
            DynamicTest.dynamicTest(nombre) {
                val caso = lotes.get("casos").first { it.get("name").textValue() == nombre }
                assertEquals(ok, caso.get("expect").get("ok").booleanValue())
                if (!ok) assertTrue(caso.get("expect").has("opIndex"), "el error del lote dice QUÉ operación falló")
            }
        }
}
