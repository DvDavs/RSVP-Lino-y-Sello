// packages/schema/src/invariants.ts — invariantes entre campos que z.toJSONSchema NO puede expresar.
// Cada I-xx se implementa DOS veces (aquí y en templates2/schema/Invariants.kt) y se prueba con la MISMA
// tabla de casos: frontend/packages/schema/golden/invariants/*.json (06-pruebas-y-calidad.md §5).
import type { TemplateManifest, ThemeSpec, DefaultsFile } from "./manifest.ts";
import type { InvitationDocument } from "./document.ts";
import type { BlockSpec, GroupSpec, ScalarValue } from "./blocks.ts";

export type Violation = { code: InvariantCode; path: string; detail?: string };
export type InvariantCode =
  | "I-01_RANGE_END_BEFORE_START" | "I-02_CHOICE_UNKNOWN_OPTION" | "I-03_ITEM_ID_DUPLICATE"
  | "I-04_GROUP_SIZE_OUT_OF_BOUNDS" | "I-05_BUSINESS_FIELD_MISSING" | "I-06_BUSINESS_TYPE_MISMATCH"
  | "I-07_GROUP_MIN_GT_MAX" | "I-08_DEFAULT_VARIANT_UNKNOWN" | "I-09_THEME_DEFAULT_UNKNOWN"
  | "I-10_DEFAULT_KEY_UNKNOWN" | "I-11_STRUCTURE_DUPLICATE_KEY" | "I-12_CONTENT_KEY_UNKNOWN"
  | "I-13_BLOCK_ID_DUPLICATE" | "I-14_SECTION_KEY_DUPLICATE" | "I-15_BLOCK_KIND_MISMATCH"
  | "I-16_TEXT_TOO_LONG" | "I-17_REQUIRED_SECTION_HIDDEN" | "I-18_ITEM_BLOCK_UNKNOWN"
  | "I-19_STRUCTURE_KEY_UNKNOWN" | "I-20_THEME_ID_UNKNOWN" | "I-21_BUSINESS_BLOCK_WRITTEN";

const BUSINESS_TYPE: Record<string, string> = {
  "invitation.date": "date", "invitation.time": "time", "invitation.hashtag": "text",
  "invitation.coverPhotoUrl": "image", "invitation.childrenAllowed": "boolean", "invitation.youngAllowed": "boolean",
};

/** Invariantes del PAQUETE (se ejecutan en el registro; cualquier violación = registro rechazado). */
export function validateManifest(m: TemplateManifest, theme: ThemeSpec, defaults: DefaultsFile): Violation[] {
  const v: Violation[] = [];
  const sectionKeys = new Set<string>();
  const blockIds = new Map<string, BlockSpec>();
  for (const s of m.sections) {
    if (sectionKeys.has(s.key)) v.push({ code: "I-14_SECTION_KEY_DUPLICATE", path: `sections.${s.key}` });
    sectionKeys.add(s.key);
    if (!s.variants.includes(s.defaultVariant)) v.push({ code: "I-08_DEFAULT_VARIANT_UNKNOWN", path: `sections.${s.key}.defaultVariant` });
    for (const b of s.blocks) {
      if (blockIds.has(b.id)) v.push({ code: "I-13_BLOCK_ID_DUPLICATE", path: `blocks.${b.id}` });
      blockIds.set(b.id, b);
      if (b.source === "business" && !b.businessField) v.push({ code: "I-05_BUSINESS_FIELD_MISSING", path: `blocks.${b.id}` });
      if (b.source === "business" && b.businessField && BUSINESS_TYPE[b.businessField] !== b.type)
        v.push({ code: "I-06_BUSINESS_TYPE_MISMATCH", path: `blocks.${b.id}`, detail: `${b.businessField} exige ${BUSINESS_TYPE[b.businessField]}` });
      if (b.type === "group") {
        if (b.min > b.max) v.push({ code: "I-07_GROUP_MIN_GT_MAX", path: `blocks.${b.id}` });
        const inner = new Set<string>();
        for (const ib of b.itemBlocks) {
          if (inner.has(ib.id)) v.push({ code: "I-13_BLOCK_ID_DUPLICATE", path: `blocks.${b.id}.${ib.id}` });
          inner.add(ib.id);
        }
      }
    }
  }
  if (!theme.palettes.some(p => p.id === theme.defaultPaletteId)) v.push({ code: "I-09_THEME_DEFAULT_UNKNOWN", path: "theme.defaultPaletteId" });
  if (!theme.fontSets.some(f => f.id === theme.defaultFontSetId)) v.push({ code: "I-09_THEME_DEFAULT_UNKNOWN", path: "theme.defaultFontSetId" });
  for (const [key, value] of Object.entries(defaults.content)) {
    const spec = blockIds.get(key);
    if (!spec) { v.push({ code: "I-10_DEFAULT_KEY_UNKNOWN", path: `defaults.${key}` }); continue; }
    v.push(...validateValueAgainstSpec(spec, value, `defaults.${key}`));
  }
  return v;
}

