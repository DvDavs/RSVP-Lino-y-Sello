package mx.evolutiondev.invitaciones.modules.templates2

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockKind
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Inventario de golden (`contratos.md §6`, `06 §3`). Añadir un caso solo en un lado es imposible: el
 * otro lo ve aparecer y, si no sabe interpretarlo, falla.
 */
class GoldenInventoryTest {

    @Test
    fun `30 invariantes, 14 tipos de bloque, 11 operaciones`() {
        assertEquals(30, Golden.listar("invariants").size, "contratos.md §3: 30 invariantes")
        assertEquals(14, Golden.listar("blocks").size, "contratos.md §3: 14 tipos de bloque")
        assertEquals(11, Golden.listar("operations").size, "ADR-1R-X-01: 11 operaciones, clearItemBlock incluida")
    }

    @Test
    fun `hay un fichero de bloques por cada BlockKind`() {
        val esperados = BlockKind.entries.map { it.wire + ".cases.json" }.sorted()
        assertEquals(esperados, Golden.listar("blocks"))
    }

    @Test
    fun `las 11 operaciones del catalogo cerrado tienen fichero`() {
        val esperados = listOf(
            "addItem", "clearBlock", "clearItemBlock", "moveItem", "removeItem", "reorderSections",
            "setBlock", "setItemBlock", "setSectionVariant", "setSectionVisible", "setTheme",
        ).map { "$it.cases.json" }.sorted()
        assertEquals(esperados, Golden.listar("operations"))
    }

    /**
     * `golden/migrations/` traía **0 pares** antes/después mientras `migrate.ts` no existía
     * (ADR-2-0a-03). El bloque 2-2 lo implementó y sintetizó los pares con código —ADR-1R-D-09
     * prohíbe *escribir* golden a mano, no *sintetizarlos*—, así que ahora hay además `index.json`
     * (los casos con estructura de directorio) y `errors.cases.json` (los cinco `MigrationError`).
     */
    @Test
    fun `migrations trae formas, errores e indice de pares`() {
        assertEquals(listOf("errors.cases.json", "index.json", "op-shapes.cases.json"), Golden.listar("migrations"))
        assertEquals(22, Golden.leer("migrations", "op-shapes.cases.json").size())
        assertEquals(5, Golden.leer("migrations", "errors.cases.json").get("casos").size())
        val indice = Golden.leer("migrations", "index.json")
        assertTrue(indice.get("migrate").size() > 0, "06 §3 exige pares antes/despues-esperado")
        assertTrue(indice.get("switch").size() > 0, "01 §6.4: switchTemplate también tiene golden")
    }

    /**
     * **OCHO** ficheros desde 2-2: `assets.json` emite el `AssetIndex` como dato (objeción O-06). Sin
     * él, la regla `assetId → url` vivía solo en un `.ts` del generador y Kotlin no podía reproducir
     * `compuesto.json` sin copiar una convención de fixture que **no** es la de producción (`02 §10.4`).
     */
    @Test
    fun `cada carpeta de plantilla trae sus ocho ficheros`() {
        for (plantilla in Golden.plantillas) {
            val esperados = listOf(
                "assets.json", "business.json", "compuesto.json", "defaults.json", "documento.json",
                "reporte.json", "template.json", "theme.json",
            )
            assertEquals(esperados, Golden.listar("templates/$plantilla"), plantilla)
        }
    }

    /** El fixture base del reductor y los lotes son dato dentro de `golden/` (objeción O-01). */
    @Test
    fun `golden-fixtures trae el fixture base del reductor y los lotes`() {
        assertEquals(listOf("operations-base.json", "operations-batches.json"), Golden.listar("fixtures"))
        val base = Golden.leer("fixtures", "operations-base.json")
        for (campo in listOf("manifest", "theme", "defaults", "documento", "assetMeta", "ulidSeed"))
            assertTrue(base.has(campo), "el fixture base debe traer `$campo` o `reducerResult` es inservible")
    }

    /** `golden/compose/` es la tabla de las ramas de R1-R9 sin cubrir que señaló O-10. */
    @Test
    fun `golden-compose trae los casos de las reglas de composicion`() {
        val ficheros = Golden.listar("compose")
        assertTrue(ficheros.size >= 15, "O-10: una rama por caso; hoy ${ficheros.size}")
        assertTrue(ficheros.all { it.endsWith(".case.json") })
    }

    @Test
    fun `los ficheros de bloques traen los seis tags obligatorios`() {
        val obligatorios = setOf("P", "PM", "N-kind", "N-shape", "N-limit", "N-null")
        for (fichero in Golden.listar("blocks")) {
            val tags = Golden.leer("blocks", fichero).map { it.get("tag").textValue() }.toSet()
            assertTrue(tags.containsAll(obligatorios), "$fichero: faltan ${obligatorios - tags}")
        }
    }
}
