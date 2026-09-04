package mx.evolutiondev.invitaciones.modules.templates2.schema

import com.fasterxml.jackson.databind.JsonNode
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockKind
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ChoiceValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.DateTimeRangeSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.DefaultsFile
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.LocalizedText
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichDoc
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateManifest
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ThemeSpec

/**
 * Puerto Kotlin de `frontend/packages/schema/src/invariants.ts`: las invariantes entre campos que
 * `z.toJSONSchema` no puede expresar (`.refine()`/`.superRefine()` se descartan **en silencio** al
 * emitir, verificado con `zod@4.5.4`, `01 §8`).
 *
 * Cada `I-xx` está implementada **dos veces** —aquí y en TypeScript— y se prueba con la **misma**
 * tabla de casos: `frontend/packages/schema/golden/invariants/` (`06 §5`), montada en el
 * classpath de pruebas sin copiarla (ADR-1R-C-09). `InvariantParityTest` falla si un código sobra o
 * falta respecto a lo que declara cada caso.
 *
 * **Precondición de normalización (objeción O-02).** `validateManifest` y `validateDocument` esperan
 * la forma **normalizada** (todos los `.default()` de Zod ya aplicados). `DomainJson` los aplica al
 * decodificar, así que cualquier ruta que pase por él cumple la precondición; un `TemplateManifest`
 * construido a mano en Kotlin también, porque los mismos defaults están en los constructores de
 * `SpecBase`, `SectionSpec` y `TemplateManifest`. Sin esa normalización, `I-22` violaría sobre un
 * manifiesto crudo que TypeScript acepta.
 *
 * Las cinco funciones públicas son exactamente las cinco que nombra `golden/README.md` (campo `fn`).
 */
object Invariants {

    /**
     * Claves reservadas del objeto de JavaScript en cualquier mapa por id (`content`, `defaults.content`,
     * `attic[...]`, `GroupItem.values`). Espejo de `invariants.ts` `RESERVED_KEYS`.
     */
    val RESERVED_KEYS = listOf("__proto__", "constructor", "prototype")

    /**
     * **I-29** — corre sobre el JSON **crudo, ANTES de `parse`** (contratos.md §3).
     *
     * Medido en la ronda 1R con `zod@4.5.4`: `z.record(BlockId, BlockValue).safeParse(JSON.parse('{"__proto__":…}'))`
     * devuelve `success: true` y un objeto **vacío** — la clave se descarta **en silencio**, que es
     * exactamente lo que P1 prohíbe. `ajv` sobre el JSON Schema emitido **sí** la rechaza
     * (`propertyNames.pattern`), así que TypeScript y Kotlin discreparían sobre el mismo documento.
     * Si esta comprobación se hiciera después del parseo, la paridad sería falsa.
     *
     * En Kotlin el riesgo de contaminación de prototipo no existe, pero la **divergencia sí**: es la
     * razón por la que la invariante se implementa igual en los dos lados.
     */
    fun assertNoReservedKeys(raw: JsonNode?, path: String = "$"): List<Violation> {
        val v = mutableListOf<Violation>()
        recorrer(raw, path, v)
        return v
    }

    private fun recorrer(n: JsonNode?, p: String, v: MutableList<Violation>) {
        if (n == null) return
        if (n.isArray) {
            n.forEachIndexed { i, hijo -> recorrer(hijo, "$p[$i]", v) }
            return
        }
        if (!n.isObject) return
        for (k in n.fieldNames()) {
            if (RESERVED_KEYS.contains(k)) v.add(Violation.of(InvariantCode.I_29_RESERVED_OBJECT_KEY, "$p.$k"))
            recorrer(n.get(k), "$p.$k", v)
        }
    }

    /** Longitud en caracteres del texto plano de un `richText` (I-16 para `richText`). */
    fun richTextLength(doc: RichDoc): Int = doc.content.sumOf { p -> p.content.sumOf { it.text.length } }

