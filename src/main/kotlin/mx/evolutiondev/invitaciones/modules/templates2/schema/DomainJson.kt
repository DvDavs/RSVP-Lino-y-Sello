package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.node.ArrayNode
import com.fasterxml.jackson.databind.node.ObjectNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetContentType
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BooleanSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BooleanValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessField
import mx.evolutiondev.invitaciones.modules.templates2.domain.BusinessSnapshot
import mx.evolutiondev.invitaciones.modules.templates2.domain.Capability
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceOption
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedBlock
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedGroup
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.ComposedSection
import mx.evolutiondev.invitaciones.modules.templates2.domain.CompositionReport
import mx.evolutiondev.invitaciones.modules.templates2.domain.ConverterId
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DefaultsFile
import mx.evolutiondev.invitaciones.modules.templates2.domain.DocumentMeta
import mx.evolutiondev.invitaciones.modules.templates2.domain.EditProposal
import mx.evolutiondev.invitaciones.modules.templates2.domain.EventKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.Focal
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontFace
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSet
import mx.evolutiondev.invitaciones.modules.templates2.domain.FontSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvalidValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.LinkSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.LinkValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Locale
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocationSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocationValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationOp
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.OperationBatch
import mx.evolutiondev.invitaciones.modules.templates2.domain.Palette
import mx.evolutiondev.invitaciones.modules.templates2.domain.PaletteTokens
import mx.evolutiondev.invitaciones.modules.templates2.domain.PersonSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.PersonValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.Provenance
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedAudio
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedBoolean
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedDate
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedDateTimeRange
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedFont
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedFonts
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedImage
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedLink
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedListText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedLocation
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedPerson
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedRichText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedTheme
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedTime
import mx.evolutiondev.invitaciones.modules.templates2.domain.ResolvedValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichDoc
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichMark
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichParagraph
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichSpan
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionType
import mx.evolutiondev.invitaciones.modules.templates2.domain.SemverVersion
import mx.evolutiondev.invitaciones.modules.templates2.domain.SpecBase
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateManifest
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateRef
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateSlug
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextConstraints
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeChoice
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeFallback
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TimeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TimeValue

/**
 * Conversión `JsonNode` <-> tipos de `templates2.domain`. Es el borde donde P1 se hace cumplir:
 * toda clave desconocida rompe ([Obj.fin]) y todo literal fuera de un catálogo cerrado rompe.
 *
 * **Normalización de los `.default()` de Zod (objeción O-02 de `bitacora/2-0a-REV.md`).**
 * `TemplateManifest.parse(...)` de Zod inyecta 28 valores por defecto, y el JSON Schema emitido usa
 * `io:"input"`, así que marca esos campos como **opcionales**: un manifiesto crudo válido para el
 * esquema llega sin `itemBlocks[].source` y, sin normalizar, `I-22` (`source !== "user"`) violaría
 * sobre un manifiesto que TypeScript acepta sin queja. Los defaults se aplican **aquí**, al
 * decodificar, de modo que `Invariants` siempre recibe la forma normalizada. `TemplateManifestNormalizacionTest`
 * lo prueba comparando `encode(manifest(crudo))` con el `template.json` normalizado de `golden/templates/`.
 *
 * `templates2.domain` no depende de Jackson (`02 §7.1`): por eso el códec vive en `templates2.schema`.
 */
object DomainJson {

    private fun nuevoObjeto(): ObjectNode = Templates2Json.mapper.createObjectNode()
    private fun nuevoArray(): ArrayNode = Templates2Json.mapper.createArrayNode()

    // -----------------------------------------------------------------------------------------
    // Primitivas compartidas
    // -----------------------------------------------------------------------------------------

    private fun blockId(texto: String, @Suppress("UNUSED_PARAMETER") path: String) = BlockId(texto)
    private fun sectionKey(texto: String, @Suppress("UNUSED_PARAMETER") path: String) = SectionKey(texto)

    internal fun localizedText(node: JsonNode, path: String): LocalizedText {
        if (!node.isObject) malformado(path, "se esperaba un objeto y llegó ${tipo(node)}")
        val mapa = LinkedHashMap<Locale, String>()
        for (k in node.fieldNames()) {
            val loc = Locale.of(k) ?: malformado("$path.$k", "\"$k\" no es un Locale soportado")
            mapa[loc] = textoDe(node.get(k), "$path.$k")
        }
        return LocalizedText(mapa)
    }

    internal fun encode(t: LocalizedText): ObjectNode {
        val o = nuevoObjeto()
        // Orden estable por el orden de declaración de `Locale` (es-MX, es-ES, en-US) igual que `common.ts`.
        for (loc in Locale.entries) t[loc]?.let { o.put(loc.wire, it) }
        return o
    }

    // -----------------------------------------------------------------------------------------
    // BlockValue (14) — `blocks.ts`
    // -----------------------------------------------------------------------------------------

    fun blockValue(node: JsonNode, path: String): BlockValue {
        val o = Obj(node, path)
        val kind = wire(BlockKind.entries.toTypedArray(), o.texto("kind"), "$path.kind", "BlockKind")
        val v: BlockValue = when (kind) {
            BlockKind.TEXT -> TextValue(o.texto("value"))
            BlockKind.RICH_TEXT -> RichTextValue(richDoc(o.obligatorio("doc"), "$path.doc"))
            BlockKind.LIST_TEXT -> ListTextValue(o.lista("items") { n, p -> textoDe(n, p) })
            BlockKind.IMAGE -> ImageValue(
                AssetId(o.texto("assetId")), o.texto("alt"), focal(o.obligatorio("focal"), "$path.focal"),
            )
            BlockKind.AUDIO -> AudioValue(AssetId(o.texto("assetId")))
            BlockKind.DATE -> DateValue(o.texto("value"))
            BlockKind.TIME -> TimeValue(o.texto("value"))
            BlockKind.DATE_TIME_RANGE -> DateTimeRangeValue(o.texto("start"), o.textoOpcional("end"))
            BlockKind.LINK -> LinkValue(o.texto("href"), o.textoOpcional("label"))
            BlockKind.LOCATION -> LocationValue(o.texto("name"), o.textoOpcional("address"), o.textoOpcional("mapHref"))
            BlockKind.CHOICE -> ChoiceValue(o.texto("optionId"))
            BlockKind.BOOLEAN -> BooleanValue(o.booleano("value"))
            BlockKind.PERSON -> PersonValue(o.texto("name"), o.textoOpcional("note"))
            BlockKind.GROUP -> GroupValue(o.lista("items") { n, p -> groupItem(n, p) })
        }
        o.fin()
        return v
    }

    fun scalarValue(node: JsonNode, path: String): ScalarValue {
        val v = blockValue(node, path)
        return v as? ScalarValue ?: malformado(path, "se esperaba un valor escalar y llegó un grupo")
    }