/** Invariantes del DOCUMENTO contra su versión de plantilla (se ejecutan en cada escritura). */
export function validateDocument(doc: InvitationDocument, m: TemplateManifest, theme: ThemeSpec): Violation[] {
  const v: Violation[] = [];
  const specs = new Map<string, BlockSpec>();
  const sections = new Map(m.sections.map(s => [s.key, s] as const));
  for (const s of m.sections) for (const b of s.blocks) specs.set(b.id, b);
  const seen = new Set<string>();
  for (const e of doc.structure.sections) {
    if (seen.has(e.key)) v.push({ code: "I-11_STRUCTURE_DUPLICATE_KEY", path: `structure.${e.key}` });
    seen.add(e.key);
    const s = sections.get(e.key);
    if (!s) { v.push({ code: "I-19_STRUCTURE_KEY_UNKNOWN", path: `structure.${e.key}` }); continue; }
    if (s.required && !e.visible) v.push({ code: "I-17_REQUIRED_SECTION_HIDDEN", path: `structure.${e.key}` });
    if (!s.variants.includes(e.variant)) v.push({ code: "I-08_DEFAULT_VARIANT_UNKNOWN", path: `structure.${e.key}.variant` });
  }
  if (!theme.palettes.some(p => p.id === doc.theme.paletteId)) v.push({ code: "I-20_THEME_ID_UNKNOWN", path: "theme.paletteId" });
  if (!theme.fontSets.some(f => f.id === doc.theme.fontSetId)) v.push({ code: "I-20_THEME_ID_UNKNOWN", path: "theme.fontSetId" });
  for (const [key, value] of Object.entries(doc.content)) {
    const spec = specs.get(key);
    if (!spec) { v.push({ code: "I-12_CONTENT_KEY_UNKNOWN", path: `content.${key}` }); continue; }
    if (spec.source !== "user") { v.push({ code: "I-21_BUSINESS_BLOCK_WRITTEN", path: `content.${key}` }); continue; }
    v.push(...validateValueAgainstSpec(spec, value, `content.${key}`));
  }
  return v;
}

/** Valor ↔ spec: kind, longitud, opciones, rango, grupos. Es la MISMA función que usa el reductor de operaciones. */
export function validateValueAgainstSpec(spec: BlockSpec, value: { kind: string } & Record<string, unknown>, path: string): Violation[] {
  const v: Violation[] = [];
  if (value.kind !== spec.type) return [{ code: "I-15_BLOCK_KIND_MISMATCH", path, detail: `${value.kind} ≠ ${spec.type}` }];
  switch (spec.type) {
    case "text": {
      const s = value.value as string;
      if (s.length > spec.constraints.maxLength || s.length < spec.constraints.minLength) v.push({ code: "I-16_TEXT_TOO_LONG", path });
      break;
    }
    case "listText": {
      const items = value.items as string[];
      if (items.length > spec.constraints.maxItems || items.length < spec.constraints.minItems) v.push({ code: "I-04_GROUP_SIZE_OUT_OF_BOUNDS", path });
      if (items.some(i => i.length > spec.constraints.maxItemLength)) v.push({ code: "I-16_TEXT_TOO_LONG", path });
      break;
    }
    case "dateTimeRange": {
      const { start, end } = value as { start: string; end?: string };
      if (end !== undefined && end < start) v.push({ code: "I-01_RANGE_END_BEFORE_START", path });
      break;
    }
    case "choice":
      if (!spec.options.some(o => o.id === value.optionId)) v.push({ code: "I-02_CHOICE_UNKNOWN_OPTION", path });
      break;
    case "group": {
      const g = spec as GroupSpec;
      const items = value.items as Array<{ itemId: string; values: Record<string, ScalarValue> }>;
      if (items.length < g.min || items.length > g.max) v.push({ code: "I-04_GROUP_SIZE_OUT_OF_BOUNDS", path });
      const ids = new Set<string>();
      const inner = new Map(g.itemBlocks.map(b => [b.id, b] as const));
      for (const it of items) {
        if (ids.has(it.itemId)) v.push({ code: "I-03_ITEM_ID_DUPLICATE", path: `${path}[${it.itemId}]` });
        ids.add(it.itemId);
        for (const [k, val] of Object.entries(it.values)) {
          const ib = inner.get(k);
          if (!ib) { v.push({ code: "I-18_ITEM_BLOCK_UNKNOWN", path: `${path}[${it.itemId}].${k}` }); continue; }
          v.push(...validateValueAgainstSpec(ib, val as any, `${path}[${it.itemId}].${k}`));
        }
      }
      break;
    }
  }
  return v;
}
