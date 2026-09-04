// packages/schema/src/compose.ts — implementación de referencia de compose() (01 §5).
// PURA: sin reloj, sin Intl, sin Locale.getDefault(), sin E/S, sin aleatoriedad (R6).
// Es la especificación ejecutable que la implementación Kotlin debe reproducir bit a bit sobre los golden files.
import type { TemplateManifest, SectionSpec, ThemeSpec, DefaultsFile } from "./manifest.ts";
import type { InvitationDocument } from "./document.ts";
import type { BlockSpec, GroupSpec, BlockValue, ScalarValue } from "./blocks.ts";
import type { BusinessSnapshot, AssetIndex, CompositionResult, CompositionReport } from "./composed.ts";
import type { Locale } from "./common.ts";

export type TemplatePackage = { manifest: TemplateManifest; theme: ThemeSpec; defaults: DefaultsFile };

// --- formateo determinista (sin Intl: ICU difiere entre JVM y Node y rompería R9) ---
const MESES: Record<Locale, string[]> = {
  "es-MX": ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
  "es-ES": ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],
  "en-US": ["January","February","March","April","May","June","July","August","September","October","November","December"],
};
function fLong(d: string, loc: Locale): string {
  const [y, m, day] = d.split("-").map(Number);
  return loc === "en-US" ? `${MESES[loc][m - 1]} ${day}, ${y}` : `${day} de ${MESES[loc][m - 1]} de ${y}`;
}
function fMonthYear(d: string, loc: Locale): string {
  const [y, m] = d.split("-").map(Number);
  return loc === "en-US" ? `${MESES[loc][m - 1]} ${y}` : `${MESES[loc][m - 1]} de ${y}`;
}
function fH12(t: string): string {
  const [H, M] = t.split(":").map(Number);
  const h = H % 12 === 0 ? 12 : H % 12;
  return `${h}:${String(M).padStart(2, "0")} ${H < 12 ? "am" : "pm"}`;
}
export function formatDate(value: string, formatId: string, loc: Locale): string {
  switch (formatId) {
    case "long": return fLong(value, loc);
    case "month-year": return fMonthYear(value, loc);
    case "h12": return fH12(value);
    case "iso": return value;
    default: return fLong(value, loc);       // formatId desconocido → "long" (y se registra fuera)
  }
}
export function formatRange(start: string, end: string | undefined, formatId: string, loc: Locale): string {
  const [ds, ts] = start.split("T");
  const head = `${fLong(ds, loc)}, ${fH12(ts)}`;
  if (!end) return head;
  const [de, te] = end.split("T");
  return de === ds ? `${head} – ${fH12(te)}` : `${head} – ${fLong(de, loc)}, ${fH12(te)}`;
}

const L = (m: Record<string, string | undefined>, loc: Locale): string => m[loc] ?? m["es-MX"]!;
const assetUrl = (idx: AssetIndex, assetId: string): string | null => idx[assetId]?.url ?? null;

function resolveScalar(spec: BlockSpec, v: ScalarValue, assets: AssetIndex, loc: Locale): any | null {
  switch (v.kind) {
    case "text": return { kind: "text", value: v.value };
    case "richText": return { kind: "richText", doc: v.doc };
    case "listText": return { kind: "listText", items: v.items };
    case "image": { const u = assetUrl(assets, v.assetId); return u === null ? null : { kind: "image", url: u, alt: v.alt, focal: v.focal }; }
    case "audio": { const u = assetUrl(assets, v.assetId); return u === null ? null : { kind: "audio", url: u }; }
    case "date": return { kind: "date", value: v.value, formatted: formatDate(v.value, (spec as any).formatId ?? "long", loc) };
    case "time": return { kind: "time", value: v.value, formatted: formatDate(v.value, (spec as any).formatId ?? "h12", loc) };
    case "dateTimeRange": {
      const o: any = { kind: "dateTimeRange", start: v.start };
      if (v.end !== undefined) o.end = v.end;
      o.formatted = formatRange(v.start, v.end, (spec as any).formatId ?? "long-h12", loc);
      return o;
    }
    case "link": { const o: any = { kind: "link", href: v.href }; if (v.label !== undefined) o.label = v.label; return o; }
    case "location": { const o: any = { kind: "location", name: v.name }; if (v.address !== undefined) o.address = v.address; if (v.mapHref !== undefined) o.mapHref = v.mapHref; return o; }
    case "choice": { const opt = (spec as any).options?.find((o: any) => o.id === v.optionId); return { kind: "choice", optionId: v.optionId, label: opt ? L(opt.label, loc) : v.optionId }; }
    case "boolean": return { kind: "boolean", value: v.value };
    case "person": { const o: any = { kind: "person", name: v.name }; if (v.note !== undefined) o.note = v.note; return o; }
  }
}

