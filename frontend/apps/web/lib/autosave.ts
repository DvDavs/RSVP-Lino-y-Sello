// lib/autosave.ts — cola de autoguardado del editor (`04 §12`). Módulo SIN estado global: todo lo
// que hay aquí son parámetros, funciones puras y dos utilidades de plataforma (localStorage y el
// `fetch` con `keepalive`). `lib/store.ts` es quien tiene la cola y quien llama a estas piezas.
//
// La separación no es cosmética: la clasificación de errores (§12.5), el troceado (U-12) y el
// `keepalive` (U-16) son exactamente lo que hay que poder probar sin montar zustand ni el DOM.
import type { Operation } from "@invitaciones/schema";
import { ApiClientValidationError, ApiError, SessionError, UnknownApiError } from "./errors.ts";
import { getApiBaseUrl, getAuthToken } from "./api-client.ts";
import type { OperationBatchRequest, RevisionConflictBody } from "./api-types.ts";

// ---------------------------------------------------------------------------------------------
// 1. Parámetros (04 §12.1)
// ---------------------------------------------------------------------------------------------

/** Debounce de teclado. Valor de ADR-019 (más conservador en tráfico que los ~800 ms del research). */
export const DEBOUNCE_MS = 2000;
/** Sin `maxWait`, escribir sin pausa 60 s no guardaría nada en 60 s (objeción O-10). */
export const MAX_WAIT_MS = 10_000;
/** Límite de `OperationBatch` (`operations.ts`: `.min(1).max(50)`). */
export const MAX_BATCH_OPS = 50;
/** 3 reintentos con espera creciente y *jitter* ±20 %. */
export const RETRY_DELAYS_MS = [1000, 4000, 10_000] as const;
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
/** Límite de la especificación de `fetch`: 64 KiB por petición `keepalive`. Se deja margen. */
export const KEEPALIVE_MAX_BYTES = 60_000;
/** Clave de la persistencia local (§12.7). */
export function pendingStorageKey(invitationId: number): string {
  return `tpl:pending:${invitationId}`;
}

export interface PendingBatch {
  clientBatchId: string;
  ops: Operation[];
  attempt: number;
  queuedAt: number;
}

export type SaveState = "idle" | "dirty" | "saving" | "retrying" | "offline" | "conflict" | "error";

// ---------------------------------------------------------------------------------------------
// 2. `clientBatchId` — `^[A-Za-z0-9_-]{8,64}$` (contratos §4; uno corto sale 400 TPL_MALFORMED_JSON)
// ---------------------------------------------------------------------------------------------

export const CLIENT_BATCH_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function newBatchId(): string {
  const base =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  // 26 caracteres: holgadamente dentro de [8,64] y sin caracteres fuera de la clase.
  return `b${base.slice(0, 25)}`;
}

// ---------------------------------------------------------------------------------------------
// 3. Troceado del borrador (04 §12.2 `flushDraft`, prueba U-12)
// ---------------------------------------------------------------------------------------------

/**
 * Trocea `ops` en lotes de como mucho `MAX_BATCH_OPS`, **en orden**. 120 operaciones ⇒ 50/50/20.
 * Nunca se envía un lote mayor que el límite del esquema, ni se descarta el resto (P1).
 */
export function splitIntoBatches(ops: readonly Operation[], now: number = Date.now()): PendingBatch[] {
  const lotes: PendingBatch[] = [];
  for (let i = 0; i < ops.length; i += MAX_BATCH_OPS) {
    lotes.push({ clientBatchId: newBatchId(), ops: ops.slice(i, i + MAX_BATCH_OPS), attempt: 0, queuedAt: now });
  }
  return lotes;
}

/** Espera del reintento `n` (0-based) con *jitter* ±20 % (§12.1). */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? RETRY_DELAYS_MS[0];
  const jitter = 1 + (random() * 0.4 - 0.2);
  return Math.round(base * jitter);
}

// ---------------------------------------------------------------------------------------------
// 4. Tabla de errores de guardado (04 §12.5, COMPLETA)
// ---------------------------------------------------------------------------------------------

/**
 * Qué hace el cliente ante un fallo. Cada rama corresponde a una fila de la tabla de §12.5; no hay
 * rama "otros" que se trague nada: lo desconocido cae en `"retry"` con el mensaje real (P1).
 */
