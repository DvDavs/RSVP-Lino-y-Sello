// lib/canvas-bridge.ts — lado PADRE del puente con el lienzo aislado (`04 §9`, `handoffs/3-0b.md` §1).
//
// El saludo NO es el de la letra de `04 §9.2`: esa versión falla en las dos direcciones y está
// MEDIDO en la compuerta A1-A8 (ADR-3-0b-03). Lo que se implementa aquí es la corrección del
// handoff, literal:
//   · `HELLO` en `onLoad` **y reintento cada 800 ms, hasta 6 veces**, mientras no llegue `READY`
//     (el evento `load` puede adelantarse al montaje de React y el `onLoad` puede no ejecutarse).
//   · Un `MessageChannel` NUEVO por intento; convergencia de puerto: el padre adopta el puerto POR
//     EL QUE LLEGÓ el `READY` y acepta cualquier `nonce` que él mismo haya enviado.
//   · Validación en el padre por `event.source === iframe.contentWindow` + `nonce`, **NUNCA por
//     `event.origin`**: el lienzo tiene origen opaco y manda `"null"` (medido).
//   · `targetOrigin: "*"` siempre — un origen opaco no es direccionable. Aceptable porque ningún
//     mensaje lleva secretos (C4/P8): el token de sesión JAMÁS cruza al lienzo.
//
// P1: todo entrante pasa por `classifyOutbound`, no por un `safeParse` desnudo. Las cuatro
// categorías se tratan distinto — `"incompatible"` es lo que dispara «vista previa incompatible»
// (U-15), `"foreign"` es ruido de extensiones y `"invalid"` es un mensaje de v1 malformado.
import {
  CANVAS_NONCE_LENGTH,
  CANVAS_PROTOCOL_TAG,
  CANVAS_PROTOCOL_VERSION,
  classifyOutbound,
  type BlockRef,
  type CanvasInbound,
} from "@invitaciones/schema/canvas";
import type { ComposedDocument } from "@invitaciones/schema";
import type { PatchEntry } from "./composed-patch.ts";

/** Reintento del `HELLO` (`handoffs/3-0b.md` §1: cada 800 ms, 6 veces). */
export const HELLO_RETRY_MS = 800;
export const HELLO_MAX_ATTEMPTS = 6;
/** `READY` en 5 s; `PING`→`PONG` en 3 s (04 §9.2). */
export const READY_TIMEOUT_MS = 5000;
export const PING_TIMEOUT_MS = 3000;

export type CanvasStatus = "idle" | "loading" | "ready" | "error" | "incompatible";

export interface CanvasBridgeHandlers {
  onReady?: (buildId: string) => void;
  onBlockClicked?: (ref: BlockRef) => void;
  onSectionInView?: (sectionKey: string) => void;
  onResized?: (height: number) => void;
  onKeyCommand?: (command: "undo" | "redo" | "save" | "escape") => void;
  onRenderError?: (info: { sectionKey?: string; message: string; digest?: string }) => void;
  onRenderWarning?: (info: { code: "unknown-variant" | "unmapped-role" | "missing-font"; detail: string }) => void;
  /** Versión de protocolo distinta de 1: «vista previa incompatible, recarga la página» (U-15). */
  onIncompatible?: (version: number) => void;
  /** Mensaje con la marca del protocolo pero malformado. Se registra; nunca se procesa a medias (P1). */
  onInvalid?: (detalle: string) => void;
  /** Se agotó la espera del `READY`. `attempt` 1 ⇒ el padre recarga el iframe; 2 ⇒ degradación (§8.8). */
  onReadyTimeout?: (attempt: number) => void;
}

export interface CanvasBridge {
  /** Arranca el saludo. Idempotente mientras no se llame a `destroy()`. */
  start(): void;
  /** Vuelve a empezar el saludo (tras recargar el iframe con `?r=2`). */
  restart(): void;
  status(): CanvasStatus;
  sendRender(composed: ComposedDocument, revision: number): void;
  sendPatch(entries: PatchEntry[]): void;
  sendSelect(ref: BlockRef | null): void;
  sendScrollToSection(sectionKey: string): void;
  sendViewport(width: "mobile" | "desktop"): void;
  sendPreviewTheme(paletteId: string | null, fontSetId: string | null): void;
  /** Diagnóstico. Resuelve `true` si llega el `PONG` dentro de `PING_TIMEOUT_MS`. */
  ping(): Promise<boolean>;
  destroy(): void;
}

function nuevoNonce(): string {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(CANVAS_NONCE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out += abc[b % abc.length];
    return out;
  }
  while (out.length < CANVAS_NONCE_LENGTH) out += abc[Math.floor(Math.random() * abc.length)];
  return out.slice(0, CANVAS_NONCE_LENGTH);
}

