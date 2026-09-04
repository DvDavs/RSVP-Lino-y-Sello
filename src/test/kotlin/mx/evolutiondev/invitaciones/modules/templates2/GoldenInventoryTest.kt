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
     * `golden/migrations/` trae **0 pares** antes/después y un solo fichero de formas
     * (`op-shapes.cases.json`, ADR-2-0a-03): ninguno de los dos ejemplos declara `migrationsFrom`.
     * La prueba fija ese hecho para que el bloque que implemente `migrate()` lo vea cambiar.
     */
    @Test
    fun `migrations trae solo el fichero de formas`() {
        assertEquals(listOf("op-shapes.cases.json"), Golden.listar("migrations"))
        assertEquals(22, Golden.leer("migrations", "op-shapes.cases.json").size())
    }

    @Test
    fun `cada carpeta de plantilla trae sus siete ficheros`() {
        for (plantilla in Golden.Ejemplos.plantillas) {
            val esperados = listOf(
                "business.json", "compuesto.json", "defaults.json", "documento.json",
                "reporte.json", "template.json", "theme.json",
            )
            assertEquals(esperados, Golden.listar("templates/$plantilla"), plantilla)
        }
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
