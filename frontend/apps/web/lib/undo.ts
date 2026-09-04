// lib/undo.ts — pila de operaciones inversas del editor (`04 §11`, ADR-1R-F-04).
//
// MÓDULO PURO: no importa `zustand`, ni el store, ni la red. Todo lo que hay aquí son funciones
// sobre `Operation[]` y sobre `UndoEntry[]`, para que las reglas duras (U-09, U-10, U-11) se
// prueben sin montar nada. `lib/store.ts` es el único consumidor.
//
// LA REGLA QUE MÁS IMPORTA (ADR-1R-F-04, objeción O-08, prueba U-09):
//   la inversa de `setBlock` sobre un bloque cuya `provenance` NO era `"user"` es **`clearBlock`**,
//   nunca `setBlock(valorPorDefecto)`. Lo segundo promovería contenido de demostración a contenido
//   de usuario, sacaría el bloque de `report.stillDefault`, desactivaría el bloqueo de publicación
//   de `03 §6` y reabriría H-03.
// Su gemela para grupos (ADR-1R-X-01, X-05): la inversa de `setItemBlock` sobre un itemBlock SIN
//   valor previo es **`clearItemBlock`** — la undécima operación del catálogo existe justo para eso,
//   porque no hay defaults por `itemBlock` (`compose.ts`, rama `group`).
import type { Operation } from "@invitaciones/schema";

// ---------------------------------------------------------------------------------------------
// Parámetros (04 §11.2)
// ---------------------------------------------------------------------------------------------

/** Ventana de fusión de una ráfaga de tecleo sobre el MISMO `coalesceKey` (04 §11.2 regla 2). */
export const COALESCE_WINDOW_MS = 1500;

/** Tope de la pila; ventana acotada ⇒ memoria acotada (04 §11.2). */
export const UNDO_LIMIT = 100;

// ---------------------------------------------------------------------------------------------
// Forma de una entrada
// ---------------------------------------------------------------------------------------------

export interface UndoEntry {
  /** Etiqueta es-MX para el botón, el `aria-label` y la lista del diálogo de conflicto (04 §12.6). */
  label: string;
  at: number;
  /** Lo que hizo el usuario (sirve para rehacer). */
  apply: Operation[];
  /** Lo que lo deshace. Vacío ⇒ la entrada no se empuja (la operación era un no-op). */
  revert: Operation[];
  /** p. ej. `"setBlock:cover.title"`. Ausente ⇒ nunca se fusiona (04 §11.2 regla 4). */
  coalesceKey?: string;
  /** Valores completos de lo borrado por `removeItem`: reconstruye sin depender del servidor. */
  restored?: Record<string, unknown>;
}

/**
 * Estado del bloque ANTES de la operación. Es lo único que hace falta para invertir, y viene del
 * `ComposedDocument` (que sí trae `provenance`) más el `InvitationDocument` (que trae el valor de
 * usuario crudo). Se pasa explícito para que `invertOperation` sea pura y probable.
 */
export interface BlockBefore {
  /** Valor de USUARIO previo (`document.content[blockId]`), o `null` si no había ninguno. */
  readonly value: Extract<Operation, { op: "setBlock" }>["value"] | null;
  /** `provenance` del bloque compuesto antes de la operación. */
  readonly provenance: "user" | "default" | "business" | "fixed" | "empty";
}

/** Estado previo de un itemBlock: no hay defaults por itemBlock, así que basta la presencia. */
export interface ItemBlockBefore {
  readonly value: Extract<Operation, { op: "setItemBlock" }>["value"] | null;
}

/** Estado previo de un ítem completo, para invertir `removeItem` (04 §10.3, limitación O-09). */
export interface ItemBefore {
  readonly values: Record<string, Extract<Operation, { op: "setItemBlock" }>["value"]>;
  readonly index: number;
}

/** Estado previo de la estructura, para invertir las operaciones de sección y de tema. */
export interface StructureBefore {
  readonly visible?: boolean;
  readonly variant?: string;
  readonly order?: string[];
  readonly paletteId?: string;
  readonly fontSetId?: string;
}

// ---------------------------------------------------------------------------------------------
// tempId (04 §10.3): `TempId` de `common.ts` es `^tmp:[A-Za-z0-9_-]{8,64}$`
// ---------------------------------------------------------------------------------------------

export function newTempId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  return `tmp:${uuid.replace(/-/g, "").slice(0, 32)}`;
}

// ---------------------------------------------------------------------------------------------
// Inversas (04 §10.3, columna "Inversa (`revert`)")
// ---------------------------------------------------------------------------------------------

