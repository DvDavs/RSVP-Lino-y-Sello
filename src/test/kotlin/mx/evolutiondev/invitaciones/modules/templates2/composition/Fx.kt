package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceOption
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DefaultsFile
import mx.evolutiondev.invitaciones.modules.templates2.domain.DocumentMeta
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontFace
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSet
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.LinkSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocationSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.Palette
import mx.evolutiondev.invitaciones.modules.templates2.domain.PaletteTokens
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.SpecBase
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateManifest
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateRef
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TimeSpec

/**
 * Constructores mínimos para las pruebas de rama de `composition` y `migration`. **No** sustituyen a
 * los golden: los golden fijan la paridad con TypeScript, y esto solo cubre ramas que ningún caso
 * compartido ejercita (límites de grupo, grupos no reordenables, diffs estructurales…).
 */
object Fx {

    fun l(s: String, en: String? = null): LocalizedText {
        val m = linkedMapOf(Locale.ES_MX to s)
        if (en != null) m[Locale.EN_US] = en
        return LocalizedText(m)
    }

    fun base(
        id: String, role: BlockRole, required: Boolean = false, source: BlockSource = BlockSource.USER,
        businessField: BusinessField? = null, editable: Boolean = true, aiEditable: Boolean = true,
    ) = SpecBase(BlockId(id), role, l(id), null, required, editable, source, businessField, aiEditable)

    fun texto(
        id: String, role: BlockRole = BlockRole.SECTION_TITLE, required: Boolean = false,
        source: BlockSource = BlockSource.USER, maxLength: Int = 200, minLength: Int = 0, multiline: Boolean = false,
    ) = TextSpec(base(id, role, required, source), TextConstraints(minLength, maxLength, multiline))

    fun rico(id: String, role: BlockRole = BlockRole.STORY_BODY) = RichTextSpec(base(id, role))
    fun lista(id: String, role: BlockRole = BlockRole.DRESS_CODE_DETAIL) = ListTextSpec(base(id, role))
    fun enlace(id: String, role: BlockRole = BlockRole.FOOTER_LINK) = LinkSpec(base(id, role))
    fun lugar(id: String, role: BlockRole = BlockRole.EVENT_PLACE) = LocationSpec(base(id, role))
    fun opcion(id: String, opciones: List<String>, role: BlockRole = BlockRole.HASHTAG_PLATFORM) =
        ChoiceSpec(base(id, role), opciones.map { ChoiceOption(it, l(it)) })

    fun imagen(
        id: String, role: BlockRole = BlockRole.DECORATIVE, aspect: ImageAspect = ImageAspect.FREE,
        maxBytes: Int = 8_388_608, required: Boolean = false, source: BlockSource = BlockSource.USER,
    ) = ImageSpec(base(id, role, required, source), ImageConstraints(aspect, maxBytes))

    fun audio(id: String, role: BlockRole = BlockRole.BACKGROUND_MUSIC, maxBytes: Int = 8_388_608) =
        AudioSpec(base(id, role), AudioConstraints(maxBytes))

    fun fecha(id: String, role: BlockRole = BlockRole.EVENT_DATE, formatId: String = "long", source: BlockSource = BlockSource.USER, businessField: BusinessField? = null) =
        DateSpec(base(id, role, source = source, businessField = businessField), formatId)

    fun hora(id: String, role: BlockRole = BlockRole.EVENT_TIME, formatId: String = "h12") = TimeSpec(base(id, role), formatId)
    fun rango(id: String, role: BlockRole = BlockRole.EVENT_WHEN, formatId: String = "long-h12") = DateTimeRangeSpec(base(id, role), formatId)

    fun grupo(
        id: String, role: BlockRole = BlockRole.EVENT_CARDS, itemBlocks: List<ScalarSpec>,
        min: Int = 0, max: Int = 12, reorderable: Boolean = true, required: Boolean = false,
        source: BlockSource = BlockSource.USER,
    ) = GroupSpec(base(id, role, required, source), min, max, reorderable, l("$id item"), itemBlocks)

    fun seccion(
        key: String, type: SectionType = SectionType.EVENT, blocks: List<BlockSpec>,
        variants: List<String> = listOf("default"), defaultVariant: String = "default",
        required: Boolean = false, defaultVisible: Boolean = true,
    ) = SectionSpec(SectionKey(key), type, l(key), variants, defaultVariant, required, defaultVisible, blocks)

    fun manifiesto(
        secciones: List<SectionSpec>, slug: String = "fixture-tpl", version: String = "1.0.0",
        locales: List<Locale> = listOf(Locale.ES_MX),
        /** I-09: los `AssetEntry` del paquete, con o sin alias (`AssetEntry.id`). */
        assets: List<AssetEntry> = emptyList(),
    ) = TemplateManifest(
        manifestVersion = 1, slug = TemplateSlug(slug), version = SemverVersion.parse(version),
        name = l("Plantilla"), description = null, eventKinds = listOf(EventKind.GENERIC),
        minPlanTier = 1, locales = locales, capabilities = emptyList(), previewImage = null,
        sections = secciones, assets = assets, migrationsFrom = emptyList(),
    )

    fun tema(
        paletas: List<String> = listOf("olive"), fuentes: List<String> = listOf("clasica"),
        defaultPaletteId: String = paletas.first(), defaultFontSetId: String = fuentes.first(),
    ) = ThemeSpec(
        palettes = paletas.map {
            Palette(it, l(it), PaletteTokens("#FFFFFF", "#F5F5F0", "#222222", "#556B2F", "#FFFFFF", "#999999"))
        },
        fontSets = fuentes.map {
            FontSet(it, l(it), FontFace("Playfair Display", listOf(400), FontSource.BUNDLED), FontFace("Lora", listOf(400), FontSource.BUNDLED))
        },
        defaultPaletteId = defaultPaletteId, defaultFontSetId = defaultFontSetId,
    )

    fun defaults(m: TemplateManifest, content: Map<String, BlockValue> = emptyMap()) =
        DefaultsFile(m.slug, m.version, content.mapKeys { BlockId(it.key) })

    fun paquete(m: TemplateManifest, t: ThemeSpec = tema(), d: DefaultsFile = defaults(m)) = TemplatePackage(m, t, d)

    fun documento(
        m: TemplateManifest, t: ThemeSpec = tema(), content: Map<String, BlockValue> = emptyMap(),
        structure: List<StructureEntry>? = null, locale: Locale = m.locales.first(),
        paletteId: String = t.defaultPaletteId, fontSetId: String = t.defaultFontSetId,
        attic: Map<String, Map<BlockId, BlockValue>> = emptyMap(),
    ) = InvitationDocument(
        schemaVersion = 1,
        template = TemplateRef(m.slug, m.version),
        theme = ThemeChoice(paletteId, fontSetId),
        structure = Structure(
            structure ?: m.sections.map { StructureEntry(it.key, it.defaultVariant, if (it.required) true else it.defaultVisible) },
        ),
        content = content.mapKeys { BlockId(it.key) },
        attic = attic,
        meta = DocumentMeta(locale),
    )

    val negocio = BusinessSnapshot(
        invitationId = 1, date = "2027-05-01", time = "18:30", hashtag = "#fx",
        coverPhotoUrl = null, childrenAllowed = true, youngAllowed = false,
        eventKind = EventKind.GENERIC, planTier = 1, timezone = "America/Mexico_City",
    )
}
