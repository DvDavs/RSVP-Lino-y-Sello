package mx.evolutiondev.invitaciones.modules.templates2.composition

import mx.evolutiondev.invitaciones.modules.templates2.domain.AssetId
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.AudioValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockId
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSource
import mx.evolutiondev.invitaciones.modules.templates2.domain.BlockSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupItem
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.GroupValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageAspect
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.ImageValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.InvitationDocument
import mx.evolutiondev.invitaciones.modules.templates2.domain.ItemId
import mx.evolutiondev.invitaciones.modules.templates2.domain.Operation
import mx.evolutiondev.invitaciones.modules.templates2.domain.ScalarValue
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionKey
import mx.evolutiondev.invitaciones.modules.templates2.domain.SectionSpec
import mx.evolutiondev.invitaciones.modules.templates2.domain.Structure
import mx.evolutiondev.invitaciones.modules.templates2.domain.TemplatePackage
import mx.evolutiondev.invitaciones.modules.templates2.domain.TplErrorCode
import mx.evolutiondev.invitaciones.modules.templates2.schema.Invariants
import mx.evolutiondev.invitaciones.modules.templates2.schema.Violation
import kotlin.math.abs

/**
 * Metadatos del asset, o `null` si no existe o no pertenece a esta invitación ni a la plantilla
 * vigente. Sustituye al `ownsAsset(assetId): Boolean` anterior (decisión X-06).
 */
data class AssetMeta(val bytes: Long, val width: Int? = null, val height: Int? = null, val contentType: String)

/**
 * `01 §6.5`. `newUlid` se inyecta porque el reductor —a diferencia de `compose`— **no** es puro:
 * `addItem` genera el ULID del ítem, y lo genera **el servidor** (ADR-020, P8). Inyectarlo es lo que
 * permite congelar `reducerResult` en `golden/operations/`.
 */
data class ReducerContext(
    val pkg: TemplatePackage,
    val newUlid: () -> String,
    val assetMeta: (AssetId) -> AssetMeta?,
)

/**
 * Errores tipados del reductor (`01 §6.5`). Cada uno lleva su `TplErrorCode` del catálogo cerrado de
 * `03 §5`: `contratos §4` prohíbe `require`/`check`/`error()` en `templates2` porque caerían en el 400
 * genérico del handler existente, sin código tipado, reintroduciendo H-14.
 */
sealed interface OperationError {
    val code: TplErrorCode

    data class BlockUnknown(val blockId: BlockId) : OperationError {
        override val code get() = TplErrorCode.TPL_BLOCK_UNKNOWN
    }
    data class BlockNotEditable(val blockId: BlockId, val source: BlockSource) : OperationError {
        override val code get() = TplErrorCode.TPL_BLOCK_NOT_EDITABLE
    }
    data class BlockTypeMismatch(val blockId: BlockId, val expected: String, val got: String) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class ItemUnknown(val groupId: BlockId, val itemId: String) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class GroupLimit(val groupId: BlockId, val min: Int, val max: Int) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class SectionUnknown(val sectionKey: SectionKey) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class SectionRequired(val sectionKey: SectionKey) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class VariantUnknown(val sectionKey: SectionKey, val variant: String) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class ThemeIdUnknown(val field: String, val id: String) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class AssetNotOwned(val assetId: AssetId) : OperationError {
        override val code get() = TplErrorCode.TPL_ASSET_NOT_OWNED
    }
    data class AssetSpecMismatch(val assetId: AssetId, val constraint: String) : OperationError {
        override val code get() = TplErrorCode.TPL_ASSET_SPEC_MISMATCH
    }
    data class InvariantViolation(val violations: List<Violation>) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class OperationInvalid(val op: String, val detail: String) : OperationError {
        override val code get() = TplErrorCode.TPL_OPERATION_INVALID
    }
    data class TempIdDuplicate(val tempId: String) : OperationError {
        override val code get() = TplErrorCode.TPL_TEMP_ID_DUPLICATE
    }