function businessValue(spec: BlockSpec, b: BusinessSnapshot, assets: AssetIndex, loc: Locale): any | null {
  switch ((spec as any).businessField) {
    case "invitation.date": return b.date === null ? null : { kind: "date", value: b.date, formatted: formatDate(b.date, (spec as any).formatId ?? "long", loc) };
    case "invitation.time": return b.time === null ? null : { kind: "time", value: b.time, formatted: formatDate(b.time, (spec as any).formatId ?? "h12", loc) };
    case "invitation.hashtag": return b.hashtag === null ? null : { kind: "text", value: b.hashtag };
    case "invitation.coverPhotoUrl": return b.coverPhotoUrl === null ? null : { kind: "image", url: b.coverPhotoUrl, alt: "", focal: { x: 0.5, y: 0.5 } };
    case "invitation.childrenAllowed": return { kind: "boolean", value: b.childrenAllowed };
    case "invitation.youngAllowed": return { kind: "boolean", value: b.youngAllowed };
    default: return null;
  }
}

export function compose(pkg: TemplatePackage, doc: InvitationDocument, business: BusinessSnapshot,
                        assets: AssetIndex, locale: Locale): CompositionResult {
  const m = pkg.manifest;
  const rep: CompositionReport = { missingRequired: [], stillDefault: [], orphanContent: [], orphanSections: [], invalidValues: [], themeFallback: null };

  // R8 — tema
  let paletteId = doc.theme.paletteId, fontSetId = doc.theme.fontSetId;
  const tf: { paletteId?: string; fontSetId?: string } = {};
  let pal = pkg.theme.palettes.find(p => p.id === paletteId);
  if (!pal) { tf.paletteId = paletteId; paletteId = pkg.theme.defaultPaletteId; pal = pkg.theme.palettes.find(p => p.id === paletteId)!; }
  let fs = pkg.theme.fontSets.find(f => f.id === fontSetId);
  if (!fs) { tf.fontSetId = fontSetId; fontSetId = pkg.theme.defaultFontSetId; fs = pkg.theme.fontSets.find(f => f.id === fontSetId)!; }
  if (tf.paletteId || tf.fontSetId) rep.themeFallback = tf;

  // R1 — estructura: el orden de doc.structure manda; las secciones del manifiesto ausentes se anexan
  const porClave = new Map(m.sections.map(s => [s.key, s] as const));
  const vistas = new Set<string>();
  const orden: Array<{ spec: SectionSpec; variant: string; visible: boolean }> = [];
  for (const e of doc.structure.sections) {
    const spec = porClave.get(e.key);
    if (!spec) { rep.orphanSections.push(e.key); continue; }          // R1: desconocida → informe, no se renderiza
    if (vistas.has(e.key)) continue;                                   // I-11 lo rechaza antes; aquí gana la primera
    vistas.add(e.key);
    orden.push({ spec, variant: spec.variants.includes(e.variant) ? e.variant : spec.defaultVariant,
                 visible: spec.required ? true : e.visible });         // I-17: required nunca oculta
  }
  // R1c — una sección del manifiesto ausente de doc.structure se INSERTA en su posición relativa del
  // manifiesto (justo detrás del último predecesor del manifiesto que sí está presente), nunca al final:
  // si no, una versión nueva que añade una sección la colocaría después del pie. Determinista (R9).
  for (let i = 0; i < m.sections.length; i++) {
    const s = m.sections[i];
    if (vistas.has(s.key)) continue;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = orden.findIndex(o => o.spec.key === m.sections[j].key);
      if (k >= 0) { pos = k + 1; break; }
    }
    orden.splice(pos, 0, { spec: s, variant: s.defaultVariant, visible: s.defaultVisible });
    vistas.add(s.key);
  }

  // R1bis — claves de content no declaradas → informe (ordenadas: R9, el orden de claves de JSONB no es estable)
  const declarados = new Set<string>();
  for (const s of m.sections) for (const b of s.blocks) declarados.add(b.id);
  rep.orphanContent = Object.keys(doc.content).filter(k => !declarados.has(k)).sort();

  const sections = orden.map(({ spec, variant, visible }) => ({
    key: spec.key, type: spec.type, variant, visible, title: L(spec.title, locale),
    blocks: spec.blocks.map(b => componerBloque(b, spec)),
  }));

  function componerBloque(b: BlockSpec, sec: SectionSpec): any {
    const label = L(b.label, locale);
    if (b.type === "group") {
      const g = b as GroupSpec;
      const del = doc.content[b.id] as BlockValue | undefined;
      const def = pkg.defaults.content[b.id] as BlockValue | undefined;
      const fuente = del?.kind === "group" ? del : def?.kind === "group" ? def : undefined;
      const prov = del?.kind === "group" ? "user" : def?.kind === "group" ? "default" : "empty";
      const items = (fuente?.items ?? []).map(it => ({
        itemId: it.itemId,
        blocks: g.itemBlocks.map(ib => {                                 // R9: orden = orden del spec, no del JSON
          const v = it.values[ib.id];
          const resolved = v === undefined ? null : resolveScalar(ib, v, assets, locale);
          return { id: ib.id, role: ib.role, type: ib.type, label: L(ib.label, locale),
                   provenance: resolved === null ? "empty" : prov, value: resolved };
        }),
      }));
      if (b.required && items.length === 0) rep.missingRequired.push(b.id);
      if (b.required && prov === "default") rep.stillDefault.push(b.id);
      return { id: b.id, role: b.role, type: "group", label, provenance: prov, items };
    }
    // R4 — negocio por rol: ignora doc.content por completo
    if (b.source === "business") {
      const v = businessValue(b, business, assets, locale);
      if (v === null) { if (b.required) rep.missingRequired.push(b.id); return { id: b.id, role: b.role, type: b.type, label, provenance: "empty", value: null }; }
      return { id: b.id, role: b.role, type: b.type, label, provenance: "business", value: v };
    }
    // R2 — tres escalones: user → default → empty. `fixed` solo puede venir de defaults.
    const del = b.source === "fixed" ? undefined : (doc.content[b.id] as ScalarValue | undefined);
    const def = pkg.defaults.content[b.id] as ScalarValue | undefined;
    const src = del ?? def;
    let prov: string = del !== undefined ? "user" : def !== undefined ? (b.source === "fixed" ? "fixed" : "default") : "empty";
    const value = src === undefined ? null : resolveScalar(b, src, assets, locale);
    if (value === null) prov = "empty";
    if (b.required && value === null) rep.missingRequired.push(b.id);
    if (b.required && prov === "default") rep.stillDefault.push(b.id);
    return { id: b.id, role: b.role, type: b.type, label, provenance: prov, value };
  }

  rep.missingRequired.sort(); rep.stillDefault.sort(); rep.orphanSections.sort();
  return {
    composed: { composedVersion: 1, template: { slug: m.slug, version: m.version }, locale,
      theme: { paletteId, fontSetId, tokens: pal.tokens, fonts: { heading: fs.heading, body: fs.body } },
      sections },
    report: rep,
  } as CompositionResult;
}

/** JSON canónico (RFC 8785 simplificado): claves ordenadas por code unit, sin espacios, sin claves undefined. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  const ks = Object.keys(o).filter(k => o[k] !== undefined).sort();
  return "{" + ks.map(k => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}