export function createCanvasBridge(
  frame: HTMLIFrameElement,
  handlers: CanvasBridgeHandlers,
  opts: {
    helloRetryMs?: number;
    maxAttempts?: number;
    readyTimeoutMs?: number;
    setTimeoutImpl?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeoutImpl?: (h: ReturnType<typeof setTimeout>) => void;
  } = {},
): CanvasBridge {
  const retryMs = opts.helloRetryMs ?? HELLO_RETRY_MS;
  const maxIntentos = opts.maxAttempts ?? HELLO_MAX_ATTEMPTS;
  const readyMs = opts.readyTimeoutMs ?? READY_TIMEOUT_MS;
  const st = opts.setTimeoutImpl ?? ((fn, ms) => setTimeout(fn, ms));
  const ct = opts.clearTimeoutImpl ?? ((h) => clearTimeout(h));

  let estado: CanvasStatus = "idle";
  let puerto: MessagePort | null = null;
  let seqSaliente = 0;
  let ultimoSeqEntrante = -1;
  /** Todos los nonces que ESTE padre envió: el `READY` puede responder al de cualquier intento. */
  const noncesEnviados = new Set<string>();
  let intentos = 0;
  let timerHello: ReturnType<typeof setTimeout> | null = null;
  let timerReady: ReturnType<typeof setTimeout> | null = null;
  let vecesAgotado = 0;
  let destruido = false;
  const pings = new Map<string, (ok: boolean) => void>();

  // Cola de mensajes previos al `READY` (04 §9.2): como mucho UN `RENDER` (solo importa el último)
  // y todos los `PATCH` posteriores a él. Nunca se descartan en silencio.
  let renderEnCola: { composed: ComposedDocument; revision: number } | null = null;
  let patchesEnCola: PatchEntry[] = [];
  let otrosEnCola: CanvasInbound[] = [];

  function sobre<T extends Record<string, unknown>>(cuerpo: T): T & { p: typeof CANVAS_PROTOCOL_TAG; v: 1; seq: number } {
    const s = seqSaliente;
    seqSaliente += 1;
    return { p: CANVAS_PROTOCOL_TAG, v: CANVAS_PROTOCOL_VERSION, seq: s, ...cuerpo };
  }

  function enviarPorPuerto(mensaje: CanvasInbound): boolean {
    if (!puerto) return false;
    try {
      puerto.postMessage(mensaje);
      return true;
    } catch {
      return false;
    }
  }

  function drenarCola(): void {
    if (renderEnCola) {
      enviarPorPuerto(sobre({ t: "RENDER" as const, composed: renderEnCola.composed, revision: renderEnCola.revision }));
      renderEnCola = null;
    }
    if (patchesEnCola.length > 0) {
      for (let i = 0; i < patchesEnCola.length; i += 50) {
        enviarPorPuerto(sobre({ t: "PATCH" as const, entries: patchesEnCola.slice(i, i + 50) }));
      }
      patchesEnCola = [];
    }
    for (const m of otrosEnCola) enviarPorPuerto(m);
    otrosEnCola = [];
  }

  function manejarMensajeDelLienzo(data: unknown, origen: MessagePort | null): void {
    const veredicto = classifyOutbound(data);
    if (veredicto.status === "foreign") return; // ruido de extensiones y de otros iframes.
    if (veredicto.status === "incompatible") {
      estado = "incompatible";
      handlers.onIncompatible?.(veredicto.version);
      return;
    }
    if (veredicto.status === "invalid") {
      handlers.onInvalid?.(veredicto.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    const m = veredicto.message;

    if (m.t === "READY") {
      // Convergencia de puerto: se adopta el puerto POR EL QUE LLEGÓ el READY, y se acepta
      // cualquier nonce que este padre haya enviado en algún intento (`handoffs/3-0b.md` §1).
      if (!noncesEnviados.has(m.nonce)) return;
      if (origen) {
        puerto = origen;
        puerto.onmessage = (e: MessageEvent) => manejarMensajeDelLienzo(e.data, puerto);
        puerto.start?.();
      }
      pararReintentos();
      estado = "ready";
      ultimoSeqEntrante = m.seq;
      handlers.onReady?.(m.buildId);
      drenarCola();
      return;
    }

    // `seq` monótono por dirección: se ignoran duplicados tras una reconexión (04 §9.2).
    if (m.seq <= ultimoSeqEntrante) return;
    ultimoSeqEntrante = m.seq;

    switch (m.t) {
      case "BLOCK_CLICKED":
        handlers.onBlockClicked?.(m.ref);
        break;
      case "SECTION_IN_VIEW":
        handlers.onSectionInView?.(m.sectionKey);
        break;
      case "CANVAS_RESIZED":
        handlers.onResized?.(m.height);
        break;
      case "KEY_COMMAND":
        handlers.onKeyCommand?.(m.command);
        break;
      case "RENDER_ERROR":
        handlers.onRenderError?.({ sectionKey: m.sectionKey, message: m.message, digest: m.digest });
        break;
      case "RENDER_WARNING":
        handlers.onRenderWarning?.({ code: m.code, detail: m.detail });
        break;
      case "PONG": {
        const resolver = pings.get(m.replyTo);
        if (resolver) {
          pings.delete(m.replyTo);
          resolver(true);
        }
        break;
      }
    }
  }

  /** Oyente de `window`: SOLO puede llegar por aquí un `READY` de un puerto que aún no adoptamos. */
  function onWindowMessage(evento: MessageEvent): void {
    // ⚠ NUNCA por `event.origin`: el lienzo es de origen opaco y manda `"null"` (medido en 3-0b).
    if (evento.source !== frame.contentWindow) return;
    manejarMensajeDelLienzo(evento.data, evento.ports[0] ?? null);
  }

  function enviarHello(): void {
    if (destruido || estado === "ready" || estado === "incompatible") return;
    const ventana = frame.contentWindow;
    if (!ventana) return;
    const canal = new MessageChannel(); // canal NUEVO por intento (convergencia, 3-0b §1)
    const nonce = nuevoNonce();
    noncesEnviados.add(nonce);
    canal.port1.onmessage = (e: MessageEvent) => manejarMensajeDelLienzo(e.data, canal.port1);
    canal.port1.start?.();
    try {
      ventana.postMessage(sobre({ t: "HELLO" as const, nonce }), "*", [canal.port2]);
    } catch {
      /* el iframe aún no tiene documento: el reintento lo cubre */
    }
    intentos += 1;
  }

  function pararReintentos(): void {
    if (timerHello !== null) ct(timerHello);
    if (timerReady !== null) ct(timerReady);
    timerHello = null;
    timerReady = null;
  }

  function programarReintento(): void {
    if (destruido || estado === "ready" || estado === "incompatible") return;
    if (intentos >= maxIntentos) return;
    timerHello = st(() => {
      timerHello = null;
      enviarHello();
      programarReintento();
    }, retryMs);
  }

  function arrancar(): void {
    if (destruido) return;
    estado = "loading";
    intentos = 0;
    enviarHello();
    programarReintento();
    if (timerReady !== null) ct(timerReady);
    timerReady = st(() => {
      timerReady = null;
      if (estado === "ready") return;
      vecesAgotado += 1;
      estado = "error";
      pararReintentos();
      handlers.onReadyTimeout?.(vecesAgotado);
    }, readyMs);
  }

  if (typeof window !== "undefined") window.addEventListener("message", onWindowMessage);

  return {
    start: arrancar,
    restart(): void {
      puerto = null;
      seqSaliente = 0;
      ultimoSeqEntrante = -1;
      noncesEnviados.clear();
      arrancar();
    },
    status: () => estado,
    sendRender(composed, revision): void {
      // Un `RENDER` invalida los `PATCH` en cola: el estado completo los contiene ya (04 §9.2).
      if (estado !== "ready" || !puerto) {
        renderEnCola = { composed, revision };
        patchesEnCola = [];
        return;
      }
      enviarPorPuerto(sobre({ t: "RENDER" as const, composed, revision }));
    },
    sendPatch(entries): void {
      if (entries.length === 0) return;
      if (estado !== "ready" || !puerto) {
        patchesEnCola.push(...entries);
        return;
      }
      for (let i = 0; i < entries.length; i += 50) {
        enviarPorPuerto(sobre({ t: "PATCH" as const, entries: entries.slice(i, i + 50) }));
      }
    },
    sendSelect(ref): void {
      const m = sobre({ t: "SELECT_BLOCK" as const, ref });
      if (!enviarPorPuerto(m)) otrosEnCola.push(m);
    },
    sendScrollToSection(sectionKey): void {
      const m = sobre({ t: "SCROLL_TO_SECTION" as const, sectionKey });
      if (!enviarPorPuerto(m)) otrosEnCola.push(m);
    },
    sendViewport(width): void {
      const m = sobre({ t: "SET_VIEWPORT" as const, width });
      if (!enviarPorPuerto(m)) otrosEnCola.push(m);
    },
    sendPreviewTheme(paletteId, fontSetId): void {
      // Efímero: si el lienzo no está listo NO se encola (una vista previa de hover caducada
      // aplicada 3 s después sería peor que no aplicarla). Es la única excepción, y es deliberada.
      enviarPorPuerto(sobre({ t: "PREVIEW_THEME" as const, paletteId, fontSetId }));
    },
    ping(): Promise<boolean> {
      const id = `ping-${seqSaliente}`;
      const m = sobre({ t: "PING" as const, id });
      if (!enviarPorPuerto(m)) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        pings.set(id, resolve);
        st(() => {
          if (pings.delete(id)) resolve(false);
        }, PING_TIMEOUT_MS);
      });
    },
    destroy(): void {
      destruido = true;
      pararReintentos();
      if (typeof window !== "undefined") window.removeEventListener("message", onWindowMessage);
      try {
        puerto?.close();
      } catch {
        /* ya cerrado */
      }
      puerto = null;
    },
  };
}