    private fun focal(node: JsonNode, path: String): Focal {
        val o = Obj(node, path)
        val f = Focal(decimalDe(o.obligatorio("x"), "$path.x"), decimalDe(o.obligatorio("y"), "$path.y"))
        o.fin()
        return f
    }

    private fun richDoc(node: JsonNode, path: String): RichDoc {
        val o = Obj(node, path)
        if (o.texto("type") != "doc") malformado("$path.type", "se esperaba \"doc\"")
        val d = RichDoc(o.lista("content") { n, p -> richParagraph(n, p) })
        o.fin()
        return d
    }

    private fun richParagraph(node: JsonNode, path: String): RichParagraph {
        val o = Obj(node, path)
        if (o.texto("type") != "paragraph") malformado("$path.type", "se esperaba \"paragraph\"")
        val p = RichParagraph(o.lista("content") { n, pp -> richSpan(n, pp) })
        o.fin()
        return p
    }

    private fun richSpan(node: JsonNode, path: String): RichSpan {
        val o = Obj(node, path)
        if (o.texto("type") != "text") malformado("$path.type", "se esperaba \"text\"")
        val marcas = if (o.bruto("marks") == null) null else o.lista("marks") { n, p ->
            wire(RichMark.entries.toTypedArray(), textoDe(n, p), p, "RichMark")
        }
        val s = RichSpan(o.texto("text"), marcas, o.textoOpcional("href"))
        o.fin()
        return s
    }

    private fun groupItem(node: JsonNode, path: String): GroupItem {
        val o = Obj(node, path)
        val g = GroupItem(
            ItemId(o.texto("itemId")),
            o.mapa("values", ::blockId) { n, p -> scalarValue(n, p) },
        )
        o.fin()
        return g
    }

    fun encode(v: BlockValue): ObjectNode {
        val o = nuevoObjeto()
        o.put("kind", v.kind.wire)
        when (v) {
            is TextValue -> o.put("value", v.value)
            is RichTextValue -> o.set<ObjectNode>("doc", encode(v.doc))
            is ListTextValue -> o.set<ArrayNode>("items", textos(v.items))
            is ImageValue -> {
                o.put("assetId", v.assetId.value); o.put("alt", v.alt); o.set<ObjectNode>("focal", encode(v.focal))
            }
            is AudioValue -> o.put("assetId", v.assetId.value)
            is DateValue -> o.put("value", v.value)
            is TimeValue -> o.put("value", v.value)
            is DateTimeRangeValue -> { o.put("start", v.start); v.end?.let { o.put("end", it) } }
            is LinkValue -> { o.put("href", v.href); v.label?.let { o.put("label", it) } }
            is LocationValue -> {
                o.put("name", v.name); v.address?.let { o.put("address", it) }; v.mapHref?.let { o.put("mapHref", it) }
            }
            is ChoiceValue -> o.put("optionId", v.optionId)
            is BooleanValue -> o.put("value", v.value)
            is PersonValue -> { o.put("name", v.name); v.note?.let { o.put("note", it) } }
            is GroupValue -> {
                val arr = nuevoArray()
                v.items.forEach { arr.add(encode(it)) }
                o.set<ArrayNode>("items", arr)
            }
        }
        return o
    }

    private fun encode(f: Focal): ObjectNode = nuevoObjeto().put("x", f.x).put("y", f.y)

    private fun encode(d: RichDoc): ObjectNode {
        val o = nuevoObjeto().put("type", "doc")
        val arr = nuevoArray()
        d.content.forEach { arr.add(encode(it)) }
        return o.set("content", arr)
    }

    private fun encode(p: RichParagraph): ObjectNode {
        val o = nuevoObjeto().put("type", "paragraph")
        val arr = nuevoArray()
        p.content.forEach { arr.add(encode(it)) }
        return o.set("content", arr)
    }

    private fun encode(s: RichSpan): ObjectNode {
        val o = nuevoObjeto().put("type", "text").put("text", s.text)
        s.marks?.let { marcas ->
            val arr = nuevoArray()
            marcas.forEach { arr.add(it.wire) }
            // `ObjectNode.set` devuelve **`this`** (un `ObjectNode`), no el nodo insertado. Como esta
            // expresión es el valor de retorno del lambda de `let`, el parámetro de tipo explícito
            // hace que Kotlin inserte un `CHECKCAST`: con `<ArrayNode>` reventaba en tiempo de
            // ejecución (`500 TPL_INTERNAL` al escribir negrita o cursiva; H-ADV-01).
            o.set<ObjectNode>("marks", arr)
        }
        s.href?.let { o.put("href", it) }
        return o
    }

    private fun encode(g: GroupItem): ObjectNode {
        val o = nuevoObjeto().put("itemId", g.itemId.value)
        val valores = nuevoObjeto()
        g.values.forEach { (k, v) -> valores.set<ObjectNode>(k.value, encode(v)) }
        return o.set("values", valores)
    }

    private fun textos(xs: List<String>): ArrayNode {
        val arr = nuevoArray()
        xs.forEach { arr.add(it) }
        return arr
    }

    // -----------------------------------------------------------------------------------------
    // BlockSpec (14) — `blocks.ts`. Aquí se aplican los `.default()` de Zod (O-02).
    // -----------------------------------------------------------------------------------------

    private fun specBase(o: Obj, path: String): SpecBase = SpecBase(
        id = BlockId(o.texto("id")),
        role = wire(BlockRole.entries.toTypedArray(), o.texto("role"), "$path.role", "BlockRole"),
        label = localizedText(o.obligatorio("label"), "$path.label"),
        help = o.bruto("help")?.let { localizedText(it, "$path.help") },
        required = o.booleano("required", false),
        editable = o.booleano("editable", true),
        source = o.textoOpcional("source")
            ?.let { wire(BlockSource.entries.toTypedArray(), it, "$path.source", "BlockSource") }
            ?: BlockSource.USER,
        businessField = o.textoOpcional("businessField")
            ?.let { wire(BusinessField.entries.toTypedArray(), it, "$path.businessField", "BusinessField") },
        aiEditable = o.booleano("aiEditable", true),
    )

