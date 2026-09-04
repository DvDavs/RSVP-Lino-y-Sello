// packages/schema/src/operations-reducer.ts — EL reductor único (01 §6.5).
// Lo comparten el editor humano, el autoguardado y la IA (ADR-014): la diferencia está en la política
// de fallo (lote todo-o-nada vs. descarte operación por operación), nunca en el reductor.
//
// PURO salvo por `ctx.newUlid`, que se inyecta: `addItem` necesita un ULID del servidor (ADR-020, P8)
// y el cliente NUNCA lo aporta. Con `newUlid` inyectado, el reductor es determinista y reproducible,
// que es lo que permite congelar `reducerResult` en golden/operations/*.cases.json.
import type { InvitationDocument } from "./document.ts";
import type { Operation } from "./operations.ts";
import type { BlockSpec, GroupSpec, GroupValue, ScalarValue } from "./blocks.ts";
import type { SectionSpec } from "./manifest.ts";
import type { TemplatePackage } from "./compose.ts";
import { validateReorder, validateValueAgainstSpec, type Violation } from "./invariants.ts";

/**
 * Metadatos del asset, o `null` si no existe o no pertenece ni a esta invitación ni a la plantilla
 * vigente. Sustituye al `ownsAsset(assetId): boolean` anterior (decisión X-06): el reductor ya cargaba
 * la fila de `tpl_asset` para comprobar pertenencia (ADR-030) y necesita además `bytes`/`width`/`height`
 * para hacer cumplir `image.maxBytes`, `image.aspect` y `audio.maxBytes`, que NO son comprobables contra
 * el valor (`ImageValue`/`AudioValue` solo llevan `assetId`). Cero restricciones del esquema sin validador.
 */
export type AssetMeta = { bytes: number; width?: number; height?: number; contentType: string };

export type ReducerContext = {
  pkg: TemplatePackage;
  /** inyectada: `compose` es pura, el reductor NO (genera ULIDs) */
  newUlid: () => string;
  assetMeta: (assetId: string) => AssetMeta | null;
};

export type OperationError =
  | { code: "TPL_BLOCK_UNKNOWN"; blockId: string }
  | { code: "TPL_BLOCK_NOT_EDITABLE"; blockId: string; source: "business" | "fixed" }
  | { code: "TPL_BLOCK_TYPE_MISMATCH"; blockId: string; expected: string; got: string }
  | { code: "TPL_ITEM_UNKNOWN"; groupId: string; itemId: string }
  | { code: "TPL_GROUP_LIMIT"; groupId: string; min: number; max: number }
  | { code: "TPL_SECTION_UNKNOWN"; sectionKey: string }
  | { code: "TPL_SECTION_REQUIRED"; sectionKey: string }
  | { code: "TPL_VARIANT_UNKNOWN"; sectionKey: string; variant: string }
  | { code: "TPL_THEME_ID_UNKNOWN"; field: "paletteId" | "fontSetId"; id: string }
  | { code: "TPL_ASSET_NOT_OWNED"; assetId: string }
  | { code: "TPL_ASSET_SPEC_MISMATCH"; assetId: string; constraint: "maxBytes" | "aspect" }
  | { code: "TPL_INVARIANT_VIOLATION"; violations: Violation[] }
  /**
   * Índice fuera de rango, `moveItem` sobre un grupo no reordenable y `setTheme` sin ningún campo.
   * `01 §6.5` no listaba código para estos tres: el catálogo cerrado de `03 §5` sí lo tiene
   * (`TPL_OPERATION_INVALID`, 422), y silenciarlos (recortando el índice) sería descartar en silencio.
   */
  | { code: "TPL_OPERATION_INVALID"; op: string; detail: string }
  /** dos `addItem` del mismo lote con el mismo `tempId` (`03 §5`, `07 §2` OP_TEMP_ID_DUPLICATE) */
  | { code: "TPL_TEMP_ID_DUPLICATE"; tempId: string };

