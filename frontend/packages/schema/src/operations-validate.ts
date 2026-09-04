// packages/schema/src/operations-validate.ts — `validateOperations` (07 §2, contratos.md §10).
// COMPARTIDA por el editor humano (03 §3.3) y por el pipeline de IA (07 §5 paso 1). La diferencia
// entre humano e IA no está en el validador sino en la política de fallo (todo-o-nada vs.
// descartar-y-continuar) y en `opts` (`scopeSectionKey` y `aiOnly` solo se activan para la IA).
//
// Existe porque `validateValueAgainstSpec` solo compara VALOR contra SPEC y 8 de las 11 operaciones
// no llevan valor (objeción A-02 de `07 §10`): quedaban sin validar.
import type { InvitationDocument } from "./document.ts";
import type { Operation } from "./operations.ts";
import type { BlockSpec, GroupSpec } from "./blocks.ts";
import type { SectionSpec, TemplateManifest, ThemeSpec } from "./manifest.ts";
import { validateReorder, validateValueAgainstSpec } from "./invariants.ts";

export type OpViolationCode =
  | "OP_BLOCK_UNKNOWN" | "OP_BLOCK_NOT_USER_SOURCE" | "OP_BLOCK_NOT_AI_EDITABLE"
  | "OP_BLOCK_REQUIRED_CANNOT_CLEAR" | "OP_GROUP_UNKNOWN" | "OP_GROUP_SIZE_OUT_OF_BOUNDS"
  | "OP_ITEM_UNKNOWN" | "OP_ITEM_NOT_REORDERABLE" | "OP_TEMP_ID_DUPLICATE"
  | "OP_SECTION_UNKNOWN" | "OP_SECTION_REQUIRED_CANNOT_HIDE" | "OP_VARIANT_UNKNOWN"
  | "OP_ORDER_NOT_A_PERMUTATION" | "OP_THEME_ID_UNKNOWN" | "OP_THEME_EMPTY"
  | "OP_VALUE_INVALID"          // envuelve las Violation de invariants.ts
  | "OP_ASSET_NOT_OWNED"        // ADR-030; solo se comprueba si `opts.assetOwned` está presente
  | "OP_OUT_OF_SECTION_SCOPE";  // 07 §4.2, solo para propuestas de IA

export type OpViolation = { code: OpViolationCode; opIndex: number; detail?: string };

export type ValidateOptions = {
  /** A-INV-01: la propuesta de IA solo puede tocar esta sección. */
  scopeSectionKey?: string;
  aiOnly: boolean;
  /** ADR-030: pertenencia del asset. Se resuelve en el servidor; sin ella no se comprueba. */
  assetOwned?: (assetId: string) => boolean;
};

const bloquesDe = (m: TemplateManifest): Map<string, BlockSpec> => {
  const r = new Map<string, BlockSpec>();
  for (const s of m.sections) for (const b of s.blocks) r.set(b.id, b);
  return r;
};
/** blockId (de nivel de sección) → clave de su sección: lo necesita A-INV-01 (alcance por sección). */
const seccionDe = (m: TemplateManifest): Map<string, string> => {
  const r = new Map<string, string>();
  for (const s of m.sections) for (const b of s.blocks) r.set(b.id, s.key);
  return r;
};
const itemsDe = (doc: InvitationDocument, groupId: string): Array<{ itemId: string; values: Record<string, unknown> }> => {
  const v = doc.content[groupId] as { kind?: string; items?: Array<{ itemId: string; values: Record<string, unknown> }> } | undefined;
  return v?.kind === "group" ? (v.items ?? []) : [];
};

/**
 * Las 11 operaciones contra manifiesto, tema y documento. Devuelve la lista vacía si todo está bien;
 * **nunca lanza** (contratos.md §4 prohíbe `require`/`check`/`error()` en este módulo).
 */