/** Contexto previo que necesita `invertOperation`, según el tipo de operación. */
export type InvertContext =
  | { kind: "block"; before: BlockBefore }
  | { kind: "itemBlock"; before: ItemBlockBefore }
  | { kind: "item"; before: ItemBefore }
  | { kind: "moveItem"; fromIndex: number }
  | { kind: "structure"; before: StructureBefore };

/**
 * Devuelve las operaciones que deshacen `op`. Un array VACÍO significa "la operación no cambió
 * nada" (p. ej. `clearBlock` sobre un bloque que ya no tenía valor de usuario): el llamador NO
 * debe empujar entrada de undo ni encolar nada. No es "descartar en silencio" (P1): no había
 * ningún cambio que preservar.
 */
export function invertOperation(op: Operation, ctx: InvertContext): Operation[] {
  switch (op.op) {
    case "setBlock": {
      if (ctx.kind !== "block") return [];
      const { before } = ctx;
      // ── U-09 / ADR-1R-F-04 ──────────────────────────────────────────────────────────────────
      // Solo se restaura con `setBlock` si lo que había era contenido DEL USUARIO. Con
      // `default`/`business`/`fixed`/`empty` la inversa es `clearBlock`: devuelve el bloque a su
      // escalón anterior sin promover nada.
      if (before.provenance === "user" && before.value !== null) {
        return [{ op: "setBlock", blockId: op.blockId, value: before.value }];
      }
      return [{ op: "clearBlock", blockId: op.blockId }];
    }
    case "clearBlock": {
      if (ctx.kind !== "block") return [];
      const { before } = ctx;
      if (before.provenance === "user" && before.value !== null) {
        return [{ op: "setBlock", blockId: op.blockId, value: before.value }];
      }
      return []; // no había valor de usuario: `clearBlock` no cambió nada.
    }
    case "addItem":
      return [{ op: "removeItem", groupId: op.groupId, itemId: op.tempId }];
    case "removeItem": {
      if (ctx.kind !== "item") return [];
      // Limitación declarada (O-09, aceptada): se restauran los valores y la posición, NUNCA el
      // `itemId` — el ULID lo asigna el servidor (ADR-015). `tempId` nuevo en cada reconstrucción.
      return [
        { op: "addItem", groupId: op.groupId, tempId: newTempId(), values: ctx.before.values, index: ctx.before.index },
      ];
    }
    case "moveItem": {
      if (ctx.kind !== "moveItem") return [];
      if (ctx.fromIndex === op.toIndex) return [];
      return [{ op: "moveItem", groupId: op.groupId, itemId: op.itemId, toIndex: ctx.fromIndex }];
    }
    case "setItemBlock": {
      if (ctx.kind !== "itemBlock") return [];
      // ── ADR-1R-X-01 / X-05 ──────────────────────────────────────────────────────────────────
      if (ctx.before.value !== null) {
        return [
          { op: "setItemBlock", groupId: op.groupId, itemId: op.itemId, blockId: op.blockId, value: ctx.before.value },
        ];
      }
      return [{ op: "clearItemBlock", groupId: op.groupId, itemId: op.itemId, blockId: op.blockId }];
    }
    case "clearItemBlock": {
      if (ctx.kind !== "itemBlock") return [];
      if (ctx.before.value === null) return []; // no había valor: no cambió nada.
      return [
        { op: "setItemBlock", groupId: op.groupId, itemId: op.itemId, blockId: op.blockId, value: ctx.before.value },
      ];
    }
    case "setSectionVisible": {
      if (ctx.kind !== "structure" || ctx.before.visible === undefined) return [];
      if (ctx.before.visible === op.visible) return [];
      return [{ op: "setSectionVisible", sectionKey: op.sectionKey, visible: ctx.before.visible }];
    }
    case "setSectionVariant": {
      if (ctx.kind !== "structure" || ctx.before.variant === undefined) return [];
      if (ctx.before.variant === op.variant) return [];
      return [{ op: "setSectionVariant", sectionKey: op.sectionKey, variant: ctx.before.variant }];
    }
    case "reorderSections": {
      if (ctx.kind !== "structure" || ctx.before.order === undefined) return [];
      if (ctx.before.order.join(" ") === op.order.join(" ")) return [];
      return [{ op: "reorderSections", order: [...ctx.before.order] }];
    }
    case "setTheme": {
      if (ctx.kind !== "structure") return [];
      // Única operación que puede cambiar dos campos a la vez; la inversa envía AMBOS (04 §10.3).
      const inversa: Extract<Operation, { op: "setTheme" }> = { op: "setTheme" };
      if (op.paletteId !== undefined && ctx.before.paletteId !== undefined) {
        inversa.paletteId = ctx.before.paletteId;
      }
      if (op.fontSetId !== undefined && ctx.before.fontSetId !== undefined) {
        inversa.fontSetId = ctx.before.fontSetId;
      }
      if (inversa.paletteId === undefined && inversa.fontSetId === undefined) return [];
      if (inversa.paletteId === op.paletteId && inversa.fontSetId === op.fontSetId) return [];
      return [inversa];
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Coalescencia (04 §11.2)
// ---------------------------------------------------------------------------------------------

/**
 * Clave de fusión. `undefined` ⇒ la operación NUNCA se fusiona (regla 4 de §11.2: las operaciones
 * no textuales son acciones discretas y merecen su propio paso de deshacer).
 *
 * Los tipos de valor que se teclean carácter a carácter (`text`, `richText`, `listText`) son los
 * únicos fusionables. Un `setBlock` de imagen/fecha/booleano/elección es un acto único.
 */
export function coalesceKeyOf(op: Operation): string | undefined {
  const TECLEABLES = new Set(["text", "richText", "listText"]);
  switch (op.op) {
    case "setBlock":
      return TECLEABLES.has(op.value.kind) ? `setBlock:${op.blockId}` : undefined;
    case "setItemBlock":
      return TECLEABLES.has(op.value.kind) ? `setItemBlock:${op.groupId}:${op.itemId}:${op.blockId}` : undefined;
    case "moveItem":
      // Arrastre continuo: una sola entrada por gesto (04 §10.3, ventana de 1 s ⊂ la de 1,5 s).
      return `moveItem:${op.groupId}:${op.itemId}`;
    default:
      return undefined;
  }
}

/**
 * Operaciones que se envían SIN esperar el debounce (04 §12.1, fila "Disparo inmediato"): son
 * acciones discretas y esperar 2 s solo hace parecer que la aplicación no responde.
 */
export function isImmediateOperation(op: Operation): boolean {
  switch (op.op) {
    case "setSectionVisible":
    case "setSectionVariant":
    case "reorderSections":
    case "setTheme":
    case "addItem":
    case "removeItem":
    case "moveItem":
    case "clearBlock":
    case "clearItemBlock":
      return true;
    case "setBlock":
    case "setItemBlock":
      return !["text", "richText", "listText"].includes(op.value.kind);
  }
}

export interface PushUndoResult {
  /** `true` si la entrada se fusionó con la superior en vez de abrir una nueva. */
  readonly fusionada: boolean;
}

/**
 * Empuja una entrada aplicando la coalescencia de `04 §11.2`. **Muta `stack`** (se llama dentro de
 * un borrador de Immer).
 *
 * ⚠ `top.revert` NO se toca al fusionar: el revert válido es el de la entrada MÁS ANTIGUA de la
 * ráfaga — el que devuelve al estado anterior a empezar a escribir. Sustituirlo por el de `entry`
 * deshace solo el último carácter; es el error clásico de esta estructura y U-10 lo cubre.
 */
export function pushUndo(
  stack: UndoEntry[],
  entry: UndoEntry,
  opts: { barrier: boolean; limit?: number } = { barrier: false },
): PushUndoResult {
  if (entry.revert.length === 0) return { fusionada: false }; // no-op: nada que deshacer.
  const limite = opts.limit ?? UNDO_LIMIT;
  const top = stack.at(-1);
  const fusionable =
    top !== undefined &&
    entry.coalesceKey !== undefined &&
    top.coalesceKey === entry.coalesceKey &&
    entry.at - top.at < COALESCE_WINDOW_MS &&
    !opts.barrier;

  if (fusionable && top) {
    top.apply = [...top.apply, ...entry.apply];
    top.at = entry.at;
    top.label = entry.label;
    return { fusionada: true };
  }
  stack.push(entry);
  while (stack.length > limite) stack.shift();
  return { fusionada: false };
}

// ---------------------------------------------------------------------------------------------
// Etiquetas es-MX (04 §10.1: "Cambiar el título de la portada")
// ---------------------------------------------------------------------------------------------

/**
 * Etiqueta legible de una operación. `nombreBloque`/`nombreSeccion` vienen del `ComposedDocument`
 * (`ComposedBlock.label`, `ComposedSection.title`), nunca del id crudo: el cliente no ve ids.
 */
export function labelForOperation(
  op: Operation,
  nombres: { bloque?: string; seccion?: string; grupo?: string } = {},
): string {
  const bloque = nombres.bloque ?? "un campo";
  const seccion = nombres.seccion ?? "una sección";
  const grupo = nombres.grupo ?? "una lista";
  switch (op.op) {
    case "setBlock":
      return `Cambiar ${bloque}`;
    case "clearBlock":
      return `Borrar ${bloque}`;
    case "addItem":
      return `Agregar un elemento a ${grupo}`;
    case "removeItem":
      return `Quitar un elemento de ${grupo}`;
    case "moveItem":
      return `Mover un elemento de ${grupo}`;
    case "setItemBlock":
      return `Cambiar ${bloque} de ${grupo}`;
    case "clearItemBlock":
      return `Borrar ${bloque} de ${grupo}`;
    case "setSectionVisible":
      return op.visible ? `Mostrar ${seccion}` : `Ocultar ${seccion}`;
    case "setSectionVariant":
      return `Cambiar el diseño de ${seccion}`;
    case "reorderSections":
      return "Reordenar las secciones";
    case "setTheme":
      return "Cambiar la apariencia";
  }
}

// ---------------------------------------------------------------------------------------------
// Reescritura `tempId → ULID` (04 §12.3, objeción O-11, prueba U-11)
// ---------------------------------------------------------------------------------------------

/**
 * Sustituye `itemId` temporales por el ULID definitivo **en sitio** (se llama sobre un borrador de
 * Immer). Sin esto, todo lo que quedó apuntando al `tempId` deja de resolver: las entradas de undo
 * de un `addItem`, las operaciones aún en `draft` sobre ese ítem y la selección de la interfaz.
 *
 * `addItem.tempId` se deja intacto A PROPÓSITO: ese lote ya se aplicó y es idempotente por
 * `clientBatchId`; reescribirlo rompería la idempotencia si hiciera falta reenviarlo, y además el
 * esquema exige `TempId` (`^tmp:…`) en ese campo — un ULID no validaría.
 */
export function applyIdMapToOperations(ops: Operation[], idMap: Readonly<Record<string, string>>): number {
  let cambios = 0;
  for (const op of ops) {
    if ("itemId" in op && typeof op.itemId === "string") {
      const nuevo = idMap[op.itemId];
      if (nuevo !== undefined) {
        op.itemId = nuevo;
        cambios += 1;
      }
    }
  }
  return cambios;
}

/** Igual, sobre las dos pilas: recorre `apply` y `revert` de cada entrada. */
export function applyIdMapToEntries(entradas: UndoEntry[], idMap: Readonly<Record<string, string>>): number {
  let cambios = 0;
  for (const e of entradas) {
    cambios += applyIdMapToOperations(e.apply, idMap);
    cambios += applyIdMapToOperations(e.revert, idMap);
  }
  return cambios;
}

/** Sustitución sobre un id suelto (selección, claves de `pendingBlocks`). */
export function swapId(id: string | undefined, idMap: Readonly<Record<string, string>>): string | undefined {
  if (id === undefined) return undefined;
  return idMap[id] ?? id;
}

// ---------------------------------------------------------------------------------------------
// Cancelación en el borrador (04 §11.3, caso 1)
// ---------------------------------------------------------------------------------------------

/**
 * Intenta quitar de `draft` las operaciones de `apply` (comparación estructural por JSON, que basta
 * porque `Operation` es un objeto plano sin ciclos). **Muta `draft`.**
 *
 * Devuelve `true` solo si TODAS se pudieron cancelar: en ese caso deshacer no genera tráfico y
 * ahorra una revisión al servidor. Si alguna ya se encoló o se envió, devuelve `false` y el
 * llamador manda la inversa como operaciones nuevas (caso 2 de §11.3) — pero deja `draft` intacto,
 * porque una cancelación a medias produciría un estado que ni el cliente ni el servidor conocen.
 */
export function removeFromDraft(draft: Operation[], apply: readonly Operation[]): boolean {
  const copia = draft.map((op) => JSON.stringify(op));
  const indices: number[] = [];
  for (const op of apply) {
    const clave = JSON.stringify(op);
    let encontrado = -1;
    for (let i = copia.length - 1; i >= 0; i -= 1) {
      if (copia[i] === clave && !indices.includes(i)) {
        encontrado = i;
        break;
      }
    }
    if (encontrado === -1) return false;
    indices.push(encontrado);
  }
  for (const i of indices.sort((a, b) => b - a)) draft.splice(i, 1);
  return true;
}
