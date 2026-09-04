// lib/autosave.test.ts — U-12 (troceado a 50) y U-16 (`keepalive` al ocultar la pestaña) de
// `04 §20.1`, más la tabla completa de errores de `§12.5` y la persistencia local de `§12.7`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Operation } from "@invitaciones/schema";
import {
  classifySaveError,
  clearPending,
  CLIENT_BATCH_ID_PATTERN,
  createAutosaveTimers,
  DEBOUNCE_MS,
  KEEPALIVE_MAX_BYTES,
  MAX_BATCH_OPS,
  MAX_WAIT_MS,
  newBatchId,
  operacionesPendientes,
  pendingStorageKey,
  persistPending,
  readPending,
  retryDelayMs,
  sendKeepaliveBatch,
  splitBatchInHalf,
  splitIntoBatches,
} from "./autosave.ts";
import { ApiClientValidationError, ApiError, SessionError, UnknownApiError } from "./errors.ts";

function ops(n: number): Operation[] {
  return Array.from({ length: n }, (_, i) => ({ op: "setBlock", blockId: `b${i}`, value: { kind: "text", value: `v${i}` } }) as Operation);
}

function apiError(code: string, status = 422, details?: unknown): ApiError {
  return new ApiError({ timestamp: "x", statusCode: status, code, message: `mensaje de ${code}`, details }, status);
}

