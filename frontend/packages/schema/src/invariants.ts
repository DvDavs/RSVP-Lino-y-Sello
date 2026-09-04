// packages/schema/src/invariants.ts — invariantes entre campos que z.toJSONSchema NO puede expresar.
// Cada I-xx se implementa DOS veces (aquí y en templates2/schema/Invariants.kt) y se prueba con la MISMA
// tabla de casos: frontend/packages/schema/golden/invariants/*.json (06-pruebas-y-calidad.md §5).
import type { TemplateManifest, ThemeSpec, DefaultsFile } from "./manifest.ts";
import type { InvitationDocument } from "./document.ts";
import type { BlockSpec, GroupSpec, ScalarValue } from "./blocks.ts";
import { GROUP_ROLES, SINGLETON_ROLES } from "./blocks.ts";

export type Violation = { code: InvariantCode; path: string; detail?: string };
export type InvariantCode =
  | "I-01_RANGE_END_BEFORE_START" | "I-02_CHOICE_UNKNOWN_OPTION" | "I-03_ITEM_ID_DUPLICATE"
  | "I-04_GROUP_SIZE_OUT_OF_BOUNDS" | "I-05_BUSINESS_FIELD_MISSING" | "I-06_BUSINESS_TYPE_MISMATCH"
  | "I-07_GROUP_MIN_GT_MAX" | "I-08_DEFAULT_VARIANT_UNKNOWN" | "I-09_THEME_DEFAULT_UNKNOWN"
  | "I-10_DEFAULT_KEY_UNKNOWN" | "I-11_STRUCTURE_DUPLICATE_KEY" | "I-12_CONTENT_KEY_UNKNOWN"
  | "I-13_BLOCK_ID_DUPLICATE" | "I-14_SECTION_KEY_DUPLICATE" | "I-15_BLOCK_KIND_MISMATCH"
  | "I-16_TEXT_TOO_LONG" | "I-17_REQUIRED_SECTION_HIDDEN" | "I-18_ITEM_BLOCK_UNKNOWN"
  | "I-19_STRUCTURE_KEY_UNKNOWN" | "I-20_THEME_ID_UNKNOWN" | "I-21_BUSINESS_BLOCK_WRITTEN"
  | "I-22_ITEM_BLOCK_SOURCE_NOT_USER" | "I-23_LOCALE_NOT_SUPPORTED"
  // añadidas en la ronda 1R (ver 01 §11, tabla de objeciones)
  | "I-24_REORDER_NOT_A_PERMUTATION" | "I-25_GROUP_ROLE_MISMATCH" | "I-26_SINGLETON_ROLE_DUPLICATE"
  | "I-27_LOCALIZED_TEXT_MISSING_LOCALE" | "I-28_DEFAULT_FOR_BUSINESS_BLOCK"
  | "I-29_RESERVED_OBJECT_KEY"
  // añadida en la ronda de dirimición (X-06): constraint declarada en blocks.ts que nadie validaba
  | "I-30_TEXT_MULTILINE_NOT_ALLOWED";
// `I-31_PALETTE_CONTRAST_BELOW_AA` queda RESERVADO para ADR-1R-F-06 (`04 §17.1`, decisión X-03).
// No se declara aquí hasta que esa ADR se acepte: un código en `InvariantCode` sin implementación ni
// fichero de casos rompería la prueba de exhaustividad de `06 §4.2`.

/**
 * I-29 — claves reservadas del objeto de JavaScript en cualquier mapa por id (`content`, `defaults.content`,
 * `attic[...]`, `GroupItem.values`).
 *
 * Medido en la ronda 1R con zod@4.5.4: `z.record(BlockId, BlockValue).safeParse(JSON.parse('{"__proto__":…}'))`
 * devuelve `success: true` y un objeto VACÍO — la clave se descarta EN SILENCIO (P1 prohíbe exactamente eso,
 * y es la misma clase de fallo que H-12). ajv sobre el JSON Schema emitido SÍ la rechaza
 * (`propertyNames.pattern`), así que TypeScript y Kotlin discreparían sobre el mismo documento.
 * Por eso esta comprobación se ejecuta sobre el JSON **crudo**, ANTES de `InvitationDocument.parse()`.
 * `"constructor"` sí casa con el patrón de `BlockId` y Zod lo deja pasar: se prohíbe explícitamente.
 */