export function validateOperations(
  ops: Operation[], m: TemplateManifest, theme: ThemeSpec, doc: InvitationDocument, opts: ValidateOptions,
): OpViolation[] {
  const v: OpViolation[] = [];
  const bloques = bloquesDe(m);
  const seccionPorBloque = seccionDe(m);
  const secciones = new Map<string, SectionSpec>(m.sections.map(s => [s.key, s] as const));
  const tempIds = new Set<string>();
  // Los ítems creados por un `addItem` anterior del mismo lote existen para las operaciones siguientes.
  const itemsCreados = new Map<string, Set<string>>();

  const fuera = (i: number, sectionKey: string | undefined) => {
    if (opts.scopeSectionKey !== undefined && sectionKey !== opts.scopeSectionKey)
      v.push({ code: "OP_OUT_OF_SECTION_SCOPE", opIndex: i, detail: sectionKey ?? "?" });
  };
  const itemExiste = (groupId: string, itemId: string): boolean =>
    itemsDe(doc, groupId).some(x => x.itemId === itemId) || (itemsCreados.get(groupId)?.has(itemId) ?? false);

  const grupo = (i: number, groupId: string): GroupSpec | null => {
    const spec = bloques.get(groupId);
    if (!spec || spec.type !== "group") { v.push({ code: "OP_GROUP_UNKNOWN", opIndex: i, detail: groupId }); return null; }
    fuera(i, seccionPorBloque.get(groupId));
    if (spec.source !== "user") v.push({ code: "OP_BLOCK_NOT_USER_SOURCE", opIndex: i, detail: groupId });
    if (opts.aiOnly && !spec.aiEditable) v.push({ code: "OP_BLOCK_NOT_AI_EDITABLE", opIndex: i, detail: groupId });
    return spec;
  };
  const valor = (i: number, spec: BlockSpec, value: { kind: string }) => {
    const vs = validateValueAgainstSpec(spec, value as never, "op");
    for (const x of vs) v.push({ code: "OP_VALUE_INVALID", opIndex: i, detail: x.code });
    if (opts.assetOwned && "assetId" in value && !opts.assetOwned((value as { assetId: string }).assetId))
      v.push({ code: "OP_ASSET_NOT_OWNED", opIndex: i, detail: (value as { assetId: string }).assetId });
  };

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    switch (op.op) {
      case "setBlock": case "clearBlock": {
        const spec = bloques.get(op.blockId);
        if (!spec) { v.push({ code: "OP_BLOCK_UNKNOWN", opIndex: i, detail: op.blockId }); break; }
        fuera(i, seccionPorBloque.get(op.blockId));
        if (spec.source !== "user") v.push({ code: "OP_BLOCK_NOT_USER_SOURCE", opIndex: i, detail: op.blockId });
        if (opts.aiOnly && !spec.aiEditable) v.push({ code: "OP_BLOCK_NOT_AI_EDITABLE", opIndex: i, detail: op.blockId });
        if (op.op === "clearBlock") { if (spec.required) v.push({ code: "OP_BLOCK_REQUIRED_CANNOT_CLEAR", opIndex: i, detail: op.blockId }); }
        else valor(i, spec, op.value);
        break;
      }
      case "addItem": {
        const g = grupo(i, op.groupId);
        if (!g) break;
        if (tempIds.has(op.tempId)) v.push({ code: "OP_TEMP_ID_DUPLICATE", opIndex: i, detail: op.tempId });
        tempIds.add(op.tempId);
        const n = itemsDe(doc, op.groupId).length + (itemsCreados.get(op.groupId)?.size ?? 0);
        if (n + 1 > g.max) v.push({ code: "OP_GROUP_SIZE_OUT_OF_BOUNDS", opIndex: i, detail: `${n + 1} > max ${g.max}` });
        if (op.index !== undefined && op.index > n) v.push({ code: "OP_ITEM_UNKNOWN", opIndex: i, detail: `index ${op.index}` });
        const inner = new Map(g.itemBlocks.map(b => [b.id, b] as const));
        for (const k of Object.keys(op.values).sort()) {
          const ib = inner.get(k);
          if (!ib) { v.push({ code: "OP_BLOCK_UNKNOWN", opIndex: i, detail: k }); continue; }
          valor(i, ib, op.values[k]!);
        }
        if (!itemsCreados.has(op.groupId)) itemsCreados.set(op.groupId, new Set());
        itemsCreados.get(op.groupId)!.add(op.tempId);
        break;
      }
      case "removeItem": {
        const g = grupo(i, op.groupId);
        if (!g) break;
        if (!itemExiste(op.groupId, op.itemId)) { v.push({ code: "OP_ITEM_UNKNOWN", opIndex: i, detail: op.itemId }); break; }
        const n = itemsDe(doc, op.groupId).length;
        if (n - 1 < g.min) v.push({ code: "OP_GROUP_SIZE_OUT_OF_BOUNDS", opIndex: i, detail: `${n - 1} < min ${g.min}` });
        break;
      }
      case "moveItem": {
        const g = grupo(i, op.groupId);
        if (!g) break;
        if (!itemExiste(op.groupId, op.itemId)) { v.push({ code: "OP_ITEM_UNKNOWN", opIndex: i, detail: op.itemId }); break; }
        if (!g.reorderable) v.push({ code: "OP_ITEM_NOT_REORDERABLE", opIndex: i, detail: op.groupId });
        if (op.toIndex >= itemsDe(doc, op.groupId).length) v.push({ code: "OP_ITEM_UNKNOWN", opIndex: i, detail: `toIndex ${op.toIndex}` });
        break;
      }
      case "setItemBlock": case "clearItemBlock": {
        const g = grupo(i, op.groupId);
        if (!g) break;
        if (!itemExiste(op.groupId, op.itemId)) { v.push({ code: "OP_ITEM_UNKNOWN", opIndex: i, detail: op.itemId }); break; }
        const ib = g.itemBlocks.find(b => b.id === op.blockId);
        if (!ib) { v.push({ code: "OP_BLOCK_UNKNOWN", opIndex: i, detail: op.blockId }); break; }
        if (op.op === "setItemBlock") valor(i, ib, op.value);
        break;
      }
      case "setSectionVisible": {
        const s = secciones.get(op.sectionKey);
        if (!s) { v.push({ code: "OP_SECTION_UNKNOWN", opIndex: i, detail: op.sectionKey }); break; }
        fuera(i, op.sectionKey);
        if (s.required && !op.visible) v.push({ code: "OP_SECTION_REQUIRED_CANNOT_HIDE", opIndex: i, detail: op.sectionKey });
        break;
      }
      case "setSectionVariant": {
        const s = secciones.get(op.sectionKey);
        if (!s) { v.push({ code: "OP_SECTION_UNKNOWN", opIndex: i, detail: op.sectionKey }); break; }
        fuera(i, op.sectionKey);
        if (!s.variants.includes(op.variant)) v.push({ code: "OP_VARIANT_UNKNOWN", opIndex: i, detail: op.variant });
        break;
      }
      case "reorderSections": {
        // A-INV-01 prohíbe `reorderSections` y `setTheme` en toda propuesta de IA: no caben en el
        // alcance de UNA sección (contratos.md §10).
        if (opts.aiOnly) v.push({ code: "OP_OUT_OF_SECTION_SCOPE", opIndex: i, detail: "reorderSections" });
        const vs = validateReorder(op.order, doc.structure.sections.map(e => e.key));
        if (vs.length > 0) v.push({ code: "OP_ORDER_NOT_A_PERMUTATION", opIndex: i, detail: vs[0]!.detail });
        break;
      }
      case "setTheme": {
        if (opts.aiOnly) v.push({ code: "OP_OUT_OF_SECTION_SCOPE", opIndex: i, detail: "setTheme" });
        if (op.paletteId === undefined && op.fontSetId === undefined) { v.push({ code: "OP_THEME_EMPTY", opIndex: i }); break; }
        if (op.paletteId !== undefined && !theme.palettes.some(p => p.id === op.paletteId))
          v.push({ code: "OP_THEME_ID_UNKNOWN", opIndex: i, detail: op.paletteId });
        if (op.fontSetId !== undefined && !theme.fontSets.some(f => f.id === op.fontSetId))
          v.push({ code: "OP_THEME_ID_UNKNOWN", opIndex: i, detail: op.fontSetId });
        break;
      }
    }
  }
  return v;
}
