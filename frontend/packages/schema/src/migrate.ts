// packages/schema/src/migrate.ts — migración de versión (01 §6.1-§6.3) y cambio de plantilla (01 §6.4).
// PURA: mismo documento + mismo plan → mismo resultado. NUNCA lanza: todo fallo es un `MigrationError`
// tipado. NADA se borra jamás: lo que pierde destino va al `attic`, indexado por `<slug>@<version>` de
// ORIGEN (ADR-006), que nunca se poda automáticamente.
import type { InvitationDocument } from "./document.ts";
import type { BlockSpec, BlockValue, GroupValue, ScalarValue } from "./blocks.ts";
import type { MigrationPlan, TemplateManifest } from "./manifest.ts";
import type { TemplatePackage } from "./compose.ts";
import { validateInvariants, type Violation } from "./invariants.ts";
import { SINGLETON_ROLES } from "./blocks.ts";

export type MigrationReport = {
  applied: Array<{ op: string; target: string }>;
  moved: Array<{ from: string; to: string }>;
  toAttic: Array<{ blockId: string; reason: "removeBlock" | "removeSection" | "shrinkGroup" | "typeChangeUnsupported" }>;
  converted: Array<{ blockId: string; converterId: string }>;
  lossless: boolean;
};

export type MigrationError =
  | { code: "MIG_PLAN_VERSION_MISMATCH"; expected: string; got: string }
  | { code: "MIG_TARGET_BLOCK_UNKNOWN"; op: string; blockId: string }
  | { code: "MIG_TARGET_BLOCK_EXISTS"; op: string; blockId: string }
  | { code: "MIG_CONVERTER_UNSUPPORTED"; from: string; to: string }
  | { code: "MIG_RESULT_INVALID"; violations: Violation[] };

export type MigrationResult =
  | { ok: true; doc: InvitationDocument; report: MigrationReport }
  | { ok: false; error: MigrationError };

const clone = <T>(v: T): T => structuredClone(v);
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Fuente de `itemId` **determinista** para `moveIntoGroup`, que crea un ítem nuevo (`01 §6.2`).
 * `01 §6.1` fija `migrate` con cuatro parámetros y `§6.3` exige que sea pura: un ULID de reloj rompería
 * lo segundo. Los `itemId` solo tienen que ser únicos DENTRO de su grupo (I-03), así que un contador
 * basta; el 5.º parámetro queda opcional para que producción pueda inyectar `UlidGenerator` si algún
 * día quiere ids opacos también aquí.
 */
export function deterministicUlids(prefijo = "01JMGRAT"): () => string {
  let n = 0;
  return () => {
    let cola = "";
    let x = n++;
    for (let i = 0; i < 26 - prefijo.length; i++) { cola = CROCKFORD[x % 32] + cola; x = Math.floor(x / 32); }
    return prefijo + cola;
  };
}

const bloquesDe = (m: TemplateManifest): Map<string, BlockSpec> => {
  const r = new Map<string, BlockSpec>();
  for (const s of m.sections) for (const b of s.blocks) r.set(b.id, b);
  return r;
};
const esGrupo = (v: BlockValue | undefined): v is GroupValue => v?.kind === "group";

/** Trunca por límite de palabra (`01 §6.2`, converters `richTextToText` y `listTextToText`). */
function truncarPorPalabra(s: string, max: number): string {
  if (s.length <= max) return s;
  const corte = s.slice(0, max);
  const i = corte.lastIndexOf(" ");
  return (i > 0 ? corte.slice(0, i) : corte).trimEnd();
}
function textoPlano(doc: { content: Array<{ content: Array<{ text: string }> }> }): string {
  return doc.content.map(p => p.content.map(s => s.text).join("")).join("\n\n");
}