    fun blockSpec(node: JsonNode, path: String): BlockSpec {
        val o = Obj(node, path)
        val tipoBloque = wire(BlockKind.entries.toTypedArray(), o.texto("type"), "$path.type", "BlockKind")
        val base = specBase(o, path)
        val spec: BlockSpec = when (tipoBloque) {
            BlockKind.TEXT -> TextSpec(base, o.objetoOpcional("constraints")?.let { c ->
                val r = TextConstraints(c.entero("minLength", 0), c.entero("maxLength", 200), c.booleano("multiline", false))
                c.fin(); r
            } ?: TextConstraints())
            BlockKind.RICH_TEXT -> RichTextSpec(base, o.objetoOpcional("constraints")?.let { c ->
                val r = RichTextConstraints(c.entero("maxLength", 8000)); c.fin(); r
            } ?: RichTextConstraints())
            BlockKind.LIST_TEXT -> ListTextSpec(base, o.objetoOpcional("constraints")?.let { c ->
                val r = ListTextConstraints(
                    c.entero("minItems", 0), c.entero("maxItems", 12), c.entero("maxItemLength", 200),
                )
                c.fin(); r
            } ?: ListTextConstraints())
            BlockKind.IMAGE -> ImageSpec(base, o.objetoOpcional("constraints")?.let { c ->
                val aspecto = c.textoOpcional("aspect")
                    ?.let { wire(ImageAspect.entries.toTypedArray(), it, "$path.constraints.aspect", "ImageAspect") }
                    ?: ImageAspect.FREE
                val r = ImageConstraints(aspecto, c.entero("maxBytes", 8_388_608)); c.fin(); r
            } ?: ImageConstraints())
            BlockKind.AUDIO -> AudioSpec(base, o.objetoOpcional("constraints")?.let { c ->
                val r = AudioConstraints(c.entero("maxBytes", 8_388_608)); c.fin(); r
            } ?: AudioConstraints())
            BlockKind.DATE -> DateSpec(base, o.textoOpcional("formatId") ?: "long")
            BlockKind.TIME -> TimeSpec(base, o.textoOpcional("formatId") ?: "h12")
            BlockKind.DATE_TIME_RANGE -> DateTimeRangeSpec(base, o.textoOpcional("formatId") ?: "long-h12")
            BlockKind.LINK -> LinkSpec(base)
            BlockKind.LOCATION -> LocationSpec(base)
            BlockKind.CHOICE -> ChoiceSpec(base, o.lista("options") { n, p ->
                val c = Obj(n, p)
                val op = ChoiceOption(c.texto("id"), localizedText(c.obligatorio("label"), "$p.label"))
                c.fin(); op
            })
            BlockKind.BOOLEAN -> BooleanSpec(base)
            BlockKind.PERSON -> PersonSpec(base)
            BlockKind.GROUP -> GroupSpec(
                base,
                min = o.entero("min", 0),
                max = o.entero("max", 12),
                reorderable = o.booleano("reorderable", true),
                itemLabel = localizedText(o.obligatorio("itemLabel"), "$path.itemLabel"),
                itemBlocks = o.lista("itemBlocks") { n, p -> scalarSpec(n, p) },
            )
        }
        o.fin()
        return spec
    }

    fun scalarSpec(node: JsonNode, path: String): ScalarSpec {
        val s = blockSpec(node, path)
        return s as? ScalarSpec ?: malformado(path, "un itemBlock no puede ser de tipo group (los grupos no anidan)")
    }

    /** Emite la forma **normalizada**: todos los `.default()` materializados, igual que hace Zod al parsear. */
    fun encode(spec: BlockSpec): ObjectNode {
        val o = nuevoObjeto()
        val b = spec.base
        o.put("id", b.id.value)
        o.put("role", b.role.wire)
        o.set<ObjectNode>("label", encode(b.label))
        b.help?.let { o.set<ObjectNode>("help", encode(it)) }
        o.put("required", b.required)
        o.put("editable", b.editable)
        o.put("source", b.source.wire)
        b.businessField?.let { o.put("businessField", it.wire) }
        o.put("aiEditable", b.aiEditable)
        o.put("type", spec.type.wire)
        when (spec) {
            is TextSpec -> o.set<ObjectNode>(
                "constraints",
                nuevoObjeto()
                    .put("minLength", spec.constraints.minLength)
                    .put("maxLength", spec.constraints.maxLength)
                    .put("multiline", spec.constraints.multiline),
            )
            is RichTextSpec -> o.set<ObjectNode>(
                "constraints", nuevoObjeto().put("maxLength", spec.constraints.maxLength),
            )
            is ListTextSpec -> o.set<ObjectNode>(
                "constraints",
                nuevoObjeto()
                    .put("minItems", spec.constraints.minItems)
                    .put("maxItems", spec.constraints.maxItems)
                    .put("maxItemLength", spec.constraints.maxItemLength),
            )
            is ImageSpec -> o.set<ObjectNode>(
                "constraints",
                nuevoObjeto().put("aspect", spec.constraints.aspect.wire).put("maxBytes", spec.constraints.maxBytes),
            )
            is AudioSpec -> o.set<ObjectNode>(
                "constraints", nuevoObjeto().put("maxBytes", spec.constraints.maxBytes),
            )
            is DateSpec -> o.put("formatId", spec.formatId)
            is TimeSpec -> o.put("formatId", spec.formatId)
            is DateTimeRangeSpec -> o.put("formatId", spec.formatId)
            is ChoiceSpec -> {
                val arr = nuevoArray()
                spec.options.forEach { arr.add(nuevoObjeto().put("id", it.id).set<ObjectNode>("label", encode(it.label))) }
                o.set<ArrayNode>("options", arr)
            }
            is GroupSpec -> {
                o.put("min", spec.min)
                o.put("max", spec.max)
                o.put("reorderable", spec.reorderable)
                o.set<ObjectNode>("itemLabel", encode(spec.itemLabel))
                val arr = nuevoArray()
                spec.itemBlocks.forEach { arr.add(encode(it)) }
                o.set<ArrayNode>("itemBlocks", arr)
            }
            is LinkSpec, is LocationSpec, is BooleanSpec, is PersonSpec -> Unit
        }
        return o
    }

    // -----------------------------------------------------------------------------------------
    // Manifiesto, tema, defaults y planes — `manifest.ts`
    // -----------------------------------------------------------------------------------------

    fun manifest(node: JsonNode): TemplateManifest = manifest(node, "template.json")

    fun manifest(node: JsonNode, path: String): TemplateManifest {
        val o = Obj(node, path)
        val m = TemplateManifest(
            manifestVersion = o.entero("manifestVersion"),
            slug = TemplateSlug(o.texto("slug")),
            version = SemverVersion.parse(o.texto("version")),
            name = localizedText(o.obligatorio("name"), "$path.name"),
            description = o.bruto("description")?.let { localizedText(it, "$path.description") },
            eventKinds = o.lista("eventKinds") { n, p ->
                wire(EventKind.entries.toTypedArray(), textoDe(n, p), p, "EventKind")
            },
            minPlanTier = o.entero("minPlanTier", 1),
            locales = o.lista("locales") { n, p -> wire(Locale.entries.toTypedArray(), textoDe(n, p), p, "Locale") },
            capabilities = o.lista("capabilities", emptyList()) { n, p ->
                wire(Capability.entries.toTypedArray(), textoDe(n, p), p, "Capability")
            },
            previewImage = o.textoOpcional("previewImage"),
            sections = o.lista("sections") { n, p -> sectionSpec(n, p) },
            assets = o.lista("assets", emptyList()) { n, p -> assetEntry(n, p) },
            migrationsFrom = o.lista("migrationsFrom", emptyList()) { n, p -> SemverVersion.parse(textoDe(n, p)) },
        )
        o.fin()
        return m
    }