export type SaveFailure =
  /** Red caída o 5xx: reintenta 3 veces y luego se reengancha a `window.online`. */
  | { kind: "retry"; mensaje: string; offline: boolean }
  /** 409 TPL_REVISION_CONFLICT: diálogo modal de tres opciones (§12.6). */
  | { kind: "conflict"; mensaje: string; body: RevisionConflictBody | null }
  /** 422 que invalida el lote: se descarta, se revierte y se recarga el documento. */
  | { kind: "drop-batch"; mensaje: string; codigo: string; recargar: boolean }
  /** 403 TPL_FORBIDDEN: se detiene el autoguardado y el editor pasa a solo lectura. */
  | { kind: "readonly"; mensaje: string }
  /** 401: refresco de sesión y un reintento; conservando el `localStorage` de pendientes. */
  | { kind: "session"; mensaje: string }
  /** 413: trocear a la mitad y reintentar una vez; si es de UNA sola operación, descartarla. */
  | { kind: "split"; mensaje: string };

const MSG = {
  offline: "Sin conexión — tus cambios se guardarán cuando vuelva",
  servidor: "No pudimos guardar — reintentando…",
  conflicto: "Esta invitación cambió en otro lugar",
  invalido: (detalle: string) => `No pudimos aplicar un cambio: ${detalle}. Hemos vuelto al último estado guardado`,
  fotoNoDisponible: "No pudimos aplicar un cambio: esta foto ya no está disponible. Hemos vuelto al último estado guardado",
  plantillaCambio: "Tu plantilla se actualizó; recargamos tu invitación",
  sinAcceso: "Ya no tienes acceso a esta invitación",
  sesion: "Tu sesión expiró. Vuelve a iniciar sesión para seguir guardando",
  demasiadoGrande: "Ese texto es demasiado largo para guardarlo",
} as const;

export function classifySaveError(error: unknown): SaveFailure {
  // Fallo de transporte: `TypeError: Failed to fetch` (§12.5 fila 1).
  if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
    return { kind: "retry", mensaje: MSG.offline, offline: true };
  }
  if (error instanceof SessionError) {
    return error.statusCode === 401
      ? { kind: "session", mensaje: MSG.sesion }
      : { kind: "readonly", mensaje: MSG.sinAcceso };
  }
  if (error instanceof ApiClientValidationError) {
    // Lote malformado ANTES de enviar: reintentarlo sería un bucle. Se descarta y se explica.
    return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: "TPL_MALFORMED_JSON", recargar: true };
  }
  if (error instanceof UnknownApiError) {
    if (error.statusCode >= 500) return { kind: "retry", mensaje: MSG.servidor, offline: false };
    if (error.statusCode === 413) return { kind: "split", mensaje: MSG.demasiadoGrande };
    return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: `HTTP_${error.statusCode}`, recargar: true };
  }
  if (error instanceof ApiError) {
    switch (error.code) {
      case "TPL_REVISION_CONFLICT":
        return { kind: "conflict", mensaje: MSG.conflicto, body: extraerConflicto(error.details) };
      case "TPL_OPERATION_INVALID":
      case "TPL_TEMP_ID_UNRESOLVED":
      case "TPL_TEMP_ID_DUPLICATE":
      case "TPL_ASSET_SPEC_MISMATCH":
      case "TPL_BLOCK_NOT_EDITABLE":
        return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: error.code, recargar: true };
      case "TPL_ASSET_NOT_OWNED":
      case "TPL_ASSET_NOT_FOUND":
        return { kind: "drop-batch", mensaje: MSG.fotoNoDisponible, codigo: error.code, recargar: true };
      case "TPL_BLOCK_UNKNOWN":
        // Señal casi segura de que la versión de plantilla cambió bajo los pies (§12.5).
        return { kind: "drop-batch", mensaje: MSG.plantillaCambio, codigo: error.code, recargar: true };
      case "TPL_FORBIDDEN":
      case "TPL_INVITATION_UNAVAILABLE":
        return { kind: "readonly", mensaje: MSG.sinAcceso };
      case "TPL_BODY_TOO_LARGE":
      case "TPL_DOCUMENT_TOO_LARGE":
        return { kind: "split", mensaje: MSG.demasiadoGrande };
      case "TPL_MALFORMED_JSON":
        return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: error.code, recargar: true };
      case "TPL_NOT_MIGRATED":
      case "TPL_DOCUMENT_NOT_STARTED":
        return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: error.code, recargar: true };
      case "TPL_INTERNAL":
        return { kind: "retry", mensaje: MSG.servidor, offline: false };
      default:
        if (error.statusCode >= 500) return { kind: "retry", mensaje: MSG.servidor, offline: false };
        if (error.statusCode === 413) return { kind: "split", mensaje: MSG.demasiadoGrande };
        // Código `TPL_*` no contemplado: se descarta el lote con SU mensaje real, nunca en silencio.
        return { kind: "drop-batch", mensaje: MSG.invalido(error.message), codigo: error.code, recargar: true };
    }
  }
  return { kind: "retry", mensaje: error instanceof Error ? error.message : MSG.servidor, offline: false };
}