/** Los CUATRO convertidores de `01 §6.2`. Ningún otro existe. */
function convertir(v: ScalarValue, converterId: string, maxDestino: number): ScalarValue | null {
  switch (converterId) {
    case "textToRichText":
      if (v.kind !== "text") return null;
      return { kind: "richText", doc: { type: "doc", content: [{ type: "paragraph", content: v.value === "" ? [] : [{ type: "text", text: v.value }] }] } };
    case "richTextToText": {
      if (v.kind !== "richText") return null;
      return { kind: "text", value: truncarPorPalabra(textoPlano(v.doc), maxDestino) };
    }
    case "textToListText":
      if (v.kind !== "text") return null;
      return { kind: "listText", items: v.value === "" ? [] : [v.value] };
    case "listTextToText":
      if (v.kind !== "listText") return null;
      return { kind: "text", value: truncarPorPalabra(v.items.join(", "), maxDestino) };
    default:
      return null;
  }
}
const maxTextoDe = (spec: BlockSpec | undefined): number =>
  spec?.type === "text" ? spec.constraints.maxLength : spec?.type === "richText" ? spec.constraints.maxLength : 2000;

// ---------------------------------------------------------------------------------------------
// migrate — 01 §6.1
// ---------------------------------------------------------------------------------------------

export function migrate(
  doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage, plan: MigrationPlan,
  newUlid: () => string = deterministicUlids(),
): MigrationResult {
  const esperado = `${from.manifest.version}->${to.manifest.version}`;
  const recibido = `${plan.from}->${plan.to}`;
  if (plan.templateSlug !== to.manifest.slug || esperado !== recibido)
    return { ok: false, error: { code: "MIG_PLAN_VERSION_MISMATCH", expected: `${to.manifest.slug}:${esperado}`, got: `${plan.templateSlug}:${recibido}` } };

  const d = clone(doc);
  const origen = bloquesDe(from.manifest);
  const destino = bloquesDe(to.manifest);
  const seccionesDestino = new Set(to.manifest.sections.map(s => s.key));
  const atticKey = `${from.manifest.slug}@${from.manifest.version}`;
  const rep: MigrationReport = { applied: [], moved: [], toAttic: [], converted: [], lossless: true };

  const alAttic = (blockId: string, value: BlockValue, reason: MigrationReport["toAttic"][number]["reason"]) => {
    if (!d.attic[atticKey]) d.attic[atticKey] = {};
    d.attic[atticKey]![blockId] = value;
    rep.toAttic.push({ blockId, reason });
  };

  for (const op of plan.ops) {
    switch (op.op) {
      case "renameBlock": {
        if (!origen.has(op.from)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.from } };
        if (!destino.has(op.to)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.to } };
        if (d.content[op.to] !== undefined) return { ok: false, error: { code: "MIG_TARGET_BLOCK_EXISTS", op: op.op, blockId: op.to } };
        const v = d.content[op.from];
        if (v !== undefined) { d.content[op.to] = v; delete d.content[op.from]; rep.moved.push({ from: op.from, to: op.to }); }
        rep.applied.push({ op: op.op, target: op.from });
        break;
      }
      case "removeBlock": {
        if (!origen.has(op.id)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.id } };
        const v = d.content[op.id];
        if (v !== undefined) { alAttic(op.id, v, "removeBlock"); delete d.content[op.id]; }
        rep.applied.push({ op: op.op, target: op.id });
        break;
      }
      case "addBlock": {
        if (!destino.has(op.id)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.id } };
        rep.applied.push({ op: op.op, target: op.id });   // no toca content: tomará su default (R2)
        break;
      }
      case "renameSection": {
        if (!seccionesDestino.has(op.to)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.to } };
        for (const e of d.structure.sections) if (e.key === op.from) e.key = op.to;
        rep.applied.push({ op: op.op, target: op.from });
        break;
      }
      case "removeSection": {
        const sec = from.manifest.sections.find(s => s.key === op.key);
        if (!sec) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.key } };
        d.structure.sections = d.structure.sections.filter(e => e.key !== op.key);
        for (const b of sec.blocks) {
          const v = d.content[b.id];
          if (v !== undefined) { alAttic(b.id, v, "removeSection"); delete d.content[b.id]; }
        }
        rep.applied.push({ op: op.op, target: op.key });
        break;
      }
      case "renamePalette": {
        if (!to.theme.palettes.some(p => p.id === op.to)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.to } };
        if (d.theme.paletteId === op.from) d.theme.paletteId = op.to;
        rep.applied.push({ op: op.op, target: op.from });
        break;
      }
      case "renameFontSet": {
        if (!to.theme.fontSets.some(f => f.id === op.to)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.to } };
        if (d.theme.fontSetId === op.from) d.theme.fontSetId = op.to;
        rep.applied.push({ op: op.op, target: op.from });
        break;
      }
      case "changeBlockType": {
        if (!destino.has(op.id)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.id } };
        const v = d.content[op.id];
        rep.applied.push({ op: op.op, target: op.id });
        if (v === undefined) break;
        if (esGrupo(v)) return { ok: false, error: { code: "MIG_CONVERTER_UNSUPPORTED", from: "group", to: op.converterId } };
        const convertido = convertir(v, op.converterId, maxTextoDe(destino.get(op.id)));
        if (convertido === null) return { ok: false, error: { code: "MIG_CONVERTER_UNSUPPORTED", from: v.kind, to: op.converterId } };
        d.content[op.id] = convertido;
        rep.converted.push({ blockId: op.id, converterId: op.converterId });
        break;
      }
      case "moveIntoGroup": {
        const g = destino.get(op.groupId);
        if (!g || g.type !== "group") return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.groupId } };
        if (!g.itemBlocks.some(b => b.id === op.itemBlockId)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.itemBlockId } };
        const v = d.content[op.blockId];
        rep.applied.push({ op: op.op, target: op.blockId });
        if (v === undefined) break;
        if (esGrupo(v)) return { ok: false, error: { code: "MIG_CONVERTER_UNSUPPORTED", from: "group", to: op.itemBlockId } };
        const actual = d.content[op.groupId];
        const items = esGrupo(actual) ? clone(actual.items) : [];
        items.push({ itemId: newUlid(), values: { [op.itemBlockId]: v } });
        d.content[op.groupId] = { kind: "group", items };
        delete d.content[op.blockId];
        rep.moved.push({ from: op.blockId, to: `${op.groupId}.${op.itemBlockId}` });
        break;
      }
      case "flattenGroup": {
        if (!destino.has(op.toBlockId)) return { ok: false, error: { code: "MIG_TARGET_BLOCK_UNKNOWN", op: op.op, blockId: op.toBlockId } };
        const g = d.content[op.groupId];
        rep.applied.push({ op: op.op, target: op.groupId });
        if (!esGrupo(g) || g.items.length === 0) { delete d.content[op.groupId]; break; }
        const primero = g.items[0]!.values[op.itemBlockId];
        if (primero !== undefined) {
          if (d.content[op.toBlockId] !== undefined) return { ok: false, error: { code: "MIG_TARGET_BLOCK_EXISTS", op: op.op, blockId: op.toBlockId } };
          d.content[op.toBlockId] = primero;
          rep.moved.push({ from: `${op.groupId}.${op.itemBlockId}`, to: op.toBlockId });
        }
        // Los ítems 1..n van al attic COMPLETOS, con su itemId (01 §6.2). `reason` es un enum cerrado
        // de cuatro valores y no tiene "flattenGroup": el bloque de grupo desaparece del destino, así
        // que la razón exacta es `removeBlock`.
        const resto = g.items.slice(1);
        delete d.content[op.groupId];
        if (resto.length > 0) alAttic(op.groupId, { kind: "group", items: resto }, "removeBlock");
        break;
      }
      case "shrinkGroup": {
        const g = d.content[op.groupId];
        rep.applied.push({ op: op.op, target: op.groupId });
        if (!esGrupo(g)) break;
        if (g.items.length <= op.max) break;
        const sobra = g.items.slice(op.max);
        d.content[op.groupId] = { kind: "group", items: g.items.slice(0, op.max) };
        alAttic(op.groupId, { kind: "group", items: sobra }, "shrinkGroup");
        break;
      }
    }
  }

  // 01 §6.3 — bloque eliminado SIN operación en el plan: va al attic igual, anotado como `removeBlock`.
  // Un plan incompleto degrada la calidad del informe, nunca destruye contenido.
  for (const key of Object.keys(d.content).sort()) {
    if (destino.has(key)) continue;
    alAttic(key, d.content[key]!, "removeBlock");
    delete d.content[key];
  }
  // Secciones que la versión destino ya no declara.
  d.structure.sections = d.structure.sections.filter(e => seccionesDestino.has(e.key));
  d.template = { slug: to.manifest.slug, version: to.manifest.version };

  rep.lossless = rep.toAttic.length === 0 && rep.converted.length === 0;

  // Regla dura de §6.3: termina validando contra I-01…I-30. Si no pasa, no se escribe nada.
  const violaciones = validateInvariants(d, to);
  if (violaciones.length > 0) return { ok: false, error: { code: "MIG_RESULT_INVALID", violations: violaciones } };
  return { ok: true, doc: d, report: rep };
}

