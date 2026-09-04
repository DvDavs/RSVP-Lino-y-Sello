package mx.evolutiondev.invitaciones.modules.templates2.migration

import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ConverterId
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.ListTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationOp
import mx.evolutiondev.invitaciones.modules.templates2.domain.MigrationPlan
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichDoc
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichParagraph
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichSpan
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.RichTextValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.StructureEntry
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplateRef
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.TextValue
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Violation

/** Razón por la que un valor acabó en el `attic`. Enum **cerrado** de `01 §6.1` (`MigrationReport`). */
enum class AtticReason(val wire: String) {
    REMOVE_BLOCK("removeBlock"), REMOVE_SECTION("removeSection"),
    SHRINK_GROUP("shrinkGroup"), TYPE_CHANGE_UNSUPPORTED("typeChangeUnsupported");
    companion object { fun of(w: String): AtticReason? = entries.firstOrNull { it.wire == w } }
}

data class AppliedOp(val op: String, val target: String)
data class MovedBlock(val from: String, val to: String)
data class AtticEntry(val blockId: String, val reason: AtticReason)
data class ConvertedBlock(val blockId: String, val converterId: String)

data class MigrationReport(
    val applied: List<AppliedOp>,
    val moved: List<MovedBlock>,
    val toAttic: List<AtticEntry>,
    val converted: List<ConvertedBlock>,
    val lossless: Boolean,
)

/** `01 §6.1`: NUNCA se lanza una excepción; todo fallo es un error tipado. */
sealed interface MigrationError {
    val code: String
    data class PlanVersionMismatch(val expected: String, val got: String) : MigrationError {
        override val code get() = "MIG_PLAN_VERSION_MISMATCH"
    }
    data class TargetBlockUnknown(val op: String, val blockId: String) : MigrationError {
        override val code get() = "MIG_TARGET_BLOCK_UNKNOWN"
    }
    data class TargetBlockExists(val op: String, val blockId: String) : MigrationError {
        override val code get() = "MIG_TARGET_BLOCK_EXISTS"
    }
    data class ConverterUnsupported(val from: String, val to: String) : MigrationError {
        override val code get() = "MIG_CONVERTER_UNSUPPORTED"
    }
    data class ResultInvalid(val violations: List<Violation>) : MigrationError {
        override val code get() = "MIG_RESULT_INVALID"
    }
}

sealed interface MigrationResult {
    data class Ok(val doc: InvitationDocument, val report: MigrationReport) : MigrationResult
    data class Failed(val error: MigrationError) : MigrationResult
}

/** `01 §6.4`. `SwitchReport` no tiene rama de error: la validación la hace el llamador (`03 §3.1`). */
data class RoleMatch(val fromBlockId: String, val toBlockId: String, val role: String)
data class SwitchReport(val matchedByRole: List<RoleMatch>, val toAttic: List<String>, val reset: List<String>)
data class SwitchResult(val doc: InvitationDocument, val report: SwitchReport)

fun interface Migrator {
    fun migrate(doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage, plan: MigrationPlan): MigrationResult
}

/**
 * `migrate` (`01 §6.1`-`§6.3`) y `switchTemplate` (`01 §6.4`). Espejo exacto de
 * `packages/schema/src/migrate.ts`, probado contra `golden/migrations/`.
 *
 * Dos reglas duras que gobiernan todo lo de abajo:
 * - **Nada se borra jamás**: lo que pierde destino va al `attic`, indexado por `<slug>@<version>` de
 *   ORIGEN (ADR-006), que no se poda nunca automáticamente.
 * - **Termina validando** el documento resultante contra I-01…I-30: si no pasa, `MIG_RESULT_INVALID`
 *   y no se escribe nada. Una migración no puede dejar el documento en un estado que la escritura
 *   normal rechazaría.
 */
object DocumentMigrator : Migrator {

    private const val CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

