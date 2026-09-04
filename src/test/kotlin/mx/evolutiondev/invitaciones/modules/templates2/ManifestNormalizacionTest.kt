package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.InvariantCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * **Objeción O-02 de `bitacora/2-0a-REV.md`, cerrada aquí.**
 *
 * `golden/templates/(*)/template.json` **no** es una copia del ejemplo: es la salida de
 * `TemplateManifest.parse(...)` de Zod, con los `.default()` ya inyectados (`itemBlocks[].source`,
 * `.editable`, `.aiEditable`). El JSON Schema emitido usa `io:"input"` y marca esos campos como
 * **opcionales**, así que un manifiesto crudo válido puede llegar a `Invariants.kt` sin ellos: si
 * Kotlin no aplicara los mismos defaults, `I-22` (`source !== "user"`) violaría sobre un manifiesto
 * que TypeScript acepta sin queja. Ningún golden cubre ese paso, por eso la prueba lo cubre
 * comparando el **crudo** de `diseno/ejemplos/` con el **normalizado** de `golden/templates/`.
 */
class ManifestNormalizacionTest {

    @TestFactory
    fun `normalizar el manifiesto crudo reproduce el normalizado por Zod`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { plantilla ->
            DynamicTest.dynamicTest(plantilla) {
                val crudo = Golden.Ejemplos.leer(plantilla, "template")
                val normalizadoPorZod = Golden.leer("templates/$plantilla", "template.json")
                val normalizadoPorKotlin = DomainJson.encode(DomainJson.manifest(crudo))
                assertEquals(
                    CanonicalJson.canonical(normalizadoPorZod),
                    CanonicalJson.canonical(normalizadoPorKotlin),
                    "$plantilla: la normalización de Kotlin no coincide con la de Zod (O-02)",
                )
            }
        }

    /** El crudo y el normalizado **no** son iguales: si lo fueran, la prueba anterior no probaría nada. */
    @TestFactory
    fun `el ejemplo crudo difiere del normalizado`(): List<DynamicTest> =
        Golden.Ejemplos.plantillas.map { plantilla ->
            DynamicTest.dynamicTest(plantilla) {
                assertNotEquals(
                    CanonicalJson.canonical(Golden.Ejemplos.leer(plantilla, "template")),
                    CanonicalJson.canonical(Golden.leer("templates/$plantilla", "template.json")),
                )
            }
        }

    /**
     * El caso concreto que O-02 describe: un `itemBlock` **sin** `source` llega válido contra el
     * esquema y, normalizado, es `source = "user"`, de modo que I-22 **no** viola.
     */
    @Test
    fun `un itemBlock sin source se normaliza a user y no dispara I-22`() {
        val crudo = Templates2Json.readTree(
            """
            {
              "id": "titulo", "role": "sectionTitle", "label": {"es-MX": "Título"},
              "type": "text"
            }
            """.trimIndent(),
        )
        val spec = DomainJson.blockSpec(crudo, "spec")
        assertEquals(BlockSource.USER, spec.source)
        assertTrue(spec.base.editable)
        assertTrue(spec.base.aiEditable)
        assertTrue(!spec.base.required)

        val manifiestoCrudo = manifiestoConItemBlockSinDefaults()
        val m = DomainJson.manifest(manifiestoCrudo, "manifest")
        val grupo = m.sections.single().blocks.single() as GroupSpec
        assertEquals(BlockSource.USER, grupo.itemBlocks.single().source)

        val violaciones = Invariants.validateManifest(m, temaMinimo(), defaultsVacios())
        assertTrue(
            violaciones.none { it.code == InvariantCode.I_22_ITEM_BLOCK_SOURCE_NOT_USER },
            "sin normalizar, I-22 violaría sobre un manifiesto que TypeScript acepta: $violaciones",
        )
    }

    /** Y con `source: "business"` explícito, I-22 **sí** viola: la normalización no lo tapa. */
    @Test
    fun `un itemBlock con source business dispara I-22`() {
        val crudo = manifiestoConItemBlockSinDefaults()
        val itemBlock = crudo.get("sections")[0].get("blocks")[0].get("itemBlocks")[0] as ObjectNode
        itemBlock.put("source", "business")
        val m = DomainJson.manifest(crudo, "manifest")
        val violaciones = Invariants.validateManifest(m, temaMinimo(), defaultsVacios())
        assertTrue(violaciones.any { it.code == InvariantCode.I_22_ITEM_BLOCK_SOURCE_NOT_USER })
    }

    private fun manifiestoConItemBlockSinDefaults() = Templates2Json.readTree(
        """
        {
          "manifestVersion": 1, "slug": "fixture-tpl", "version": "1.0.0",
          "name": {"es-MX": "Plantilla"}, "eventKinds": ["generic"], "locales": ["es-MX"],
          "sections": [{
            "key": "event", "type": "event", "title": {"es-MX": "Evento"},
            "variants": ["default"], "defaultVariant": "default",
            "blocks": [{
              "id": "event.cards", "role": "eventCards", "label": {"es-MX": "Tarjetas"},
              "type": "group", "itemLabel": {"es-MX": "Tarjeta"},
              "itemBlocks": [{"id": "titulo", "role": "sectionTitle", "label": {"es-MX": "Título"}, "type": "text"}]
            }]
          }]
        }
        """.trimIndent(),
    ) as ObjectNode

    private fun temaMinimo() = DomainJson.theme(
        Templates2Json.readTree(
            """
            {
              "palettes": [{"id":"olive","name":{"es-MX":"Olivo"},"tokens":{
                "bg":"#FFFFFF","surface":"#F5F5F0","ink":"#222222",
                "accent":"#556B2F","accentInk":"#FFFFFF","muted":"#999999"}}],
              "fontSets": [{"id":"clasica","name":{"es-MX":"Clásica"},
                "heading":{"family":"Playfair Display","weights":[400],"source":"bundled"},
                "body":{"family":"Lora","weights":[400],"source":"bundled"}}],
              "defaultPaletteId": "olive", "defaultFontSetId": "clasica"
            }
            """.trimIndent(),
        ),
    )

    private fun defaultsVacios() = DomainJson.defaults(
        Templates2Json.readTree("""{"templateSlug":"fixture-tpl","templateVersion":"1.0.0","content":{}}"""),
    )

    /** `attic` y `timezone` también llevan `.default()` y el esquema emitido no los exige (O-02). */
    @Test
    fun `attic ausente se normaliza a mapa vacio y timezone al valor por defecto`() {
        val doc = Golden.Ejemplos.leer("boda-clasica-1.0.0", "documento") as ObjectNode
        doc.remove("attic")
        assertTrue(DomainJson.document(doc).attic.isEmpty())

        val negocio = Golden.leer("templates/boda-clasica-1.0.0", "business.json") as ObjectNode
        negocio.remove("timezone")
        assertEquals("America/Mexico_City", DomainJson.businessSnapshot(negocio).timezone)
    }
}
