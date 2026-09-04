package mx.evolutiondev.invitaciones.modules.templates2.catalog

import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.Golden
import mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaRegistry
import mx.evolutiondev.invitaciones.modules.templates2.schema.JsonSchemaValidatorService
import mx.evolutiondev.invitaciones.modules.templates2.schema.PackageHasher
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

/**
 * [TemplatePackageParser]: pasos 1 y 2 de `02 §4`. Se construye sin Spring —`JsonSchemaRegistry` no
 * necesita contexto— para que estas pruebas no dependan de PostgreSQL.
 */
class TemplatePackageParserTest {

    private val parser = TemplatePackageParser(JsonSchemaValidatorService(JsonSchemaRegistry()))

    @Test
    fun `los dos ejemplos completos de la fase 1 son paquetes validos y su package_hash lleva prefijo`() {
        for (plantilla in Golden.Ejemplos.plantillas) {
            val validado = parser.parse(PaqueteFixture.ejemplo(plantilla))
            assertEquals(plantilla, "${validado.slug}-${validado.version}")
            assertTrue(
                Patterns.PREFIXED_SHA256.matches(validado.packageHash),
                "package_hash de $plantilla debe casar ^sha256:[0-9a-f]{64}$ (01 §2.1, X-01): ${validado.packageHash}",
            )
            assertEquals(validado.manifest.assets.size, validado.assets.size)
        }
    }

    @Test
    fun `el package_hash es el de PackageHasher, no una formula propia`() {
        val raw = PaqueteFixture.ejemplo("xv-jardin-1.0.0")
        val validado = parser.parse(raw)
        val esperado = PackageHasher.packageHash(
            manifest = Templates2Json.mapper.readTree(raw.files.getValue("template.json")),
            theme = Templates2Json.mapper.readTree(raw.files.getValue("theme.json")),
            defaults = Templates2Json.mapper.readTree(raw.files.getValue("defaults.json")),
            migraciones = emptyMap(),
            assets = raw.files.filterKeys { it.startsWith("assets/") }.mapKeys { it.key.removePrefix("assets/") },
        )
        assertEquals(esperado, validado.packageHash)
    }