/** El 409 trae `{currentRevision, document, composed, report}` en `details` (03 §3.4 punto 5). */
function extraerConflicto(details: unknown): RevisionConflictBody | null {
  if (details === null || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const anidado = typeof d.conflict === "object" && d.conflict !== null ? (d.conflict as Record<string, unknown>) : d;
  if (typeof anidado.currentRevision !== "number") return null;
  return {
    currentRevision: anidado.currentRevision,
    document: anidado.document as RevisionConflictBody["document"],
    composed: anidado.composed as RevisionConflictBody["composed"],
    report: anidado.report as RevisionConflictBody["report"],
  };
}

/** Trocea un lote a la mitad (§12.5, fila 413). `null` ⇒ una sola operación: hay que descartarla. */
export function splitBatchInHalf(batch: PendingBatch): [PendingBatch, PendingBatch] | null {
  if (batch.ops.length < 2) return null;
  const mitad = Math.ceil(batch.ops.length / 2);
  return [
    { clientBatchId: newBatchId(), ops: batch.ops.slice(0, mitad), attempt: 0, queuedAt: batch.queuedAt },
    { clientBatchId: newBatchId(), ops: batch.ops.slice(mitad), attempt: 0, queuedAt: batch.queuedAt },
  ];
}

// ---------------------------------------------------------------------------------------------
// 5. Persistencia local y recuperación de sesión (04 §12.7, §7.5)
// ---------------------------------------------------------------------------------------------

export interface PendingSnapshot {
  revision: number;
  draft: Operation[];
  queue: { clientBatchId: string; ops: Operation[] }[];
  at: number;
  templateVersion: { slug: string; version: string } | null;
}

function localStorageSiDisponible(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Ventana privada o almacenamiento bloqueado: no es la fuente de verdad, se sigue sin él.
    return null;
  }
}

export function persistPending(invitationId: number, snapshot: PendingSnapshot): void {
  const ls = localStorageSiDisponible();
  if (!ls) return;
  try {
    ls.setItem(pendingStorageKey(invitationId), JSON.stringify(snapshot));
  } catch {
    /* cuota llena: se ignora; la cola en memoria sigue siendo la verdad (§12.7). */
  }
}

export function readPending(invitationId: number): PendingSnapshot | null {
  const ls = localStorageSiDisponible();
  if (!ls) return null;
  try {
    const crudo = ls.getItem(pendingStorageKey(invitationId));
    if (crudo === null) return null;
    const parseado: unknown = JSON.parse(crudo);
    if (parseado === null || typeof parseado !== "object") return null;
    const p = parseado as Partial<PendingSnapshot>;
    if (!Array.isArray(p.draft) || !Array.isArray(p.queue) || typeof p.at !== "number") return null;
    return {
      revision: typeof p.revision === "number" ? p.revision : 0,
      draft: p.draft,
      queue: p.queue,
      at: p.at,
      templateVersion: p.templateVersion ?? null,
    };
  } catch {
    return null;
  }
}

export function clearPending(invitationId: number): void {
  const ls = localStorageSiDisponible();
  if (!ls) return;
  try {
    ls.removeItem(pendingStorageKey(invitationId));
  } catch {
    /* idem */
  }
}

/** Todas las operaciones sin confirmar de un snapshot, en orden (draft va DESPUÉS de la cola). */
export function operacionesPendientes(s: PendingSnapshot): Operation[] {
  return [...s.queue.flatMap((b) => b.ops), ...s.draft];
}