// ---------------------------------------------------------------------------------------------
// switchTemplate — 01 §6.4 (lo ejecuta `:choose-template` al cambiar de plantilla)
// ---------------------------------------------------------------------------------------------

export type SwitchReport = {
  matchedByRole: Array<{ fromBlockId: string; toBlockId: string; role: string }>;
  toAttic: string[];
  reset: string[];
};

const SINGLETON: ReadonlySet<string> = new Set<string>(SINGLETON_ROLES);

/**
 * Transporta **solo por rol singleton** y del **mismo `type`** (ADR-1R-D-07). Los grupos NUNCA se
 * transportan: un `eventCards` de otra plantilla tiene otros `itemBlocks` y copiar ítems produciría
 * ítems medio vacíos — que es exactamente el pecado de H-01. Todo lo demás va al `attic`.
 */
export function switchTemplate(
  doc: InvitationDocument, from: TemplatePackage, to: TemplatePackage,
): { doc: InvitationDocument; report: SwitchReport } {
  const atticKey = `${from.manifest.slug}@${from.manifest.version}`;
  const origen = bloquesDe(from.manifest);
  const destino = bloquesDe(to.manifest);
  const rep: SwitchReport = { matchedByRole: [], toAttic: [], reset: [] };

  // Rol singleton → bloque, en los dos paquetes. I-26 garantiza como mucho uno por manifiesto.
  const porRolOrigen = new Map<string, BlockSpec>();
  for (const b of origen.values()) if (SINGLETON.has(b.role) && !porRolOrigen.has(b.role)) porRolOrigen.set(b.role, b);
  const porRolDestino = new Map<string, BlockSpec>();
  for (const b of destino.values()) if (SINGLETON.has(b.role) && !porRolDestino.has(b.role)) porRolDestino.set(b.role, b);

  const contenido: Record<string, BlockValue> = {};
  const transportados = new Set<string>();
  for (const rol of [...porRolOrigen.keys()].sort()) {
    const a = porRolOrigen.get(rol)!;
    const b = porRolDestino.get(rol);
    if (!b || a.type !== b.type || a.type === "group") continue;   // regla 4: los grupos, nunca
    const v = doc.content[a.id];
    if (v === undefined) continue;
    contenido[b.id] = clone(v);
    transportados.add(a.id);
    rep.matchedByRole.push({ fromBlockId: a.id, toBlockId: b.id, role: rol });
  }

  const attic = clone(doc.attic);
  const guardados: Record<string, BlockValue> = { ...(attic[atticKey] ?? {}) };
  for (const key of Object.keys(doc.content).sort()) {
    if (transportados.has(key)) continue;
    guardados[key] = clone(doc.content[key]!);
    rep.toAttic.push(key);
  }
  if (Object.keys(guardados).length > 0) attic[atticKey] = guardados;

  rep.reset = [...destino.keys()].filter(id => contenido[id] === undefined).sort();

  const nuevo: InvitationDocument = {
    schemaVersion: 1,
    template: { slug: to.manifest.slug, version: to.manifest.version },
    // Regla 2: los ids de paleta son de la plantilla; conservarlos sería casualidad.
    theme: { paletteId: to.theme.defaultPaletteId, fontSetId: to.theme.defaultFontSetId },
    // Regla 1: `structure` se descarta entera y se reconstruye desde `to.manifest`.
    structure: { sections: to.manifest.sections.map(s => ({ key: s.key, variant: s.defaultVariant, visible: s.required ? true : s.defaultVisible })) },
    content: contenido,
    attic,
    meta: { locale: to.manifest.locales.includes(doc.meta.locale) ? doc.meta.locale : to.manifest.locales[0]! },
  };
  return { doc: nuevo, report: rep };
}