    private fun sectionSpec(node: JsonNode, path: String): SectionSpec {
        val o = Obj(node, path)
        val s = SectionSpec(
            key = SectionKey(o.texto("key")),
            type = wire(SectionType.entries.toTypedArray(), o.texto("type"), "$path.type", "SectionType"),
            title = localizedText(o.obligatorio("title"), "$path.title"),
            variants = o.lista("variants") { n, p -> textoDe(n, p) },
            defaultVariant = o.texto("defaultVariant"),
            required = o.booleano("required", false),
            defaultVisible = o.booleano("defaultVisible", true),
            blocks = o.lista("blocks") { n, p -> blockSpec(n, p) },
        )
        o.fin()
        return s
    }

    private fun assetEntry(node: JsonNode, path: String): AssetEntry {
        val o = Obj(node, path)
        val a = AssetEntry(
            // I-09: opcional y aditivo — un manifiesto sin `id` decodifica igual que antes.
            id = o.textoOpcional("id")?.let { AssetId(it) },
            path = o.texto("path"),
            sha256 = o.texto("sha256"),
            contentType = wire(
                AssetContentType.entries.toTypedArray(), o.texto("contentType"), "$path.contentType", "AssetContentType",
            ),
            bytes = o.entero("bytes"),
        )
        o.fin()
        return a
    }

    fun encode(m: TemplateManifest): ObjectNode {
        val o = nuevoObjeto()
        o.put("manifestVersion", m.manifestVersion)
        o.put("slug", m.slug.value)
        o.put("version", m.version.toString())
        o.set<ObjectNode>("name", encode(m.name))
        m.description?.let { o.set<ObjectNode>("description", encode(it)) }
        o.set<ArrayNode>("eventKinds", textos(m.eventKinds.map { it.wire }))
        o.put("minPlanTier", m.minPlanTier)
        o.set<ArrayNode>("locales", textos(m.locales.map { it.wire }))
        o.set<ArrayNode>("capabilities", textos(m.capabilities.map { it.wire }))
        m.previewImage?.let { o.put("previewImage", it) }
        val secciones = nuevoArray()
        m.sections.forEach { secciones.add(encode(it)) }
        o.set<ArrayNode>("sections", secciones)
        val assets = nuevoArray()
        m.assets.forEach { a ->
            val entrada = nuevoObjeto()
            a.id?.let { entrada.put("id", it.value) }
            assets.add(
                entrada.put("path", a.path).put("sha256", a.sha256)
                    .put("contentType", a.contentType.wire).put("bytes", a.bytes),
            )
        }
        o.set<ArrayNode>("assets", assets)
        o.set<ArrayNode>("migrationsFrom", textos(m.migrationsFrom.map { it.toString() }))
        return o
    }

    private fun encode(s: SectionSpec): ObjectNode {
        val o = nuevoObjeto()
        o.put("key", s.key.value)
        o.put("type", s.type.wire)
        o.set<ObjectNode>("title", encode(s.title))
        o.set<ArrayNode>("variants", textos(s.variants))
        o.put("defaultVariant", s.defaultVariant)
        o.put("required", s.required)
        o.put("defaultVisible", s.defaultVisible)
        val bloques = nuevoArray()
        s.blocks.forEach { bloques.add(encode(it)) }
        o.set<ArrayNode>("blocks", bloques)
        return o
    }

    fun theme(node: JsonNode): ThemeSpec = theme(node, "theme.json")

    fun theme(node: JsonNode, path: String): ThemeSpec {
        val o = Obj(node, path)
        val t = ThemeSpec(
            palettes = o.lista("palettes") { n, p -> palette(n, p) },
            fontSets = o.lista("fontSets") { n, p -> fontSet(n, p) },
            defaultPaletteId = o.texto("defaultPaletteId"),
            defaultFontSetId = o.texto("defaultFontSetId"),
        )
        o.fin()
        return t
    }

    private fun palette(node: JsonNode, path: String): Palette {
        val o = Obj(node, path)
        val tk = o.objeto("tokens")
        val tokens = PaletteTokens(
            tk.texto("bg"), tk.texto("surface"), tk.texto("ink"),
            tk.texto("accent"), tk.texto("accentInk"), tk.texto("muted"),
        )
        tk.fin()
        val p = Palette(o.texto("id"), localizedText(o.obligatorio("name"), "$path.name"), tokens)
        o.fin()
        return p
    }

    private fun fontSet(node: JsonNode, path: String): FontSet {
        val o = Obj(node, path)
        val f = FontSet(
            o.texto("id"),
            localizedText(o.obligatorio("name"), "$path.name"),
            fontFace(o.obligatorio("heading"), "$path.heading"),
            fontFace(o.obligatorio("body"), "$path.body"),
        )
        o.fin()
        return f
    }

    private fun fontFace(node: JsonNode, path: String): FontFace {
        val o = Obj(node, path)
        val f = FontFace(
            o.texto("family"),
            o.lista("weights") { n, p -> enteroDe(n, p) },
            wire(FontSource.entries.toTypedArray(), o.texto("source"), "$path.source", "FontSource"),
        )
        o.fin()
        return f
    }

    fun encode(t: ThemeSpec): ObjectNode {
        val o = nuevoObjeto()
        val paletas = nuevoArray()
        t.palettes.forEach { p ->
            val tk = nuevoObjeto()
                .put("bg", p.tokens.bg).put("surface", p.tokens.surface).put("ink", p.tokens.ink)
                .put("accent", p.tokens.accent).put("accentInk", p.tokens.accentInk).put("muted", p.tokens.muted)
            paletas.add(nuevoObjeto().put("id", p.id).set<ObjectNode>("name", encode(p.name)).set<ObjectNode>("tokens", tk))
        }
        o.set<ArrayNode>("palettes", paletas)
        val fuentes = nuevoArray()
        t.fontSets.forEach { f ->
            fuentes.add(
                nuevoObjeto().put("id", f.id)
                    .set<ObjectNode>("name", encode(f.name))
                    .set<ObjectNode>("heading", encode(f.heading))
                    .set<ObjectNode>("body", encode(f.body)),
            )
        }
        o.set<ArrayNode>("fontSets", fuentes)
        o.put("defaultPaletteId", t.defaultPaletteId)
        o.put("defaultFontSetId", t.defaultFontSetId)
        return o
    }