export const RESERVED_KEYS = ["__proto__", "constructor", "prototype"] as const;
export function assertNoReservedKeys(raw: unknown, path = "$"): Violation[] {
  const v: Violation[] = [];
  const walk = (n: unknown, p: string) => {
    if (Array.isArray(n)) { n.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
    if (n === null || typeof n !== "object") return;
    for (const k of Object.getOwnPropertyNames(n)) {
      if ((RESERVED_KEYS as readonly string[]).includes(k))
        v.push({ code: "I-29_RESERVED_OBJECT_KEY", path: `${p}.${k}` });
      walk((n as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(raw, path);
  return v;
}

const GROUP_ROLE_SET: ReadonlySet<string> = new Set<string>(GROUP_ROLES);
const SINGLETON_ROLE_SET: ReadonlySet<string> = new Set<string>(SINGLETON_ROLES);
/** Longitud en caracteres del texto plano de un richText (I-16 para `richText`). */
export function richTextLength(doc: { content?: Array<{ content?: Array<{ text?: string }> }> }): number {
  let n = 0;
  for (const p of doc.content ?? []) for (const s of p.content ?? []) n += (s.text ?? "").length;
  return n;
}

const BUSINESS_TYPE: Record<string, string> = {
  "invitation.date": "date", "invitation.time": "time", "invitation.hashtag": "text",
  "invitation.coverPhotoUrl": "image", "invitation.childrenAllowed": "boolean", "invitation.youngAllowed": "boolean",
};

/** Invariantes del PAQUETE (se ejecutan en el registro; cualquier violación = registro rechazado). */
export function validateManifest(m: TemplateManifest, theme: ThemeSpec, defaults: DefaultsFile): Violation[] {
  const v: Violation[] = [];
  const sectionKeys = new Set<string>();
  const blockIds = new Map<string, BlockSpec>();
  const singletonSeen = new Map<string, string>();
  // I-27: todo LocalizedText del manifiesto debe traer TODOS los locales que `locales` declara; si no,
  // compose() caería a "es-MX" en silencio para un cliente en-US (P1: nada se descarta sin traza).
  const checkL10n = (t: Record<string, unknown>, path: string) => {
    for (const loc of m.locales) if (typeof t[loc] !== "string")
      v.push({ code: "I-27_LOCALIZED_TEXT_MISSING_LOCALE", path, detail: loc });
  };
  checkL10n(m.name, "name");
  if (m.description) checkL10n(m.description, "description");
  for (const s of m.sections) {
    checkL10n(s.title, `sections.${s.key}.title`);
    if (sectionKeys.has(s.key)) v.push({ code: "I-14_SECTION_KEY_DUPLICATE", path: `sections.${s.key}` });
    sectionKeys.add(s.key);
    if (!s.variants.includes(s.defaultVariant)) v.push({ code: "I-08_DEFAULT_VARIANT_UNKNOWN", path: `sections.${s.key}.defaultVariant` });
    for (const b of s.blocks) {
      checkL10n(b.label, `blocks.${b.id}.label`);
      if (blockIds.has(b.id)) v.push({ code: "I-13_BLOCK_ID_DUPLICATE", path: `blocks.${b.id}` });
      blockIds.set(b.id, b);
      if (b.source === "business" && !b.businessField) v.push({ code: "I-05_BUSINESS_FIELD_MISSING", path: `blocks.${b.id}` });
      if (b.source === "business" && b.businessField && BUSINESS_TYPE[b.businessField] !== b.type)
        v.push({ code: "I-06_BUSINESS_TYPE_MISMATCH", path: `blocks.${b.id}`, detail: `${b.businessField} exige ${BUSINESS_TYPE[b.businessField]}` });
      // I-25: rol de grupo ⟺ bloque de tipo group (hallazgo 1R A-09).
      const esRolDeGrupo = GROUP_ROLE_SET.has(b.role);
      if (b.type === "group" && !esRolDeGrupo)
        v.push({ code: "I-25_GROUP_ROLE_MISMATCH", path: `blocks.${b.id}`, detail: `"${b.role}" no es un rol de grupo` });
      if (b.type !== "group" && esRolDeGrupo)
        v.push({ code: "I-25_GROUP_ROLE_MISMATCH", path: `blocks.${b.id}`, detail: `"${b.role}" está reservado a bloques group` });
      // I-26: rol singleton usado dos veces en el mismo manifiesto (hallazgo 1R A-10).
      if (SINGLETON_ROLE_SET.has(b.role)) {
        const antes = singletonSeen.get(b.role);
        if (antes) v.push({ code: "I-26_SINGLETON_ROLE_DUPLICATE", path: `blocks.${b.id}`, detail: `${b.role} ya lo usa ${antes}` });
        else singletonSeen.set(b.role, b.id);
      }
      if (b.type === "group") {
        if (b.min > b.max) v.push({ code: "I-07_GROUP_MIN_GT_MAX", path: `blocks.${b.id}` });
        const inner = new Set<string>();
        for (const ib of b.itemBlocks) {
          checkL10n(ib.label, `blocks.${b.id}.${ib.id}.label`);
          if (GROUP_ROLE_SET.has(ib.role))
            v.push({ code: "I-25_GROUP_ROLE_MISMATCH", path: `blocks.${b.id}.${ib.id}`, detail: `"${ib.role}" está reservado a bloques group` });
          if (inner.has(ib.id)) v.push({ code: "I-13_BLOCK_ID_DUPLICATE", path: `blocks.${b.id}.${ib.id}` });
          inner.add(ib.id);
          // I-22 (cierra el hallazgo adversarial E-04): un itemBlock nunca lee de negocio ni es fijo —
          // BusinessSnapshot no tiene ningún campo indexado por ítem, y R4 (01 §5.2) no define cómo
          // resolverlo; solo "user" tiene sentido dentro de un grupo repetible.
          if (ib.source !== "user") v.push({ code: "I-22_ITEM_BLOCK_SOURCE_NOT_USER", path: `blocks.${b.id}.${ib.id}` });
        }
      }
    }
  }
  if (!theme.palettes.some(p => p.id === theme.defaultPaletteId)) v.push({ code: "I-09_THEME_DEFAULT_UNKNOWN", path: "theme.defaultPaletteId" });
  if (!theme.fontSets.some(f => f.id === theme.defaultFontSetId)) v.push({ code: "I-09_THEME_DEFAULT_UNKNOWN", path: "theme.defaultFontSetId" });
  for (const key of Object.keys(defaults.content).sort()) {   // ordenado: el orden de claves de JSONB no es estable (1R A-08)
    const value = defaults.content[key];
    const spec = blockIds.get(key);
    if (!spec) { v.push({ code: "I-10_DEFAULT_KEY_UNKNOWN", path: `defaults.${key}` }); continue; }
    // I-28: un default para un bloque `business` es contenido muerto — R4 lo ignora siempre.
    if (spec.source === "business") { v.push({ code: "I-28_DEFAULT_FOR_BUSINESS_BLOCK", path: `defaults.${key}` }); continue; }
    v.push(...validateValueAgainstSpec(spec, value, `defaults.${key}`));
  }
  return v;
}

/**
 * I-24 — `reorderSections.order` debe ser una PERMUTACIÓN exacta de las claves visibles del documento.
 * El esquema solo comprueba `min(1).max(16)`: acepta `["cover","cover","cover"]` (hallazgo 1R A-04).
 * La ejecuta el reductor de operaciones ANTES de aplicar el lote (03 §3.3).
 */
export function validateReorder(order: string[], actuales: string[]): Violation[] {
  const a = [...order].sort(), b = [...actuales].sort();
  const igual = a.length === b.length && a.every((k, i) => k === b[i]);
  return igual ? [] : [{ code: "I-24_REORDER_NOT_A_PERMUTATION", path: "operations.reorderSections.order",
    detail: `esperaba una permutación de [${b.join(",")}]` }];
}

/** Invariantes del DOCUMENTO contra su versión de plantilla (se ejecutan en cada escritura). */
export function validateDocument(doc: InvitationDocument, m: TemplateManifest, theme: ThemeSpec): Violation[] {
  const v: Violation[] = [];
  // I-23 (cierra el hallazgo adversarial E-06): el locale elegido debe estar entre los que la
  // plantilla declara soportar (manifest.locales, 01 §2.2) — antes no se verificaba en absoluto.
  if (!m.locales.includes(doc.meta.locale)) v.push({ code: "I-23_LOCALE_NOT_SUPPORTED", path: "meta.locale" });
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
  for (const key of Object.keys(doc.content).sort()) {   // ordenado (1R A-08)
    const value = doc.content[key];
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
  // `!=` en ASCII, no `≠`: `Invariants.kt:310` emite `"${value.kind.wire} != ${spec.type.wire}"` y las dos
  // implementaciones de la misma invariante tienen que decir lo mismo (P1, `contratos.md` §3). Divergían
  // en este único carácter desde el bloque 2-2 (objeción O-11, `preguntas-abiertas.md`) y ninguna prueba
  // lo detecta porque `detail` no entra en ningún golden. Se mueve el lado de TypeScript porque
  // `templates2/schema` estaba congelado para quien lo encontró (2-ADV, objeción ADV-13).
  if (value.kind !== spec.type) return [{ code: "I-15_BLOCK_KIND_MISMATCH", path, detail: `${value.kind} != ${spec.type}` }];
  switch (spec.type) {
    case "text": {
      const s = value.value as string;
      if (s.length > spec.constraints.maxLength || s.length < spec.constraints.minLength) v.push({ code: "I-16_TEXT_TOO_LONG", path });
      // I-30 (X-06): `multiline: false` prohíbe saltos de línea en el valor. Antes era una constraint
      // declarada que no comprobaba nadie: el editor pintaba un <input>, pero la API y la IA escriben
      // sin pasar por él y un "\n" rompe la maquetación de la sección.
      if (!spec.constraints.multiline && /[\r\n]/.test(s)) v.push({ code: "I-30_TEXT_MULTILINE_NOT_ALLOWED", path });
      break;
    }
    case "richText": {
      // 1R A-02: `spec.constraints.maxLength` de richText no se validaba en NINGÚN sitio; un relato de
      // 8000 caracteres pasaba contra un spec de 600. Se mide sobre el texto plano, no sobre el JSON.
      const doc = value.doc as { content?: Array<{ content?: Array<{ text?: string }> }> };
      if (richTextLength(doc) > spec.constraints.maxLength) v.push({ code: "I-16_TEXT_TOO_LONG", path });
      break;
    }
    case "listText": {
      const items = value.items as string[];
      if (items.length > spec.constraints.maxItems || items.length < spec.constraints.minItems) v.push({ code: "I-04_GROUP_SIZE_OUT_OF_BOUNDS", path });
      if (items.some(i => i.length > spec.constraints.maxItemLength)) v.push({ code: "I-16_TEXT_TOO_LONG", path });
      break;
    }
    case "dateTimeRange": {
      const { start, end } = value as unknown as { start: string; end?: string };
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

/**
 * Las 30 invariantes en una sola llamada (`01 §6.5`). Devuelve la lista vacía si todo está bien;
 * **nunca lanza**. Espejo exacto de `Invariants.validateInvariants` de Kotlin: `raw` (el JSON crudo,
 * tal cual llegaría por HTTP) solo se recorre si se aporta, porque I-29 corre **antes** de `parse`
 * (contratos.md §3). Sin ella, `migrate()` (`01 §6.3`) no podía cumplir su regla dura de terminar
 * validando el documento resultante.
 */
export function validateInvariants(
  doc: InvitationDocument, pkg: { manifest: TemplateManifest; theme: ThemeSpec }, raw?: unknown,
): Violation[] {
  const v: Violation[] = [];
  if (raw !== undefined) v.push(...assertNoReservedKeys(raw));
  v.push(...validateDocument(doc, pkg.manifest, pkg.theme));
  return v;
}
