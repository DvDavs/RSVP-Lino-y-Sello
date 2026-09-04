package mx.evolutiondev.invitaciones.modules.templates2

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.Capability
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.ConverterId
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvalidValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.NarrowedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.Provenance
import mx.evolutiondev.invitaciones.modules.templates2.domain.PublicToken
import mx.evolutiondev.invitaciones.modules.templates2.domain.RegistrationResult
import mx.evolutiondev.invitaciones.modules.templates2.domain.RemovedVariant
import mx.evolutiondev.invitaciones.modules.templates2.domain.RetypedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.Revision
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichMark
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructuralDiff
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import mx.evolutiondev.invitaciones.modules.templates2.domain.Templates2Exception
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeFallback
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.DomainJson
import mx.evolutiondev.invitaciones.modules.templates2.schema.InvariantCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Templates2Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * El contrato de `templates2.domain` que consumen los bloques 2-1, 2-2 y 2-3: los identificadores
 * rechazan en el constructor, los catálogos son cerrados y **ningún** valor fuera de catálogo pasa en
 * silencio (P1).
 */
class DomainContractTest {

    @Test
    fun `los identificadores rechazan en el constructor con codigo tipado`() {
        val malos: List<Pair<String, () -> Any>> = listOf(
            "TemplateSlug" to { TemplateSlug("Boda_Clasica") },
            "BlockId" to { BlockId("Cover.Title") },
            "SectionKey" to { SectionKey("cover-1") },
            "AssetId" to { AssetId("as_minusculas") },
            "PublicToken" to { PublicToken("tok_ABC") },
            "ItemId" to { ItemId("no-es-ulid") },
            "Revision" to { Revision(-1) },
            "SemverVersion" to { SemverVersion.parse("1.0") },
        )
        for ((nombre, f) in malos) {
            val e = runCatching { f() }.exceptionOrNull()
            assertTrue(e is Templates2Exception.MalformedJson, "$nombre no rechazó: $e")
            assertEquals(TplErrorCode.TPL_MALFORMED_JSON, (e as Templates2Exception).code)
            assertEquals(400, e.status)
        }
    }

    @Test
    fun `los identificadores validos se construyen y se imprimen por su valor`() {
        assertEquals("boda-clasica", TemplateSlug("boda-clasica").toString())
        assertEquals("cover.title", BlockId("cover.title").toString())
        assertEquals("cover", SectionKey("cover").toString())
        assertEquals("as_01J9ZQ8H000000000000000000", AssetId.of("01J9ZQ8H000000000000000000").toString())
        assertEquals("pub_01J9ZQ8H000000000000000000", PublicToken.of("01J9ZQ8H000000000000000000").toString())
        assertEquals("01J9ZQ8H000000000000000000", ItemId("01J9ZQ8H000000000000000000").toString())
        assertEquals("7", Revision(6).next().toString())
        assertEquals(6L, Revision(6).value)
    }

    @Test
    fun `SemverVersion es comparable y redondea a texto`() {
        assertEquals("1.2.3", SemverVersion.parse("1.2.3").toString())
        assertTrue(SemverVersion.parse("1.2.3") < SemverVersion.parse("1.10.0"))
        assertTrue(SemverVersion.parse("2.0.0") > SemverVersion.parse("1.99.99"))
        assertEquals(0, SemverVersion.parse("1.0.0").compareTo(SemverVersion(1, 0, 0)))
        assertEquals(listOf("1.0.0", "1.0.1", "1.1.0", "2.0.0"), listOf("2.0.0", "1.1.0", "1.0.1", "1.0.0")
            .map { SemverVersion.parse(it) }.sorted().map { it.toString() })
    }

    @Test
    fun `los catalogos cerrados resuelven por su literal de JSON y solo por ese`() {
        assertEquals(Locale.ES_MX, Locale.of("es-MX")); assertNull(Locale.of("fr-FR"))
        assertEquals(EventKind.WEDDING, EventKind.of("wedding")); assertNull(EventKind.of("boda"))
        assertEquals(SectionType.COVER, SectionType.of("cover")); assertNull(SectionType.of("portada"))
        assertEquals(Capability.SINGLE_PLACE, Capability.of("singlePlace")); assertNull(Capability.of("x"))
        assertEquals(BlockKind.RICH_TEXT, BlockKind.of("richText")); assertNull(BlockKind.of("html"))
        assertEquals(BlockSource.BUSINESS, BlockSource.of("business")); assertNull(BlockSource.of("business:date"))
        assertEquals(Provenance.DEFAULT, Provenance.of("default")); assertNull(Provenance.of("demo"))
        assertEquals(RichMark.BOLD, RichMark.of("bold")); assertNull(RichMark.of("underline"))
        assertEquals(ImageAspect.WIDE, ImageAspect.of("wide")); assertNull(ImageAspect.of("panoramic"))
        assertEquals(FontSource.BUNDLED, FontSource.of("bundled")); assertNull(FontSource.of("adobe"))
        assertEquals(ConverterId.TEXT_TO_RICH_TEXT, ConverterId.of("textToRichText")); assertNull(ConverterId.of("x"))
        assertEquals(AssetContentType.IMAGE_WEBP, AssetContentType.of("image/webp"))
        assertNull(AssetContentType.of("image/gif"))
        assertEquals(BlockRole.COVER_TITLE, BlockRole.of("coverTitle")); assertNull(BlockRole.of("titulo"))
        assertEquals(InvariantCode.I_01_RANGE_END_BEFORE_START, InvariantCode.of("I-01_RANGE_END_BEFORE_START"))
        assertNull(InvariantCode.of("I-31_PALETTE_CONTRAST_BELOW_AA"))
    }