    /** Invariantes del PAQUETE. Se ejecutan en el registro: cualquier violación = registro rechazado. */
    fun validateManifest(m: TemplateManifest, theme: ThemeSpec, defaults: DefaultsFile): List<Violation> {
        val v = mutableListOf<Violation>()
        val sectionKeys = HashSet<String>()
        val blockIds = LinkedHashMap<String, BlockSpec>()
        val singletonSeen = HashMap<BlockRole, String>()

        // I-27: todo LocalizedText del manifiesto debe traer TODOS los locales que `locales` declara;
        // si no, compose() caería a "es-MX" en silencio para un cliente en-US (P1: nada sin traza).
        fun checkL10n(t: LocalizedText, path: String) {
            for (loc in m.locales) {
                if (t[loc] == null) {
                    v.add(Violation.of(InvariantCode.I_27_LOCALIZED_TEXT_MISSING_LOCALE, path, loc.wire))
                }
            }
        }

        checkL10n(m.name, "name")
        m.description?.let { checkL10n(it, "description") }

        for (s in m.sections) {
            checkL10n(s.title, "sections.${s.key.value}.title")
            if (sectionKeys.contains(s.key.value)) {
                v.add(Violation.of(InvariantCode.I_14_SECTION_KEY_DUPLICATE, "sections.${s.key.value}"))
            }
            sectionKeys.add(s.key.value)
            if (!s.variants.contains(s.defaultVariant)) {
                v.add(Violation.of(InvariantCode.I_08_DEFAULT_VARIANT_UNKNOWN, "sections.${s.key.value}.defaultVariant"))
            }
            for (b in s.blocks) {
                checkL10n(b.label, "blocks.${b.id.value}.label")
                if (blockIds.containsKey(b.id.value)) {
                    v.add(Violation.of(InvariantCode.I_13_BLOCK_ID_DUPLICATE, "blocks.${b.id.value}"))
                }
                blockIds[b.id.value] = b
                if (b.source == BlockSource.BUSINESS && b.businessField == null) {
                    v.add(Violation.of(InvariantCode.I_05_BUSINESS_FIELD_MISSING, "blocks.${b.id.value}"))
                }
                val bf = b.businessField
                if (b.source == BlockSource.BUSINESS && bf != null && bf.expectedType != b.type) {
                    v.add(
                        Violation.of(
                            InvariantCode.I_06_BUSINESS_TYPE_MISMATCH, "blocks.${b.id.value}",
                            "${bf.wire} exige ${bf.expectedType.wire}",
                        ),
                    )
                }
                // I-25: rol de grupo <=> bloque de tipo group (hallazgo 1R A-09).
                val esRolDeGrupo = BlockRole.GROUP_ROLES.contains(b.role)
                if (b.type == BlockKind.GROUP && !esRolDeGrupo) {
                    v.add(
                        Violation.of(
                            InvariantCode.I_25_GROUP_ROLE_MISMATCH, "blocks.${b.id.value}",
                            "\"${b.role.wire}\" no es un rol de grupo",
                        ),
                    )
                }
                if (b.type != BlockKind.GROUP && esRolDeGrupo) {
                    v.add(
                        Violation.of(
                            InvariantCode.I_25_GROUP_ROLE_MISMATCH, "blocks.${b.id.value}",
                            "\"${b.role.wire}\" está reservado a bloques group",
                        ),
                    )
                }
                // I-26: rol singleton usado dos veces en el mismo manifiesto (hallazgo 1R A-10).
                if (BlockRole.SINGLETON_ROLES.contains(b.role)) {
                    val antes = singletonSeen[b.role]
                    if (antes != null) {
                        v.add(
                            Violation.of(
                                InvariantCode.I_26_SINGLETON_ROLE_DUPLICATE, "blocks.${b.id.value}",
                                "${b.role.wire} ya lo usa $antes",
                            ),
                        )
                    } else {
                        singletonSeen[b.role] = b.id.value
                    }
                }
                if (b is GroupSpec) {
                    if (b.min > b.max) v.add(Violation.of(InvariantCode.I_07_GROUP_MIN_GT_MAX, "blocks.${b.id.value}"))
                    val inner = HashSet<String>()
                    for (ib in b.itemBlocks) {
                        val rutaInterna = "blocks.${b.id.value}.${ib.id.value}"
                        checkL10n(ib.label, "$rutaInterna.label")
                        if (BlockRole.GROUP_ROLES.contains(ib.role)) {
                            v.add(
                                Violation.of(
                                    InvariantCode.I_25_GROUP_ROLE_MISMATCH, rutaInterna,
                                    "\"${ib.role.wire}\" está reservado a bloques group",
                                ),
                            )
                        }
                        if (inner.contains(ib.id.value)) {
                            v.add(Violation.of(InvariantCode.I_13_BLOCK_ID_DUPLICATE, rutaInterna))
                        }
                        inner.add(ib.id.value)
                        // I-22 (cierra el hallazgo adversarial E-04): un itemBlock nunca lee de negocio ni
                        // es fijo — BusinessSnapshot no tiene ningún campo indexado por ítem y R4 no define
                        // cómo resolverlo; solo "user" tiene sentido dentro de un grupo repetible.
                        if (ib.source != BlockSource.USER) {
                            v.add(Violation.of(InvariantCode.I_22_ITEM_BLOCK_SOURCE_NOT_USER, rutaInterna))
                        }
                    }
                }
            }
        }

        if (theme.palettes.none { it.id == theme.defaultPaletteId }) {
            v.add(Violation.of(InvariantCode.I_09_THEME_DEFAULT_UNKNOWN, "theme.defaultPaletteId"))
        }
        if (theme.fontSets.none { it.id == theme.defaultFontSetId }) {
            v.add(Violation.of(InvariantCode.I_09_THEME_DEFAULT_UNKNOWN, "theme.defaultFontSetId"))
        }

        // Ordenado: el orden de claves de un JSONB no es estable (hallazgo 1R A-08).
        for (key in defaults.content.keys.map { it.value }.sorted()) {
            val valor = defaults.content[BlockId(key)]!!
            val spec = blockIds[key]
            if (spec == null) {
                v.add(Violation.of(InvariantCode.I_10_DEFAULT_KEY_UNKNOWN, "defaults.$key"))
                continue
            }
            // I-28: un default para un bloque `business` es contenido muerto — R4 lo ignora siempre.
            if (spec.source == BlockSource.BUSINESS) {
                v.add(Violation.of(InvariantCode.I_28_DEFAULT_FOR_BUSINESS_BLOCK, "defaults.$key"))
                continue
            }
            v.addAll(validateValueAgainstSpec(spec, valor, "defaults.$key"))
        }
        return v
    }

