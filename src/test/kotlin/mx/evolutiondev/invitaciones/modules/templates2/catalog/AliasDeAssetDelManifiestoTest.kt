package mx.evolutiondev.invitaciones.modules.templates2.catalog

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * I-09 (ADR-3B-I09-01) — `AssetEntry.id` en el REGISTRO: el manifiesto puede declarar el alias de
 * cada archivo, el espejo Kotlin lo lee y lo vuelve a escribir igual, y **dos assets del mismo
 * manifiesto no pueden declarar el mismo id** (con un mapa, una de las dos imágenes desaparecería en
 * silencio; P1 lo prohíbe).
 *
 * Entre VERSIONES distintas del mismo paquete no hay colisión que resolver: el `AssetIndex` se
 * construye con el manifiesto de la versión que el documento usa, y solo con ese
 * (`EditorDocumentService.filasIndexadas`).
 */
class AliasDeAssetDelManifiestoTest {

    private val parser = TemplatePackageParser(JsonSchemaValidatorService(JsonSchemaRegistry()))

    @Test
    fun `el ejemplo de boda-clasica declara el alias de rsvp-bg y el parser lo conserva`() {
        val validado = parser.parse(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))

        val fondo = validado.manifest.assets.first { it.path == "assets/rsvp-bg.webp" }
        assertEquals(AssetId("as_01J8DEM000000000000000RSV1"), fondo.id)
        // `rsvp.background` es `source:"fixed"`: su único origen posible es `defaults.json`, y sin el
        // alias ese `assetId` no resolvía nunca (bitacora/3-2d.md §5.3).
        assertTrue(
            validado.pkg.defaults.content.keys.any { it.value == "rsvp.background" },
            "el ejemplo tiene que traer el default de rsvp.background",
        )
    }

    @Test
    fun `un asset sin id sigue siendo valido - el cambio es aditivo`() {
        val validado = parser.parse(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        assertNull(validado.manifest.assets.first { it.path == "assets/preview.webp" }.id)
        // Y una plantilla entera sin un solo alias se registra igual que antes de I-09.
        assertTrue(parser.parse(PaqueteFixture.ejemplo("xv-jardin-1.0.0")).manifest.assets.all { it.id == null })
    }

    @Test
    fun `el id sobrevive al viaje de ida y vuelta por DomainJson (espejo del esquema Zod)`() {
        val manifiesto = parser.parse(PaqueteFixture.ejemplo("boda-clasica-1.0.0")).manifest
        val ida = DomainJson.encode(manifiesto)
        assertEquals(manifiesto, DomainJson.manifest(ida))
        assertEquals(
            "as_01J8DEM000000000000000RSV1",
            (ida.get("assets") as ArrayNode).first { it.get("path").asText() == "assets/rsvp-bg.webp" }
                .get("id").asText(),
        )
    }

    @Test
    fun `dos assets del mismo manifiesto con el mismo id se rechazan en el registro`() {
        val e = assertThrows<PackageAssetMismatchException> { parser.parse(conAliasRepetido()) }

        assertEquals(listOf("as_01J8DEM000000000000000RSV1"), e.details["duplicatedId"])
        assertTrue(e.message!!.contains("el mismo id"), e.message!!)
    }

    /** El manifiesto de `boda-clasica` con el MISMO alias en sus dos assets. */
    private fun conAliasRepetido(): RawTemplatePackage {
        val manifest = Golden.Ejemplos.leer("boda-clasica-1.0.0", "template").deepCopy<ObjectNode>()
        (manifest.get("assets") as ArrayNode).forEach {
            (it as ObjectNode).put("id", "as_01J8DEM000000000000000RSV1")
        }
        return PaqueteFixture.conAssetsReales(
            manifest,
            Golden.Ejemplos.leer("boda-clasica-1.0.0", "theme"),
            Golden.Ejemplos.leer("boda-clasica-1.0.0", "defaults"),
            emptyMap(),
        )
    }

    /**
     * El registro valida el manifiesto contra el **bundle JSON Schema emitido** antes de decodificarlo
     * (`02 §4` paso 1): si `AssetEntry` no admitiera `id`, `additionalProperties:false` haría fallar
     * las cuatro pruebas de arriba con `TPL_MALFORMED_JSON`, no con un `assertEquals`. Esta deja dicho
     * que el bundle regenerado y el espejo Kotlin dicen lo mismo.
     */
    @Test
    fun `el bundle emitido y el espejo Kotlin coinciden en que id es opcional`() {
        val conAlias = parser.parse(PaqueteFixture.ejemplo("boda-clasica-1.0.0"))
        val sinAlias = parser.parse(PaqueteFixture.ejemplo("xv-jardin-1.0.0"))
        assertEquals(1, conAlias.manifest.assets.count { it.id != null })
        assertEquals(0, sinAlias.manifest.assets.count { it.id != null })
    }
}