    // Literal `code` que viaja en los ficheros de `golden/operations` (espejo de `OperationError` de TS).
    // AVISO: los comentarios de bloque de Kotlin ANIDAN. Escribir aquí una barra seguida de asterisco
    // (un glob de fichero, por ejemplo) comentaría el resto del fichero SIN error de compilación.
    val wire: String
        get() = when (this) {
            is BlockUnknown -> "TPL_BLOCK_UNKNOWN"
            is BlockNotEditable -> "TPL_BLOCK_NOT_EDITABLE"
            is BlockTypeMismatch -> "TPL_BLOCK_TYPE_MISMATCH"
            is ItemUnknown -> "TPL_ITEM_UNKNOWN"
            is GroupLimit -> "TPL_GROUP_LIMIT"
            is SectionUnknown -> "TPL_SECTION_UNKNOWN"
            is SectionRequired -> "TPL_SECTION_REQUIRED"
            is VariantUnknown -> "TPL_VARIANT_UNKNOWN"
            is ThemeIdUnknown -> "TPL_THEME_ID_UNKNOWN"
            is AssetNotOwned -> "TPL_ASSET_NOT_OWNED"
            is AssetSpecMismatch -> "TPL_ASSET_SPEC_MISMATCH"
            is InvariantViolation -> "TPL_INVARIANT_VIOLATION"
            is OperationInvalid -> "TPL_OPERATION_INVALID"
            is TempIdDuplicate -> "TPL_TEMP_ID_DUPLICATE"
        }
}

sealed interface OperationResult {
    data class Ok(val doc: InvitationDocument, val idMap: Map<String, String> = emptyMap()) : OperationResult
    data class Failed(val error: OperationError) : OperationResult
}

/** Un lote humano es **todo o nada** (ADR-014); la IA descarta operación por operación (`07 §4`). */
sealed interface BatchResult {
    data class Ok(val doc: InvitationDocument, val idMap: Map<String, String>) : BatchResult
    data class Failed(val error: OperationError, val opIndex: Int) : BatchResult
}

fun interface OperationReducer {
    fun apply(doc: InvitationDocument, op: Operation, ctx: ReducerContext): OperationResult
}

/**
 * **El reductor único** (`02 §7.3`, ADR-014): lo comparten el editor humano, el autoguardado y la IA.
 * Espejo exacto de `packages/schema/src/operations-reducer.ts`, probado contra `golden/operations/`.
 */
object DefaultOperationReducer : OperationReducer {

