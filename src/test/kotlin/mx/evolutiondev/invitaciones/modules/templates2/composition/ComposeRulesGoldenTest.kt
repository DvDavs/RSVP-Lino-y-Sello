package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * Paridad de las ramas de R1-R9 que los dos golden de `golden/templates/` **no** ejercitan
 * (objeción O-10 de `bitacora/2-0a-REV.md`): el fallback de tema de R8 y `report.themeFallback`
 * (`null` en los dos ejemplos), `orphanSections`, la clave de sección duplicada, la variante
 * desconocida, el asset ausente del `AssetIndex`, los seis `businessField` con datos y con nulos, los
 * cinco `formatId`, la medianoche de `h12`, los locales `es-ES`/`en-US`, los 13 kinds escalares y el
 * `invalidValues` no vacío de O-12.
 *
 * La revisión pedía justamente esto: **casos golden, no pruebas TS sueltas**. Una prueba TS sube la
 * cobertura de rama de `compose.ts` pero no cruza a Kotlin, así que no es cobertura de paridad.
 */
class ComposeRulesGoldenTest {

    private val ficheros: List<String> = Golden.listar("compose")

    @TestFactory
    fun `cada caso de golden-compose da el mismo compuesto y el mismo reporte que TypeScript`(): List<DynamicTest> =
        ficheros.map { f ->
            DynamicTest.dynamicTest(f) {
                val c = Golden.leer("compose", f)
                val pkg = GoldenComposition.paquete(c.get("manifest"), c.get("theme"), c.get("defaults"))
                val doc = DomainJson.document(c.get("documento"))
                val negocio = DomainJson.businessSnapshot(c.get("business"))
                val assets = GoldenComposition.assetIndex(c.get("assets"))
                val locale = Locale.of(c.get("locale").textValue())
                    ?: throw AssertionError("locale desconocido en $f")
                val r = DefaultComposer.compose(pkg, doc, negocio, assets, locale)
                assertEquals(
                    GoldenComposition.canonical(c.get("compuesto")),
                    GoldenComposition.canonical(DomainJson.encode(r.composed)),
                    "${c.get("name").textValue()}: ${c.get("descripcion").textValue()}",
                )
                assertEquals(
                    GoldenComposition.canonical(c.get("reporte")),
                    GoldenComposition.canonical(DomainJson.encode(r.report)),
                    "${c.get("name").textValue()}: informe",
                )
            }
        }

    @TestFactory
    fun `cada caso de golden-compose es idempotente`(): List<DynamicTest> =
        ficheros.map { f ->
            DynamicTest.dynamicTest(f) {
                val c = Golden.leer("compose", f)
                val pkg = GoldenComposition.paquete(c.get("manifest"), c.get("theme"), c.get("defaults"))
                val doc = DomainJson.document(c.get("documento"))
                val negocio = DomainJson.businessSnapshot(c.get("business"))
                val assets = GoldenComposition.assetIndex(c.get("assets"))
                val locale = Locale.of(c.get("locale").textValue())!!
                val a = DefaultComposer.compose(pkg, doc, negocio, assets, locale)
                val b = DefaultComposer.compose(pkg, doc, negocio, assets, locale)
                assertEquals(ContentHasher.contentHash(a), ContentHasher.contentHash(b))
            }
        }

    /**
     * El inventario: si alguien borra un caso de una rama, esta prueba lo dice. Los nombres son el
     * contrato (`golden/README.md`), no una convención suelta.
     */
    @Test
    fun `estan cubiertas las ramas que la revision 2-0a-REV senalo sin probar`() {
        val nombres = ficheros.joinToString(" ")
        for (marca in listOf(
            "r8-fallback-de-paleta-y-fontset", "r8-fallback-solo-de-paleta", "r8-sin-fallback",
            "r1-huerfana-duplicada-y-variante-desconocida", "r1c-insercion",
            "r2-tres-escalones-y-asset-ausente",
            "r4-negocio-los-seis-campos", "r4-negocio-con-nulos",
            "r6-formatos-es-MX", "r6-formatos-es-ES", "r6-formatos-en-US", "r6-formato-cruzado",
            "r7-grupos-usuario-default-y-vacio", "kinds-los-trece-escalares", "o12-invalid-values",
        )) assertTrue(nombres.contains(marca), "falta el caso golden `$marca` (O-10)")
    }

    /** O-12: el informe deja rastro de un valor presente pero inválido. Aquí NO está vacío. */
    @Test
    fun `invalidValues se puebla y va ordenado`() {
        val c = Golden.leer("compose", "o12-invalid-values.case.json")
        val invalidos = c.get("reporte").get("invalidValues")
        assertTrue(invalidos.size() >= 5, "el caso debe traer varios valores inválidos")
        val claves = invalidos.map { it.get("blockId").textValue() + "|" + it.get("code").textValue() }
        assertEquals(claves.sorted(), claves, "R9: `invalidValues` va ordenado por blockId y luego por código")
    }

    /** R8: el fallback se registra; NO se cae en silencio a la paleta por defecto. */
    @Test
    fun `el fallback de tema se registra en el informe`() {
        val c = Golden.leer("compose", "r8-fallback-de-paleta-y-fontset.case.json")
        val fb = c.get("reporte").get("themeFallback")
        assertEquals("no-existe", fb.get("paletteId").textValue())
        assertEquals("tampoco", fb.get("fontSetId").textValue())
        assertEquals("olive", c.get("compuesto").get("theme").get("paletteId").textValue())
    }
}