// ---------------------------------------------------------------------------------------------
// 6. Cierre de pestaña con `keepalive` (04 §12.7, prueba U-16)
// ---------------------------------------------------------------------------------------------

export interface KeepaliveResult {
  readonly enviado: boolean;
  /** `"vacio"` | `"demasiado-grande"` | `"sin-sesion"` — por qué NO se envió (P1: nunca en silencio). */
  readonly motivo?: "vacio" | "demasiado-grande" | "sin-sesion";
  readonly bytes?: number;
}

/**
 * Envía el borrador con `fetch(..., {keepalive:true})` al ocultarse la pestaña.
 *
 * `keepalive` sobrevive al cierre y SÍ admite cabeceras — a diferencia de `sendBeacon`, que no
 * permite `Authorization` y por eso no sirve aquí (§12.7). El token se lee por el accesor PÚBLICO
 * de `lib/api-client.ts` (`getAuthToken`), que es el único lugar del proyecto que lo custodia; no
 * se duplica su almacenamiento (P8). Este camino NUNCA existe dentro del lienzo (C4).
 */
export function sendKeepaliveBatch(
  invitationId: number,
  body: OperationBatchRequest,
  deps: { fetchImpl?: typeof fetch; baseUrl?: string; token?: string | null } = {},
): KeepaliveResult {
  if (body.operations.length === 0) return { enviado: false, motivo: "vacio" };
  const json = JSON.stringify(body);
  const bytes = new TextEncoder().encode(json).length;
  if (bytes >= KEEPALIVE_MAX_BYTES) return { enviado: false, motivo: "demasiado-grande", bytes };
  const token = deps.token !== undefined ? deps.token : getAuthToken();
  if (token === null) return { enviado: false, motivo: "sin-sesion", bytes };
  const f = deps.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!f) return { enviado: false, motivo: "sin-sesion", bytes };
  const base = deps.baseUrl ?? getApiBaseUrl();
  void f(`${base}/editor/invitations/${invitationId}/document/operations`, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: json,
  }).catch(() => {
    /* la pestaña se está cerrando: no hay a quién informar. La cola queda en `localStorage`. */
  });
  return { enviado: true, bytes };
}

// ---------------------------------------------------------------------------------------------
// 7. Temporizadores del debounce + `maxWait` (04 §12.2 `enqueue`)
// ---------------------------------------------------------------------------------------------

export interface AutosaveTimers {
  /** Programa el vaciado. `immediate` salta el debounce (04 §12.1). */
  schedule(immediate: boolean): void;
  /** Cancela el temporizador pendiente y olvida el `maxWait` (lo llama `flushDraft`). */
  cancel(): void;
  /** Momento en que vencerá el `maxWait`, o `null`. Solo para pruebas y diagnóstico. */
  maxWaitDeadline(): number | null;
}

export function createAutosaveTimers(opts: {
  onFlush: () => void;
  now?: () => number;
  setTimeoutImpl?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutImpl?: (h: ReturnType<typeof setTimeout>) => void;
  debounceMs?: number;
  maxWaitMs?: number;
}): AutosaveTimers {
  const now = opts.now ?? (() => Date.now());
  const st = opts.setTimeoutImpl ?? ((fn, ms) => setTimeout(fn, ms));
  const ct = opts.clearTimeoutImpl ?? ((h) => clearTimeout(h));
  const debounce = opts.debounceMs ?? DEBOUNCE_MS;
  const maxWait = opts.maxWaitMs ?? MAX_WAIT_MS;

  let handle: ReturnType<typeof setTimeout> | null = null;
  let deadline: number | null = null;

  function cancel(): void {
    if (handle !== null) ct(handle);
    handle = null;
    deadline = null;
  }

  return {
    schedule(immediate: boolean): void {
      if (immediate) {
        cancel();
        opts.onFlush();
        return;
      }
      if (deadline === null) deadline = now() + maxWait;
      if (handle !== null) ct(handle);
      const espera = Math.max(0, Math.min(debounce, deadline - now()));
      handle = st(() => {
        handle = null;
        deadline = null;
        opts.onFlush();
      }, espera);
    },
    cancel,
    maxWaitDeadline: () => deadline,
  };
}
