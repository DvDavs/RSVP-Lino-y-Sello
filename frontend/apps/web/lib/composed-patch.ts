// lib/composed-patch.ts — parche OPTIMISTA sobre el `ComposedDocument` (04 §10.3 columna "Parche
// optimista", §12.4 puntos 3-5). Módulo puro; `lib/store.ts` es su único consumidor.
//
// POR QUÉ EXISTE COMO ARCHIVO APARTE (y no dentro de `store.ts`): es la única parte del núcleo que
// no toca estado global — son funciones sobre un `ComposedDocument`. Aisladas se prueban sin montar
// zustand, y `store.ts` se queda en lo suyo (ciclo de vida, colas, pilas).
//
// LÍMITE DURO, DECLARADO (04 §12.4 "Bloques cuya representación no se puede calcular en el cliente"):
// hay valores que el cliente NO puede resolver sin duplicar lógica del servidor, y duplicarla
// reintroduciría exactamente H-27 (dos formateadores que divergen):
//   · `date`/`time`/`dateTimeRange` → `formatted` lo produce `formatDate(value, formatId, locale)`
//     en el servidor (R6, `01 §5.2`);
//   · `image`/`audio` → `ResolvedValue` exige una `url` del CDN y el documento solo guarda `assetId`
//     (ADR-021, ADR-1R-D-01: el `AssetIndex` es entrada de `compose`, del lado servidor);
//   · `choice` → `ResolvedValue.label` sale de `ChoiceSpec.options` del MANIFIESTO, que hoy ninguna
//     de las 19 rutas devuelve al cliente (ver `preguntas-abiertas.md`, «Fase 3 · 3-4»).
// Para esos seis tipos NO se parchea: el bloque entra en `pendingBlocks`, el lienzo lo pinta con el
// valor anterior y `aria-busy="true"` hasta que llega la respuesta. Nada se descarta en silencio (P1).
import type {
  ComposedDocument,
  Operation,
  ThemeSpec as ThemeSpecType,
  ComposedBlock as ComposedBlockSchema,
  ComposedGroup as ComposedGroupSchema,
  ComposedSection as ComposedSectionSchema,
} from "@invitaciones/schema";

// `@invitaciones/schema` exporta estos tres solo como VALOR (el esquema Zod), sin su `export type`
// (`composed.ts`). Se derivan igual que en `packages/sections/src/schema-types.ts`, sin tocar el
// paquete (es de solo lectura para este bloque).
export type ComposedBlock = ReturnType<typeof ComposedBlockSchema.parse>;
export type ComposedGroup = ReturnType<typeof ComposedGroupSchema.parse>;
export type ComposedSection = ReturnType<typeof ComposedSectionSchema.parse>;

type ScalarValue = Extract<Operation, { op: "setBlock" }>["value"];
type ResolvedValue = ComposedBlock["value"];
type Provenance = ComposedBlock["provenance"];

/** Referencia estable a un bloque; misma forma que `BlockRef` de `@invitaciones/schema/canvas`. */
export interface BlockRef {
  readonly sectionKey: string;
  readonly blockId: string;
  readonly itemId?: string;
  readonly itemBlockId?: string;
}

/** Clave de `pendingBlocks` y de los mapas del panel. Idéntica a `refKey` de `@invitaciones/sections`. */
export function refKey(ref: BlockRef): string {
  return [ref.sectionKey, ref.blockId, ref.itemId ?? "", ref.itemBlockId ?? ""].join("::");
}

/** Entrada del mensaje `PATCH` (04 §9.3). */
export interface PatchEntry {
  ref: BlockRef;
  value: ResolvedValue;
  provenance: Provenance;
  pending: boolean;
}

/** Resultado de aplicar una operación al `composed` local. */
export interface PatchResult {
  /** Deltas escalares que viajan como `PATCH` al lienzo. */
  entries: PatchEntry[];
  /** Claves (`refKey`) que quedan a la espera de la verdad del servidor (§12.4). */
  pending: string[];
  /** `true` si la operación es estructural y exige `RENDER` completo en vez de `PATCH` (04 §9.3). */
  structural: boolean;
}

