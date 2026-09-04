package mx.evolutiondev.invitaciones.modules.templates2.migration

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.composition.GoldenComposition
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * `migrate()` y `switchTemplate()` contra `golden/migrations/` (`01 §6`). Los pares antes/después son
 * **sintetizados con código** por `scripts/gen-golden-migrations.ts`: ADR-1R-D-09 prohíbe *escribir*
 * golden a mano, no *sintetizarlos*, y la revisión 2-0a-REV (§5.4) fijó que "cero pares no cumple
 * `06 §3`". Todo el material de entrada (los dos paquetes completos, el plan y el documento) es dato
 * dentro de `golden/`: Kotlin no necesita conocer el generador.
 */
class MigrationGoldenTest {

    private val indice: JsonNode = Golden.leer("migrations", "index.json")

    private fun objeto(): ObjectNode = Templates2Json.mapper.createObjectNode()

    private fun encode(r: MigrationReport): ObjectNode {
        val o = objeto()
        val aplicadas = Templates2Json.mapper.createArrayNode()
        r.applied.forEach { aplicadas.add(objeto().put("op", it.op).put("target", it.target)) }
        o.set<ObjectNode>("applied", aplicadas)
        val movidas = Templates2Json.mapper.createArrayNode()
        r.moved.forEach { movidas.add(objeto().put("from", it.from).put("to", it.to)) }
        o.set<ObjectNode>("moved", movidas)
        val attic = Templates2Json.mapper.createArrayNode()
        r.toAttic.forEach { attic.add(objeto().put("blockId", it.blockId).put("reason", it.reason.wire)) }
        o.set<ObjectNode>("toAttic", attic)
        val convertidas = Templates2Json.mapper.createArrayNode()
        r.converted.forEach { convertidas.add(objeto().put("blockId", it.blockId).put("converterId", it.converterId)) }
        o.set<ObjectNode>("converted", convertidas)
        return o.put("lossless", r.lossless)
    }

    private fun encode(e: MigrationError): ObjectNode {
        val o = objeto().put("code", e.code)
        when (e) {
            is MigrationError.PlanVersionMismatch -> o.put("expected", e.expected).put("got", e.got)
            is MigrationError.TargetBlockUnknown -> o.put("op", e.op).put("blockId", e.blockId)
            is MigrationError.TargetBlockExists -> o.put("op", e.op).put("blockId", e.blockId)
            is MigrationError.ConverterUnsupported -> o.put("from", e.from).put("to", e.to)
            is MigrationError.ResultInvalid -> {
                val arr = Templates2Json.mapper.createArrayNode()
                e.violations.forEach { arr.add(GoldenComposition.encode(it)) }
                o.set<ObjectNode>("violations", arr)
            }
        }
        return o
    }

    private val pares: List<String> = indice.get("migrate").map { it.textValue() }
    private val cambios: List<String> = indice.get("switch").map { it.textValue() }

    @Test
    fun `hay al menos un par antes-despues y un caso de switchTemplate`() {
        assertTrue(pares.isNotEmpty(), "06 §3 exige pares antes/despues-esperado; ADR-2-0a-03 queda cerrada")
        assertTrue(cambios.isNotEmpty())
    }

    @TestFactory
    fun `migrate reproduce despues-esperado punto json de TypeScript`(): List<DynamicTest> =
        pares.map { dir ->
            DynamicTest.dynamicTest(dir) {
                val ruta = "migrations/$dir"
                val from = GoldenComposition.paqueteDe(ruta, "from")
                val to = GoldenComposition.paqueteDe(ruta, "to")
                val plan = DomainJson.migrationPlan(Golden.leer(ruta, "plan.json"))
                val antes = DomainJson.document(Golden.leer(ruta, "antes.json"))
                val r = DocumentMigrator.migrate(antes, from, to, plan)
                assertTrue(r is MigrationResult.Ok, "migrate falló: $r")
                r as MigrationResult.Ok
                assertEquals(
                    GoldenComposition.canonical(Golden.leer(ruta, "despues-esperado.json")),
                    GoldenComposition.canonical(DomainJson.encode(r.doc)),
                )
                assertEquals(
                    GoldenComposition.canonical(Golden.leer(ruta, "reporte-esperado.json")),
                    GoldenComposition.canonical(encode(r.report)),
                )
            }
        }