    /** `contratos.md §3`: 12 secciones, 14 bloques, 10 roles de grupo y 17 singleton. */
    @Test
    fun `los tamanos de los catalogos son los del contrato`() {
        assertEquals(12, SectionType.entries.size)
        assertEquals(14, BlockKind.entries.size)
        assertEquals(3, BlockSource.entries.size)
        assertEquals(6, BusinessField.entries.size)
        assertEquals(10, BlockRole.GROUP_ROLES.size)
        assertEquals(17, BlockRole.SINGLETON_ROLES.size)
        assertEquals(3, Locale.entries.size)
        assertEquals(8, EventKind.entries.size)
        assertEquals(5, Capability.entries.size)
        assertEquals(5, Provenance.entries.size)
    }

    /** `invariants.ts` `BUSINESS_TYPE`: cada `businessField` exige un tipo de bloque (I-06). */
    @Test
    fun `cada BusinessField declara el tipo de bloque que exige`() {
        assertEquals(BlockKind.DATE, BusinessField.INVITATION_DATE.expectedType)
        assertEquals(BlockKind.TIME, BusinessField.INVITATION_TIME.expectedType)
        assertEquals(BlockKind.TEXT, BusinessField.INVITATION_HASHTAG.expectedType)
        assertEquals(BlockKind.IMAGE, BusinessField.INVITATION_COVER_PHOTO_URL.expectedType)
        assertEquals(BlockKind.BOOLEAN, BusinessField.INVITATION_CHILDREN_ALLOWED.expectedType)
        assertEquals(BlockKind.BOOLEAN, BusinessField.INVITATION_YOUNG_ALLOWED.expectedType)
        assertEquals(BusinessField.INVITATION_DATE, BusinessField.of("invitation.date"))
    }

    /** `03 §5`: la tabla de errores y el enum tienen que coincidir; aquí se fija el tamaño y el HTTP. */
    @Test
    fun `TplErrorCode cubre los 35 codigos de la tabla y su HTTP`() {
        assertEquals(35, TplErrorCode.entries.size)
        assertEquals(403, TplErrorCode.TPL_FORBIDDEN.httpStatus)
        assertEquals(409, TplErrorCode.TPL_REVISION_CONFLICT.httpStatus)
        assertEquals(422, TplErrorCode.TPL_OPERATION_INVALID.httpStatus)
        assertEquals(413, TplErrorCode.TPL_BODY_TOO_LARGE.httpStatus)
        assertEquals(415, TplErrorCode.TPL_ASSET_TYPE_UNSUPPORTED.httpStatus)
        assertEquals(502, TplErrorCode.TPL_ASSET_STORAGE_UNAVAILABLE.httpStatus)
        assertEquals(500, TplErrorCode.TPL_INTERNAL.httpStatus)
        assertTrue(TplErrorCode.entries.none { it.name.startsWith("TPL_AI_") }, "el prefijo TPL_AI_ está reservado")
        assertTrue(TplErrorCode.entries.count { it.httpStatus == 500 } == 1, "TPL_INTERNAL es el único 500")
    }

    @Test
    fun `Templates2Exception expone codigo, estado y detalles`() {
        val e = Templates2Exception.ManifestInvalid("mal", mapOf("k" to 1))
        assertEquals(TplErrorCode.TPL_MANIFEST_INVALID, e.code)
        assertEquals(422, e.status)
        assertEquals(mapOf("k" to 1), e.details)
        val i = Templates2Exception.Internal("boom", IllegalStateException("x"))
        assertEquals(TplErrorCode.TPL_INTERNAL, i.code)
        assertNotNull(i.cause)
    }

    @Test
    fun `LocalizedText resuelve con caida a es-MX`() {
        val t = LocalizedText(mapOf(Locale.ES_MX to "Hola"))
        assertEquals("Hola", t.resolve(Locale.EN_US))
        assertEquals("Hola", t[Locale.ES_MX])
        assertNull(t[Locale.EN_US])
        assertEquals("", LocalizedText(emptyMap()).resolve(Locale.ES_MX))
    }