    override fun apply(doc: InvitationDocument, op: Operation, ctx: ReducerContext): OperationResult {
        val bloques = ctx.pkg.manifest.topLevelBlocks()
        val secciones = ctx.pkg.manifest.sections.associateBy { it.key }

        return when (op) {
            is Operation.SetBlock -> {
                val spec = bloques[op.blockId] ?: return falla(OperationError.BlockUnknown(op.blockId))
                if (spec.source != BlockSource.USER) return falla(OperationError.BlockNotEditable(op.blockId, spec.source))
                comprobarEscalar(spec, op.blockId, op.value, ctx, "content.${op.blockId.value}")?.let { return falla(it) }
                OperationResult.Ok(doc.copy(content = doc.content + (op.blockId to op.value)))
            }

            is Operation.ClearBlock -> {
                val spec = bloques[op.blockId] ?: return falla(OperationError.BlockUnknown(op.blockId))
                if (spec.source != BlockSource.USER) return falla(OperationError.BlockNotEditable(op.blockId, spec.source))
                OperationResult.Ok(doc.copy(content = doc.content - op.blockId))
            }

            is Operation.AddItem -> {
                val g = grupo(bloques, op.groupId) ?: return falla(errorDeGrupo(bloques, op.groupId))
                val items = itemsDe(doc, op.groupId)
                if (items.size + 1 > g.max) return falla(OperationError.GroupLimit(op.groupId, g.min, g.max))
                if (op.index != null && op.index > items.size)
                    return falla(OperationError.OperationInvalid(op.op, "index ${op.index} > items ${items.size}"))
                val internos = g.itemBlocks.associateBy { it.id }
                for (k in op.values.keys.sortedBy { it.value }) {          // orden estable: R9 punto 1
                    val ib = internos[k] ?: return falla(OperationError.BlockUnknown(k))
                    comprobarEscalar(ib, k, op.values.getValue(k), ctx, "content.${op.groupId.value}[].${k.value}")
                        ?.let { return falla(it) }
                }
                val itemId = ItemId(ctx.newUlid())
                val nuevos = items.toMutableList()
                nuevos.add(op.index ?: nuevos.size, GroupItem(itemId, op.values))
                OperationResult.Ok(
                    doc.copy(content = doc.content + (op.groupId to GroupValue(nuevos))),
                    mapOf(op.tempId to itemId.value),
                )
            }

            is Operation.RemoveItem -> {
                val g = grupo(bloques, op.groupId) ?: return falla(errorDeGrupo(bloques, op.groupId))
                val items = itemsDe(doc, op.groupId)
                val i = items.indexOfFirst { it.itemId.value == op.itemId }
                if (i < 0) return falla(OperationError.ItemUnknown(op.groupId, op.itemId))
                if (items.size - 1 < g.min) return falla(OperationError.GroupLimit(op.groupId, g.min, g.max))
                val nuevos = items.toMutableList(); nuevos.removeAt(i)
                OperationResult.Ok(doc.copy(content = doc.content + (op.groupId to GroupValue(nuevos))))
            }

            is Operation.MoveItem -> {
                val g = grupo(bloques, op.groupId) ?: return falla(errorDeGrupo(bloques, op.groupId))
                val items = itemsDe(doc, op.groupId)
                val i = items.indexOfFirst { it.itemId.value == op.itemId }
                if (i < 0) return falla(OperationError.ItemUnknown(op.groupId, op.itemId))
                if (!g.reorderable) return falla(OperationError.OperationInvalid(op.op, "${op.groupId.value} no es reorderable"))
                if (op.toIndex >= items.size)
                    return falla(OperationError.OperationInvalid(op.op, "toIndex ${op.toIndex} >= items ${items.size}"))
                val nuevos = items.toMutableList()
                val x = nuevos.removeAt(i)
                nuevos.add(op.toIndex, x)
                OperationResult.Ok(doc.copy(content = doc.content + (op.groupId to GroupValue(nuevos))))
            }

            is Operation.SetItemBlock -> {
                val g = grupo(bloques, op.groupId) ?: return falla(errorDeGrupo(bloques, op.groupId))
                val items = itemsDe(doc, op.groupId)
                val i = items.indexOfFirst { it.itemId.value == op.itemId }
                if (i < 0) return falla(OperationError.ItemUnknown(op.groupId, op.itemId))
                val ib = g.itemBlocks.firstOrNull { it.id == op.blockId }
                    ?: return falla(OperationError.BlockUnknown(op.blockId))
                comprobarEscalar(ib, op.blockId, op.value, ctx, "content.${op.groupId.value}[${op.itemId}].${op.blockId.value}")
                    ?.let { return falla(it) }
                val nuevos = items.toMutableList()
                nuevos[i] = nuevos[i].copy(values = nuevos[i].values + (op.blockId to op.value))
                OperationResult.Ok(doc.copy(content = doc.content + (op.groupId to GroupValue(nuevos))))
            }

            is Operation.ClearItemBlock -> {
                val g = grupo(bloques, op.groupId) ?: return falla(errorDeGrupo(bloques, op.groupId))
                val items = itemsDe(doc, op.groupId)
                val i = items.indexOfFirst { it.itemId.value == op.itemId }
                if (i < 0) return falla(OperationError.ItemUnknown(op.groupId, op.itemId))
                if (g.itemBlocks.none { it.id == op.blockId }) return falla(OperationError.BlockUnknown(op.blockId))
                val nuevos = items.toMutableList()
                nuevos[i] = nuevos[i].copy(values = nuevos[i].values - op.blockId)
                OperationResult.Ok(doc.copy(content = doc.content + (op.groupId to GroupValue(nuevos))))
            }

            is Operation.SetSectionVisible -> {
                val s = secciones[op.sectionKey] ?: return falla(OperationError.SectionUnknown(op.sectionKey))
                val i = doc.structure.sections.indexOfFirst { it.key == op.sectionKey }
                if (i < 0) return falla(OperationError.SectionUnknown(op.sectionKey))
                if (s.required && !op.visible) return falla(OperationError.SectionRequired(op.sectionKey))
                val nuevas = doc.structure.sections.toMutableList()
                nuevas[i] = nuevas[i].copy(visible = op.visible)
                OperationResult.Ok(doc.copy(structure = Structure(nuevas)))
            }

            is Operation.SetSectionVariant -> {
                val s = secciones[op.sectionKey] ?: return falla(OperationError.SectionUnknown(op.sectionKey))
                val i = doc.structure.sections.indexOfFirst { it.key == op.sectionKey }
                if (i < 0) return falla(OperationError.SectionUnknown(op.sectionKey))
                if (!s.variants.contains(op.variant)) return falla(OperationError.VariantUnknown(op.sectionKey, op.variant))
                val nuevas = doc.structure.sections.toMutableList()
                nuevas[i] = nuevas[i].copy(variant = op.variant)
                OperationResult.Ok(doc.copy(structure = Structure(nuevas)))
            }

            is Operation.ReorderSections -> {
                // I-24: PERMUTACIÓN exacta. El esquema solo mide longitud y aceptaría ["cover","cover"].
                val actuales = doc.structure.sections.map { it.key.value }
                val vs = Invariants.validateReorder(op.order.map { it.value }, actuales)
                if (vs.isNotEmpty()) return falla(OperationError.InvariantViolation(vs))
                val porClave = doc.structure.sections.associateBy { it.key }
                OperationResult.Ok(doc.copy(structure = Structure(op.order.map { porClave.getValue(it) })))
            }

            is Operation.SetTheme -> {
                if (op.paletteId == null && op.fontSetId == null)
                    return falla(OperationError.OperationInvalid(op.op, "setTheme sin paletteId ni fontSetId"))
                if (op.paletteId != null && ctx.pkg.theme.palettes.none { it.id == op.paletteId })
                    return falla(OperationError.ThemeIdUnknown("paletteId", op.paletteId))
                if (op.fontSetId != null && ctx.pkg.theme.fontSets.none { it.id == op.fontSetId })
                    return falla(OperationError.ThemeIdUnknown("fontSetId", op.fontSetId))
                OperationResult.Ok(
                    doc.copy(
                        theme = doc.theme.copy(
                            paletteId = op.paletteId ?: doc.theme.paletteId,
                            fontSetId = op.fontSetId ?: doc.theme.fontSetId,
                        ),
                    ),
                )
            }
        }
    }