    private fun encode(f: FontFace): ObjectNode {
        val o = nuevoObjeto().put("family", f.family)
        val pesos = nuevoArray()
        f.weights.forEach { pesos.add(it) }
        o.set<ArrayNode>("weights", pesos)
        return o.put("source", f.source.wire)
    }

    fun defaults(node: JsonNode): DefaultsFile = defaults(node, "defaults.json")

    fun defaults(node: JsonNode, path: String): DefaultsFile {
        val o = Obj(node, path)
        val d = DefaultsFile(
            templateSlug = TemplateSlug(o.texto("templateSlug")),
            templateVersion = SemverVersion.parse(o.texto("templateVersion")),
            content = o.mapa("content", ::blockId) { n, p -> blockValue(n, p) },
        )
        o.fin()
        return d
    }

    fun encode(d: DefaultsFile): ObjectNode {
        val o = nuevoObjeto().put("templateSlug", d.templateSlug.value).put("templateVersion", d.templateVersion.toString())
        val contenido = nuevoObjeto()
        d.content.forEach { (k, v) -> contenido.set<ObjectNode>(k.value, encode(v)) }
        return o.set("content", contenido)
    }

    fun migrationPlan(node: JsonNode, path: String = "migration-plan.json"): MigrationPlan {
        val o = Obj(node, path)
        val p = MigrationPlan(
            templateSlug = TemplateSlug(o.texto("templateSlug")),
            from = SemverVersion.parse(o.texto("from")),
            to = SemverVersion.parse(o.texto("to")),
            ops = o.lista("ops") { n, pp -> migrationOp(n, pp) },
        )
        o.fin()
        return p
    }

    fun migrationOp(node: JsonNode, path: String): MigrationOp {
        val o = Obj(node, path)
        val op: MigrationOp = when (val nombre = o.texto("op")) {
            "renameBlock" -> MigrationOp.RenameBlock(BlockId(o.texto("from")), BlockId(o.texto("to")))
            "removeBlock" -> MigrationOp.RemoveBlock(BlockId(o.texto("id")))
            "addBlock" -> MigrationOp.AddBlock(BlockId(o.texto("id")))
            "renameSection" -> MigrationOp.RenameSection(SectionKey(o.texto("from")), SectionKey(o.texto("to")))
            "removeSection" -> MigrationOp.RemoveSection(SectionKey(o.texto("key")))
            "renamePalette" -> MigrationOp.RenamePalette(o.texto("from"), o.texto("to"))
            "renameFontSet" -> MigrationOp.RenameFontSet(o.texto("from"), o.texto("to"))
            "changeBlockType" -> MigrationOp.ChangeBlockType(
                BlockId(o.texto("id")),
                wire(ConverterId.entries.toTypedArray(), o.texto("converterId"), "$path.converterId", "ConverterId"),
            )
            "moveIntoGroup" -> MigrationOp.MoveIntoGroup(
                BlockId(o.texto("blockId")), BlockId(o.texto("groupId")), BlockId(o.texto("itemBlockId")),
            )
            "flattenGroup" -> MigrationOp.FlattenGroup(
                BlockId(o.texto("groupId")), BlockId(o.texto("itemBlockId")), BlockId(o.texto("toBlockId")),
            )
            "shrinkGroup" -> MigrationOp.ShrinkGroup(BlockId(o.texto("groupId")), o.entero("max"))
            else -> malformado("$path.op", "\"$nombre\" no pertenece al catálogo cerrado de 11 MigrationOp")
        }
        o.fin()
        return op
    }

    fun encode(p: MigrationPlan): ObjectNode {
        val o = nuevoObjeto()
            .put("templateSlug", p.templateSlug.value)
            .put("from", p.from.toString())
            .put("to", p.to.toString())
        val arr = nuevoArray()
        p.ops.forEach { arr.add(encode(it)) }
        return o.set("ops", arr)
    }

    fun encode(op: MigrationOp): ObjectNode {
        val o = nuevoObjeto().put("op", op.op)
        when (op) {
            is MigrationOp.RenameBlock -> o.put("from", op.from.value).put("to", op.to.value)
            is MigrationOp.RemoveBlock -> o.put("id", op.id.value)
            is MigrationOp.AddBlock -> o.put("id", op.id.value)
            is MigrationOp.RenameSection -> o.put("from", op.from.value).put("to", op.to.value)
            is MigrationOp.RemoveSection -> o.put("key", op.key.value)
            is MigrationOp.RenamePalette -> o.put("from", op.from).put("to", op.to)
            is MigrationOp.RenameFontSet -> o.put("from", op.from).put("to", op.to)
            is MigrationOp.ChangeBlockType -> o.put("id", op.id.value).put("converterId", op.converterId.wire)
            is MigrationOp.MoveIntoGroup ->
                o.put("blockId", op.blockId.value).put("groupId", op.groupId.value).put("itemBlockId", op.itemBlockId.value)
            is MigrationOp.FlattenGroup ->
                o.put("groupId", op.groupId.value).put("itemBlockId", op.itemBlockId.value).put("toBlockId", op.toBlockId.value)
            is MigrationOp.ShrinkGroup -> o.put("groupId", op.groupId.value).put("max", op.max)
        }
        return o
    }

    // -----------------------------------------------------------------------------------------
    // Documento — `document.ts`
    // -----------------------------------------------------------------------------------------

    fun document(node: JsonNode): InvitationDocument = document(node, "document")

    fun document(node: JsonNode, path: String): InvitationDocument {
        val o = Obj(node, path)
        val tpl = o.objeto("template")
        val ref = TemplateRef(TemplateSlug(tpl.texto("slug")), SemverVersion.parse(tpl.texto("version")))
        tpl.fin()
        val th = o.objeto("theme")
        val eleccion = ThemeChoice(th.texto("paletteId"), th.texto("fontSetId"))
        th.fin()
        val st = o.objeto("structure")
        val estructura = Structure(st.lista("sections") { n, p -> structureEntry(n, p) })
        st.fin()
        val meta = o.objeto("meta")
        val m = DocumentMeta(wire(Locale.entries.toTypedArray(), meta.texto("locale"), "$path.meta.locale", "Locale"))
        meta.fin()
        val d = InvitationDocument(
            schemaVersion = o.entero("schemaVersion"),
            template = ref,
            theme = eleccion,
            structure = estructura,
            content = o.mapa("content", ::blockId) { n, p -> blockValue(n, p) },
            // `attic` lleva `.default({})` en Zod y el esquema emitido no lo exige (O-02).
            attic = o.mapa("attic", emptyMap(), ::atticKey) { n, p -> mapaDeValores(n, p) },
            meta = m,
        )
        o.fin()
        return d
    }

    private fun atticKey(texto: String, path: String): String =
        if (mx.evolutiondev.invitaciones.modules.templates2.domain.Patterns.ATTIC_KEY.matches(texto)) texto
        else malformado(path, "\"$texto\" no es una clave de attic válida (<slug>@<semver>)")

