// lib/store.ts — store del editor (Zustand + Immer). `04 §10`, ADR-019.
//
// REGLA DURA: **las acciones de edición son EXACTAMENTE las 11 operaciones de
// `@invitaciones/schema/operations.ts`**, ni una más ni una menos. Todo lo demás son acciones de
// interfaz (no producen operación) o de ciclo de vida.
//
// Las cinco fases de toda acción de edición (04 §10.3):
//   1. validar la operación contra el esquema compartido (`Operation.safeParse`);
//   2. parche optimista sobre `composed` (`lib/composed-patch.ts`);
//   3. empujar la entrada de undo con su INVERSA correcta (`lib/undo.ts`);
//   4. encolar la operación (`draft`);
//   5. programar el autoguardado (`lib/autosave.ts`).
//
// Lo que este store NO hace, a propósito y documentado: no monta formularios, no elige paletas, no
// reordena con arrastre y no sube imágenes — eso es del bloque 3-5, que se engancha llamando a
// estas mismas 11 acciones. Los puntos de extensión están marcados con «EXTENSIÓN 3-5».
import { useMemo } from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";
import { Operation } from "@invitaciones/schema";
import type { ComposedDocument, CompositionReport, InvitationDocument } from "@invitaciones/schema";
import {
  ApiError,
  chooseTemplate,
  getDocument,
  postOperations,
  restoreRevision,
} from "./api-client.ts";
import type { OperationBatchResponse } from "./api-types.ts";
import {
  classifySaveError,
  clearPending,
  createAutosaveTimers,
  MAX_BATCH_OPS,
  MAX_ATTEMPTS,
  newBatchId,
  persistPending,
  readPending,
  retryDelayMs,
  sendKeepaliveBatch,
  splitBatchInHalf,
  splitIntoBatches,
  type AutosaveTimers,
  type PendingBatch,
  type PendingSnapshot,
  type SaveState,
} from "./autosave.ts";
import {
  applyIdMapToEntries,
  applyIdMapToOperations,
  coalesceKeyOf,
  invertOperation,
  isImmediateOperation,
  labelForOperation,
  newTempId,
  pushUndo,
  removeFromDraft,
  swapId,
  type InvertContext,
  type UndoEntry,
} from "./undo.ts";
import {
  applyOperationOptimistic,
  findBlock,
  findGroup,
  findItemBlock,
  nombresDe,
  pendingKeysFor,
  refKey,
  type BlockRef,
  type PatchEntry,
} from "./composed-patch.ts";

// ---------------------------------------------------------------------------------------------
// 1. Forma del estado (04 §10.1)
// ---------------------------------------------------------------------------------------------

export type LoadState = "idle" | "loading" | "ready" | "error" | "forbidden" | "not-started";
export type PanelKey = "sections" | "block" | "theme" | "photos" | "attic";
export type Viewport = "mobile" | "desktop";
export type TabRole = "editor" | "readonly";
export type ConflictChoice = "discard-mine" | "rebase" | "review";

/** Aviso visible en el chrome. Nada se descarta en silencio (P1): todo error tiene su aviso. */
export interface Aviso {
  id: string;
  nivel: "info" | "warning" | "error";
  texto: string;
  codigo?: string;
}

export interface ConflictState {
  currentRevision: number;
  currentDocument: InvitationDocument | null;
  currentComposed: ComposedDocument | null;
  currentReport: CompositionReport | null;
  /** Operaciones pendientes en el momento del conflicto (cola + borrador), en orden. */
  pending: Operation[];
  /** Etiquetas es-MX de lo pendiente, para la opción 3 «ver mis cambios» (04 §12.6). */
  labels: string[];
  /** Resultado del rebase asistido tras revalidar: qué se puede reenviar y qué no. */
  rebase: { aplicables: Operation[]; descartadas: { op: Operation; motivo: string }[] } | null;
}

/** Cambios sin confirmar de una sesión anterior (§12.7, flujo E de §7.5). */
export interface RecoveredSession {
  at: number;
  operations: Operation[];
}

export interface EditorState {
  // identidad y carga
  invitationId: number;
  templateVersion: { slug: string; version: string } | null;
  loadState: LoadState;
  loadError: string | null;
  publicToken: string | null;

  // documento
  document: InvitationDocument | null;
  revision: number;
  composed: ComposedDocument | null;
  report: CompositionReport | null;

  // interfaz
  selection: BlockRef | null;
  panel: PanelKey;
  viewport: Viewport;
  pendingBlocks: string[]; // `refKey` de los bloques con valor sin confirmar (§12.4)
  avisos: Aviso[];

  // guardado
  draft: Operation[];
  queue: PendingBatch[];
  inFlight: PendingBatch | null;
  saveState: SaveState;
  lastSavedAt: number | null;
  lastError: string | null;
  conflict: ConflictState | null;
  recovered: RecoveredSession | null;

  // undo
  undo: UndoEntry[];
  redo: UndoEntry[];
  coalesceBarrier: boolean;

  // lienzo
  canvas: { status: "idle" | "loading" | "ready" | "error" | "incompatible"; height: number; buildId: string | null; attempts: number };

  // pestañas
  tabRole: TabRole;
}

/** Efectos que el store PIDE y que el componente ejecuta: el store no habla `postMessage`. */
export interface CanvasSink {
  render: (composed: ComposedDocument, revision: number) => void;
  patch: (entries: PatchEntry[]) => void;
  select: (ref: BlockRef | null) => void;
  scrollToSection: (sectionKey: string) => void;
  viewport: (width: Viewport) => void;
  previewTheme: (paletteId: string | null, fontSetId: string | null) => void;
}

export interface EditorActions {
  // — ciclo de vida —
  load: (invitationId: number) => Promise<void>;
  chooseTemplateFor: (invitationId: number, slug: string, version: string) => Promise<boolean>;
  restoreFromHistory: (revision: number) => Promise<void>;
  applyServerState: (res: OperationBatchResponse) => void;
  flushNow: () => void;
  resolveConflict: (mode: ConflictChoice) => Promise<void>;
  restoreRecovered: (aplicar: boolean) => void;
  reset: () => void;