    /**
     * Regresión de ADR-1R-D-03 / objeción O-06: con la fórmula vieja (manifiesto + assets) dos
     * paquetes que solo diferían en `defaults.json` daban el **mismo** `package_hash` y el segundo se
     * descartaba como no-op **en silencio**.
     */
    @Test
    fun `cambiar solo defaults_json cambia el package_hash`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val defaults = Templates2Json.mapper.readTree(base.files.getValue("defaults.json")).deepCopy<ObjectNode>()
        val contenido = defaults.get("content") as ObjectNode
        val titulo = contenido.get("cover.title") as ObjectNode
        titulo.put("value", "Otro texto de demostración")
        val modificado = RawTemplatePackage(
            base.files.toMutableMap().apply { put("defaults.json", PaqueteFixture.texto(defaults)) },
        )
        assertNotEquals(parser.parse(base).packageHash, parser.parse(modificado).packageHash)
    }

    @Test
    fun `un sha256 declarado que no corresponde al archivo es TPL_PACKAGE_ASSET_MISMATCH`() {
        val raw = conManifiesto("boda-clasica-1.0.0") { manifest ->
            ((manifest.get("assets") as ArrayNode)[0] as ObjectNode)
                .put("sha256", "0".repeat(64))
        }
        val e = assertThrows<PackageAssetMismatchException> { parser.parse(raw) }
        assertEquals(422, e.status)
        assertEquals("sha256", e.details["constraint"])
    }

    @Test
    fun `un bytes declarado que no corresponde al archivo es TPL_PACKAGE_ASSET_MISMATCH`() {
        val base = PaqueteFixture.ejemplo("xv-jardin-1.0.0")
        val manifest = Templates2Json.mapper.readTree(base.files.getValue("template.json")).deepCopy<ObjectNode>()
        ((manifest.get("assets") as ArrayNode)[0] as ObjectNode).put("bytes", 7)
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply { put("template.json", PaqueteFixture.texto(manifest)) },
        )
        val e = assertThrows<PackageAssetMismatchException> { parser.parse(raw) }
        assertEquals("bytes", e.details["constraint"])
    }

    @Test
    fun `un asset que el manifiesto no declara no se ignora`() {
        val base = PaqueteFixture.ejemplo("xv-jardin-1.0.0")
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply {
                put("assets/extra.webp", PaqueteFixture.archivo("assets/extra.webp", 64, "image/webp"))
            },
        )
        val e = assertThrows<PackageAssetMismatchException> { parser.parse(raw) }
        assertEquals(listOf("assets/extra.webp"), e.details["undeclared"])
    }

    @Test
    fun `un archivo cuyo numero magico no casa el contentType es 415`() {
        val base = PaqueteFixture.ejemplo("xv-jardin-1.0.0")
        val ruta = "assets/preview.webp"
        val bytes = base.files.getValue(ruta).copyOf()
        bytes[0] = 'X'.code.toByte()
        val manifest = Templates2Json.mapper.readTree(base.files.getValue("template.json")).deepCopy<ObjectNode>()
        ((manifest.get("assets") as ArrayNode)[0] as ObjectNode)
            .put("sha256", PaqueteFixture.hex(PaqueteFixture.sha256(bytes)))
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply {
                put(ruta, bytes)
                put("template.json", PaqueteFixture.texto(manifest))
            },
        )
        val e = assertThrows<AssetTypeUnsupportedException> { parser.parse(raw) }
        assertEquals(415, e.status)
    }

    @Test
    fun `un manifiesto que viola una invariante trae la lista completa de violaciones`() {
        // I-13: dos bloques con el mismo id en todo el manifiesto (mata H-28).
        val raw = conManifiesto("boda-clasica-1.0.0") { manifest ->
            val secciones = manifest.get("sections") as ArrayNode
            val bloques = (secciones[0] as ObjectNode).get("blocks") as ArrayNode
            bloques.add(bloques[0].deepCopy<com.fasterxml.jackson.databind.JsonNode>())
        }
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        val violaciones = e.details["violations"] as List<*>
        assertTrue(
            violaciones.any { (it as Map<*, *>)["code"].toString().startsWith("I-13") },
            "esperaba I-13_BLOCK_ID_DUPLICATE entre $violaciones",
        )
    }

    @Test
    fun `un manifiesto que no casa el JSON Schema se rechaza antes de decodificar`() {
        val raw = conManifiesto("boda-clasica-1.0.0") { it.put("slug", "Boda Clasica") }
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertTrue((e.details["violations"] as List<*>).isNotEmpty())
    }

    @Test
    fun `defaults_json de otra version no se mezcla con este manifiesto`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val defaults = Templates2Json.mapper.readTree(base.files.getValue("defaults.json")).deepCopy<ObjectNode>()
        defaults.put("templateVersion", "9.9.9")
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply { put("defaults.json", PaqueteFixture.texto(defaults)) },
        )
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertEquals("TPL_PACKAGE_DEFAULTS_MISMATCH", e.details["packageError"])
    }

    @Test
    fun `un plan de migracion que migrationsFrom no declara es un huerfano, no se ignora`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val plan = PaqueteFixture.planRemoveBlock("boda-clasica", "0.9.0", "1.0.0", "footer.note")
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply { put("migrations/0.9.0-to-1.0.0.json", PaqueteFixture.texto(plan)) },
        )
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertEquals("TPL_MIGRATION_PLAN_ORPHAN", e.details["packageError"])
    }

    @Test
    fun `una version de migrationsFrom sin su archivo es TPL_MIGRATION_PLAN_MISSING`() {
        val raw = PaqueteFixture.variante("boda-clasica-1.0.0", "2.0.0", migrationsFrom = listOf("1.0.0"))
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertEquals("TPL_MIGRATION_PLAN_MISSING", e.details["packageError"])
    }

    @Test
    fun `el paquete guardado en la carpeta equivocada no se registra en silencio`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val raw = RawTemplatePackage(base.files, slugDeclarado = "otra-plantilla", versionDeclarada = "1.0.0")
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertEquals("TPL_PACKAGE_PATH_MISMATCH", e.details["packageError"])
    }

    @Test
    fun `un JSON no parseable no revienta con una excepcion cruda`() {
        val base = PaqueteFixture.ejemplo("boda-clasica-1.0.0")
        val raw = RawTemplatePackage(
            base.files.toMutableMap().apply { put("theme.json", "{ esto no es json".toByteArray()) },
        )
        val e = assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
        assertEquals("TPL_PACKAGE_MALFORMED_JSON", e.details["packageError"])
        // …y aun así hay huella para la auditoría: `requested_hash` es NOT NULL (02 §2 V35).
        assertTrue(Patterns.PREFIXED_SHA256.matches(parser.rawHash(raw)))
        assertEquals("boda-clasica" to "1.0.0", parser.identidadAproximada(raw))
    }

    @Test
    fun `una clave reservada en el paquete se para antes del codec (I-29)`() {
        val raw = conManifiesto("boda-clasica-1.0.0") { it.putObject("__proto__").put("x", 1) }
        assertThrows<Templates2Exception.ManifestInvalid> { parser.parse(raw) }
    }

    private fun conManifiesto(plantilla: String, cambio: (ObjectNode) -> Unit): RawTemplatePackage {
        val base = PaqueteFixture.ejemplo(plantilla)
        val manifest = Templates2Json.mapper.readTree(base.files.getValue("template.json")).deepCopy<ObjectNode>()
        cambio(manifest)
        return RawTemplatePackage(
            base.files.toMutableMap().apply { put("template.json", PaqueteFixture.texto(manifest)) },
        )
    }
}