    private fun mapaDeValores(node: JsonNode, path: String): Map<BlockId, BlockValue> {
        if (!node.isObject) malformado(path, "se esperaba un objeto y llegó ${tipo(node)}")
        val salida = LinkedHashMap<BlockId, BlockValue>()
        for (k in node.fieldNames()) salida[BlockId(k)] = blockValue(node.get(k), "$path.$k")
        return salida
    }

    private fun structureEntry(node: JsonNode, path: String): StructureEntry {
        val o = Obj(node, path)
        val e = StructureEntry(SectionKey(o.texto("key")), o.texto("variant"), o.booleano("visible"))
        o.fin()
        return e
    }

    fun encode(d: InvitationDocument): ObjectNode {
        val o = nuevoObjeto().put("schemaVersion", d.schemaVersion)
        o.set<ObjectNode>(
            "template",
            nuevoObjeto().put("slug", d.template.slug.value).put("version", d.template.version.toString()),
        )
        o.set<ObjectNode>(
            "theme", nuevoObjeto().put("paletteId", d.theme.paletteId).put("fontSetId", d.theme.fontSetId),
        )
        val secciones = nuevoArray()
        d.structure.sections.forEach {
            secciones.add(nuevoObjeto().put("key", it.key.value).put("variant", it.variant).put("visible", it.visible))
        }
        o.set<ObjectNode>("structure", nuevoObjeto().set("sections", secciones))
        val contenido = nuevoObjeto()
        d.content.forEach { (k, v) -> contenido.set<ObjectNode>(k.value, encode(v)) }
        o.set<ObjectNode>("content", contenido)
        val attic = nuevoObjeto()
        d.attic.forEach { (clave, mapa) ->
            val interno = nuevoObjeto()
            mapa.forEach { (k, v) -> interno.set<ObjectNode>(k.value, encode(v)) }
            attic.set<ObjectNode>(clave, interno)
        }
        o.set<ObjectNode>("attic", attic)
        o.set<ObjectNode>("meta", nuevoObjeto().put("locale", d.meta.locale.wire))
        return o
    }

    // -----------------------------------------------------------------------------------------
    // Operaciones — `operations.ts`
    // -----------------------------------------------------------------------------------------

    fun operation(node: JsonNode, path: String): Operation {
        val o = Obj(node, path)
        val op: Operation = when (val nombre = o.texto("op")) {
            "setBlock" -> Operation.SetBlock(
                BlockId(o.texto("blockId")), scalarValue(o.obligatorio("value"), "$path.value"),
            )
            "clearBlock" -> Operation.ClearBlock(BlockId(o.texto("blockId")))
            "addItem" -> Operation.AddItem(
                BlockId(o.texto("groupId")), o.texto("tempId"),
                o.mapa("values", ::blockId) { n, p -> scalarValue(n, p) },
                o.bruto("index")?.let { enteroDe(it, "$path.index") },
            )
            "removeItem" -> Operation.RemoveItem(BlockId(o.texto("groupId")), o.texto("itemId"))
            "moveItem" -> Operation.MoveItem(BlockId(o.texto("groupId")), o.texto("itemId"), o.entero("toIndex"))
            "setItemBlock" -> Operation.SetItemBlock(
                BlockId(o.texto("groupId")), o.texto("itemId"), BlockId(o.texto("blockId")),
                scalarValue(o.obligatorio("value"), "$path.value"),
            )
            "clearItemBlock" -> Operation.ClearItemBlock(
                BlockId(o.texto("groupId")), o.texto("itemId"), BlockId(o.texto("blockId")),
            )
            "setSectionVisible" -> Operation.SetSectionVisible(SectionKey(o.texto("sectionKey")), o.booleano("visible"))
            "setSectionVariant" -> Operation.SetSectionVariant(SectionKey(o.texto("sectionKey")), o.texto("variant"))
            "reorderSections" -> Operation.ReorderSections(o.lista("order") { n, p -> SectionKey(textoDe(n, p)) })
            "setTheme" -> Operation.SetTheme(o.textoOpcional("paletteId"), o.textoOpcional("fontSetId"))
            else -> malformado("$path.op", "\"$nombre\" no pertenece al catálogo cerrado de 11 operaciones")
        }
        o.fin()
        return op
    }

    fun operationBatch(node: JsonNode, path: String = "operationBatch"): OperationBatch {
        val o = Obj(node, path)
        val b = OperationBatch(
            baseRevision = o.largo("baseRevision"),
            clientBatchId = o.texto("clientBatchId"),
            operations = o.lista("operations") { n, p -> operation(n, p) },
        )
        o.fin()
        return b
    }

    fun editProposal(node: JsonNode, path: String = "editProposal"): EditProposal {
        val o = Obj(node, path)
        val p = EditProposal(
            sectionKey = SectionKey(o.texto("sectionKey")),
            rationale = o.texto("rationale"),
            operations = o.lista("operations") { n, pp -> operation(n, pp) },
        )
        o.fin()
        return p
    }

    fun encode(op: Operation): ObjectNode {
        val o = nuevoObjeto().put("op", op.op)
        when (op) {
            is Operation.SetBlock -> { o.put("blockId", op.blockId.value); o.set<ObjectNode>("value", encode(op.value)) }
            is Operation.ClearBlock -> o.put("blockId", op.blockId.value)
            is Operation.AddItem -> {
                o.put("groupId", op.groupId.value).put("tempId", op.tempId)
                val valores = nuevoObjeto()
                op.values.forEach { (k, v) -> valores.set<ObjectNode>(k.value, encode(v)) }
                o.set<ObjectNode>("values", valores)
                op.index?.let { o.put("index", it) }
            }
            is Operation.RemoveItem -> o.put("groupId", op.groupId.value).put("itemId", op.itemId)
            is Operation.MoveItem ->
                o.put("groupId", op.groupId.value).put("itemId", op.itemId).put("toIndex", op.toIndex)
            is Operation.SetItemBlock -> {
                o.put("groupId", op.groupId.value).put("itemId", op.itemId).put("blockId", op.blockId.value)
                o.set<ObjectNode>("value", encode(op.value))
            }
            is Operation.ClearItemBlock ->
                o.put("groupId", op.groupId.value).put("itemId", op.itemId).put("blockId", op.blockId.value)
            is Operation.SetSectionVisible -> o.put("sectionKey", op.sectionKey.value).put("visible", op.visible)
            is Operation.SetSectionVariant -> o.put("sectionKey", op.sectionKey.value).put("variant", op.variant)
            is Operation.ReorderSections -> o.set<ArrayNode>("order", textos(op.order.map { it.value }))
            is Operation.SetTheme -> {
                op.paletteId?.let { o.put("paletteId", it) }
                op.fontSetId?.let { o.put("fontSetId", it) }
            }
        }
        return o
    }