beforeEach(() => {
  window.localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-12 — `flushDraft` con 120 operaciones ⇒ tres lotes de 50/50/20, en orden
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-12 · troceado del borrador (04 §12.2)", () => {
  it("120 operaciones ⇒ 50 / 50 / 20, EN ORDEN y sin perder ninguna", () => {
    const lotes = splitIntoBatches(ops(120), 1000);
    expect(lotes.map((l) => l.ops.length)).toEqual([50, 50, 20]);
    const planas = lotes.flatMap((l) => l.ops);
    expect(planas).toHaveLength(120);
    expect((planas[0] as { blockId: string }).blockId).toBe("b0");
    expect((planas[119] as { blockId: string }).blockId).toBe("b119");
  });

  it("ningún lote excede el límite del esquema (`OperationBatch` .max(50))", () => {
    for (const n of [1, 49, 50, 51, 99, 100, 101, 500]) {
      for (const lote of splitIntoBatches(ops(n))) expect(lote.ops.length).toBeLessThanOrEqual(MAX_BATCH_OPS);
    }
  });

  it("cada lote lleva un `clientBatchId` propio que casa `^[A-Za-z0-9_-]{8,64}$`", () => {
    const lotes = splitIntoBatches(ops(120));
    const ids = lotes.map((l) => l.clientBatchId);
    expect(new Set(ids).size).toBe(3); // uno por lote: la idempotencia es por (document_id, clientBatchId)
    for (const id of ids) expect(id).toMatch(CLIENT_BATCH_ID_PATTERN);
  });

  it("`newBatchId` nunca produce un identificador corto (uno corto sale 400 TPL_MALFORMED_JSON)", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = newBatchId();
      expect(id).toMatch(CLIENT_BATCH_ID_PATTERN);
      expect(id.length).toBeGreaterThanOrEqual(8);
      expect(id.length).toBeLessThanOrEqual(64);
    }
  });

  it("splitBatchInHalf trocea a la mitad; con una sola operación devuelve null (hay que descartarla)", () => {
    const lote = { clientBatchId: newBatchId(), ops: ops(7), attempt: 1, queuedAt: 0 };
    const mitades = splitBatchInHalf(lote);
    expect(mitades?.[0]?.ops).toHaveLength(4);
    expect(mitades?.[1]?.ops).toHaveLength(3);
    expect(splitBatchInHalf({ ...lote, ops: ops(1) })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Debounce + maxWait (04 §12.1)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("temporizadores del autoguardado", () => {
  it("el debounce reprograma; el `maxWait` de 10 s acota la espera total (objeción O-10)", () => {
    let ahora = 0;
    const programados: { fn: () => void; ms: number }[] = [];
    const timers = createAutosaveTimers({
      onFlush: () => {
        /* medido en el `maxWaitDeadline` */
      },
      now: () => ahora,
      setTimeoutImpl: (fn, ms) => {
        programados.push({ fn, ms });
        return programados.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeoutImpl: () => {},
    });
    timers.schedule(false);
    expect(programados[0]?.ms).toBe(DEBOUNCE_MS);
    expect(timers.maxWaitDeadline()).toBe(MAX_WAIT_MS);
    // Se sigue tecleando durante 9 s: la espera se recorta para no pasar del `maxWait`.
    ahora = 9000;
    timers.schedule(false);
    expect(programados.at(-1)?.ms).toBe(1000);
    ahora = 10_500;
    timers.schedule(false);
    expect(programados.at(-1)?.ms).toBe(0);
  });

  it("`immediate` vacía sin esperar (04 §12.1, disparo inmediato)", () => {
    const vaciados: number[] = [];
    const timers = createAutosaveTimers({
      onFlush: () => vaciados.push(1),
      setTimeoutImpl: () => 0 as unknown as ReturnType<typeof setTimeout>,
      clearTimeoutImpl: () => {},
    });
    timers.schedule(true);
    expect(vaciados).toHaveLength(1);
    expect(timers.maxWaitDeadline()).toBeNull();
  });

  it("la espera del reintento crece y lleva jitter de ±20 %", () => {
    expect(retryDelayMs(0, () => 0.5)).toBe(1000);
    expect(retryDelayMs(1, () => 0.5)).toBe(4000);
    expect(retryDelayMs(2, () => 0.5)).toBe(10_000);
    expect(retryDelayMs(0, () => 0)).toBe(800);
    expect(retryDelayMs(0, () => 1)).toBe(1200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Tabla de errores de guardado (04 §12.5) — completa, fila por fila
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("clasificación de errores de guardado (04 §12.5)", () => {
  it("red caída (`TypeError: Failed to fetch`) ⇒ reintentar, marcado como offline", () => {
    const f = classifySaveError(new TypeError("Failed to fetch"));
    expect(f.kind).toBe("retry");
    expect(f.kind === "retry" && f.offline).toBe(true);
    expect(f.mensaje).toContain("Sin conexión");
  });

  it("5xx ⇒ reintentar, NO offline", () => {
    const f = classifySaveError(new UnknownApiError(503, "gateway"));
    expect(f.kind).toBe("retry");
    expect(f.kind === "retry" && f.offline).toBe(false);
  });

  it("409 TPL_REVISION_CONFLICT ⇒ conflicto, con el cuerpo del servidor extraído", () => {
    const f = classifySaveError(apiError("TPL_REVISION_CONFLICT", 409, { currentRevision: 7, document: {}, composed: {}, report: {} }));
    expect(f.kind).toBe("conflict");
    expect(f.kind === "conflict" && f.body?.currentRevision).toBe(7);
  });

  it("409 sin cuerpo utilizable sigue siendo conflicto (nunca se degrada a error genérico)", () => {
    const f = classifySaveError(apiError("TPL_REVISION_CONFLICT", 409, undefined));
    expect(f.kind).toBe("conflict");
    expect(f.kind === "conflict" && f.body).toBeNull();
  });

  it("422 TPL_OPERATION_INVALID ⇒ descartar el lote y recargar (nunca reintentar: sería un bucle)", () => {
    const f = classifySaveError(apiError("TPL_OPERATION_INVALID"));
    expect(f.kind).toBe("drop-batch");
    expect(f.kind === "drop-batch" && f.recargar).toBe(true);
    expect(f.mensaje).toContain("Hemos vuelto al último estado guardado");
  });

  it("422 TPL_ASSET_NOT_OWNED ⇒ descartar, con el mensaje de la foto", () => {
    expect(classifySaveError(apiError("TPL_ASSET_NOT_OWNED")).mensaje).toContain("esta foto ya no está disponible");
  });

  it("422 TPL_BLOCK_UNKNOWN ⇒ recarga completa con el mensaje de plantilla actualizada", () => {
    const f = classifySaveError(apiError("TPL_BLOCK_UNKNOWN"));
    expect(f.kind).toBe("drop-batch");
    expect(f.mensaje).toContain("Tu plantilla se actualizó");
  });

  it("403 TPL_FORBIDDEN ⇒ solo lectura", () => {
    expect(classifySaveError(apiError("TPL_FORBIDDEN", 403)).kind).toBe("readonly");
  });

  it("401 de la cadena de filtros (sin TPL_*) ⇒ sesión; 403 ⇒ solo lectura", () => {
    expect(classifySaveError(new SessionError(401, "")).kind).toBe("session");
    expect(classifySaveError(new SessionError(403, "")).kind).toBe("readonly");
  });

  it("413 ⇒ trocear a la mitad", () => {
    expect(classifySaveError(new UnknownApiError(413, "")).kind).toBe("split");
    expect(classifySaveError(apiError("TPL_BODY_TOO_LARGE", 413)).kind).toBe("split");
  });

  it("un lote malformado detectado ANTES de enviar se descarta con su mensaje real", () => {
    const f = classifySaveError(new ApiClientValidationError("clientBatchId corto"));
    expect(f.kind).toBe("drop-batch");
    expect(f.mensaje).toContain("clientBatchId corto");
  });

  it("un código TPL_* no contemplado NO se traga: se descarta con SU mensaje (P1)", () => {
    const f = classifySaveError(apiError("TPL_ALGO_NUEVO", 422));
    expect(f.kind).toBe("drop-batch");
    expect(f.mensaje).toContain("mensaje de TPL_ALGO_NUEVO");
  });

  it("lo desconocido cae en reintentar con el texto original, nunca en silencio", () => {
    expect(classifySaveError(new Error("vaya")).mensaje).toBe("vaya");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// U-16 — `visibilitychange` con borrador pequeño ⇒ `fetch` con `keepalive: true`
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("U-16 · cierre de pestaña con keepalive (04 §12.7)", () => {
  const cuerpo = { baseRevision: 3, clientBatchId: "lote1234abcd", operations: ops(2) };

  it("emite UN fetch con `keepalive: true` y cabecera Authorization", () => {
    const espia = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    const r = sendKeepaliveBatch(7, cuerpo, { fetchImpl: espia as unknown as typeof fetch, baseUrl: "http://api", token: "jwt-x" });
    expect(r.enviado).toBe(true);
    expect(espia).toHaveBeenCalledTimes(1);
    const [url, init] = espia.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api/editor/invitations/7/document/operations");
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("POST");
    // `sendBeacon` no admite `Authorization`; por eso se usa `fetch` con keepalive (§12.7).
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer jwt-x");
    expect(JSON.parse(init.body as string)).toEqual(cuerpo);
  });

  it("un borrador que pasa del límite de 64 KiB NO se manda por keepalive, y lo dice", () => {
    const espia = vi.fn();
    const enorme = { ...cuerpo, operations: [{ op: "setBlock", blockId: "b", value: { kind: "text", value: "x".repeat(KEEPALIVE_MAX_BYTES) } }] as Operation[] };
    const r = sendKeepaliveBatch(7, enorme, { fetchImpl: espia as unknown as typeof fetch, baseUrl: "http://api", token: "jwt-x" });
    expect(r.enviado).toBe(false);
    expect(r.motivo).toBe("demasiado-grande");
    expect(espia).not.toHaveBeenCalled();
  });

  it("sin sesión no se manda nada (y se dice el motivo, P1)", () => {
    const r = sendKeepaliveBatch(7, cuerpo, { fetchImpl: vi.fn() as unknown as typeof fetch, token: null });
    expect(r).toEqual({ enviado: false, motivo: "sin-sesion", bytes: expect.any(Number) });
  });

  it("un borrador vacío no genera petición", () => {
    expect(sendKeepaliveBatch(7, { ...cuerpo, operations: [] }, { token: "x" }).motivo).toBe("vacio");
  });

  it("un fallo del fetch no propaga (la pestaña se está cerrando)", () => {
    const espia = vi.fn(() => Promise.reject(new Error("cerrado")));
    expect(() => sendKeepaliveBatch(7, cuerpo, { fetchImpl: espia as unknown as typeof fetch, token: "x" })).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Persistencia local (04 §12.7) y recuperación de sesión (§7.5)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

describe("persistencia local", () => {
  it("guarda y relee el borrador y la cola bajo `tpl:pending:{id}`", () => {
    const snapshot = {
      revision: 4,
      draft: ops(2),
      queue: [{ clientBatchId: "lote1234abcd", ops: ops(1) }],
      at: 1_700_000_000_000,
      templateVersion: { slug: "boda-clasica", version: "1.0.0" },
    };
    persistPending(9, snapshot);
    expect(window.localStorage.getItem(pendingStorageKey(9))).not.toBeNull();
    expect(readPending(9)).toEqual(snapshot);
    expect(operacionesPendientes(snapshot)).toHaveLength(3);
    clearPending(9);
    expect(readPending(9)).toBeNull();
  });

  it("un contenido corrupto devuelve null en vez de romper el editor", () => {
    window.localStorage.setItem(pendingStorageKey(9), "{no es json");
    expect(readPending(9)).toBeNull();
    window.localStorage.setItem(pendingStorageKey(9), JSON.stringify({ draft: "no es array" }));
    expect(readPending(9)).toBeNull();
  });

  it("si `localStorage` lanza (modo privado, cuota) no se propaga: no es la fuente de verdad", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => persistPending(9, { revision: 0, draft: [], queue: [], at: 0, templateVersion: null })).not.toThrow();
    spy.mockRestore();
  });
});