  // — las 11 operaciones de `@invitaciones/schema` —
  setBlock: (blockId: string, value: Extract<Operation, { op: "setBlock" }>["value"]) => void;
  clearBlock: (blockId: string) => void;
  addItem: (groupId: string, values: Extract<Operation, { op: "addItem" }>["values"], index?: number) => string;
  removeItem: (groupId: string, itemId: string) => void;
  moveItem: (groupId: string, itemId: string, toIndex: number) => void;
  setItemBlock: (groupId: string, itemId: string, blockId: string, value: Extract<Operation, { op: "setBlock" }>["value"]) => void;
  clearItemBlock: (groupId: string, itemId: string, blockId: string) => void;
  setSectionVisible: (sectionKey: string, visible: boolean) => void;
  setSectionVariant: (sectionKey: string, variant: string) => void;
  reorderSections: (order: string[]) => void;
  setTheme: (ids: { paletteId?: string; fontSetId?: string }) => void;

  // — interfaz (no producen operación) —
  select: (ref: BlockRef | null) => void;
  /** Desplaza el lienzo a una sección (`SCROLL_TO_SECTION`). No produce operación. */
  scrollToSection: (sectionKey: string) => void;
  openPanel: (p: PanelKey) => void;
  setViewport: (v: Viewport) => void;
  previewTheme: (paletteId: string | null, fontSetId: string | null) => void;
  dismissWarning: (id: string) => void;
  pushWarning: (aviso: Omit<Aviso, "id">) => void;
  enterReadonly: () => void;
  setTabRole: (role: TabRole) => void;

  // — undo / redo (04 §11) —
  undoOnce: () => void;
  redoOnce: () => void;

  // — lienzo —
  attachCanvas: (sink: CanvasSink | null) => void;
  onCanvasReady: (buildId: string) => void;
  onCanvasResized: (height: number) => void;
  onCanvasError: () => void;
  onCanvasIncompatible: (version: number) => void;

  // — cierre de pestaña (§12.7) —
  saveOnHide: () => void;
  hasUnsaved: () => boolean;
}

export type EditorStore = EditorState & EditorActions;

const ESTADO_INICIAL: EditorState = {
  invitationId: 0,
  templateVersion: null,
  loadState: "idle",
  loadError: null,
  publicToken: null,
  document: null,
  revision: 0,
  composed: null,
  report: null,
  selection: null,
  panel: "sections",
  viewport: "desktop",
  pendingBlocks: [],
  avisos: [],
  draft: [],
  queue: [],
  inFlight: null,
  saveState: "idle",
  lastSavedAt: null,
  lastError: null,
  conflict: null,
  recovered: null,
  undo: [],
  redo: [],
  coalesceBarrier: false,
  canvas: { status: "idle", height: 0, buildId: null, attempts: 0 },
  tabRole: "editor",
};

// ---------------------------------------------------------------------------------------------
// 2. Efectos externos, inyectables (para las pruebas)
// ---------------------------------------------------------------------------------------------

export interface StoreDeps {
  getDocument: typeof getDocument;
  chooseTemplate: typeof chooseTemplate;
  postOperations: typeof postOperations;
  restoreRevision: typeof restoreRevision;
  now: () => number;
  setTimeoutImpl: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl: (h: ReturnType<typeof setTimeout>) => void;
  sendKeepalive: typeof sendKeepaliveBatch;
}

const DEPS_POR_DEFECTO: StoreDeps = {
  getDocument,
  chooseTemplate,
  postOperations,
  restoreRevision,
  now: () => Date.now(),
  setTimeoutImpl: (fn, ms) => setTimeout(fn, ms),
  clearTimeoutImpl: (h) => clearTimeout(h),
  sendKeepalive: sendKeepaliveBatch,
};

// ---------------------------------------------------------------------------------------------
// 3. Fábrica del store
// ---------------------------------------------------------------------------------------------

