package mx.evolutiondev.invitaciones.modules.templates2

import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.InvariantCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory

/**
 * **Objeción O-11 de `bitacora/2-0a-REV.md`.** `06 §4` dice que la comparación de invariantes es por
 * `code` **y `path`**, pero el `expect` de los golden solo lleva códigos y el `path` se descarta en
 * los dos lados: un `Invariants.kt` que emitiera los códigos correctos con rutas equivocadas pasaría
 * `InvariantParityTest` entero.
 *
 * Esta prueba cierra ese hueco con las rutas literales que produce `invariants.ts`. No sustituye a un
 * golden con `path` —eso exige regenerar los 30 ficheros, y ese cambio necesita ADR— pero deja la
 * convención fijada y comprobada.
 */
class InvariantPathTest {

    /** Para los casos de `validateValueAgainstSpec`, toda ruta emitida cuelga del `path` del caso. */
    @TestFactory
    fun `las rutas de validateValueAgainstSpec cuelgan del path del caso`(): List<DynamicTest> =
        Golden.listar("invariants").flatMap { fichero ->
            Golden.leer("invariants", fichero).mapIndexed { i, caso -> i to caso }
                .filter { (_, c) -> c.get("fn").textValue() == "validateValueAgainstSpec" }
                .map { (i, caso) ->
                    DynamicTest.dynamicTest("$fichero [$i] ${caso.get("name").textValue()}") {
                        val path = caso.get("path").textValue()
                        val vs = Invariants.validateValueAgainstSpec(
                            DomainJson.blockSpec(caso.get("spec"), "spec"),
                            DomainJson.blockValue(caso.get("input"), "input"),
                            path,
                        )
                        assertTrue(vs.all { it.path.startsWith(path) }, "rutas fuera de \"$path\": ${vs.map { it.path }}")
                    }
                }
        }

    /** Rutas literales de `validateManifest`, tal como las escribe `invariants.ts`. */
    @Test
    fun `validateManifest usa las rutas de invariants-ts`() {
        val manifiesto = Templates2Json.readTree(MANIFIESTO_ROTO) as ObjectNode
        val vs = Invariants.validateManifest(
            DomainJson.manifest(manifiesto, "manifest"),
            DomainJson.theme(Templates2Json.readTree(TEMA_ROTO)),
            DomainJson.defaults(Templates2Json.readTree(DEFAULTS_ROTOS)),
        )
        val porCodigo = vs.groupBy({ it.code }, { it.path })
        assertEquals(listOf("sections.cover.defaultVariant"), porCodigo[InvariantCode.I_08_DEFAULT_VARIANT_UNKNOWN])
        assertEquals(listOf("blocks.cover.title"), porCodigo[InvariantCode.I_05_BUSINESS_FIELD_MISSING])
        assertEquals(
            listOf("theme.defaultPaletteId", "theme.defaultFontSetId"),
            porCodigo[InvariantCode.I_09_THEME_DEFAULT_UNKNOWN],
        )
        assertEquals(listOf("defaults.no.existe"), porCodigo[InvariantCode.I_10_DEFAULT_KEY_UNKNOWN])
        assertTrue(vs.any { it.code == InvariantCode.I_27_LOCALIZED_TEXT_MISSING_LOCALE && it.path == "name" })
        assertTrue(vs.any { it.detail == "en-US" }, "I-27 lleva el locale que falta en `detail`")
    }

    /** Rutas literales de `validateDocument`. */
    @Test
    fun `validateDocument usa las rutas de invariants-ts`() {
        val manifiesto = DomainJson.manifest(Golden.leer("templates/boda-clasica-1.0.0", "template.json"))
        val tema = DomainJson.theme(Golden.leer("templates/boda-clasica-1.0.0", "theme.json"))
        val doc = Golden.leer("templates/boda-clasica-1.0.0", "documento.json") as ObjectNode
        (doc.get("theme") as ObjectNode).put("paletteId", "no-existe").put("fontSetId", "tampoco")
        (doc.get("meta") as ObjectNode).put("locale", "en-US")
        (doc.get("content") as ObjectNode)
            .set<ObjectNode>("no.declarado", Templates2Json.mapper.createObjectNode().put("kind", "text").put("value", "x"))
        val estructura = (doc.get("structure") as ObjectNode).get("sections")
        (estructura[0] as ObjectNode).put("variant", "inventada")

        val vs = Invariants.validateDocument(DomainJson.document(doc), manifiesto, tema)
        val porCodigo = vs.groupBy({ it.code }, { it.path })
        assertEquals(listOf("meta.locale"), porCodigo[InvariantCode.I_23_LOCALE_NOT_SUPPORTED])
        assertEquals(listOf("theme.paletteId", "theme.fontSetId"), porCodigo[InvariantCode.I_20_THEME_ID_UNKNOWN])
        assertEquals(listOf("content.no.declarado"), porCodigo[InvariantCode.I_12_CONTENT_KEY_UNKNOWN])
        assertEquals(listOf("structure.cover.variant"), porCodigo[InvariantCode.I_08_DEFAULT_VARIANT_UNKNOWN])
    }

