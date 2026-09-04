package mx.evolutiondev.invitaciones.modules.templates2.domain

/**
 * Espejo de `blocks.ts` `SpecBase` — los 9 campos comunes de toda especificación de bloque.
 * Se modela como tipo propio (y no repitiendo 9 propiedades en 14 data classes) porque `02 §7.1`
 * nombra explícitamente `SpecBase` como parte de la jerarquía.
 *
 * `required`, `editable`, `source` y `aiEditable` llevan `.default()` en Zod: un manifiesto crudo
 * válido puede llegar sin ellos y la normalización (`SchemaDefaults`) debe rellenarlos ANTES de
 * evaluar invariantes, o `I-22` violaría sobre un manifiesto que TypeScript acepta (objeción O-02).
 */
data class SpecBase(
    val id: BlockId,
    val role: BlockRole,
    val label: LocalizedText,
    val help: LocalizedText? = null,
    val required: Boolean = false,
    val editable: Boolean = true,
    val source: BlockSource = BlockSource.USER,
    val businessField: BusinessField? = null,
    val aiEditable: Boolean = true,
)

/** Espejo de `blocks.ts` `BlockSpec` — unión discriminada por `type` con los 14 tipos de bloque. */
sealed interface BlockSpec {
    val base: SpecBase
    val type: BlockKind

    // Accesos de conveniencia usados por `Invariants` y por la composición.
    val id: BlockId get() = base.id
    val role: BlockRole get() = base.role
    val label: LocalizedText get() = base.label
    val source: BlockSource get() = base.source
    val businessField: BusinessField? get() = base.businessField
    val required: Boolean get() = base.required
}

/** `blocks.ts` `ScalarSpec` — las 13 especificaciones que pueden ser `itemBlocks` de un grupo. */
sealed interface ScalarSpec : BlockSpec

data class TextConstraints(val minLength: Int = 0, val maxLength: Int = 200, val multiline: Boolean = false)
data class RichTextConstraints(val maxLength: Int = 8000)
data class ListTextConstraints(val minItems: Int = 0, val maxItems: Int = 12, val maxItemLength: Int = 200)
/** `aspect` y `maxBytes` NO se comprueban contra el valor (X-06): se verifican en el reductor. */
data class ImageConstraints(val aspect: ImageAspect = ImageAspect.FREE, val maxBytes: Int = 8_388_608)
data class AudioConstraints(val maxBytes: Int = 8_388_608)
/** `blocks.ts` `ChoiceSpec.options[]` */
data class ChoiceOption(val id: String, val label: LocalizedText)

data class TextSpec(override val base: SpecBase, val constraints: TextConstraints = TextConstraints()) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.TEXT
}
data class RichTextSpec(override val base: SpecBase, val constraints: RichTextConstraints = RichTextConstraints()) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.RICH_TEXT
}
data class ListTextSpec(override val base: SpecBase, val constraints: ListTextConstraints = ListTextConstraints()) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.LIST_TEXT
}
data class ImageSpec(override val base: SpecBase, val constraints: ImageConstraints = ImageConstraints()) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.IMAGE
}
data class AudioSpec(override val base: SpecBase, val constraints: AudioConstraints = AudioConstraints()) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.AUDIO
}
/** `formatId` lo resuelve `formatDate(value, formatId, locale)` (R6, mata H-27). */
data class DateSpec(override val base: SpecBase, val formatId: String = "long") : ScalarSpec {
    override val type: BlockKind get() = BlockKind.DATE
}
data class TimeSpec(override val base: SpecBase, val formatId: String = "h12") : ScalarSpec {
    override val type: BlockKind get() = BlockKind.TIME
}
data class DateTimeRangeSpec(override val base: SpecBase, val formatId: String = "long-h12") : ScalarSpec {
    override val type: BlockKind get() = BlockKind.DATE_TIME_RANGE
}
data class LinkSpec(override val base: SpecBase) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.LINK
}
data class LocationSpec(override val base: SpecBase) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.LOCATION
}
data class ChoiceSpec(override val base: SpecBase, val options: List<ChoiceOption>) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.CHOICE
}
data class BooleanSpec(override val base: SpecBase) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.BOOLEAN
}
data class PersonSpec(override val base: SpecBase) : ScalarSpec {
    override val type: BlockKind get() = BlockKind.PERSON
}

/** Grupo repetible. Sus `itemBlocks` son escalares (no anidan). `min ≤ max` es I-07. */
data class GroupSpec(
    override val base: SpecBase,
    val min: Int = 0,
    val max: Int = 12,
    val reorderable: Boolean = true,
    val itemLabel: LocalizedText,
    val itemBlocks: List<ScalarSpec>,
) : BlockSpec {
    override val type: BlockKind get() = BlockKind.GROUP
}