export function createEditorStore(depsParciales: Partial<StoreDeps> = {}) {
  const deps: StoreDeps = { ...DEPS_POR_DEFECTO, ...depsParciales };
  let sink: CanvasSink | null = null;
  let timers: AutosaveTimers | null = null;
  let contadorAviso = 0;

  return create<EditorStore>()(
    immer((set, get) => {
      // ─────────────────────────────────────────────────────────────────────────────────────────
      // Utilidades internas
      // ─────────────────────────────────────────────────────────────────────────────────────────

      function aviso(nivel: Aviso["nivel"], texto: string, codigo?: string): void {
        contadorAviso += 1;
        const id = `av-${contadorAviso}`;
        set((s) => {
          s.avisos.push(codigo === undefined ? { id, nivel, texto } : { id, nivel, texto, codigo });
        });
      }

      function snapshotPendiente(s: EditorState): PendingSnapshot {
        return {
          revision: s.revision,
          draft: JSON.parse(JSON.stringify(s.draft)) as Operation[],
          queue: s.queue.map((b) => ({ clientBatchId: b.clientBatchId, ops: JSON.parse(JSON.stringify(b.ops)) as Operation[] })),
          at: deps.now(),
          templateVersion: s.templateVersion,
        };
      }

      function persistir(): void {
        const s = get();
        if (s.invitationId === 0) return;
        if (s.draft.length === 0 && s.queue.length === 0 && s.inFlight === null) {
          clearPending(s.invitationId);
          return;
        }
        persistPending(s.invitationId, snapshotPendiente(s));
      }

      /** §12.4 punto 5: `pendingBlocks` se recalcula SIEMPRE desde `draft` + `queue` + `inFlight`. */
      function recalcularPendientes(): void {
        set((s) => {
          const ops = [...(s.inFlight?.ops ?? []), ...s.queue.flatMap((b) => b.ops), ...s.draft];
          s.pendingBlocks = pendingKeysFor(s.composed as ComposedDocument | null, ops);
        });
      }

      function asegurarTimers(): AutosaveTimers {
        timers ??= createAutosaveTimers({
          onFlush: () => flushDraft(),
          now: deps.now,
          setTimeoutImpl: deps.setTimeoutImpl,
          clearTimeoutImpl: deps.clearTimeoutImpl,
        });
        return timers;
      }

      /**
       * El indicador dice LA VERDAD (04 §12.8): si no queda nada pendiente, el estado vuelve a
       * `idle`. Hace falta porque deshacer puede CANCELAR en el borrador lo último que se escribió
       * (§11.3, caso 1) y entonces no hay respuesta del servidor que devuelva el estado — sin esto
       * el editor se quedaba diciendo "Sin guardar" con la cola vacía.
       */
      function reconciliarEstadoDeGuardado(): void {
        set((s) => {
          if (s.saveState === "conflict" || s.saveState === "error" || s.saveState === "offline") return;
          const pendiente = s.draft.length > 0 || s.queue.length > 0 || s.inFlight !== null;
          if (!pendiente && s.saveState === "dirty") s.saveState = "idle";
        });
      }

      /** 04 §12.2 `flushDraft`: trocea a ≤ 50 y bombea. */
      function flushDraft(): void {
        asegurarTimers().cancel();
        const pendientes = get().draft;
        if (pendientes.length > 0) {
          const lotes = splitIntoBatches(pendientes, deps.now());
          set((s) => {
            s.draft = [];
            s.queue.push(...lotes);
          });
        }
        reconciliarEstadoDeGuardado();
        void pump();
      }

      /** 04 §12.2 `enqueue`. */
      function enqueue(ops: Operation[], immediate: boolean): void {
        if (ops.length === 0) return;
        set((s) => {
          s.draft.push(...ops);
          if (s.saveState !== "conflict") s.saveState = "dirty";
        });
        persistir();
        recalcularPendientes();
        asegurarTimers().schedule(immediate);
      }

      /** 04 §12.2 `pump`: EXACTAMENTE un lote en vuelo (baseRevision es un contador). */
      async function pump(): Promise<void> {
        const s0 = get();
        if (s0.inFlight !== null || s0.queue.length === 0) return;
        if (s0.saveState === "conflict") return; // bloqueado hasta que el usuario decida (§12.6)
        if (s0.tabRole === "readonly") return;
        const batch = s0.queue[0];
        if (!batch) return;

        set((s) => {
          s.inFlight = s.queue[0] ?? null;
          s.saveState = batch.attempt === 0 ? "saving" : "retrying";
        });

        try {
          const res = await deps.postOperations(s0.invitationId, {
            baseRevision: get().revision,
            clientBatchId: batch.clientBatchId,
            operations: batch.ops,
          });
          // Idempotencia (contratos §4): ante un timeout, el reintento del MISMO `clientBatchId`
          // responde `200 {applied:false, revision:<la que produjo>}`. Es ÉXITO, no error.
          set((s) => {
            s.queue.shift();
            s.inFlight = null;
            s.lastError = null;
          });
          get().applyServerState(res);
          set((s) => {
            s.saveState = s.queue.length > 0 || s.draft.length > 0 ? "dirty" : "idle";
            s.lastSavedAt = deps.now();
          });
          persistir();
          void pump();
        } catch (error: unknown) {
          set((s) => {
            s.inFlight = null;
          });
          manejarFalloDeGuardado(error, batch);
        }
      }

      /** Tabla completa de `04 §12.5`. El editor NUNCA se bloquea por un fallo de guardado. */
      function manejarFalloDeGuardado(error: unknown, batch: PendingBatch): void {
        const fallo = classifySaveError(error);
        set((s) => {
          s.lastError = fallo.mensaje;
        });

        switch (fallo.kind) {
          case "retry": {
            const intento = batch.attempt + 1;
            if (intento > MAX_ATTEMPTS) {
              // Cola intacta; se reengancha a `window.online` (lo hace el componente).
              set((s) => {
                s.saveState = fallo.offline ? "offline" : "error";
              });
              aviso("warning", fallo.mensaje);
              return;
            }
            set((s) => {
              const b = s.queue[0];
              if (b) b.attempt = intento;
              s.saveState = fallo.offline ? "offline" : "retrying";
            });
            deps.setTimeoutImpl(() => void pump(), retryDelayMs(batch.attempt));
            return;
          }
          case "conflict": {
            // §12.6: `saveState = "conflict"`, `pump()` no envía nada y el panel se deshabilita.
            const pendientes = [...get().queue.flatMap((b) => b.ops), ...get().draft];
            set((s) => {
              s.saveState = "conflict";
              s.conflict = {
                currentRevision: fallo.body?.currentRevision ?? s.revision,
                currentDocument: fallo.body?.document ?? null,
                currentComposed: fallo.body?.composed ?? null,
                currentReport: fallo.body?.report ?? null,
                pending: JSON.parse(JSON.stringify(pendientes)) as Operation[],
                labels: s.undo.slice(-Math.max(1, s.undo.length)).map((e) => e.label),
                rebase: null,
              };
            });
            return;
          }
          case "drop-batch": {
            // Nunca se reintenta (sería un bucle): se descarta ESE lote, se revierten sus
            // operaciones en la pila y se recarga el documento autoritativo.
            set((s) => {
              s.queue.shift();
              purgarEntradasDeUndoQueContienen(s, batch.ops);
              s.saveState = "error";
            });
            aviso("error", fallo.mensaje, fallo.codigo);
            persistir();
            if (fallo.recargar) void get().load(get().invitationId);
            return;
          }
          case "readonly": {
            set((s) => {
              s.tabRole = "readonly";
              s.saveState = "error";
            });
            aviso("error", fallo.mensaje);
            return;
          }
          case "session": {
            set((s) => {
              s.saveState = "error";
            });
            // Se CONSERVA el localStorage de pendientes: al volver, §7.5 los ofrece.
            aviso("error", fallo.mensaje, "401");
            return;
          }
          case "split": {
            const mitades = splitBatchInHalf(batch);
            if (mitades === null) {
              set((s) => {
                s.queue.shift();
                purgarEntradasDeUndoQueContienen(s, batch.ops);
                s.saveState = "error";
              });
              aviso("error", fallo.mensaje);
              persistir();
              return;
            }
            set((s) => {
              s.queue.splice(0, 1, mitades[0], mitades[1]);
              s.saveState = "retrying";
            });
            void pump();
            return;
          }
        }
      }

      /** §11.4: un `422` invalida las entradas cuya inversa ya no corresponde a nada. */
      function purgarEntradasDeUndoQueContienen(s: EditorState, ops: readonly Operation[]): void {
        const claves = new Set(ops.map((o) => JSON.stringify(o)));
        s.undo = s.undo.filter((e) => !e.apply.some((o) => claves.has(JSON.stringify(o))));
        s.redo = s.redo.filter((e) => !e.apply.some((o) => claves.has(JSON.stringify(o))));
      }

      /** Empuja al lienzo lo que corresponda tras aplicar operaciones localmente. */
      function avisarAlLienzo(resultadoEstructural: boolean, entries: PatchEntry[]): void {
        if (!sink) return;
        const s = get();
        if (resultadoEstructural) {
          if (s.composed) sink.render(s.composed as ComposedDocument, s.revision);
          return;
        }
        if (entries.length > 0) sink.patch(entries);
      }

      /**
       * Núcleo compartido por las 11 acciones. Valida, parchea, invierte, encola y programa.
       * Devuelve `false` si la operación no era válida o no cambiaba nada.
       */
      function aplicarOperacion(op: Operation, ctx: InvertContext, opciones: { forzarNuevaEntrada?: boolean } = {}): boolean {
        // (1) Validación contra el MISMO esquema que usará el servidor. Un lote malformado falla
        // aquí, con un mensaje claro, en vez de viajar y volver como `400 TPL_MALFORMED_JSON`.
        const validado = Operation.safeParse(op);
        if (!validado.success) {
          aviso("error", `No pudimos aplicar ese cambio: ${validado.error.issues.map((i) => i.message).join("; ")}`);
          return false;
        }
        const s0 = get();
        if (s0.tabRole === "readonly") {
          aviso("warning", "Esta pestaña está en modo lectura. Usa «Editar aquí de todas formas» para tomar el control.");
          return false;
        }
        if (s0.saveState === "conflict") {
          aviso("warning", "Resuelve primero el conflicto de versiones para seguir editando.");
          return false;
        }

        // (3) La INVERSA se calcula ANTES del parche: necesita el estado previo.
        const revert = invertOperation(op, ctx);
        if (revert.length === 0) return false; // no-op: no había nada que cambiar ni que deshacer.

        // (2) Parche optimista.
        let entries: PatchEntry[] = [];
        let structural = false;
        set((s) => {
          if (!s.composed) return;
          const r = applyOperationOptimistic(s.composed as ComposedDocument, op);
          entries = r.entries;
          structural = r.structural;
        });

        // (3) Entrada de undo con coalescencia (§11.2).
        const label = labelForOperation(op, nombresDe(get().composed as ComposedDocument | null, op));
        set((s) => {
          const entrada: UndoEntry = { label, at: deps.now(), apply: [op], revert };
          const clave = coalesceKeyOf(op);
          if (clave !== undefined && opciones.forzarNuevaEntrada !== true) entrada.coalesceKey = clave;
          pushUndo(s.undo, entrada, { barrier: s.coalesceBarrier || opciones.forzarNuevaEntrada === true });
          s.redo = []; // toda edición nueva invalida el rehacer (§11.2)
          s.coalesceBarrier = false;
        });

        // (4) + (5)
        enqueue([op], isImmediateOperation(op));
        avisarAlLienzo(structural, entries);
        return true;
      }

      /** Contexto de inversión de un bloque escalar: valor de usuario previo + `provenance`. */
      function ctxBloque(blockId: string): InvertContext {
        const s = get();
        const comp = s.composed ? findBlock(s.composed as ComposedDocument, blockId) : null;
        const crudo = s.document?.content?.[blockId];
        const valorUsuario =
          crudo !== undefined && crudo !== null && typeof crudo === "object" && "kind" in crudo && crudo.kind !== "group"
            ? (crudo as Extract<Operation, { op: "setBlock" }>["value"])
            : null;
        return { kind: "block", before: { value: valorUsuario, provenance: comp?.block.provenance ?? "empty" } };
      }

      function ctxItemBlock(groupId: string, itemId: string, blockId: string): InvertContext {
        const s = get();
        const grupo = s.document?.content?.[groupId];
        let valor: Extract<Operation, { op: "setBlock" }>["value"] | null = null;
        if (grupo && typeof grupo === "object" && "kind" in grupo && grupo.kind === "group") {
          const item = grupo.items.find((i) => i.itemId === itemId);
          const v = item?.values?.[blockId];
          if (v !== undefined) valor = v as Extract<Operation, { op: "setBlock" }>["value"];
        }
        return { kind: "itemBlock", before: { value: valor } };
      }

      // ─────────────────────────────────────────────────────────────────────────────────────────
      // Estado + acciones
      // ─────────────────────────────────────────────────────────────────────────────────────────

      return {
        ...ESTADO_INICIAL,

        // ═══ ciclo de vida ═══════════════════════════════════════════════════════════════════

        async load(invitationId: number): Promise<void> {
          set((s) => {
            s.invitationId = invitationId;
            s.loadState = "loading";
            s.loadError = null;
          });
          try {
            const doc = await deps.getDocument(invitationId);
            set((s) => {
              s.document = doc.document;
              s.composed = doc.composed;
              s.report = doc.report;
              s.revision = doc.revision;
              s.templateVersion = { slug: doc.templateVersion.slug, version: doc.templateVersion.version };
              s.publicToken = doc.publicToken;
              s.loadState = "ready";
            });
            // §7.5 / §12.7: ¿había cambios sin confirmar de una sesión anterior?
            const guardado = readPending(invitationId);
            if (guardado) {
              const ops = [...guardado.queue.flatMap((b) => b.ops), ...guardado.draft];
              if (ops.length > 0) set((s) => { s.recovered = { at: guardado.at, operations: ops }; });
              else clearPending(invitationId);
            }
            if (sink && get().composed) sink.render(get().composed as ComposedDocument, get().revision);
          } catch (error: unknown) {
            if (error instanceof ApiError && error.code === "TPL_DOCUMENT_NOT_STARTED") {
              // `:choose-template` es el ÚNICO creador del documento (contratos §4, ADR-1R-X-03):
              // el `GET` NO crea nada. Es el estado inicial esperado, no un error.
              set((s) => { s.loadState = "not-started"; });
              return;
            }
            if (error instanceof ApiError && (error.code === "TPL_FORBIDDEN" || error.code === "TPL_INVITATION_UNAVAILABLE")) {
              set((s) => { s.loadState = "forbidden"; s.loadError = error.message; });
              return;
            }
            set((s) => {
              s.loadState = "error";
              s.loadError = error instanceof Error ? error.message : String(error);
            });
          }
        },

        async chooseTemplateFor(invitationId: number, slug: string, version: string): Promise<boolean> {
          const existe = get().loadState === "ready";
          try {
            const res = await deps.chooseTemplate(invitationId, {
              templateSlug: slug,
              templateVersion: version,
              // `baseRevision` es obligatorio también aquí si el documento YA existe (ADR-1R-B-11);
              // se omite en la primera creación (03 §3.2).
              ...(existe ? { baseRevision: get().revision } : {}),
            });
            set((s) => {
              s.invitationId = invitationId;
              s.document = res.document;
              s.composed = res.composed;
              s.report = res.report;
              s.revision = res.revision;
              s.templateVersion = { slug, version };
              s.publicToken = res.publicToken;
              s.loadState = "ready";
              // §7.3: un cambio de plantilla VACÍA ambas pilas — las inversas apuntan a `blockId`
              // que la plantilla nueva no declara y darían `422 TPL_BLOCK_UNKNOWN` en bloque.
              s.undo = [];
              s.redo = [];
              s.draft = [];
              s.queue = [];
              s.inFlight = null;
              s.saveState = "idle";
              s.selection = null;
              s.pendingBlocks = [];
            });
            clearPending(invitationId);
            if (existe) aviso("info", "Cambiaste de plantilla. Tu contenido anterior está guardado, pero no se puede deshacer este cambio.");
            if (res.movedToAttic.length > 0) {
              aviso("info", `Guardamos tu contenido anterior (${res.movedToAttic.length} versión(es) en el archivo). Revísalo en la plantilla nueva.`);
            }
            if (sink && get().composed) sink.render(get().composed as ComposedDocument, get().revision);
            return true;
          } catch (error: unknown) {
            const codigo = error instanceof ApiError ? error.code : undefined;
            const texto =
              codigo === "TPL_PLAN_TIER_INSUFFICIENT"
                ? "Esta plantilla es de un plan superior al tuyo."
                : codigo === "TPL_TEMPLATE_VERSION_NOT_FOUND"
                  ? "Esta plantilla ya no está disponible."
                  : codigo === "TPL_MIGRATION_PLAN_MISSING"
                    ? "No podemos cambiar a esta versión ahora mismo. Avísanos y lo revisamos."
                    : error instanceof Error
                      ? error.message
                      : "No pudimos elegir esa plantilla.";
            aviso("error", texto, codigo);
            return false;
          }
        },

        async restoreFromHistory(revision: number): Promise<void> {
          try {
            const res = await deps.restoreRevision(get().invitationId, { revision, baseRevision: get().revision });
            set((s) => {
              s.composed = res.composed;
              s.report = res.report;
              s.revision = res.revision;
              // §11.4: `restore` vacía las pilas — el documento puede haber cambiado masivamente.
              s.undo = [];
              s.redo = [];
            });
            if (sink && get().composed) sink.render(get().composed as ComposedDocument, get().revision);
          } catch (error: unknown) {
            aviso("error", error instanceof Error ? error.message : "No pudimos restaurar esa versión.");
          }
        },

        /** 04 §12.4, pasos 1-6. */
        applyServerState(res: OperationBatchResponse): void {
          set((s) => {
            // (1) Reescritura `tempId → ULID` (§12.3, U-11), ANTES de tocar nada más.
            if (Object.keys(res.idMap).length > 0) {
              applyIdMapToOperations(s.draft, res.idMap);
              for (const b of s.queue) applyIdMapToOperations(b.ops, res.idMap);
              if (s.inFlight) applyIdMapToOperations(s.inFlight.ops, res.idMap);
              applyIdMapToEntries(s.undo, res.idMap);
              applyIdMapToEntries(s.redo, res.idMap);
              if (s.selection?.itemId) {
                s.selection = { ...s.selection, itemId: swapId(s.selection.itemId, res.idMap) };
              }
            }
            // (2) + (3) La verdad es del servidor: incluye fechas formateadas, `provenance` y
            // `stillDefault` reales.
            s.revision = res.revision;
            s.composed = res.composed;
            s.report = res.report;
            // (4) Se reaplican encima los parches optimistas de lo que sigue pendiente, para que el
            // texto recién escrito no "salte hacia atrás".
            const pendientes = [...(s.inFlight?.ops ?? []), ...s.queue.flatMap((b) => b.ops), ...s.draft];
            for (const op of pendientes) applyOperationOptimistic(s.composed as ComposedDocument, op);
            // (5) `pendingBlocks` se recalcula desde lo que sigue en vuelo.
            s.pendingBlocks = pendingKeysFor(s.composed as ComposedDocument | null, pendientes);
          });
          // (6) `RENDER` completo al lienzo.
          const s = get();
          if (sink && s.composed) sink.render(s.composed as ComposedDocument, s.revision);
        },

        flushNow(): void {
          flushDraft();
        },

        async resolveConflict(mode: ConflictChoice): Promise<void> {
          const conflicto = get().conflict;
          if (!conflicto) return;

          if (mode === "review") {
            // Opción 3: solo abre el panel de solo lectura; el diálogo sigue vivo (§12.6).
            return;
          }

          if (mode === "discard-mine") {
            // Opción 1, la conservadora y por defecto.
            set((s) => {
              s.queue = [];
              s.draft = [];
              s.inFlight = null;
              s.undo = [];
              s.redo = [];
              s.conflict = null;
              s.saveState = "idle";
              s.pendingBlocks = [];
            });
            clearPending(get().invitationId);
            await get().load(get().invitationId);
            aviso("info", "Traímos la versión más reciente. Tus cambios sin guardar se descartaron, como pediste.");
            return;
          }

          // Opción 2: rebase ASISTIDO. Nunca se aplica sin mostrar la lista (§12.6).
          const base = conflicto.currentComposed;
          const aplicables: Operation[] = [];
          const descartadas: { op: Operation; motivo: string }[] = [];
          for (const op of conflicto.pending) {
            const motivo = motivoNoAplicable(base, op);
            if (motivo === null) aplicables.push(op);
            else descartadas.push({ op, motivo });
          }
          if (conflicto.rebase === null) {
            // Primera pasada: se calcula y se ENSEÑA. No se envía nada todavía.
            set((s) => {
              if (s.conflict) s.conflict.rebase = { aplicables, descartadas };
            });
            return;
          }
          // Segunda pasada (el usuario ya vio la lista y confirmó): se adopta la versión nueva y se
          // reenvía lo aplicable como lote NUEVO con `baseRevision` fresca.
          set((s) => {
            s.revision = conflicto.currentRevision;
            if (conflicto.currentDocument) s.document = conflicto.currentDocument;
            if (conflicto.currentComposed) s.composed = conflicto.currentComposed;
            if (conflicto.currentReport) s.report = conflicto.currentReport;
            s.queue = [];
            s.draft = [];
            s.inFlight = null;
            s.conflict = null;
            s.saveState = aplicables.length > 0 ? "dirty" : "idle";
            if (aplicables.length > 0) {
              for (let i = 0; i < aplicables.length; i += MAX_BATCH_OPS) {
                s.queue.push({
                  clientBatchId: newBatchId(),
                  ops: aplicables.slice(i, i + MAX_BATCH_OPS),
                  attempt: 0,
                  queuedAt: deps.now(),
                });
              }
            }
            // Las inversas de la pila ya no corresponden al documento nuevo.
            s.undo = [];
            s.redo = [];
          });
          if (descartadas.length > 0) {
            aviso("warning", `Descartamos ${descartadas.length} cambio(s) que ya no aplican sobre la versión nueva.`);
          }
          if (sink && get().composed) sink.render(get().composed as ComposedDocument, get().revision);
          void pump();
        },

        restoreRecovered(aplicar: boolean): void {
          const rec = get().recovered;
          set((s) => { s.recovered = null; });
          if (!rec) return;
          if (!aplicar) {
            clearPending(get().invitationId);
            aviso("info", "Descartamos los cambios sin guardar de la sesión anterior.");
            return;
          }
          // §7.5: se encolan con `baseRevision` ACTUAL (la del store) y `clientBatchId` NUEVO.
          set((s) => {
            for (let i = 0; i < rec.operations.length; i += MAX_BATCH_OPS) {
              s.queue.push({
                clientBatchId: newBatchId(),
                ops: rec.operations.slice(i, i + MAX_BATCH_OPS),
                attempt: 0,
                queuedAt: deps.now(),
              });
            }
            s.saveState = "dirty";
            s.undo = [];
            s.redo = [];
          });
          void pump();
        },

        reset(): void {
          asegurarTimers().cancel();
          set(() => ({ ...ESTADO_INICIAL }) as EditorState);
        },

        // ═══ las 11 operaciones ══════════════════════════════════════════════════════════════

        setBlock(blockId, value): void {
          aplicarOperacion({ op: "setBlock", blockId, value }, ctxBloque(blockId));
        },

        clearBlock(blockId): void {
          aplicarOperacion({ op: "clearBlock", blockId }, ctxBloque(blockId));
        },

        addItem(groupId, values, index): string {
          const tempId = newTempId();
          const op: Operation =
            index === undefined
              ? { op: "addItem", groupId, tempId, values }
              : { op: "addItem", groupId, tempId, values, index };
          aplicarOperacion(op, { kind: "item", before: { values: {}, index: index ?? 0 } });
          return tempId;
        },

        removeItem(groupId, itemId): void {
          const s = get();
          const grupo = s.composed ? findGroup(s.composed as ComposedDocument, groupId) : null;
          const idx = grupo?.group.items.findIndex((i) => i.itemId === itemId) ?? -1;
          // Los valores para reconstruir salen del DOCUMENTO (crudos), no del compuesto: `addItem`
          // exige `ScalarValue`, no `ResolvedValue` (una `url` no es un `assetId`).
          const crudo = s.document?.content?.[groupId];
          let values: Record<string, Extract<Operation, { op: "setBlock" }>["value"]> = {};
          if (crudo && typeof crudo === "object" && "kind" in crudo && crudo.kind === "group") {
            const item = crudo.items.find((i) => i.itemId === itemId);
            if (item) values = { ...item.values } as Record<string, Extract<Operation, { op: "setBlock" }>["value"]>;
          }
          aplicarOperacion({ op: "removeItem", groupId, itemId }, { kind: "item", before: { values, index: Math.max(0, idx) } });
        },

        moveItem(groupId, itemId, toIndex): void {
          const s = get();
          const grupo = s.composed ? findGroup(s.composed as ComposedDocument, groupId) : null;
          const desde = grupo?.group.items.findIndex((i) => i.itemId === itemId) ?? -1;
          if (desde === -1) return;
          aplicarOperacion({ op: "moveItem", groupId, itemId, toIndex }, { kind: "moveItem", fromIndex: desde });
        },

        setItemBlock(groupId, itemId, blockId, value): void {
          aplicarOperacion({ op: "setItemBlock", groupId, itemId, blockId, value }, ctxItemBlock(groupId, itemId, blockId));
        },

        clearItemBlock(groupId, itemId, blockId): void {
          aplicarOperacion({ op: "clearItemBlock", groupId, itemId, blockId }, ctxItemBlock(groupId, itemId, blockId));
        },

        setSectionVisible(sectionKey, visible): void {
          const s = get();
          const sec = s.composed?.sections.find((x) => x.key === sectionKey);
          if (!sec) return;
          aplicarOperacion({ op: "setSectionVisible", sectionKey, visible }, { kind: "structure", before: { visible: sec.visible } });
        },

        setSectionVariant(sectionKey, variant): void {
          const s = get();
          const sec = s.composed?.sections.find((x) => x.key === sectionKey);
          if (!sec) return;
          aplicarOperacion({ op: "setSectionVariant", sectionKey, variant }, { kind: "structure", before: { variant: sec.variant } });
        },

        reorderSections(order): void {
          const s = get();
          const anterior = s.composed?.sections.map((x) => x.key) ?? [];
          aplicarOperacion({ op: "reorderSections", order }, { kind: "structure", before: { order: anterior } });
        },

        setTheme(ids): void {
          const s = get();
          const t = s.composed?.theme;
          if (!t) return;
          const op: Operation = { op: "setTheme" };
          if (ids.paletteId !== undefined) op.paletteId = ids.paletteId;
          if (ids.fontSetId !== undefined) op.fontSetId = ids.fontSetId;
          aplicarOperacion(op, { kind: "structure", before: { paletteId: t.paletteId, fontSetId: t.fontSetId } });
        },

        // ═══ interfaz ════════════════════════════════════════════════════════════════════════

        select(ref): void {
          set((s) => {
            s.selection = ref;
            // 04 §4: al hacer clic en un bloque el PANEL abre ese campo con el foco. El lienzo no
            // edita texto sobre sí mismo (nada de `contenteditable`), es la decisión de diseño.
            if (ref !== null) s.panel = "block";
            s.coalesceBarrier = true; // cambiar de campo abre entrada nueva de undo (§11.2 regla 1)
          });
          sink?.select(ref);
        },

        scrollToSection(sectionKey): void {
          sink?.scrollToSection(sectionKey);
        },

        openPanel(p): void {
          set((s) => { s.panel = p; });
        },

        setViewport(v): void {
          set((s) => { s.viewport = v; });
          sink?.viewport(v);
        },

        previewTheme(paletteId, fontSetId): void {
          // Efímero: NO genera operación ni entra en el undo (04 §9.3).
          sink?.previewTheme(paletteId, fontSetId);
        },

        dismissWarning(id): void {
          set((s) => { s.avisos = s.avisos.filter((a) => a.id !== id); });
        },

        pushWarning(a): void {
          aviso(a.nivel, a.texto, a.codigo);
        },

        enterReadonly(): void {
          set((s) => { s.tabRole = "readonly"; });
        },

        setTabRole(role): void {
          set((s) => { s.tabRole = role; });
          if (role === "editor") void pump();
        },

        // ═══ undo / redo (04 §11.3) ══════════════════════════════════════════════════════════

        undoOnce(): void {
          const s0 = get();
          if (s0.undo.length === 0 || s0.tabRole === "readonly" || s0.saveState === "conflict") return;
          const entry = s0.undo[s0.undo.length - 1];
          if (!entry) return;

          // Caso 1: las operaciones siguen en `draft` ⇒ se cancelan localmente, sin tráfico.
          let cancelado = false;
          set((s) => {
            cancelado = removeFromDraft(s.draft, entry.apply);
            s.undo.pop();
            s.redo.push(entry);
            s.coalesceBarrier = true;
          });

          let entries: PatchEntry[] = [];
          let structural = false;
          set((s) => {
            if (!s.composed) return;
            for (const op of entry.revert) {
              const r = applyOperationOptimistic(s.composed as ComposedDocument, op);
              entries = [...entries, ...r.entries];
              structural = structural || r.structural;
            }
          });

          if (cancelado) {
            persistir();
            recalcularPendientes();
            reconciliarEstadoDeGuardado();
          } else {
            // Caso 2: ya estaban encoladas o enviadas ⇒ la inversa viaja como operaciones NUEVAS.
            enqueue([...entry.revert], entry.revert.some(isImmediateOperation));
          }
          avisarAlLienzo(structural, entries);
        },

        redoOnce(): void {
          const s0 = get();
          if (s0.redo.length === 0 || s0.tabRole === "readonly" || s0.saveState === "conflict") return;
          const entry = s0.redo[s0.redo.length - 1];
          if (!entry) return;
          set((s) => {
            s.redo.pop();
            s.undo.push(entry);
            s.coalesceBarrier = true;
          });
          let entries: PatchEntry[] = [];
          let structural = false;
          set((s) => {
            if (!s.composed) return;
            for (const op of entry.apply) {
              const r = applyOperationOptimistic(s.composed as ComposedDocument, op);
              entries = [...entries, ...r.entries];
              structural = structural || r.structural;
            }
          });
          enqueue([...entry.apply], entry.apply.some(isImmediateOperation));
          avisarAlLienzo(structural, entries);
        },

        // ═══ lienzo ══════════════════════════════════════════════════════════════════════════

        attachCanvas(nuevo): void {
          sink = nuevo;
          const s = get();
          if (sink && s.composed) {
            sink.render(s.composed as ComposedDocument, s.revision);
            sink.viewport(s.viewport);
            if (s.selection) sink.select(s.selection);
          }
        },

        onCanvasReady(buildId): void {
          set((s) => {
            s.canvas.status = "ready";
            s.canvas.buildId = buildId;
          });
        },

        onCanvasResized(height): void {
          set((s) => { s.canvas.height = height; });
        },

        onCanvasError(): void {
          set((s) => {
            s.canvas.status = "error";
            s.canvas.attempts += 1;
          });
        },

        onCanvasIncompatible(version): void {
          set((s) => { s.canvas.status = "incompatible"; });
          aviso("warning", `La vista previa habla otra versión del editor (v${version}). Recarga la página.`);
        },

        // ═══ cierre de pestaña (04 §12.7, U-16) ══════════════════════════════════════════════

        saveOnHide(): void {
          const s = get();
          if (s.draft.length === 0) return;
          const ops = s.draft.slice(0, MAX_BATCH_OPS);
          const resultado = deps.sendKeepalive(s.invitationId, {
            baseRevision: s.revision,
            clientBatchId: newBatchId(),
            operations: ops,
          });
          if (resultado.enviado) {
            // Se deja en `localStorage` igualmente: si el `keepalive` no llegó, §7.5 lo recupera.
            persistir();
            return;
          }
          if (resultado.motivo === "demasiado-grande") flushDraft(); // intento normal (§12.7)
        },

        hasUnsaved(): boolean {
          const s = get();
          return s.draft.length > 0 || s.queue.length > 0 || s.inFlight !== null;
        },
      };
    }),
  );
}