    /** Rutas de grupo: `<path>[<itemId>]` y `<path>[<itemId>].<itemBlockId>`. */
    @Test
    fun `las rutas dentro de un grupo llevan el itemId entre corchetes`() {
        val spec = DomainJson.blockSpec(Templates2Json.readTree(GRUPO_SPEC), "spec")
        val valor = DomainJson.blockValue(Templates2Json.readTree(GRUPO_VALOR), "value")
        val vs = Invariants.validateValueAgainstSpec(spec, valor, "content.event.cards")
        val rutas = vs.map { it.path }.toSet()
        assertTrue(rutas.contains("content.event.cards[01J9ZQ8H000000000000000001]"), rutas.toString())
        assertTrue(rutas.contains("content.event.cards[01J9ZQ8H000000000000000001].sinDeclarar"), rutas.toString())
    }

    @Test
    fun `validateReorder usa la ruta de la operacion`() {
        val vs = Invariants.validateReorder(listOf("cover", "cover"), listOf("cover", "event"))
        assertEquals("operations.reorderSections.order", vs.single().path)
        assertEquals("esperaba una permutación de [cover,event]", vs.single().detail)
        assertTrue(Invariants.validateReorder(listOf("event", "cover"), listOf("cover", "event")).isEmpty())
    }

    private companion object {
        const val MANIFIESTO_ROTO = """
        {
          "manifestVersion": 1, "slug": "fixture-tpl", "version": "1.0.0",
          "name": {"es-MX": "Plantilla"}, "eventKinds": ["generic"], "locales": ["es-MX", "en-US"],
          "sections": [{
            "key": "cover", "type": "cover", "title": {"es-MX": "Portada", "en-US": "Cover"},
            "variants": ["full"], "defaultVariant": "otra",
            "blocks": [{
              "id": "cover.title", "role": "coverTitle",
              "label": {"es-MX": "Título", "en-US": "Title"},
              "source": "business", "type": "text"
            }]
          }]
        }
        """
        const val TEMA_ROTO = """
        {
          "palettes": [{"id":"olive","name":{"es-MX":"Olivo"},"tokens":{
            "bg":"#FFFFFF","surface":"#F5F5F0","ink":"#222222",
            "accent":"#556B2F","accentInk":"#FFFFFF","muted":"#999999"}}],
          "fontSets": [{"id":"clasica","name":{"es-MX":"Clásica"},
            "heading":{"family":"Playfair Display","weights":[400],"source":"bundled"},
            "body":{"family":"Lora","weights":[400],"source":"bundled"}}],
          "defaultPaletteId": "inexistente", "defaultFontSetId": "inexistente"
        }
        """
        const val DEFAULTS_ROTOS = """
        {"templateSlug":"fixture-tpl","templateVersion":"1.0.0",
         "content":{"no.existe":{"kind":"text","value":"x"}}}
        """
        const val GRUPO_SPEC = """
        {
          "id": "event.cards", "role": "eventCards", "label": {"es-MX": "Tarjetas"},
          "type": "group", "min": 0, "max": 12, "reorderable": true,
          "itemLabel": {"es-MX": "Tarjeta"},
          "itemBlocks": [{"id":"titulo","role":"sectionTitle","label":{"es-MX":"Título"},"type":"text"}]
        }
        """
        const val GRUPO_VALOR = """
        {"kind":"group","items":[
          {"itemId":"01J9ZQ8H000000000000000001","values":{"titulo":{"kind":"text","value":"A"}}},
          {"itemId":"01J9ZQ8H000000000000000001","values":{"sinDeclarar":{"kind":"text","value":"B"}}}
        ]}
        """
    }
}