    // -----------------------------------------------------------------------------------------
    // Negocio y documento compuesto — `composed.ts`
    // -----------------------------------------------------------------------------------------

    fun businessSnapshot(node: JsonNode, path: String = "business"): BusinessSnapshot {
        val o = Obj(node, path)
        val b = BusinessSnapshot(
            invitationId = o.largo("invitationId"),
            date = o.textoOpcional("date"),
            time = o.textoOpcional("time"),
            hashtag = o.textoOpcional("hashtag"),
            coverPhotoUrl = o.textoOpcional("coverPhotoUrl"),
            childrenAllowed = o.booleano("childrenAllowed"),
            youngAllowed = o.booleano("youngAllowed"),
            eventKind = wire(EventKind.entries.toTypedArray(), o.texto("eventKind"), "$path.eventKind", "EventKind"),
            planTier = o.entero("planTier"),
            // `timezone` lleva `.default(...)` y el esquema emitido no lo exige (O-02).
            timezone = o.textoOpcional("timezone") ?: "America/Mexico_City",
        )
        o.fin()
        return b
    }

    fun encode(b: BusinessSnapshot): ObjectNode {
        val o = nuevoObjeto().put("invitationId", b.invitationId)
        // Estos cinco son `nullable()`, no `optional()`: el `null` viaja explícito.
        if (b.date == null) o.putNull("date") else o.put("date", b.date)
        if (b.time == null) o.putNull("time") else o.put("time", b.time)
        if (b.hashtag == null) o.putNull("hashtag") else o.put("hashtag", b.hashtag)
        if (b.coverPhotoUrl == null) o.putNull("coverPhotoUrl") else o.put("coverPhotoUrl", b.coverPhotoUrl)
        o.put("childrenAllowed", b.childrenAllowed)
        o.put("youngAllowed", b.youngAllowed)
        o.put("eventKind", b.eventKind.wire)
        o.put("planTier", b.planTier)
        o.put("timezone", b.timezone)
        return o
    }

    fun composedDocument(node: JsonNode, path: String = "composed"): ComposedDocument {
        val o = Obj(node, path)
        val tpl = o.objeto("template")
        val ref = TemplateRef(TemplateSlug(tpl.texto("slug")), SemverVersion.parse(tpl.texto("version")))
        tpl.fin()
        val c = ComposedDocument(
            composedVersion = o.entero("composedVersion"),
            template = ref,
            locale = wire(Locale.entries.toTypedArray(), o.texto("locale"), "$path.locale", "Locale"),
            theme = resolvedTheme(o.obligatorio("theme"), "$path.theme"),
            sections = o.lista("sections") { n, p -> composedSection(n, p) },
        )
        o.fin()
        return c
    }

    private fun resolvedTheme(node: JsonNode, path: String): ResolvedTheme {
        val o = Obj(node, path)
        val tokens = LinkedHashMap<String, String>()
        val tk = o.obligatorio("tokens")
        for (k in tk.fieldNames()) tokens[k] = textoDe(tk.get(k), "$path.tokens.$k")
        val f = o.objeto("fonts")
        val fuentes = ResolvedFonts(
            resolvedFont(f.obligatorio("heading"), "$path.fonts.heading"),
            resolvedFont(f.obligatorio("body"), "$path.fonts.body"),
        )
        f.fin()
        val t = ResolvedTheme(o.texto("paletteId"), o.texto("fontSetId"), tokens, fuentes)
        o.fin()
        return t
    }

    private fun resolvedFont(node: JsonNode, path: String): ResolvedFont {
        val o = Obj(node, path)
        val f = ResolvedFont(o.texto("family"), o.lista("weights") { n, p -> enteroDe(n, p) }, o.texto("source"))
        o.fin()
        return f
    }

    private fun composedSection(node: JsonNode, path: String): ComposedSection {
        val o = Obj(node, path)
        val s = ComposedSection(
            key = SectionKey(o.texto("key")),
            type = wire(SectionType.entries.toTypedArray(), o.texto("type"), "$path.type", "SectionType"),
            variant = o.texto("variant"),
            visible = o.booleano("visible"),
            title = o.texto("title"),
            blocks = o.lista("blocks") { n, p -> composedEntry(n, p) },
        )
        o.fin()
        return s
    }

    private fun composedEntry(node: JsonNode, path: String): ComposedEntry {
        val o = Obj(node, path)
        val id = BlockId(o.texto("id"))
        val role = wire(BlockRole.entries.toTypedArray(), o.texto("role"), "$path.role", "BlockRole")
        val kind = wire(BlockKind.entries.toTypedArray(), o.texto("type"), "$path.type", "BlockKind")
        val label = o.texto("label")
        val prov = wire(Provenance.entries.toTypedArray(), o.texto("provenance"), "$path.provenance", "Provenance")
        val e: ComposedEntry = if (kind == BlockKind.GROUP) {
            ComposedGroup(id, role, label, prov, o.lista("items") { n, p -> composedItem(n, p) })
        } else {
            val valorBruto = o.bruto("value")
            ComposedBlock(id, role, kind, label, prov, valorBruto?.let { resolvedValue(it, "$path.value") })
        }
        o.fin()
        return e
    }

    private fun composedItem(node: JsonNode, path: String): ComposedItem {
        val o = Obj(node, path)
        val i = ComposedItem(
            ItemId(o.texto("itemId")),
            o.lista("blocks") { n, p -> composedEntry(n, p) as ComposedBlock },
        )
        o.fin()
        return i
    }

    fun resolvedValue(node: JsonNode, path: String): ResolvedValue {
        val o = Obj(node, path)
        val kind = wire(BlockKind.entries.toTypedArray(), o.texto("kind"), "$path.kind", "BlockKind")
        val v: ResolvedValue = when (kind) {
            BlockKind.TEXT -> ResolvedText(o.texto("value"))
            BlockKind.RICH_TEXT -> ResolvedRichText(richDoc(o.obligatorio("doc"), "$path.doc"))
            BlockKind.LIST_TEXT -> ResolvedListText(o.lista("items") { n, p -> textoDe(n, p) })
            BlockKind.IMAGE -> ResolvedImage(o.texto("url"), o.texto("alt"), focal(o.obligatorio("focal"), "$path.focal"))
            BlockKind.AUDIO -> ResolvedAudio(o.texto("url"))
            BlockKind.DATE -> ResolvedDate(o.texto("value"), o.texto("formatted"))
            BlockKind.TIME -> ResolvedTime(o.texto("value"), o.texto("formatted"))
            BlockKind.DATE_TIME_RANGE ->
                ResolvedDateTimeRange(o.texto("start"), o.textoOpcional("end"), o.texto("formatted"))
            BlockKind.LINK -> ResolvedLink(o.texto("href"), o.textoOpcional("label"))
            BlockKind.LOCATION ->
                ResolvedLocation(o.texto("name"), o.textoOpcional("address"), o.textoOpcional("mapHref"))
            BlockKind.CHOICE -> ResolvedChoice(o.texto("optionId"), o.texto("label"))
            BlockKind.BOOLEAN -> ResolvedBoolean(o.booleano("value"))
            BlockKind.PERSON -> ResolvedPerson(o.texto("name"), o.textoOpcional("note"))
            BlockKind.GROUP -> malformado("$path.kind", "\"group\" no es un ResolvedValue (los grupos llevan `items`)")
        }
        o.fin()
        return v
    }

