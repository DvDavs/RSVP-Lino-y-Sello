// packages/schema/scripts/gen-golden-operations.ts — golden/operations/<op>.cases.json (contratos.md
// §3 y §6: 11 operaciones, no 10 — clearItemBlock incluida, ADR-1R-X-01; 06 §5.4).
//
// LÍMITE DE ALCANCE DE ESTA FASE (documentado también en golden/README.md y en el handoff 2-0a):
// `esquema/operations-reducer.ts` (applyOperation) NO es uno de los 10 archivos que esta fase movió
// (ver diseno/esquema/README.md original) — es lógica de negocio del reductor, fuera del alcance de
// 2-0a ("no escribas lógica de negocio del módulo templates2"). Por tanto cada fichero de esta carpeta
// cubre, con código real y autoverificado, SOLO lo que 2-0a puede ejecutar sin el reductor:
//   1. forma válida (Operation.safeParse === true)
//   2. forma inválida por Zod (Operation.safeParse === false)
//   3. válida en forma pero inválida CONTRA EL MANIFIESTO — mediante comprobaciones referenciales
//      directas (existencia de blockId/sectionKey/variant/paletteId/itemId), NO mediante el reductor.
// El campo "reducerResult" (01 §6.5, "el resultado esperado del reductor sobre un documento base
// fijo") queda `null` con `reducerResultPending: true`: es tarea de 2-0b, cuando exista
// operations-reducer.ts / OperationReducer.kt. Ver golden/README.md.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Operation } from "../src/operations.ts";
import { validateReorder, type InvariantCode } from "../src/invariants.ts";
import type { TemplateManifest, ThemeSpec } from "../src/manifest.ts";
import {
  textSpec, imageSpec, groupSpec, sectionSpec, themeFixture, manifestFixture, textValue, ulid,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = HERE + "../golden/operations/";
mkdirSync(OUT, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

// -------------------------------------------------------------------------------------------
// Manifiesto/tema fijo compartido por todos los ficheros de esta carpeta.
// -------------------------------------------------------------------------------------------
const theme: ThemeSpec = themeFixture();
const manifest: TemplateManifest = manifestFixture([
  sectionSpec("cover", "cover", [textSpec("cover.title", "coverTitle"), imageSpec("cover.image", "coverImage")], { variants: ["default", "alt"] }),
  sectionSpec("event", "event", [
    groupSpec("event.cards", "eventCards", [textSpec("title", "sectionTitle"), imageSpec("image", "decorative")], { max: 6 }),
  ]),
]);
const KNOWN_ITEM_ID = ulid("known1");

type Tag = "valid-shape" | "invalid-shape" | "invalid-manifest";
type OpCase = {
  name: string; tag: Tag; operation: unknown;
  expectZodValid: boolean; expectManifestError: string | null;
  reducerResult: null; reducerResultPending: true;
};

/**
 * Comprobación REFERENCIAL (no el reductor: no muta el documento, no genera ULIDs, no resuelve
 * `tempId`). Replica solo la parte de `01 §6.5` que 2-0a puede verificar sin operations-reducer.ts.
 */
function manifestError(op: any): string | null {
  const blockIds = new Set<string>();
  const groupItemBlocks = new Map<string, Set<string>>();
  for (const s of manifest.sections) for (const b of s.blocks) {
    blockIds.add(b.id);
    if (b.type === "group") groupItemBlocks.set(b.id, new Set(b.itemBlocks.map(ib => ib.id)));
  }
  const sections = new Map(manifest.sections.map(s => [s.key, s] as const));
  switch (op.op) {
    case "setBlock": case "clearBlock":
      return blockIds.has(op.blockId) ? null : "TPL_BLOCK_UNKNOWN";
    case "addItem": case "removeItem": case "moveItem":
      if (!groupItemBlocks.has(op.groupId)) return "TPL_BLOCK_UNKNOWN";
      if (op.op !== "addItem" && op.itemId !== KNOWN_ITEM_ID) return "TPL_ITEM_UNKNOWN";
      return null;
    case "setItemBlock": case "clearItemBlock": {
      const inner = groupItemBlocks.get(op.groupId);
      if (!inner) return "TPL_BLOCK_UNKNOWN";
      if (op.itemId !== KNOWN_ITEM_ID) return "TPL_ITEM_UNKNOWN";
      if (!inner.has(op.blockId)) return "TPL_BLOCK_UNKNOWN";
      return null;
    }
    case "setSectionVisible":
      return sections.has(op.sectionKey) ? null : "TPL_SECTION_UNKNOWN";
    case "setSectionVariant": {
      const s = sections.get(op.sectionKey);
      if (!s) return "TPL_SECTION_UNKNOWN";
      return s.variants.includes(op.variant) ? null : "TPL_VARIANT_UNKNOWN";
    }
    case "reorderSections": {
      const actuales = manifest.sections.map(s => s.key);
      const v = validateReorder(op.order, actuales);
      return v.length > 0 ? (v[0]!.code as string) : null;
    }
    case "setTheme": {
      if (op.paletteId !== undefined && !theme.palettes.some(p => p.id === op.paletteId)) return "TPL_THEME_ID_UNKNOWN";
      if (op.fontSetId !== undefined && !theme.fontSets.some(f => f.id === op.fontSetId)) return "TPL_THEME_ID_UNKNOWN";
      return null;
    }
    default: return null;
  }
}

function ocase(name: string, tag: Tag, operation: unknown, expectZodValid: boolean, expectManifestError: string | null = null): OpCase {
  const zr = Operation.safeParse(operation);
  if (zr.success !== expectZodValid)
    throw new Error(`${name}: esperaba zodValid=${expectZodValid}, obtuve ${zr.success}`);
  if (zr.success && tag === "invalid-manifest") {
    const got = manifestError(operation);
    if (got !== expectManifestError) throw new Error(`${name}: esperaba error de manifiesto ${expectManifestError}, obtuve ${got}`);
  }
  return { name, tag, operation, expectZodValid, expectManifestError, reducerResult: null, reducerResultPending: true };
}

const files: Record<string, () => OpCase[]> = {
  setBlock: () => [
    ocase("forma válida", "valid-shape", { op: "setBlock", blockId: "cover.title", value: textValue("Ana & Luis") }, true),
    ocase("forma inválida: falta value", "invalid-shape", { op: "setBlock", blockId: "cover.title" }, false),
    ocase("blockId inexistente en el manifiesto", "invalid-manifest", { op: "setBlock", blockId: "no.existe", value: textValue("x") }, true, "TPL_BLOCK_UNKNOWN"),
  ],
  clearBlock: () => [
    ocase("forma válida", "valid-shape", { op: "clearBlock", blockId: "cover.title" }, true),
    ocase("forma inválida: campo extra", "invalid-shape", { op: "clearBlock", blockId: "cover.title", value: textValue("x") }, false),
    ocase("blockId inexistente", "invalid-manifest", { op: "clearBlock", blockId: "no.existe" }, true, "TPL_BLOCK_UNKNOWN"),
  ],
  addItem: () => [
    ocase("forma válida", "valid-shape", { op: "addItem", groupId: "event.cards", tempId: "tmp:abcdefgh", values: {} }, true),
    ocase("forma inválida: tempId demasiado corto", "invalid-shape", { op: "addItem", groupId: "event.cards", tempId: "tmp:x", values: {} }, false),
    ocase("groupId inexistente", "invalid-manifest", { op: "addItem", groupId: "no.existe", tempId: "tmp:abcdefgh", values: {} }, true, "TPL_BLOCK_UNKNOWN"),
  ],
  removeItem: () => [
    ocase("forma válida", "valid-shape", { op: "removeItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID }, true),
    ocase("forma inválida: itemId no es ULID ni tempId", "invalid-shape", { op: "removeItem", groupId: "event.cards", itemId: "bad" }, false),
    ocase("itemId inexistente", "invalid-manifest", { op: "removeItem", groupId: "event.cards", itemId: ulid("noexist") }, true, "TPL_ITEM_UNKNOWN"),
  ],
  moveItem: () => [
    ocase("forma válida", "valid-shape", { op: "moveItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID, toIndex: 0 }, true),
    ocase("forma inválida: toIndex negativo", "invalid-shape", { op: "moveItem", groupId: "event.cards", itemId: KNOWN_ITEM_ID, toIndex: -1 }, false),
    ocase("groupId inexistente", "invalid-manifest", { op: "moveItem", groupId: "no.existe", itemId: KNOWN_ITEM_ID, toIndex: 0 }, true, "TPL_BLOCK_UNKNOWN"),
  ],
  setItemBlock: () => [
    ocase("forma válida", "valid-shape", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title", value: textValue("x") }, true),
    ocase("forma inválida: falta value", "invalid-shape", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title" }, false),
    ocase("blockId no es itemBlock del grupo", "invalid-manifest", { op: "setItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "no.existe", value: textValue("x") }, true, "TPL_BLOCK_UNKNOWN"),
  ],
  clearItemBlock: () => [
    // X-05 (ADR-1R-X-01): borra el valor de un itemBlock sin dejarlo "no deshacible" ni promover un
    // default a contenido de usuario — ver invariants.ts nota y 01 §6.5.
    ocase("forma válida", "valid-shape", { op: "clearItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title" }, true),
    ocase("forma inválida: campo extra", "invalid-shape", { op: "clearItemBlock", groupId: "event.cards", itemId: KNOWN_ITEM_ID, blockId: "title", value: textValue("x") }, false),
    ocase("itemId inexistente", "invalid-manifest", { op: "clearItemBlock", groupId: "event.cards", itemId: ulid("noexist"), blockId: "title" }, true, "TPL_ITEM_UNKNOWN"),
  ],
  setSectionVisible: () => [
    ocase("forma válida", "valid-shape", { op: "setSectionVisible", sectionKey: "cover", visible: false }, true),
    ocase("forma inválida: visible no booleano", "invalid-shape", { op: "setSectionVisible", sectionKey: "cover", visible: "no" }, false),
    ocase("sectionKey inexistente", "invalid-manifest", { op: "setSectionVisible", sectionKey: "noExiste", visible: true }, true, "TPL_SECTION_UNKNOWN"),
  ],
  setSectionVariant: () => [
    ocase("forma válida", "valid-shape", { op: "setSectionVariant", sectionKey: "cover", variant: "alt" }, true),
    ocase("forma inválida: falta variant", "invalid-shape", { op: "setSectionVariant", sectionKey: "cover" }, false),
    ocase("variant no declarada", "invalid-manifest", { op: "setSectionVariant", sectionKey: "cover", variant: "no-existe" }, true, "TPL_VARIANT_UNKNOWN"),
  ],
  reorderSections: () => [
    ocase("forma válida: permutación exacta", "valid-shape", { op: "reorderSections", order: ["event", "cover"] }, true),
    ocase("forma inválida: array vacío (min 1)", "invalid-shape", { op: "reorderSections", order: [] }, false),
    ocase("no es una permutación (I-24)", "invalid-manifest", { op: "reorderSections", order: ["cover", "cover"] }, true, "I-24_REORDER_NOT_A_PERMUTATION"),
  ],
  setTheme: () => [
    ocase("forma válida", "valid-shape", { op: "setTheme", paletteId: "olive" }, true),
    ocase("forma inválida: paletteId no es Ident", "invalid-shape", { op: "setTheme", paletteId: "OLIVE!" }, false),
    ocase("paletteId inexistente", "invalid-manifest", { op: "setTheme", paletteId: "no-existe" }, true, "TPL_THEME_ID_UNKNOWN"),
  ],
};

const EXPECTED_OPS = [
  "setBlock", "clearBlock", "addItem", "removeItem", "moveItem", "setItemBlock", "clearItemBlock",
  "setSectionVisible", "setSectionVariant", "reorderSections", "setTheme",
];
if (EXPECTED_OPS.length !== 11) throw new Error("EXPECTED_OPS debe tener 11 entradas");
for (const op of EXPECTED_OPS) if (!files[op]) throw new Error(`falta generador para la operación ${op}`);

let total = 0;
for (const op of EXPECTED_OPS) {
  write(OUT + `${op}.cases.json`, files[op]!());
  total++;
}
console.log(`golden/operations: ${total} ficheros (11 operaciones, ADR-1R-X-01)`);