    /**
     * **I-24** — `reorderSections.order` debe ser una PERMUTACIÓN exacta de las claves del documento.
     * El esquema solo comprueba `min(1).max(16)`: acepta `["cover","cover","cover"]` (hallazgo 1R A-04).
     * La ejecuta el reductor de operaciones ANTES de aplicar el lote (`03 §3.3`).
     */
    fun validateReorder(order: List<String>, actuales: List<String>): List<Violation> {
        val a = order.sorted()
        val b = actuales.sorted()
        return if (a == b) {
            emptyList()
        } else {
            listOf(
                Violation.of(
                    InvariantCode.I_24_REORDER_NOT_A_PERMUTATION, "operations.reorderSections.order",
                    "esperaba una permutación de [${b.joinToString(",")}]",
                ),
            )
        }
    }

    /** Invariantes del DOCUMENTO contra su versión de plantilla. Se ejecutan en cada escritura. */
    fun validateDocument(doc: InvitationDocument, m: TemplateManifest, theme: ThemeSpec): List<Violation> {
        val v = mutableListOf<Violation>()
        // I-23 (hallazgo adversarial E-06): el locale elegido debe estar entre los que la plantilla
        // declara soportar (`manifest.locales`, `01 §2.2`) — antes no se verificaba en absoluto.
        if (!m.locales.contains(doc.meta.locale)) {
            v.add(Violation.of(InvariantCode.I_23_LOCALE_NOT_SUPPORTED, "meta.locale"))
        }
        val specs = LinkedHashMap<String, BlockSpec>()
        val sections = m.sections.associateBy { it.key.value }
        for (s in m.sections) for (b in s.blocks) specs[b.id.value] = b

        val vistas = HashSet<String>()
        for (e in doc.structure.sections) {
            val k = e.key.value
            if (vistas.contains(k)) v.add(Violation.of(InvariantCode.I_11_STRUCTURE_DUPLICATE_KEY, "structure.$k"))
            vistas.add(k)
            val s = sections[k]
            if (s == null) {
                v.add(Violation.of(InvariantCode.I_19_STRUCTURE_KEY_UNKNOWN, "structure.$k"))
                continue
            }
            if (s.required && !e.visible) {
                v.add(Violation.of(InvariantCode.I_17_REQUIRED_SECTION_HIDDEN, "structure.$k"))
            }
            if (!s.variants.contains(e.variant)) {
                v.add(Violation.of(InvariantCode.I_08_DEFAULT_VARIANT_UNKNOWN, "structure.$k.variant"))
            }
        }
        if (theme.palettes.none { it.id == doc.theme.paletteId }) {
            v.add(Violation.of(InvariantCode.I_20_THEME_ID_UNKNOWN, "theme.paletteId"))
        }
        if (theme.fontSets.none { it.id == doc.theme.fontSetId }) {
            v.add(Violation.of(InvariantCode.I_20_THEME_ID_UNKNOWN, "theme.fontSetId"))
        }
        for (key in doc.content.keys.map { it.value }.sorted()) {   // ordenado (1R A-08)
            val valor = doc.content[BlockId(key)]!!
            val spec = specs[key]
            if (spec == null) {
                v.add(Violation.of(InvariantCode.I_12_CONTENT_KEY_UNKNOWN, "content.$key"))
                continue
            }
            if (spec.source != BlockSource.USER) {
                v.add(Violation.of(InvariantCode.I_21_BUSINESS_BLOCK_WRITTEN, "content.$key"))
                continue
            }
            v.addAll(validateValueAgainstSpec(spec, valor, "content.$key"))
        }
        return v
    }