    /** `01 §6.3`: una migración es **pura** — mismo documento + mismo plan → mismo resultado. */
    @TestFactory
    fun `migrate es pura`(): List<DynamicTest> =
        pares.map { dir ->
            DynamicTest.dynamicTest(dir) {
                val ruta = "migrations/$dir"
                val from = GoldenComposition.paqueteDe(ruta, "from")
                val to = GoldenComposition.paqueteDe(ruta, "to")
                val plan = DomainJson.migrationPlan(Golden.leer(ruta, "plan.json"))
                val antes = DomainJson.document(Golden.leer(ruta, "antes.json"))
                val a = DocumentMigrator.migrate(antes, from, to, plan) as MigrationResult.Ok
                val b = DocumentMigrator.migrate(antes, from, to, plan) as MigrationResult.Ok
                assertEquals(
                    GoldenComposition.canonical(DomainJson.encode(a.doc)),
                    GoldenComposition.canonical(DomainJson.encode(b.doc)),
                )
            }
        }

    /** ADR-006: **nada se borra jamás**. Todo lo que sale de `content` está en el `attic`. */
    @TestFactory
    fun `nada se borra - todo lo que pierde destino esta en el attic`(): List<DynamicTest> =
        pares.map { dir ->
            DynamicTest.dynamicTest(dir) {
                val ruta = "migrations/$dir"
                val from = GoldenComposition.paqueteDe(ruta, "from")
                val to = GoldenComposition.paqueteDe(ruta, "to")
                val plan = DomainJson.migrationPlan(Golden.leer(ruta, "plan.json"))
                val antes = DomainJson.document(Golden.leer(ruta, "antes.json"))
                val r = DocumentMigrator.migrate(antes, from, to, plan) as MigrationResult.Ok
                val clave = "${from.manifest.slug.value}@${from.manifest.version}"
                for (e in r.report.toAttic) {
                    val guardado = r.doc.attic[clave]
                        ?.get(mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId(e.blockId))
                    assertTrue(guardado != null, "${e.blockId} salió de content y NO está en el attic")
                }
                // Y ninguna clave de `content` sobrevive sin declararse en la versión destino.
                val declarados = to.manifest.topLevelBlocks().keys
                assertTrue(r.doc.content.keys.all { declarados.contains(it) })
            }
        }

    @Test
    fun `el par principal ejercita las once operaciones de migracion`() {
        val ops = pares.flatMap { dir ->
            DomainJson.migrationPlan(Golden.leer("migrations/$dir", "plan.json")).ops.map { it.op }
        }.toSet()
        for (op in listOf(
            "renameBlock", "removeBlock", "addBlock", "renameSection", "removeSection", "renamePalette",
            "renameFontSet", "changeBlockType", "moveIntoGroup", "flattenGroup", "shrinkGroup",
        )) assertTrue(ops.contains(op), "el catálogo cerrado de `01 §6.2` exige un caso de $op")
    }

    @TestFactory
    fun `los cinco MigrationError coinciden con TypeScript`(): List<DynamicTest> {
        val f = Golden.leer("migrations", "errors.cases.json")
        val from = GoldenComposition.paquete(
            f.get("from").get("manifest"), f.get("from").get("theme"), f.get("from").get("defaults"),
        )
        val to = GoldenComposition.paquete(
            f.get("to").get("manifest"), f.get("to").get("theme"), f.get("to").get("defaults"),
        )
        return f.get("casos").map { caso ->
            DynamicTest.dynamicTest(caso.get("name").textValue()) {
                val plan = DomainJson.migrationPlan(caso.get("plan"))
                val antes = DomainJson.document(caso.get("antes"))
                val r = DocumentMigrator.migrate(antes, from, to, plan)
                assertTrue(r is MigrationResult.Failed, "esperaba un MigrationError y migró bien")
                assertEquals(
                    GoldenComposition.canonical(GoldenComposition.sinDetail(caso.get("expectError"))),
                    GoldenComposition.canonical(GoldenComposition.sinDetail(encode((r as MigrationResult.Failed).error))),
                )
            }
        }
    }