    /**
     * Lote humano: **todo o nada**. Resuelve los `tempId` dentro del lote y en orden — `addItem`
     * guarda el ULID nuevo en `idMap[tempId]` y una operación posterior del MISMO lote que use ese
     * `tempId` lo resuelve contra él. Un `tempId` sin resolver es `TPL_ITEM_UNKNOWN` (`01 §6.5`).
     */
    fun applyBatch(doc: InvitationDocument, ops: List<Operation>, ctx: ReducerContext): BatchResult {
        var actual = doc
        val idMap = LinkedHashMap<String, String>()
        for ((i, original) in ops.withIndex()) {
            if (original is Operation.AddItem && idMap.containsKey(original.tempId))
                return BatchResult.Failed(OperationError.TempIdDuplicate(original.tempId), i)
            val resuelta = when (val r = resolverTempIds(original, idMap)) {
                is Resuelta.Error -> return BatchResult.Failed(r.error, i)
                is Resuelta.Op -> r.op
            }
            when (val r = apply(actual, resuelta, ctx)) {
                is OperationResult.Failed -> return BatchResult.Failed(r.error, i)
                is OperationResult.Ok -> { actual = r.doc; idMap.putAll(r.idMap) }
            }
        }
        return BatchResult.Ok(actual, idMap)
    }

    private sealed interface Resuelta {
        data class Op(val op: Operation) : Resuelta
        data class Error(val error: OperationError) : Resuelta
    }

    private fun resolverTempIds(op: Operation, idMap: Map<String, String>): Resuelta {
        fun real(groupId: BlockId, itemId: String): Resuelta? {
            if (!itemId.startsWith("tmp:")) return null
            val r = idMap[itemId] ?: return Resuelta.Error(OperationError.ItemUnknown(groupId, itemId))
            return Resuelta.Op(
                when (op) {
                    is Operation.RemoveItem -> op.copy(itemId = r)
                    is Operation.MoveItem -> op.copy(itemId = r)
                    is Operation.SetItemBlock -> op.copy(itemId = r)
                    is Operation.ClearItemBlock -> op.copy(itemId = r)
                    else -> op
                },
            )
        }
        return when (op) {
            is Operation.RemoveItem -> real(op.groupId, op.itemId) ?: Resuelta.Op(op)
            is Operation.MoveItem -> real(op.groupId, op.itemId) ?: Resuelta.Op(op)
            is Operation.SetItemBlock -> real(op.groupId, op.itemId) ?: Resuelta.Op(op)
            is Operation.ClearItemBlock -> real(op.groupId, op.itemId) ?: Resuelta.Op(op)
            else -> Resuelta.Op(op)
        }
    }