    /**
     * Valor contra especificación: `kind`, longitud, opciones, rango y grupos. Es la MISMA función que
     * usa el reductor de operaciones.
     *
     * `image.aspect`, `image.maxBytes` y `audio.maxBytes` **no** se comprueban aquí (decisión X-06):
     * `ImageValue`/`AudioValue` solo llevan `assetId`, sin bytes ni dimensiones. Las verifica el
     * reductor con `ReducerContext.assetMeta`, con error `TPL_ASSET_SPEC_MISMATCH`.
     */
    fun validateValueAgainstSpec(spec: BlockSpec, value: BlockValue, path: String): List<Violation> {
        val v = mutableListOf<Violation>()
        if (value.kind != spec.type) {
            return listOf(
                Violation.of(
                    InvariantCode.I_15_BLOCK_KIND_MISMATCH, path,
                    "${value.kind.wire} != ${spec.type.wire}",
                ),
            )
        }
        when (spec) {
            is TextSpec -> {
                val s = (value as TextValue).value
                if (s.length > spec.constraints.maxLength || s.length < spec.constraints.minLength) {
                    v.add(Violation.of(InvariantCode.I_16_TEXT_TOO_LONG, path))
                }
                // I-30 (X-06): `multiline: false` prohibe saltos de linea en el valor. Antes era una
                // constraint declarada que no comprobaba nadie: el editor pintaba un <input>, pero la API
                // y la IA escriben sin pasar por el y un "\n" rompe la maquetacion de la seccion.
                if (!spec.constraints.multiline && s.any { it == '\r' || it == '\n' }) {
                    v.add(Violation.of(InvariantCode.I_30_TEXT_MULTILINE_NOT_ALLOWED, path))
                }
            }
            is RichTextSpec -> {
                // 1R A-02: `constraints.maxLength` de richText no se validaba en NINGUN sitio; un relato
                // de 8000 caracteres pasaba contra un spec de 600. Se mide sobre el texto plano.
                if (richTextLength((value as RichTextValue).doc) > spec.constraints.maxLength) {
                    v.add(Violation.of(InvariantCode.I_16_TEXT_TOO_LONG, path))
                }
            }
            is ListTextSpec -> {
                val items = (value as ListTextValue).items
                if (items.size > spec.constraints.maxItems || items.size < spec.constraints.minItems) {
                    v.add(Violation.of(InvariantCode.I_04_GROUP_SIZE_OUT_OF_BOUNDS, path))
                }
                if (items.any { it.length > spec.constraints.maxItemLength }) {
                    v.add(Violation.of(InvariantCode.I_16_TEXT_TOO_LONG, path))
                }
            }
            is DateTimeRangeSpec -> {
                val r = value as DateTimeRangeValue
                val fin = r.end
                // Comparacion lexicografica de `IsoLocalDateTime`, igual que el `<` de JavaScript sobre
                // strings: el formato es de ancho fijo, asi que el orden lexicografico es el cronologico.
                if (fin != null && fin < r.start) {
                    v.add(Violation.of(InvariantCode.I_01_RANGE_END_BEFORE_START, path))
                }
            }
            is ChoiceSpec -> {
                val optionId = (value as ChoiceValue).optionId
                if (spec.options.none { it.id == optionId }) {
                    v.add(Violation.of(InvariantCode.I_02_CHOICE_UNKNOWN_OPTION, path))
                }
            }
            is GroupSpec -> {
                val items = (value as GroupValue).items
                if (items.size < spec.min || items.size > spec.max) {
                    v.add(Violation.of(InvariantCode.I_04_GROUP_SIZE_OUT_OF_BOUNDS, path))
                }
                val ids = HashSet<String>()
                val inner: Map<String, ScalarSpec> = spec.itemBlocks.associateBy { it.id.value }
                for (item in items) {
                    val itemId = item.itemId.value
                    if (ids.contains(itemId)) {
                        v.add(Violation.of(InvariantCode.I_03_ITEM_ID_DUPLICATE, "$path[$itemId]"))
                    }
                    ids.add(itemId)
                    for ((k, valor) in item.values) {
                        val ib = inner[k.value]
                        if (ib == null) {
                            v.add(Violation.of(InvariantCode.I_18_ITEM_BLOCK_UNKNOWN, "$path[$itemId].${k.value}"))
                            continue
                        }
                        v.addAll(validateValueAgainstSpec(ib, valor, "$path[$itemId].${k.value}"))
                    }
                }
            }
            // `image`, `audio`, `date`, `time`, `link`, `location`, `boolean` y `person` no tienen
            // ninguna restriccion comprobable contra el valor: la forma ya la garantiza el esquema y las
            // tres restricciones de asset las verifica el reductor (X-06).
            else -> Unit
        }
        return v
    }

    /**
     * Las 30 invariantes en una sola llamada (`01 §6.5` `validateInvariants`). Devuelve la lista vacía
     * si todo está bien; **nunca lanza**. `raw` es el JSON crudo del documento tal como llegó por HTTP:
     * sin él, `I-29` no puede comprobarse (contratos.md §3).
     */
    fun validateInvariants(doc: InvitationDocument, pkg: TemplatePackage, raw: JsonNode? = null): List<Violation> {
        val v = mutableListOf<Violation>()
        if (raw != null) v.addAll(assertNoReservedKeys(raw))
        v.addAll(validateDocument(doc, pkg.manifest, pkg.theme))
        return v
    }
}
