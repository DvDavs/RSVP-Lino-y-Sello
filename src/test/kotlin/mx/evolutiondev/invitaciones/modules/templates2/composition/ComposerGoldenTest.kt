package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.Provenance
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * **Criterio de aceptación central del bloque 2-2**: el `compose` de Kotlin reproduce los MISMOS
 * `compuesto.json` y `reporte.json` que el de TypeScript sobre los dos ejemplos completos de la fase 1
 * (`golden/templates/`, `contratos.md §3`).
 *
 * El `AssetIndex` se lee del golden como **dato** (`assets.json`): la regla `assetId → url` que produjo
 * esos ficheros es una convención de fixture de la ronda 1R, **no** la de producción (`02 §10.4`), y
 * llevarla a `AssetUrlResolver` rompería todo asset cuya clave S3 no sea `<ULID>.webp` (objeción O-06).
 */
class ComposerGoldenTest {

    private val validador = JsonSchemaValidatorService(JsonSchemaRegistry())

    private fun caso(plantilla: String): Triple<mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult, String, String> {
        val dir = "templates/$plantilla"
        val pkg = GoldenComposition.paquete(
            Golden.leer(dir, "template.json"), Golden.leer(dir, "theme.json"), Golden.leer(dir, "defaults.json"),
        )
        val doc = DomainJson.document(Golden.leer(dir, "documento.json"))
        val negocio = DomainJson.businessSnapshot(Golden.leer(dir, "business.json"))
        val assets = GoldenComposition.assetIndex(Golden.leer(dir, "assets.json"))
        val r = DefaultComposer.compose(pkg, doc, negocio, assets, doc.meta.locale)
        return Triple(
            r,
            GoldenComposition.canonical(Golden.leer(dir, "compuesto.json")),
            GoldenComposition.canonical(Golden.leer(dir, "reporte.json")),
        )
    }

    @TestFactory
    fun `compose reproduce compuesto punto json de TypeScript`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { p ->
            DynamicTest.dynamicTest(p) {
                val (r, compuesto, _) = caso(p)
                assertEquals(compuesto, GoldenComposition.canonical(DomainJson.encode(r.composed)))
            }
        }

    @TestFactory
    fun `compose reproduce reporte punto json de TypeScript`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { p ->
            DynamicTest.dynamicTest(p) {
                val (r, _, reporte) = caso(p)
                assertEquals(reporte, GoldenComposition.canonical(DomainJson.encode(r.report)))
            }
        }

    /** R9: componer dos veces produce bytes idénticos. Sin reloj, sin aleatoriedad, sin ULIDs. */
    @TestFactory
    fun `compose es idempotente y determinista`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { p ->
            DynamicTest.dynamicTest(p) {
                val dir = "templates/$p"
                val pkg = GoldenComposition.paquete(
                    Golden.leer(dir, "template.json"), Golden.leer(dir, "theme.json"), Golden.leer(dir, "defaults.json"),
                )
                val doc = DomainJson.document(Golden.leer(dir, "documento.json"))
                val negocio = DomainJson.businessSnapshot(Golden.leer(dir, "business.json"))
                val assets = GoldenComposition.assetIndex(Golden.leer(dir, "assets.json"))
                val a = DefaultComposer.compose(pkg, doc, negocio, assets, doc.meta.locale)
                val b = DefaultComposer.compose(pkg, doc, negocio, assets, doc.meta.locale)
                assertEquals(ContentHasher.canonicalJson(a), ContentHasher.canonicalJson(b))
                assertEquals(ContentHasher.contentHash(a), ContentHasher.contentHash(b))
            }
        }

    /** El `ComposedDocument` producido es válido contra el JSON Schema emitido (P1, las dos capas). */
    @TestFactory
    fun `el compuesto valida contra el JSON Schema emitido`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { p ->
            DynamicTest.dynamicTest(p) {
                val (r, _, _) = caso(p)
                val violaciones = validador.validate("composed-document", DomainJson.encode(r.composed))
                assertTrue(violaciones.isEmpty(), "composed-document inválido: $violaciones")
            }
        }

    /** El informe también: `composition-report` es uno de los 10 punteros del bundle. */
    @TestFactory
    fun `el reporte valida contra el JSON Schema emitido`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { p ->
            DynamicTest.dynamicTest(p) {
                val (r, _, _) = caso(p)
                val violaciones = validador.validate("composition-report", DomainJson.encode(r.report))
                assertTrue(violaciones.isEmpty(), "composition-report inválido: $violaciones")
            }
        }

    /**
     * El `contentHash` cambia cuando cambia el **informe**, no solo el documento compuesto
     * (`01 §5.5`, dirimida X-02). Es la razón por la que el hash se calcula sobre `{composed, report}`:
     * sin el informe, un cambio en `stillDefault` no invalidaría el `ETag` del render público.
     */
    @Test
    fun `el contentHash depende del informe, no solo del compuesto`() {
        val (r, _, _) = caso("boda-clasica-1.0.0")
        val conInforme = ContentHasher.contentHash(r)
        val otro = r.copy(
            report = r.report.copy(
                stillDefault = r.report.stillDefault +
                    mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId("cover.title"),
            ),
        )
        assertNotEquals(conInforme, ContentHasher.contentHash(otro))
        assertEquals(
            GoldenComposition.canonical(DomainJson.encode(r.composed)),
            GoldenComposition.canonical(DomainJson.encode(otro.composed)),
            "el compuesto es idéntico: lo único que cambió es el informe",
        )
        assertTrue(conInforme.startsWith("sha256:"), "el hash se guarda CON prefijo de algoritmo (X-02)")
        assertEquals(71, conInforme.length)
    }

    /** H-03: un bloque `required` que sigue en contenido de demostración se marca, y eso bloquea publicar. */
    @Test
    fun `provenance distingue el contenido de demostración del del cliente`() {
        val (r, _, _) = caso("boda-clasica-1.0.0")
        val procedencias = r.composed.sections.flatMap { it.blocks }.map { it.provenance }.toSet()
        assertTrue(procedencias.contains(Provenance.USER), "algún bloque lo escribió el cliente")
        assertTrue(
            procedencias.any { it == Provenance.DEFAULT || it == Provenance.FIXED || it == Provenance.EMPTY },
            "y algún otro NO: si todo fuera 'user', H-03 seguiría siendo indetectable",
        )
    }
}