    @Test
    fun `TemplatePackage expone slug y version del manifiesto`() {
        val pkg = TemplatePackage(
            DomainJson.manifest(Golden.leer("templates/boda-clasica-1.0.0", "template.json")),
            DomainJson.theme(Golden.leer("templates/boda-clasica-1.0.0", "theme.json")),
            DomainJson.defaults(Golden.leer("templates/boda-clasica-1.0.0", "defaults.json")),
        )
        assertEquals("boda-clasica", pkg.slug.value)
        assertEquals("1.0.0", pkg.version.toString())
        assertTrue(pkg.migrationPlans.isEmpty())
        assertTrue(pkg.manifest.topLevelBlocks().isNotEmpty())

        // `validateInvariants` junta I-29 (sobre el crudo) con las del documento (`01 §6.5`).
        val crudo = Golden.leer("templates/boda-clasica-1.0.0", "documento.json")
        assertTrue(Invariants.validateInvariants(DomainJson.document(crudo), pkg, crudo).isEmpty())
        assertTrue(Invariants.validateInvariants(DomainJson.document(crudo), pkg).isEmpty())
    }

    @Test
    fun `StructuralDiff vacio y no vacio`() {
        assertTrue(StructuralDiff().isEmpty)
        assertTrue(!StructuralDiff(removedBlocks = listOf(BlockId("a.b"))).isEmpty)
        assertTrue(!StructuralDiff(removedSections = listOf(SectionKey("cover"))).isEmpty)
        assertTrue(!StructuralDiff(retypedBlocks = listOf(RetypedBlock(BlockId("a.b"), BlockKind.TEXT, BlockKind.LINK))).isEmpty)
        assertTrue(!StructuralDiff(narrowedGroups = listOf(NarrowedGroup(BlockId("a.b"), 12, 3))).isEmpty)
        assertTrue(!StructuralDiff(removedPalettes = listOf("olive")).isEmpty)
        assertTrue(!StructuralDiff(removedFontSets = listOf("clasica")).isEmpty)
        assertTrue(!StructuralDiff(removedVariants = listOf(RemovedVariant(SectionKey("cover"), "full"))).isEmpty)
    }

    @Test
    fun `RegistrationResult tiene las tres formas de 02 seccion 4`() {
        val h = "sha256:" + "0".repeat(64)
        val creado: RegistrationResult = RegistrationResult.Created(TemplateSlug("boda-clasica"), SemverVersion(1, 0, 0), h)
        val noop: RegistrationResult = RegistrationResult.NoopSameHash(TemplateSlug("boda-clasica"), SemverVersion(1, 0, 0), h)
        val rechazo: RegistrationResult = RegistrationResult.Rejected(TplErrorCode.TPL_MANIFEST_INVALID, "detalle")
        assertTrue(creado is RegistrationResult.Created)
        assertTrue(noop is RegistrationResult.NoopSameHash)
        assertEquals(TplErrorCode.TPL_MANIFEST_INVALID, (rechazo as RegistrationResult.Rejected).code)
    }

    @Test
    fun `CompositionResult y las piezas del informe`() {
        val compuesto = DomainJson.composedDocument(Golden.leer("templates/xv-jardin-1.0.0", "compuesto.json"))
        val informe = DomainJson.compositionReport(Golden.leer("templates/xv-jardin-1.0.0", "reporte.json"))
        val r = CompositionResult(compuesto, informe)
        assertEquals("xv-jardin", r.composed.template.slug.value)
        assertTrue(r.report.invalidValues.isEmpty())
        assertNull(r.report.themeFallback)
        assertEquals("a.b", InvalidValue(BlockId("a.b"), "I-16_TEXT_TOO_LONG").blockId.value)
        assertEquals("olive", ThemeFallback(paletteId = "olive").paletteId)
    }

    /** Un `themeFallback` no nulo va y vuelve (los golden solo traen `null`, objeción O-10). */
    @Test
    fun `el informe con themeFallback no nulo va y vuelve`() {
        val texto = """
            {"missingRequired":["a.b"],"stillDefault":[],"orphanContent":[],"orphanSections":["cover"],
             "invalidValues":[{"blockId":"a.b","code":"I-16_TEXT_TOO_LONG"}],
             "themeFallback":{"paletteId":"olive","fontSetId":"clasica"}}
        """.trimIndent()
        val node = Templates2Json.readTree(texto)
        val informe = DomainJson.compositionReport(node)
        assertEquals("olive", informe.themeFallback?.paletteId)
        assertEquals(1, informe.invalidValues.size)
        assertEquals(
            mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson.canonical(node),
            mx.evolutiondev.invitaciones.modules.templates2.schema.CanonicalJson.canonical(DomainJson.encode(informe)),
        )
    }
}