    fun encode(c: ComposedDocument): ObjectNode {
        val o = nuevoObjeto().put("composedVersion", c.composedVersion)
        o.set<ObjectNode>(
            "template",
            nuevoObjeto().put("slug", c.template.slug.value).put("version", c.template.version.toString()),
        )
        o.put("locale", c.locale.wire)
        val tokens = nuevoObjeto()
        c.theme.tokens.forEach { (k, v) -> tokens.put(k, v) }
        val fuentes = nuevoObjeto()
            .set<ObjectNode>("heading", encode(c.theme.fonts.heading))
            .set<ObjectNode>("body", encode(c.theme.fonts.body))
        o.set<ObjectNode>(
            "theme",
            nuevoObjeto().put("paletteId", c.theme.paletteId).put("fontSetId", c.theme.fontSetId)
                .set<ObjectNode>("tokens", tokens).set<ObjectNode>("fonts", fuentes),
        )
        val secciones = nuevoArray()
        c.sections.forEach { secciones.add(encode(it)) }
        return o.set("sections", secciones)
    }

    private fun encode(f: ResolvedFont): ObjectNode {
        val o = nuevoObjeto().put("family", f.family)
        val pesos = nuevoArray()
        f.weights.forEach { pesos.add(it) }
        o.set<ArrayNode>("weights", pesos)
        return o.put("source", f.source)
    }

    private fun encode(s: ComposedSection): ObjectNode {
        val o = nuevoObjeto()
            .put("key", s.key.value).put("type", s.type.wire).put("variant", s.variant)
            .put("visible", s.visible).put("title", s.title)
        val arr = nuevoArray()
        s.blocks.forEach { arr.add(encode(it)) }
        return o.set("blocks", arr)
    }

    fun encode(e: ComposedEntry): ObjectNode {
        val o = nuevoObjeto()
            .put("id", e.id.value).put("role", e.role.wire).put("type", e.type.wire)
            .put("label", e.label).put("provenance", e.provenance.wire)
        when (e) {
            is ComposedBlock ->
                if (e.value == null) o.putNull("value") else o.set<ObjectNode>("value", encode(e.value))
            is ComposedGroup -> {
                val arr = nuevoArray()
                e.items.forEach { item ->
                    val bloques = nuevoArray()
                    item.blocks.forEach { bloques.add(encode(it)) }
                    arr.add(nuevoObjeto().put("itemId", item.itemId.value).set<ArrayNode>("blocks", bloques))
                }
                o.set<ArrayNode>("items", arr)
            }
        }
        return o
    }

    fun encode(v: ResolvedValue): ObjectNode {
        val o = nuevoObjeto().put("kind", v.kind.wire)
        when (v) {
            is ResolvedText -> o.put("value", v.value)
            is ResolvedRichText -> o.set<ObjectNode>("doc", encode(v.doc))
            is ResolvedListText -> o.set<ArrayNode>("items", textos(v.items))
            is ResolvedImage -> { o.put("url", v.url).put("alt", v.alt); o.set<ObjectNode>("focal", encode(v.focal)) }
            is ResolvedAudio -> o.put("url", v.url)
            is ResolvedDate -> o.put("value", v.value).put("formatted", v.formatted)
            is ResolvedTime -> o.put("value", v.value).put("formatted", v.formatted)
            is ResolvedDateTimeRange -> {
                o.put("start", v.start)
                v.end?.let { o.put("end", it) }
                o.put("formatted", v.formatted)
            }
            is ResolvedLink -> { o.put("href", v.href); v.label?.let { o.put("label", it) } }
            is ResolvedLocation -> {
                o.put("name", v.name); v.address?.let { o.put("address", it) }; v.mapHref?.let { o.put("mapHref", it) }
            }
            is ResolvedChoice -> o.put("optionId", v.optionId).put("label", v.label)
            is ResolvedBoolean -> o.put("value", v.value)
            is ResolvedPerson -> { o.put("name", v.name); v.note?.let { o.put("note", it) } }
        }
        return o
    }

    fun compositionReport(node: JsonNode, path: String = "report"): CompositionReport {
        val o = Obj(node, path)
        val fb = o.bruto("themeFallback")?.let { n ->
            val f = Obj(n, "$path.themeFallback")
            val r = ThemeFallback(f.textoOpcional("paletteId"), f.textoOpcional("fontSetId"))
            f.fin()
            r
        }
        val r = CompositionReport(
            missingRequired = o.lista("missingRequired") { n, p -> BlockId(textoDe(n, p)) },
            stillDefault = o.lista("stillDefault") { n, p -> BlockId(textoDe(n, p)) },
            orphanContent = o.lista("orphanContent") { n, p -> BlockId(textoDe(n, p)) },
            orphanSections = o.lista("orphanSections") { n, p -> SectionKey(textoDe(n, p)) },
            invalidValues = o.lista("invalidValues") { n, p ->
                val i = Obj(n, p)
                val iv = InvalidValue(BlockId(i.texto("blockId")), i.texto("code"))
                i.fin(); iv
            },
            themeFallback = fb,
        )
        o.fin()
        return r
    }

    fun encode(r: CompositionReport): ObjectNode {
        val o = nuevoObjeto()
        o.set<ArrayNode>("missingRequired", textos(r.missingRequired.map { it.value }))
        o.set<ArrayNode>("stillDefault", textos(r.stillDefault.map { it.value }))
        o.set<ArrayNode>("orphanContent", textos(r.orphanContent.map { it.value }))
        o.set<ArrayNode>("orphanSections", textos(r.orphanSections.map { it.value }))
        val invalidos = nuevoArray()
        r.invalidValues.forEach { invalidos.add(nuevoObjeto().put("blockId", it.blockId.value).put("code", it.code)) }
        o.set<ArrayNode>("invalidValues", invalidos)
        val fb = r.themeFallback
        if (fb == null) {
            o.putNull("themeFallback")
        } else {
            val f = nuevoObjeto()
            fb.paletteId?.let { f.put("paletteId", it) }
            fb.fontSetId?.let { f.put("fontSetId", it) }
            o.set<ObjectNode>("themeFallback", f)
        }
        return o
    }
}