/**
 * ¿Por qué una operación pendiente ya no aplica sobre el documento nuevo? `null` ⇒ sí aplica.
 * Se comprueba contra la ESTRUCTURA del compuesto autoritativo, que es lo que el cliente tiene.
 */
function motivoNoAplicable(base: ComposedDocument | null, op: Operation): string | null {
  if (!base) return null; // sin documento nuevo no se puede juzgar: se deja pasar y decide el servidor.
  switch (op.op) {
    case "setBlock":
    case "clearBlock":
      return findBlock(base, op.blockId) ? null : "el campo ya no existe en esta versión";
    case "addItem":
    case "removeItem":
    case "moveItem":
      if (!findGroup(base, op.groupId)) return "la lista ya no existe en esta versión";
      if (op.op !== "addItem" && !findGroup(base, op.groupId)?.group.items.some((i) => i.itemId === op.itemId)) {
        return "alguien borró ese elemento";
      }
      return null;
    case "setItemBlock":
    case "clearItemBlock":
      return findItemBlock(base, op.groupId, op.itemId, op.blockId) ? null : "alguien borró ese elemento";
    case "setSectionVisible":
    case "setSectionVariant":
      return base.sections.some((s) => s.key === op.sectionKey) ? null : "la sección ya no existe";
    case "reorderSections":
      return op.order.every((k) => base.sections.some((s) => s.key === k)) ? null : "el orden cita secciones que ya no existen";
    case "setTheme":
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Instancia por defecto y selectores memoizados (04 §10.2)
// ---------------------------------------------------------------------------------------------

export const useEditorStore = createEditorStore();

/**
 * Filas de la lista de secciones. EXTENSIÓN 3-5: `SectionList`/`SectionRow` consumen esto.
 *
 * ⚠ El `map` va en un `useMemo`, NO dentro del selector con `useShallow`. `useShallow` compara los
 * elementos del array con `Object.is`, así que un array de objetos RECIÉN CREADOS nunca es igual al
 * anterior: el selector devuelve una instantánea distinta en cada render y `useSyncExternalStore`
 * entra en bucle («Maximum update depth exceeded», React #185 — medido en el navegador, no
 * supuesto). Se selecciona la referencia ESTABLE que mantiene Immer (`composed.sections`) y se
 * deriva encima.
 */
export function useSectionRows() {
  const sections = useEditorStore((s) => s.composed?.sections);
  return useMemo(
    () =>
      (sections ?? []).map((sec, i) => ({
        key: sec.key,
        title: sec.title,
        visible: sec.visible,
        variant: sec.variant,
        type: sec.type,
        order: i,
      })),
    [sections],
  );
}

/** Bloque (o grupo) activo según `selection`. EXTENSIÓN 3-5: `BlockForm` consume esto. */
export function useActiveBlock() {
  return useEditorStore((s) => {
    const sel = s.selection;
    if (!sel || !s.composed) return null;
    if (sel.itemId && sel.itemBlockId) {
      return findItemBlock(s.composed as ComposedDocument, sel.blockId, sel.itemId, sel.itemBlockId)?.block ?? null;
    }
    const escalar = findBlock(s.composed as ComposedDocument, sel.blockId);
    if (escalar) return escalar.block;
    return findGroup(s.composed as ComposedDocument, sel.blockId)?.group ?? null;
  });
}

/** `report.stillDefault.includes(blockId)` — insignia «contenido de ejemplo» (H-03). */
export function useIsDefault(blockId: string): boolean {
  return useEditorStore((s) => s.report?.stillDefault.includes(blockId) ?? false);
}

/** Aviso LOCAL; la verdad la da el preflight del servidor (04 §10.2). */
export function useCanPublish(): boolean {
  return useEditorStore((s) => (s.report?.missingRequired.length ?? 1) === 0 && (s.report?.stillDefault.length ?? 1) === 0);
}

/** Cadena es-MX del indicador de guardado (`SaveIndicator`). */
export function saveLabel(saveState: SaveState, lastSavedAt: number | null): string {
  switch (saveState) {
    case "saving":
      return "Guardando…";
    case "retrying":
      return "Reintentando…";
    case "offline":
      return "Sin conexión — tus cambios se guardarán cuando vuelva";
    case "conflict":
      return "Cambios en pausa";
    case "error":
      return "No pudimos guardar";
    case "dirty":
      return "Sin guardar";
    case "idle":
      return lastSavedAt === null ? "Todo guardado" : `Guardado ${new Date(lastSavedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  }
}

export function useSaveLabel(): string {
  return useEditorStore((s) => saveLabel(s.saveState, s.lastSavedAt));
}

export function useUndoRedoLabels() {
  return useEditorStore(
    useShallow((s) => ({
      undo: s.undo.at(-1)?.label ?? null,
      redo: s.redo.at(-1)?.label ?? null,
      canUndo: s.undo.length > 0,
      canRedo: s.redo.length > 0,
    })),
  );
}

/** Ítems de un grupo. EXTENSIÓN 3-5: `GroupField`/`PhotoManager` consumen esto. */
export function useGroupItems(groupId: string) {
  const composed = useEditorStore((s) => s.composed);
  return useMemo(
    () => (composed ? (findGroup(composed as ComposedDocument, groupId)?.group.items ?? []) : []),
    [composed, groupId],
  );
}

export { refKey };
export type { BlockRef, PatchEntry };