    // ------------------------------------------------------------------------------------------
    // Auxiliares
    // ------------------------------------------------------------------------------------------

    private fun falla(e: OperationError): OperationResult = OperationResult.Failed(e)

    private fun grupo(bloques: Map<BlockId, BlockSpec>, groupId: BlockId): GroupSpec? {
        val spec = bloques[groupId] as? GroupSpec ?: return null
        return if (spec.source == BlockSource.USER) spec else null
    }

    private fun errorDeGrupo(bloques: Map<BlockId, BlockSpec>, groupId: BlockId): OperationError {
        val spec = bloques[groupId]
        if (spec !is GroupSpec) return OperationError.BlockUnknown(groupId)
        return OperationError.BlockNotEditable(groupId, spec.source)
    }

    /**
     * Ítems actuales del grupo en el DOCUMENTO. Los `defaults` **no** se copian: el escalón de default
     * opera a nivel de bloque de grupo completo (`01 §5.3`); mezclarlo por ítem resucitaría H-02.
     */
    private fun itemsDe(doc: InvitationDocument, groupId: BlockId): List<GroupItem> =
        (doc.content[groupId] as? GroupValue)?.items ?: emptyList()

    /** kind ↔ `spec.type`, asset y `validateValueAgainstSpec`, en ese orden. */
    private fun comprobarEscalar(
        spec: BlockSpec, blockId: BlockId, value: ScalarValue, ctx: ReducerContext, path: String,
    ): OperationError? {
        if (value.kind != spec.type)
            return OperationError.BlockTypeMismatch(blockId, spec.type.wire, value.kind.wire)
        comprobarAsset(spec, value, ctx)?.let { return it }
        val vs = Invariants.validateValueAgainstSpec(spec, value, path)
        return if (vs.isNotEmpty()) OperationError.InvariantViolation(vs) else null
    }

    /**
     * Pertenencia del asset (ADR-030) y las **tres restricciones que ningún validador de valor puede
     * ver** (X-06): `image.maxBytes`, `image.aspect` y `audio.maxBytes`. `ImageValue`/`AudioValue`
     * solo llevan `assetId`, así que este es el único punto donde el dato existe. Cero restricciones
     * del esquema sin validador.
     */
    private fun comprobarAsset(spec: BlockSpec, value: ScalarValue, ctx: ReducerContext): OperationError? {
        val assetId = when (value) {
            is ImageValue -> value.assetId
            is AudioValue -> value.assetId
            else -> return null
        }
        val meta = ctx.assetMeta(assetId) ?: return OperationError.AssetNotOwned(assetId)
        if (spec is ImageSpec) {
            if (meta.bytes > spec.constraints.maxBytes) return OperationError.AssetSpecMismatch(assetId, "maxBytes")
            // Si faltan las dimensiones NO se comprueba y nunca se rechaza por falta de dato (01 §6.5).
            val w = meta.width; val h = meta.height
            if (w != null && h != null && h > 0) {
                val r = w.toDouble() / h.toDouble()
                val malo = when (spec.constraints.aspect) {
                    ImageAspect.SQUARE -> abs(r - 1.0) > 0.02
                    ImageAspect.PORTRAIT -> !(r < 1.0)
                    ImageAspect.LANDSCAPE -> !(r > 1.0)
                    ImageAspect.WIDE -> !(r >= 1.6)
                    ImageAspect.FREE -> false
                }
                if (malo) return OperationError.AssetSpecMismatch(assetId, "aspect")
            }
        }
        if (spec is AudioSpec && meta.bytes > spec.constraints.maxBytes)
            return OperationError.AssetSpecMismatch(assetId, "maxBytes")
        return null
    }

    /** Índice `sectionKey → spec`, expuesto para los consumidores de 2-4. */
    fun seccionesDe(pkg: TemplatePackage): Map<SectionKey, SectionSpec> =
        pkg.manifest.sections.associateBy { it.key }
}