    @TestFactory
    fun `switchTemplate reproduce el documento y el informe de TypeScript`(): List<DynamicTest> =
        cambios.map { dir ->
            DynamicTest.dynamicTest(dir) {
                val ruta = "migrations/$dir"
                val from = GoldenComposition.paqueteDe(ruta, "from")
                val to = GoldenComposition.paqueteDe(ruta, "to")
                val antes = DomainJson.document(Golden.leer(ruta, "antes.json"))
                val r = DocumentMigrator.switchTemplate(antes, from, to)
                assertEquals(
                    GoldenComposition.canonical(Golden.leer(ruta, "despues-esperado.json")),
                    GoldenComposition.canonical(DomainJson.encode(r.doc)),
                )
                val informe = objeto()
                val casadas = Templates2Json.mapper.createArrayNode()
                r.report.matchedByRole.forEach {
                    casadas.add(objeto().put("fromBlockId", it.fromBlockId).put("toBlockId", it.toBlockId).put("role", it.role))
                }
                informe.set<ObjectNode>("matchedByRole", casadas)
                val attic = Templates2Json.mapper.createArrayNode()
                r.report.toAttic.forEach { attic.add(it) }
                informe.set<ObjectNode>("toAttic", attic)
                val reset = Templates2Json.mapper.createArrayNode()
                r.report.reset.forEach { reset.add(it) }
                informe.set<ObjectNode>("reset", reset)
                assertEquals(
                    GoldenComposition.canonical(Golden.leer(ruta, "reporte-esperado.json")),
                    GoldenComposition.canonical(informe),
                )
            }
        }

    /** ADR-1R-D-07: los grupos van **siempre** al attic; nunca se transportan. */
    @TestFactory
    fun `switchTemplate no transporta ningun grupo`(): List<DynamicTest> =
        cambios.map { dir ->
            DynamicTest.dynamicTest(dir) {
                val ruta = "migrations/$dir"
                val from = GoldenComposition.paqueteDe(ruta, "from")
                val to = GoldenComposition.paqueteDe(ruta, "to")
                val antes = DomainJson.document(Golden.leer(ruta, "antes.json"))
                val r = DocumentMigrator.switchTemplate(antes, from, to)
                assertTrue(
                    r.doc.content.values.none { it is mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue },
                    "un `eventCards` de otra plantilla tiene otros itemBlocks: copiarlo es H-01",
                )
                val clave = "${from.manifest.slug.value}@${from.manifest.version}"
                assertTrue(r.doc.attic.containsKey(clave), "clave del attic: <slug>@<semver>")
            }
        }

    /** Los `itemId` que crea `moveIntoGroup` son ULID válidos y deterministas (`01 §6.2` + `§6.3`). */
    @Test
    fun `el itemId sintetizado por moveIntoGroup es un ULID valido`() {
        val gen = DocumentMigrator.deterministicUlids()
        val ids = List(3) { gen() }
        assertEquals(ids.distinct().size, ids.size, "únicos dentro del grupo (I-03)")
        for (id in ids) {
            assertEquals(26, id.length)
            assertTrue(
                Regex("^[0-9A-HJKMNP-TV-Z]{26}$").matches(id),
                "$id no es Crockford base32 en mayúsculas",
            )
            mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId(id)   // rechaza en el constructor
        }
        // Determinista: dos generadores independientes producen la MISMA secuencia. Es lo que permite
        // que `migrate` cumpla a la vez la firma de cuatro parámetros de §6.1 y la pureza de §6.3.
        val otro = DocumentMigrator.deterministicUlids()
        assertEquals(ids, List(3) { otro() })
    }
}