    /**
     * Fuente de `itemId` **determinista** para `moveIntoGroup`, que crea un ítem nuevo (`01 §6.2`).
     * `§6.1` fija la firma con cuatro parámetros y `§6.3` exige que la migración sea pura: un ULID de
     * reloj rompería lo segundo. Los `itemId` solo tienen que ser únicos DENTRO de su grupo (I-03).
     * El quinto parámetro queda abierto para que producción inyecte `UlidGenerator` si algún día
     * quiere ids opacos también aquí. Espejo de `deterministicUlids` de `migrate.ts`.
     */
    fun deterministicUlids(prefijo: String = "01JMGRAT"): () -> String {
        var n = 0
        return {
            val sb = StringBuilder()
            var x = n++
            repeat(26 - prefijo.length) { sb.insert(0, CROCKFORD[x % 32]); x /= 32 }
            prefijo + sb
        }
    }

    override fun migrate(
        doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage, plan: MigrationPlan,
    ): MigrationResult = migrate(doc, from, to, plan, deterministicUlids())

    @Suppress("LongMethod", "CyclomaticComplexMethod")
    fun migrate(
        doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage, plan: MigrationPlan,
        newUlid: () -> String,
    ): MigrationResult {
        val esperado = "${from.manifest.version}->${to.manifest.version}"
        val recibido = "${plan.from}->${plan.to}"
        if (plan.templateSlug != to.manifest.slug || esperado != recibido)
            return MigrationResult.Failed(
                MigrationError.PlanVersionMismatch(
                    "${to.manifest.slug.value}:$esperado", "${plan.templateSlug.value}:$recibido",
                ),
            )

        val origen = from.manifest.topLevelBlocks()
        val destino = to.manifest.topLevelBlocks()
        val seccionesDestino = to.manifest.sections.map { it.key }.toSet()
        val atticKey = "${from.manifest.slug.value}@${from.manifest.version}"

        val contenido = LinkedHashMap(doc.content)
        var estructura = doc.structure.sections.toMutableList()
        var paletteId = doc.theme.paletteId
        var fontSetId = doc.theme.fontSetId
        val guardados = LinkedHashMap<BlockId, BlockValue>(doc.attic[atticKey] ?: emptyMap())

        val applied = mutableListOf<AppliedOp>()
        val moved = mutableListOf<MovedBlock>()
        val toAttic = mutableListOf<AtticEntry>()
        val converted = mutableListOf<ConvertedBlock>()

        fun alAttic(id: BlockId, v: BlockValue, razon: AtticReason) {
            guardados[id] = v
            toAttic.add(AtticEntry(id.value, razon))
        }

        for (op in plan.ops) {
            when (op) {
                is MigrationOp.RenameBlock -> {
                    if (!origen.containsKey(op.from)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.from.value))
                    if (!destino.containsKey(op.to)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.to.value))
                    if (contenido.containsKey(op.to)) return fallo(MigrationError.TargetBlockExists(op.op, op.to.value))
                    val v = contenido[op.from]
                    if (v != null) {
                        contenido[op.to] = v; contenido.remove(op.from)
                        moved.add(MovedBlock(op.from.value, op.to.value))
                    }
                    applied.add(AppliedOp(op.op, op.from.value))
                }
                is MigrationOp.RemoveBlock -> {
                    if (!origen.containsKey(op.id)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.id.value))
                    contenido.remove(op.id)?.let { alAttic(op.id, it, AtticReason.REMOVE_BLOCK) }
                    applied.add(AppliedOp(op.op, op.id.value))
                }
                is MigrationOp.AddBlock -> {
                    if (!destino.containsKey(op.id)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.id.value))
                    applied.add(AppliedOp(op.op, op.id.value))   // no toca content: tomará su default (R2)
                }
                is MigrationOp.RenameSection -> {
                    if (!seccionesDestino.contains(op.to)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.to.value))
                    estructura = estructura.map { if (it.key == op.from) it.copy(key = op.to) else it }.toMutableList()
                    applied.add(AppliedOp(op.op, op.from.value))
                }
                is MigrationOp.RemoveSection -> {
                    val sec = from.manifest.sections.firstOrNull { it.key == op.key }
                        ?: return fallo(MigrationError.TargetBlockUnknown(op.op, op.key.value))
                    estructura = estructura.filter { it.key != op.key }.toMutableList()
                    for (b in sec.blocks) contenido.remove(b.id)?.let { alAttic(b.id, it, AtticReason.REMOVE_SECTION) }
                    applied.add(AppliedOp(op.op, op.key.value))
                }
                is MigrationOp.RenamePalette -> {
                    if (to.theme.palettes.none { it.id == op.to }) return fallo(MigrationError.TargetBlockUnknown(op.op, op.to))
                    if (paletteId == op.from) paletteId = op.to
                    applied.add(AppliedOp(op.op, op.from))
                }
                is MigrationOp.RenameFontSet -> {
                    if (to.theme.fontSets.none { it.id == op.to }) return fallo(MigrationError.TargetBlockUnknown(op.op, op.to))
                    if (fontSetId == op.from) fontSetId = op.to
                    applied.add(AppliedOp(op.op, op.from))
                }
                is MigrationOp.ChangeBlockType -> {
                    if (!destino.containsKey(op.id)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.id.value))
                    applied.add(AppliedOp(op.op, op.id.value))
                    val v = contenido[op.id] ?: continue
                    if (v is GroupValue) return fallo(MigrationError.ConverterUnsupported("group", op.converterId.wire))
                    val convertido = convertir(v as ScalarValue, op.converterId, maxTextoDe(destino[op.id]))
                        ?: return fallo(MigrationError.ConverterUnsupported(v.kind.wire, op.converterId.wire))
                    contenido[op.id] = convertido
                    converted.add(ConvertedBlock(op.id.value, op.converterId.wire))
                }
                is MigrationOp.MoveIntoGroup -> {
                    val g = destino[op.groupId] as? GroupSpec
                        ?: return fallo(MigrationError.TargetBlockUnknown(op.op, op.groupId.value))
                    if (g.itemBlocks.none { it.id == op.itemBlockId })
                        return fallo(MigrationError.TargetBlockUnknown(op.op, op.itemBlockId.value))
                    applied.add(AppliedOp(op.op, op.blockId.value))
                    val v = contenido[op.blockId] ?: continue
                    if (v is GroupValue) return fallo(MigrationError.ConverterUnsupported("group", op.itemBlockId.value))
                    val actuales = (contenido[op.groupId] as? GroupValue)?.items ?: emptyList()
                    contenido[op.groupId] = GroupValue(
                        actuales + GroupItem(ItemId(newUlid()), mapOf(op.itemBlockId to (v as ScalarValue))),
                    )
                    contenido.remove(op.blockId)
                    moved.add(MovedBlock(op.blockId.value, "${op.groupId.value}.${op.itemBlockId.value}"))
                }
                is MigrationOp.FlattenGroup -> {
                    if (!destino.containsKey(op.toBlockId)) return fallo(MigrationError.TargetBlockUnknown(op.op, op.toBlockId.value))
                    applied.add(AppliedOp(op.op, op.groupId.value))
                    val g = contenido[op.groupId] as? GroupValue
                    if (g == null || g.items.isEmpty()) { contenido.remove(op.groupId); continue }
                    val primero = g.items[0].values[op.itemBlockId]
                    if (primero != null) {
                        if (contenido.containsKey(op.toBlockId))
                            return fallo(MigrationError.TargetBlockExists(op.op, op.toBlockId.value))
                        contenido[op.toBlockId] = primero
                        moved.add(MovedBlock("${op.groupId.value}.${op.itemBlockId.value}", op.toBlockId.value))
                    }
                    // Los ítems 1..n van al attic COMPLETOS, con su itemId (01 §6.2). `reason` es un
                    // enum cerrado de cuatro valores sin "flattenGroup": el bloque de grupo desaparece
                    // del destino, así que la razón exacta es `removeBlock`.
                    val resto = g.items.drop(1)
                    contenido.remove(op.groupId)
                    if (resto.isNotEmpty()) alAttic(op.groupId, GroupValue(resto), AtticReason.REMOVE_BLOCK)
                }
                is MigrationOp.ShrinkGroup -> {
                    applied.add(AppliedOp(op.op, op.groupId.value))
                    val g = contenido[op.groupId] as? GroupValue ?: continue
                    if (g.items.size <= op.max) continue
                    contenido[op.groupId] = GroupValue(g.items.take(op.max))
                    alAttic(op.groupId, GroupValue(g.items.drop(op.max)), AtticReason.SHRINK_GROUP)
                }
            }
        }

        // 01 §6.3 — bloque eliminado SIN operación en el plan: va al attic igual, como `removeBlock`.
        // Un plan incompleto degrada la calidad del informe, nunca destruye contenido.
        val sinDestino = contenido.keys.filter { !destino.containsKey(it) }.sortedBy { it.value }
        for (k in sinDestino) {
            alAttic(k, contenido.getValue(k), AtticReason.REMOVE_BLOCK)
            contenido.remove(k)
        }
        // Secciones que la versión destino ya no declara.
        estructura = estructura.filter { seccionesDestino.contains(it.key) }.toMutableList()

        val attic = doc.attic.toMutableMap()
        if (guardados.isNotEmpty()) attic[atticKey] = guardados

        val migrado = doc.copy(
            template = TemplateRef(to.manifest.slug, to.manifest.version),
            theme = doc.theme.copy(paletteId = paletteId, fontSetId = fontSetId),
            structure = Structure(estructura),
            content = contenido,
            attic = attic,
        )
        val report = MigrationReport(applied, moved, toAttic, converted, toAttic.isEmpty() && converted.isEmpty())

        val violaciones = Invariants.validateInvariants(migrado, to)
        if (violaciones.isNotEmpty()) return fallo(MigrationError.ResultInvalid(violaciones))
        return MigrationResult.Ok(migrado, report)
    }

    // ------------------------------------------------------------------------------------------
    // switchTemplate — 01 §6.4
    // ------------------------------------------------------------------------------------------

    /**
     * Transporta **solo por rol singleton** y del **mismo `type`** (ADR-1R-D-07). Los grupos NUNCA se
     * transportan: un `eventCards` de otra plantilla tiene otros `itemBlocks` y copiar ítems produce
     * ítems medio vacíos que el cliente no sabe de dónde salen — el pecado exacto de H-01. Todo lo que
     * no se transporta va al `attic`, con clave `<slugOrigen>@<versionOrigen>`.
     */
    fun switchTemplate(doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage): SwitchResult {
        val atticKey = "${from.manifest.slug.value}@${from.manifest.version}"
        val origen = from.manifest.topLevelBlocks()
        val destino = to.manifest.topLevelBlocks()

        // I-26 garantiza como mucho un bloque por rol singleton en cada manifiesto.
        val porRolOrigen = LinkedHashMap<String, BlockSpec>()
        for (b in origen.values) if (esSingleton(b) && !porRolOrigen.containsKey(b.role.wire)) porRolOrigen[b.role.wire] = b
        val porRolDestino = LinkedHashMap<String, BlockSpec>()
        for (b in destino.values) if (esSingleton(b) && !porRolDestino.containsKey(b.role.wire)) porRolDestino[b.role.wire] = b

        val contenido = LinkedHashMap<BlockId, BlockValue>()
        val transportados = LinkedHashSet<BlockId>()
        val emparejados = mutableListOf<RoleMatch>()
        for (rol in porRolOrigen.keys.sorted()) {
            val a = porRolOrigen.getValue(rol)
            val b = porRolDestino[rol] ?: continue
            if (a.type != b.type || a is GroupSpec) continue          // regla 4: los grupos, nunca
            val v = doc.content[a.id] ?: continue
            contenido[b.id] = v
            transportados.add(a.id)
            emparejados.add(RoleMatch(a.id.value, b.id.value, rol))
        }

        val attic = doc.attic.toMutableMap()
        val guardados = LinkedHashMap<BlockId, BlockValue>(attic[atticKey] ?: emptyMap())
        val alAttic = mutableListOf<String>()
        for (k in doc.content.keys.sortedBy { it.value }) {
            if (transportados.contains(k)) continue
            guardados[k] = doc.content.getValue(k)
            alAttic.add(k.value)
        }
        if (guardados.isNotEmpty()) attic[atticKey] = guardados

        val reset = destino.keys.filter { !contenido.containsKey(it) }.map { it.value }.sorted()

        val nuevo = InvitationDocument(
            schemaVersion = 1,
            template = TemplateRef(to.manifest.slug, to.manifest.version),
            // Regla 2: los ids de paleta son de la plantilla; conservarlos sería casualidad.
            theme = doc.theme.copy(paletteId = to.theme.defaultPaletteId, fontSetId = to.theme.defaultFontSetId),
            // Regla 1: `structure` se descarta entera y se reconstruye desde `to.manifest`.
            structure = Structure(
                to.manifest.sections.map {
                    StructureEntry(it.key, it.defaultVariant, if (it.required) true else it.defaultVisible)
                },
            ),
            content = contenido,
            attic = attic,
            meta = doc.meta.copy(
                locale = if (to.manifest.locales.contains(doc.meta.locale)) doc.meta.locale else to.manifest.locales.first(),
            ),
        )
        return SwitchResult(nuevo, SwitchReport(emparejados, alAttic, reset))
    }

    // ------------------------------------------------------------------------------------------
    // Convertidores — los CUATRO de 01 §6.2, ninguno más
    // ------------------------------------------------------------------------------------------

    private fun esSingleton(b: BlockSpec): Boolean =
        mx.evolutiondev.invitaciones.modules.templates2.domain.BlockRole.SINGLETON_ROLES.contains(b.role)

    private fun fallo(e: MigrationError): MigrationResult = MigrationResult.Failed(e)

    /** Trunca por límite de palabra (`01 §6.2`, `richTextToText` y `listTextToText`). */
    internal fun truncarPorPalabra(s: String, max: Int): String {
        if (s.length <= max) return s
        val corte = s.substring(0, max)
        val i = corte.lastIndexOf(' ')
        return (if (i > 0) corte.substring(0, i) else corte).trimEnd()
    }

    private fun textoPlano(doc: RichDoc): String =
        doc.content.joinToString("\n\n") { p -> p.content.joinToString("") { it.text } }

    private fun maxTextoDe(spec: BlockSpec?): Int = when (spec) {
        is TextSpec -> spec.constraints.maxLength
        is RichTextSpec -> spec.constraints.maxLength
        else -> 2000
    }

    internal fun convertir(v: ScalarValue, converterId: ConverterId, maxDestino: Int): ScalarValue? = when (converterId) {
        ConverterId.TEXT_TO_RICH_TEXT -> (v as? TextValue)?.let {
            RichTextValue(RichDoc(listOf(RichParagraph(if (it.value == "") emptyList() else listOf(RichSpan(it.value))))))
        }
        ConverterId.RICH_TEXT_TO_TEXT -> (v as? RichTextValue)?.let {
            TextValue(truncarPorPalabra(textoPlano(it.doc), maxDestino))
        }
        ConverterId.TEXT_TO_LIST_TEXT -> (v as? TextValue)?.let {
            ListTextValue(if (it.value == "") emptyList() else listOf(it.value))
        }
        ConverterId.LIST_TEXT_TO_TEXT -> (v as? ListTextValue)?.let {
            TextValue(truncarPorPalabra(it.items.joinToString(", "), maxDestino))
        }
    }
}