const VACIO: PatchResult = Object.freeze({ entries: [], pending: [], structural: false });

// ---------------------------------------------------------------------------------------------
// Resolución local de un `ScalarValue` a `ResolvedValue`
// ---------------------------------------------------------------------------------------------

/**
 * `null` significa "no se puede resolver sin el servidor" (ver la cabecera). No es un error ni un
 * fallo silencioso: el llamador marca el bloque como pendiente y lo dice en la interfaz.
 */
export function resolveScalarLocally(value: ScalarValue): ResolvedValue | null {
  switch (value.kind) {
    case "text":
      return { kind: "text", value: value.value };
    case "richText":
      return { kind: "richText", doc: value.doc };
    case "listText":
      return { kind: "listText", items: [...value.items] };
    case "link":
      return value.label === undefined
        ? { kind: "link", href: value.href }
        : { kind: "link", href: value.href, label: value.label };
    case "location": {
      const out: Extract<ResolvedValue, { kind: "location" }> = { kind: "location", name: value.name };
      if (value.address !== undefined) out.address = value.address;
      if (value.mapHref !== undefined) out.mapHref = value.mapHref;
      return out;
    }
    case "boolean":
      return { kind: "boolean", value: value.value };
    case "person":
      return value.note === undefined
        ? { kind: "person", name: value.name }
        : { kind: "person", name: value.name, note: value.note };
    // Los seis que NO se pueden resolver en el cliente (§12.4).
    case "image":
    case "audio":
    case "date":
    case "time":
    case "dateTimeRange":
    case "choice":
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Búsqueda dentro del documento compuesto
// ---------------------------------------------------------------------------------------------

/**
 * `ComposedBlock.type` es `BlockKind` COMPLETO (incluye el literal `"group"` aunque el dominio no
 * lo produzca ahí, `01 §2.5`), así que `b.type === "group"` NO narrowea de forma fiable. Se
 * distingue por la presencia de `items`, que sí es exclusiva de `ComposedGroup` — mismo criterio
 * que `packages/sections/src/schema-types.ts`.
 */
function esGrupo(b: ComposedBlock | ComposedGroup): b is ComposedGroup {
  return "items" in b;
}

export interface BlockLocation {
  section: ComposedSection;
  block: ComposedBlock;
}

export function findBlock(composed: ComposedDocument, blockId: string): BlockLocation | null {
  for (const section of composed.sections) {
    for (const b of section.blocks) {
      if (!esGrupo(b) && b.id === blockId) return { section, block: b };
    }
  }
  return null;
}

export interface GroupLocation {
  section: ComposedSection;
  group: ComposedGroup;
}

export function findGroup(composed: ComposedDocument, groupId: string): GroupLocation | null {
  for (const section of composed.sections) {
    for (const b of section.blocks) {
      if (esGrupo(b) && b.id === groupId) return { section, group: b };
    }
  }
  return null;
}

export function findItemBlock(
  composed: ComposedDocument,
  groupId: string,
  itemId: string,
  blockId: string,
): { section: ComposedSection; group: ComposedGroup; block: ComposedBlock } | null {
  const g = findGroup(composed, groupId);
  if (!g) return null;
  const item = g.group.items.find((i) => i.itemId === itemId);
  if (!item) return null;
  const block = item.blocks.find((b) => b.id === blockId);
  if (!block) return null;
  return { section: g.section, group: g.group, block };
}

/** Etiquetas legibles de una operación, para `labelForOperation` (04 §10.1). */
export function nombresDe(composed: ComposedDocument | null, op: Operation): { bloque?: string; seccion?: string; grupo?: string } {
  if (!composed) return {};
  switch (op.op) {
    case "setBlock":
    case "clearBlock": {
      const loc = findBlock(composed, op.blockId);
      return loc ? { bloque: loc.block.label, seccion: loc.section.title } : {};
    }
    case "addItem":
    case "removeItem":
    case "moveItem": {
      const g = findGroup(composed, op.groupId);
      return g ? { grupo: g.group.label, seccion: g.section.title } : {};
    }
    case "setItemBlock":
    case "clearItemBlock": {
      const g = findGroup(composed, op.groupId);
      const b = findItemBlock(composed, op.groupId, op.itemId, op.blockId);
      return { grupo: g?.group.label, bloque: b?.block.label, seccion: g?.section.title };
    }
    case "setSectionVisible":
    case "setSectionVariant": {
      const s = composed.sections.find((x) => x.key === op.sectionKey);
      return s ? { seccion: s.title } : {};
    }
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------------------------
// Aplicación optimista
// ---------------------------------------------------------------------------------------------

/**
 * Aplica `op` a `composed` **en sitio** (borrador de Immer) y devuelve qué mandar al lienzo.
 *
 * Regla de despacho `RENDER` vs `PATCH` (04 §9.3): toda operación ESTRUCTURAL
 * (`reorderSections`, `setSectionVisible`, `setSectionVariant`, `setTheme`, `addItem`,
 * `removeItem`, `moveItem`) devuelve `structural: true` y el store manda el `RENDER` completo;
 * las escalares devuelven `entries` y viajan como `PATCH`.
 */
/**
 * `ResolvedTheme` completo a partir de los IDENTIFICADORES y del catálogo (`theme.json`). Lo usan
 * los dos caminos del paso 8 de `04 §7.1`: la vista previa al pasar el ratón (`lib/store.ts`
 * → `previewTheme`, ADR-3-5b-01) y el parche optimista de `setTheme` al confirmar.
 *
 * Devuelve `null` cuando NO hay nada que resolver: sin catálogo, sin identificadores, o con
 * identificadores que esa versión de plantilla no declara. Nunca inventa una paleta (P1) — el
 * `422 TPL_OPERATION_INVALID` del servidor sigue siendo quien manda sobre un id inexistente.
 * Copia los valores en vez de compartir la referencia con el catálogo: acaban dentro de un
 * documento que se parchea en sitio.
 */
export function resolverTema(
  spec: ThemeSpecType | null | undefined,
  actual: ComposedDocument["theme"],
  paletteId: string | null,
  fontSetId: string | null,
): ComposedDocument["theme"] | null {
  if (!spec) return null;
  const paleta = paletteId === null ? null : (spec.palettes.find((p) => p.id === paletteId) ?? null);
  const fuentes = fontSetId === null ? null : (spec.fontSets.find((f) => f.id === fontSetId) ?? null);
  if (paleta === null && fuentes === null) return null;
  const cara = (f: { family: string; weights: number[]; source: string }) => ({ ...f, weights: [...f.weights] });
  return {
    paletteId: paleta?.id ?? actual.paletteId,
    fontSetId: fuentes?.id ?? actual.fontSetId,
    tokens: paleta ? { ...paleta.tokens } : actual.tokens,
    fonts: fuentes ? { heading: cara(fuentes.heading), body: cara(fuentes.body) } : actual.fonts,
  };
}

export function applyOperationOptimistic(
  composed: ComposedDocument,
  op: Operation,
  /** `theme.json` de la versión activa (`lib/store.ts` → `themeSpec`). Sin él, `setTheme` solo
   *  puede parchear los identificadores, como antes del bloque 3-5b. */
  themeSpec?: ThemeSpecType | null,
): PatchResult {
  switch (op.op) {
    case "setBlock": {
      const loc = findBlock(composed, op.blockId);
      if (!loc) return VACIO;
      const ref: BlockRef = { sectionKey: loc.section.key, blockId: op.blockId };
      const resuelto = resolveScalarLocally(op.value);
      loc.block.provenance = "user";
      if (resuelto === null) {
        // §12.4: se conserva el valor anterior en pantalla y se marca pendiente.
        return { entries: [{ ref, value: loc.block.value, provenance: "user", pending: true }], pending: [refKey(ref)], structural: false };
      }
      loc.block.value = resuelto;
      return { entries: [{ ref, value: resuelto, provenance: "user", pending: false }], pending: [], structural: false };
    }
    case "clearBlock": {
      const loc = findBlock(composed, op.blockId);
      if (!loc) return VACIO;
      const ref: BlockRef = { sectionKey: loc.section.key, blockId: op.blockId };
      // El escalón siguiente (`defaults[blockId]` con `provenance:"default"`, o `null`/`"empty"`)
      // sale del `defaults.json` del PAQUETE, que ninguna ruta del editor devuelve hoy. No se
      // adivina: se marca pendiente y manda la respuesta del servidor (§12.4, misma regla).
      return { entries: [{ ref, value: loc.block.value, provenance: loc.block.provenance, pending: true }], pending: [refKey(ref)], structural: false };
    }
    case "setItemBlock": {
      const loc = findItemBlock(composed, op.groupId, op.itemId, op.blockId);
      if (!loc) return VACIO;
      const ref: BlockRef = { sectionKey: loc.section.key, blockId: op.groupId, itemId: op.itemId, itemBlockId: op.blockId };
      const resuelto = resolveScalarLocally(op.value);
      loc.block.provenance = "user";
      if (resuelto === null) {
        return { entries: [{ ref, value: loc.block.value, provenance: "user", pending: true }], pending: [refKey(ref)], structural: false };
      }
      loc.block.value = resuelto;
      return { entries: [{ ref, value: resuelto, provenance: "user", pending: false }], pending: [], structural: false };
    }
    case "clearItemBlock": {
      const loc = findItemBlock(composed, op.groupId, op.itemId, op.blockId);
      if (!loc) return VACIO;
      const ref: BlockRef = { sectionKey: loc.section.key, blockId: op.groupId, itemId: op.itemId, itemBlockId: op.blockId };
      // Simétrica de `clearBlock`, pero AQUÍ sí se puede resolver: no hay defaults por itemBlock
      // (`compose.ts`, rama `group`), así que el escalón siguiente es siempre `null`/`"empty"`.
      loc.block.value = null;
      loc.block.provenance = "empty";
      return { entries: [{ ref, value: null, provenance: "empty", pending: false }], pending: [], structural: false };
    }
    case "addItem": {
      const g = findGroup(composed, op.groupId);
      if (!g) return VACIO;
      // El ítem optimista se pinta con los bloques del PRIMER ítem existente como plantilla de
      // forma (etiquetas y roles), con valor `null` donde no hay dato: sin manifiesto no hay otra
      // fuente de la forma del ítem. Si el grupo está vacío, se inserta un ítem sin bloques y el
      // `RENDER` del servidor lo completa (≤ 2 s: `addItem` es de disparo inmediato, §12.1).
      const plantilla = g.group.items[0]?.blocks ?? [];
      const bloques: ComposedBlock[] = plantilla.map((b) => {
        const crudo = op.values[b.id];
        const resuelto = crudo === undefined ? null : resolveScalarLocally(crudo);
        return { id: b.id, role: b.role, type: b.type, label: b.label, provenance: resuelto === null ? "empty" : "user", value: resuelto };
      });
      const indice = op.index ?? g.group.items.length;
      g.group.items.splice(Math.min(indice, g.group.items.length), 0, { itemId: op.tempId, blocks: bloques });
      return { entries: [], pending: [], structural: true };
    }
    case "removeItem": {
      const g = findGroup(composed, op.groupId);
      if (!g) return VACIO;
      const i = g.group.items.findIndex((it) => it.itemId === op.itemId);
      if (i === -1) return VACIO;
      g.group.items.splice(i, 1);
      return { entries: [], pending: [], structural: true };
    }
    case "moveItem": {
      const g = findGroup(composed, op.groupId);
      if (!g) return VACIO;
      const i = g.group.items.findIndex((it) => it.itemId === op.itemId);
      if (i === -1) return VACIO;
      const [item] = g.group.items.splice(i, 1);
      if (item) g.group.items.splice(Math.min(op.toIndex, g.group.items.length), 0, item);
      return { entries: [], pending: [], structural: true };
    }
    case "setSectionVisible": {
      const s = composed.sections.find((x) => x.key === op.sectionKey);
      if (!s) return VACIO;
      s.visible = op.visible;
      return { entries: [], pending: [], structural: true };
    }
    case "setSectionVariant": {
      const s = composed.sections.find((x) => x.key === op.sectionKey);
      if (!s) return VACIO;
      s.variant = op.variant;
      return { entries: [], pending: [], structural: true };
    }
    case "reorderSections": {
      const porClave = new Map(composed.sections.map((s) => [s.key, s]));
      const ordenadas: ComposedSection[] = [];
      for (const key of op.order) {
        const s = porClave.get(key);
        if (s) {
          ordenadas.push(s);
          porClave.delete(key);
        }
      }
      // Las que el lote no nombró conservan su orden relativo al final: nunca se pierden (P1).
      for (const s of composed.sections) if (porClave.has(s.key)) ordenadas.push(s);
      composed.sections = ordenadas;
      return { entries: [], pending: [], structural: true };
    }
    case "setTheme": {
      // `04 §10.3` pide que `setTheme` «sustituya `composed.theme` RESOLVIENDO desde `theme.json`
      // del TemplateContext». Desde el bloque 3-4b ese `theme.json` llega en `GET .../document` y
      // el store lo guarda (`themeSpec`), así que la confirmación cambia el color AL INSTANTE en
      // vez de esperar al `RENDER` del servidor — que sigue siendo la verdad y llega igual (§12.1).
      // Sin catálogo se cae al comportamiento anterior: solo los dos identificadores, que sí son
      // del documento, y los tokens los trae el servidor.
      const resuelto = resolverTema(themeSpec, composed.theme, op.paletteId ?? null, op.fontSetId ?? null);
      if (resuelto !== null) {
        composed.theme.tokens = resuelto.tokens;
        composed.theme.fonts = resuelto.fonts;
      }
      if (op.paletteId !== undefined) composed.theme.paletteId = op.paletteId;
      if (op.fontSetId !== undefined) composed.theme.fontSetId = op.fontSetId;
      return { entries: [], pending: [], structural: true };
    }
  }
}

/** Claves `refKey` de todos los bloques que tocan estas operaciones (recalcular `pendingBlocks`). */
export function pendingKeysFor(composed: ComposedDocument | null, ops: readonly Operation[]): string[] {
  if (!composed) return [];
  const claves = new Set<string>();
  for (const op of ops) {
    if (op.op === "setBlock" || op.op === "clearBlock") {
      const loc = findBlock(composed, op.blockId);
      if (loc) claves.add(refKey({ sectionKey: loc.section.key, blockId: op.blockId }));
    } else if (op.op === "setItemBlock" || op.op === "clearItemBlock") {
      const g = findGroup(composed, op.groupId);
      if (g) claves.add(refKey({ sectionKey: g.section.key, blockId: op.groupId, itemId: op.itemId, itemBlockId: op.blockId }));
    }
  }
  return [...claves];
}

// ---------------------------------------------------------------------------------------------
// Aplicación de un `PATCH` entrante (lado LIENZO, 04 §9.3)
// ---------------------------------------------------------------------------------------------

/**
 * Aplica las entradas de un `PATCH` sobre una copia del documento compuesto y la devuelve. **Pura**
 * (no muta la entrada): la ruta del lienzo la usa dentro de un `setState`, donde mutar el estado
 * anterior sería un defecto de React.
 *
 * Una entrada que no case con ningún bloque se IGNORA para el pintado pero no rompe el resto del
 * `PATCH` (P1: se procesa lo que se entiende, nunca a medias un mismo bloque). El `RENDER` completo
 * que sigue a toda respuesta del servidor (§12.4 paso 6) reconcilia cualquier deriva.
 */
export function applyPatchEntries(composed: ComposedDocument, entries: readonly PatchEntry[]): ComposedDocument {
  const copia = structuredClone(composed) as ComposedDocument;
  for (const entrada of entries) {
    const { ref } = entrada;
    if (ref.itemId !== undefined && ref.itemBlockId !== undefined) {
      const loc = findItemBlock(copia, ref.blockId, ref.itemId, ref.itemBlockId);
      if (!loc) continue;
      loc.block.value = entrada.value;
      loc.block.provenance = entrada.provenance;
      continue;
    }
    const loc = findBlock(copia, ref.blockId);
    if (!loc) continue;
    loc.block.value = entrada.value;
    loc.block.provenance = entrada.provenance;
  }
  return copia;
}