export type OperationResult =
  | { ok: true; doc: InvitationDocument; idMap?: Record<string, string> }
  | { ok: false; error: OperationError };

/** Resultado de un lote humano: TODO o NADA (`01 §6.5`, ADR-014). */
export type BatchResult =
  | { ok: true; doc: InvitationDocument; idMap: Record<string, string> }
  | { ok: false; error: OperationError; opIndex: number };

// ---------------------------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------------------------

const clone = <T>(v: T): T => structuredClone(v);
const fail = (error: OperationError): OperationResult => ({ ok: false, error });

export function topLevelBlocks(pkg: TemplatePackage): Map<string, BlockSpec> {
  const m = new Map<string, BlockSpec>();
  for (const s of pkg.manifest.sections) for (const b of s.blocks) m.set(b.id, b);
  return m;
}
const sectionsByKey = (pkg: TemplatePackage): Map<string, SectionSpec> =>
  new Map(pkg.manifest.sections.map(s => [s.key, s] as const));

const isGroupValue = (v: unknown): v is GroupValue =>
  typeof v === "object" && v !== null && (v as { kind?: string }).kind === "group";

/** Ítems actuales del grupo en el DOCUMENTO. Los `defaults` NO se copian: el escalón de default opera
 *  a nivel de bloque de grupo completo (`01 §5.3`, nota). Mezclar por ítem resucitaría H-02. */
function itemsOf(doc: InvitationDocument, groupId: string): GroupValue["items"] {
  const v = doc.content[groupId];
  return isGroupValue(v) ? v.items : [];
}

/** Comprobación de asset: pertenencia (ADR-030) + las tres restricciones de X-06. */
function checkAsset(spec: BlockSpec, value: ScalarValue, ctx: ReducerContext): OperationError | null {
  if (!("assetId" in value)) return null;
  const assetId = value.assetId as string;
  const meta = ctx.assetMeta(assetId);
  if (meta === null) return { code: "TPL_ASSET_NOT_OWNED", assetId };
  if (spec.type === "image") {
    if (meta.bytes > spec.constraints.maxBytes) return { code: "TPL_ASSET_SPEC_MISMATCH", assetId, constraint: "maxBytes" };
    // Si faltan las dimensiones no se comprueba y NUNCA se rechaza por falta de dato (01 §6.5).
    if (meta.width !== undefined && meta.height !== undefined && meta.height > 0) {
      const r = meta.width / meta.height;
      const a = spec.constraints.aspect;
      const malo =
        (a === "square" && Math.abs(r - 1) > 0.02) ||
        (a === "portrait" && !(r < 1)) ||
        (a === "landscape" && !(r > 1)) ||
        (a === "wide" && !(r >= 1.6));
      if (malo) return { code: "TPL_ASSET_SPEC_MISMATCH", assetId, constraint: "aspect" };
    }
  }
  if (spec.type === "audio" && meta.bytes > spec.constraints.maxBytes)
    return { code: "TPL_ASSET_SPEC_MISMATCH", assetId, constraint: "maxBytes" };
  return null;
}

/** kind ↔ spec.type, asset y `validateValueAgainstSpec`, en ese orden. */
function checkScalar(spec: BlockSpec, blockId: string, value: ScalarValue, ctx: ReducerContext, path: string): OperationError | null {
  if (value.kind !== spec.type) return { code: "TPL_BLOCK_TYPE_MISMATCH", blockId, expected: spec.type, got: value.kind };
  const a = checkAsset(spec, value, ctx);
  if (a) return a;
  const vs = validateValueAgainstSpec(spec, value as never, path);
  return vs.length > 0 ? { code: "TPL_INVARIANT_VIOLATION", violations: vs } : null;
}

/** El grupo declarado por el manifiesto, o el error tipado que corresponda. */
function groupSpecOf(ctx: ReducerContext, groupId: string): GroupSpec | OperationError {
  const spec = topLevelBlocks(ctx.pkg).get(groupId);
  if (!spec || spec.type !== "group") return { code: "TPL_BLOCK_UNKNOWN", blockId: groupId };
  if (spec.source !== "user") return { code: "TPL_BLOCK_NOT_EDITABLE", blockId: groupId, source: spec.source };
  return spec;
}
const esError = (x: unknown): x is OperationError =>
  typeof x === "object" && x !== null && typeof (x as { code?: unknown }).code === "string";

// ---------------------------------------------------------------------------------------------
// applyOperation — 01 §6.5
// ---------------------------------------------------------------------------------------------

export function applyOperation(doc: InvitationDocument, op: Operation, ctx: ReducerContext): OperationResult {
  const bloques = topLevelBlocks(ctx.pkg);
  const secciones = sectionsByKey(ctx.pkg);

  switch (op.op) {
    case "setBlock": {
      const spec = bloques.get(op.blockId);
      if (!spec) return fail({ code: "TPL_BLOCK_UNKNOWN", blockId: op.blockId });
      if (spec.source !== "user") return fail({ code: "TPL_BLOCK_NOT_EDITABLE", blockId: op.blockId, source: spec.source });
      const e = checkScalar(spec, op.blockId, op.value, ctx, `content.${op.blockId}`);
      if (e) return fail(e);
      const d = clone(doc);
      d.content[op.blockId] = op.value;
      return { ok: true, doc: d };
    }

    case "clearBlock": {
      const spec = bloques.get(op.blockId);
      if (!spec) return fail({ code: "TPL_BLOCK_UNKNOWN", blockId: op.blockId });
      if (spec.source !== "user") return fail({ code: "TPL_BLOCK_NOT_EDITABLE", blockId: op.blockId, source: spec.source });
      const d = clone(doc);
      delete d.content[op.blockId];
      return { ok: true, doc: d };
    }

    case "addItem": {
      const g = groupSpecOf(ctx, op.groupId);
      if (esError(g)) return fail(g);
      const items = itemsOf(doc, op.groupId);
      if (items.length + 1 > g.max) return fail({ code: "TPL_GROUP_LIMIT", groupId: op.groupId, min: g.min, max: g.max });
      if (op.index !== undefined && op.index > items.length)
        return fail({ code: "TPL_OPERATION_INVALID", op: op.op, detail: `index ${op.index} > items ${items.length}` });
      const inner = new Map(g.itemBlocks.map(b => [b.id, b] as const));
      for (const k of Object.keys(op.values).sort()) {          // orden estable: R9 punto 1
        const ib = inner.get(k);
        if (!ib) return fail({ code: "TPL_BLOCK_UNKNOWN", blockId: k });
        const e = checkScalar(ib, k, op.values[k]!, ctx, `content.${op.groupId}[].${k}`);
        if (e) return fail(e);
      }
      const itemId = ctx.newUlid();
      const d = clone(doc);
      const nuevos = clone(items);
      nuevos.splice(op.index ?? nuevos.length, 0, { itemId, values: clone(op.values) });
      d.content[op.groupId] = { kind: "group", items: nuevos };
      return { ok: true, doc: d, idMap: { [op.tempId]: itemId } };
    }

    case "removeItem": {
      const g = groupSpecOf(ctx, op.groupId);
      if (esError(g)) return fail(g);
      const items = itemsOf(doc, op.groupId);
      const i = items.findIndex(x => x.itemId === op.itemId);
      if (i < 0) return fail({ code: "TPL_ITEM_UNKNOWN", groupId: op.groupId, itemId: op.itemId });
      if (items.length - 1 < g.min) return fail({ code: "TPL_GROUP_LIMIT", groupId: op.groupId, min: g.min, max: g.max });
      const d = clone(doc);
      const nuevos = clone(items);
      nuevos.splice(i, 1);
      d.content[op.groupId] = { kind: "group", items: nuevos };
      return { ok: true, doc: d };
    }

    case "moveItem": {
      const g = groupSpecOf(ctx, op.groupId);
      if (esError(g)) return fail(g);
      const items = itemsOf(doc, op.groupId);
      const i = items.findIndex(x => x.itemId === op.itemId);
      if (i < 0) return fail({ code: "TPL_ITEM_UNKNOWN", groupId: op.groupId, itemId: op.itemId });
      if (!g.reorderable) return fail({ code: "TPL_OPERATION_INVALID", op: op.op, detail: `${op.groupId} no es reorderable` });
      if (op.toIndex >= items.length)
        return fail({ code: "TPL_OPERATION_INVALID", op: op.op, detail: `toIndex ${op.toIndex} >= items ${items.length}` });
      const d = clone(doc);
      const nuevos = clone(items);
      const [x] = nuevos.splice(i, 1);
      nuevos.splice(op.toIndex, 0, x!);
      d.content[op.groupId] = { kind: "group", items: nuevos };
      return { ok: true, doc: d };
    }

    case "setItemBlock": {
      const g = groupSpecOf(ctx, op.groupId);
      if (esError(g)) return fail(g);
      const items = itemsOf(doc, op.groupId);
      const i = items.findIndex(x => x.itemId === op.itemId);
      if (i < 0) return fail({ code: "TPL_ITEM_UNKNOWN", groupId: op.groupId, itemId: op.itemId });
      const ib = g.itemBlocks.find(b => b.id === op.blockId);
      if (!ib) return fail({ code: "TPL_BLOCK_UNKNOWN", blockId: op.blockId });
      const e = checkScalar(ib, op.blockId, op.value, ctx, `content.${op.groupId}[${op.itemId}].${op.blockId}`);
      if (e) return fail(e);
      const d = clone(doc);
      const nuevos = clone(items);
      nuevos[i]!.values[op.blockId] = op.value;
      d.content[op.groupId] = { kind: "group", items: nuevos };
      return { ok: true, doc: d };
    }

    case "clearItemBlock": {
      const g = groupSpecOf(ctx, op.groupId);
      if (esError(g)) return fail(g);
      const items = itemsOf(doc, op.groupId);
      const i = items.findIndex(x => x.itemId === op.itemId);
      if (i < 0) return fail({ code: "TPL_ITEM_UNKNOWN", groupId: op.groupId, itemId: op.itemId });
      if (!g.itemBlocks.some(b => b.id === op.blockId)) return fail({ code: "TPL_BLOCK_UNKNOWN", blockId: op.blockId });
      const d = clone(doc);
      const nuevos = clone(items);
      delete nuevos[i]!.values[op.blockId];
      d.content[op.groupId] = { kind: "group", items: nuevos };
      return { ok: true, doc: d };
    }

    case "setSectionVisible": {
      const s = secciones.get(op.sectionKey);
      if (!s) return fail({ code: "TPL_SECTION_UNKNOWN", sectionKey: op.sectionKey });
      const i = doc.structure.sections.findIndex(e => e.key === op.sectionKey);
      if (i < 0) return fail({ code: "TPL_SECTION_UNKNOWN", sectionKey: op.sectionKey });
      if (s.required && !op.visible) return fail({ code: "TPL_SECTION_REQUIRED", sectionKey: op.sectionKey });
      const d = clone(doc);
      d.structure.sections[i]!.visible = op.visible;
      return { ok: true, doc: d };
    }

    case "setSectionVariant": {
      const s = secciones.get(op.sectionKey);
      if (!s) return fail({ code: "TPL_SECTION_UNKNOWN", sectionKey: op.sectionKey });
      const i = doc.structure.sections.findIndex(e => e.key === op.sectionKey);
      if (i < 0) return fail({ code: "TPL_SECTION_UNKNOWN", sectionKey: op.sectionKey });
      if (!s.variants.includes(op.variant)) return fail({ code: "TPL_VARIANT_UNKNOWN", sectionKey: op.sectionKey, variant: op.variant });
      const d = clone(doc);
      d.structure.sections[i]!.variant = op.variant;
      return { ok: true, doc: d };
    }

    case "reorderSections": {
      // I-24: PERMUTACIÓN exacta de las claves actuales. El esquema solo mide longitud y aceptaría
      // ["cover","cover","cover"] (hallazgo 1R A-04).
      const actuales = doc.structure.sections.map(e => e.key);
      const vs = validateReorder(op.order, actuales);
      if (vs.length > 0) return fail({ code: "TPL_INVARIANT_VIOLATION", violations: vs });
      const porClave = new Map(doc.structure.sections.map(e => [e.key, e] as const));
      const d = clone(doc);
      d.structure.sections = op.order.map(k => clone(porClave.get(k)!));
      return { ok: true, doc: d };
    }

    case "setTheme": {
      if (op.paletteId === undefined && op.fontSetId === undefined)
        return fail({ code: "TPL_OPERATION_INVALID", op: op.op, detail: "setTheme sin paletteId ni fontSetId" });
      if (op.paletteId !== undefined && !ctx.pkg.theme.palettes.some(p => p.id === op.paletteId))
        return fail({ code: "TPL_THEME_ID_UNKNOWN", field: "paletteId", id: op.paletteId });
      if (op.fontSetId !== undefined && !ctx.pkg.theme.fontSets.some(f => f.id === op.fontSetId))
        return fail({ code: "TPL_THEME_ID_UNKNOWN", field: "fontSetId", id: op.fontSetId });
      const d = clone(doc);
      if (op.paletteId !== undefined) d.theme.paletteId = op.paletteId;
      if (op.fontSetId !== undefined) d.theme.fontSetId = op.fontSetId;
      return { ok: true, doc: d };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// applyBatch — resolución de `tempId` dentro del lote, en orden (01 §6.5)
// ---------------------------------------------------------------------------------------------

const esTempId = (s: string): boolean => s.startsWith("tmp:");

/** Sustituye `itemId: "tmp:…"` por el ULID que produjo un `addItem` anterior DEL MISMO LOTE. */
function resolverTempIds(op: Operation, idMap: Record<string, string>): Operation | OperationError {
  if (op.op !== "removeItem" && op.op !== "moveItem" && op.op !== "setItemBlock" && op.op !== "clearItemBlock") return op;
  if (!esTempId(op.itemId)) return op;
  const real = idMap[op.itemId];
  // Un `tempId` sin resolver es TPL_ITEM_UNKNOWN (01 §6.5): el cliente nunca aporta ULIDs (ADR-020, P8).
  if (real === undefined) return { code: "TPL_ITEM_UNKNOWN", groupId: op.groupId, itemId: op.itemId };
  return { ...op, itemId: real };
}

/**
 * Un lote humano es **todo o nada** (`01 §6.5`); una `EditProposal` de IA descarta operación por
 * operación (`07 §4`) y para eso llama a `applyOperation` una a una, no a esta función.
 */
export function applyBatch(doc: InvitationDocument, ops: Operation[], ctx: ReducerContext): BatchResult {
  let actual = doc;
  const idMap: Record<string, string> = {};
  for (let i = 0; i < ops.length; i++) {
    const original = ops[i]!;
    if (original.op === "addItem" && idMap[original.tempId] !== undefined)
      return { ok: false, error: { code: "TPL_TEMP_ID_DUPLICATE", tempId: original.tempId }, opIndex: i };
    const resuelta = resolverTempIds(original, idMap);
    if (esError(resuelta)) return { ok: false, error: resuelta, opIndex: i };
    const r = applyOperation(actual, resuelta as Operation, ctx);
    if (!r.ok) return { ok: false, error: r.error, opIndex: i };
    actual = r.doc;
    if (r.idMap) Object.assign(idMap, r.idMap);
  }
  return { ok: true, doc: actual, idMap };
}
