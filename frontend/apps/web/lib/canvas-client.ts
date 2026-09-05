// lib/canvas-client.ts — lado HIJO del puente (`04 §9`, `handoffs/3-0b.md` §1). Lo importa SOLO la
// ruta del lienzo, `app/(canvas)/editor/[invitationId]/canvas/page.tsx`.
//
// Diferencias con el padre, todas medidas en la compuerta A1-A8:
//   · El hijo SÍ valida `event.origin`. Aquí es válido y es la comprobación importante: impide que
//     otra página embeba el lienzo y le inyecte contenido (reforzado por `frame-ancestors` de la
//     CSP). Contra QUÉ origen compara lo decide `origenDelPadre` — ver ahí: desde N-02
//     (`ADR-3C-N02-01`) es el origen REAL del que embebe, resuelto en ejecución, no una constante
//     horneada en el build.
//   · El hijo **sigue escuchando `window` tras el saludo**, pero solo acepta `HELLO` ahí — sin eso
//     el reintento del padre no llegaría nunca. Adopta el puerto del ÚLTIMO `HELLO`.
//   · Drena primero la cola `window.__pendientes` que llena el `<script nonce>` del layout ANTES de
//     que React hidrate: el `HELLO` puede llegar antes del montaje.
//
// Este archivo NO puede importar `lib/api-client.ts` ni `lib/store.ts` ni hacer `fetch`
// (`eslint.config.mjs`, `04 §19.3`, `connect-src 'none'`). No hay ningún secreto aquí (C4/P8).
import {
  CANVAS_PROTOCOL_TAG,
  CANVAS_PROTOCOL_VERSION,
  classifyInbound,
  configureZodForCanvas,
  type BlockRef,
  type CanvasOutbound,
} from "@invitaciones/schema/canvas";
import type { ComposedDocument } from "@invitaciones/schema";

/** Entradas del `PATCH` tal y como las define `04 §9.3` (mismo tipo que `lib/composed-patch.ts`). */
export interface PatchEntryIn {
  ref: BlockRef;
  value: unknown;
  provenance: "user" | "default" | "business" | "fixed" | "empty";
  pending: boolean;
}

export interface CanvasClientHandlers {
  onRender: (composed: ComposedDocument, revision: number) => void;
  onPatch: (entries: PatchEntryIn[]) => void;
  onSelect: (ref: BlockRef | null) => void;
  onScrollToSection: (sectionKey: string) => void;
  onViewport: (width: "mobile" | "desktop") => void;
  onPreviewTheme: (paletteId: string | null, fontSetId: string | null) => void;
  /** El padre habla otra versión del protocolo: el lienzo lo dice, no lo interpreta (U-15). */
  onIncompatible?: (version: number) => void;
  onConnected?: () => void;
}

export interface CanvasClient {
  start(): void;
  stop(): void;
  connected(): boolean;
  sendBlockClicked(ref: BlockRef): void;
  sendSectionInView(sectionKey: string): void;
  sendResized(height: number): void;
  sendKeyCommand(command: "undo" | "redo" | "save" | "escape"): void;
  sendRenderError(info: { sectionKey?: string; message: string; digest?: string }): void;
  sendRenderWarning(info: { code: "unknown-variant" | "unmapped-role" | "missing-font"; detail: string }): void;
}

declare global {
  interface Window {
    __pendientes?: MessageEvent[];
    __bufferMensajes?: (e: MessageEvent) => void;
  }
}

/**
 * El origen contra el que el hijo valida `event.origin`, resuelto EN EJECUCIÓN (N-02,
 * `ADR-3C-N02-01`).
 *
 * Antes esto era `process.env.NEXT_PUBLIC_EDITOR_ORIGIN`, es decir una constante horneada al
 * construir. Con el mismo artefacto servido en otro puerto, el hijo descartaba el `HELLO` del padre
 * legítimo por no coincidir el origen, y la vista previa se quedaba en «Esperando al editor…» sin
 * decir por qué. Era el segundo candado del mismo defecto medido en `bitacora/3b-adv.md §6.2`: el
 * primero es la CSP, y aunque se arreglara sólo la CSP, esta comparación seguiría matando el lienzo.
 *
 * Orden de resolución:
 *   1. `opts.expectedParentOrigin` — quien monta el lienzo puede imponerlo (lo usan las pruebas del
 *      puente, que conducen los dos lados sin navegador).
 *   2. `location.ancestorOrigins[0]` — el origen del que embebe, según el propio navegador.
 *      Chromium y WebKit lo exponen incluso en un iframe de origen opaco; **no** es falsificable
 *      desde la página que embebe.
 *   3. `document.referrer` — el mismo dato en Firefox, donde `ancestorOrigins` no existe.
 *   4. La constante horneada, sólo como último recurso, para no cambiar el comportamiento de un
 *      arranque donde no hubiera ni una cosa ni la otra.
 *
 * Qué NO cambia: quién puede embeber el lienzo lo decide `frame-ancestors` de la CSP
 * (`proxy.ts`), que es la defensa real y que ahora nombra el origen correcto. Esta comparación es
 * la segunda capa, y sigue haciendo su trabajo: sólo se acepta al marco que de verdad nos embebe.
 * Por el puente no viaja ningún secreto (C4/P8), así que el peor caso sigue siendo el de siempre.
 */
export function origenDelPadre(declarado?: string): string {
  if (declarado) return declarado;
  if (typeof window === "undefined") return "";

  const ancestros = window.location?.ancestorOrigins;
  const primero = ancestros && ancestros.length > 0 ? ancestros[0] : undefined;
  if (primero && primero !== "null") return primero;

  try {
    const remitente = typeof document === "undefined" ? "" : document.referrer;
    if (remitente) return new URL(remitente).origin;
  } catch {
    /* un referrer que no es una URL no dice nada: se sigue al último recurso */
  }

  return process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? "";
}

export function createCanvasClient(
  handlers: CanvasClientHandlers,
  opts: { expectedParentOrigin?: string; buildId?: string } = {},
): CanvasClient {
  // Obligatorio ANTES de construir/usar cualquier esquema de Zod dentro del lienzo (ADR-3-0b-02):
  // Zod ejecuta `new Function("")` para decidir su ruta rápida y bajo esta CSP eso registra un
  // `securitypolicyviolation` de `script-src`/`eval`. No se afloja la CSP por esto.
  configureZodForCanvas();

  const origenPadre = origenDelPadre(opts.expectedParentOrigin);
  const buildId = (opts.buildId ?? "apps-web").slice(0, 64);
  let puerto: MessagePort | null = null;
  let seqSaliente = 0;
  let ultimoSeqEntrante = -1;
  let activo = false;

  function sobre<T extends Record<string, unknown>>(cuerpo: T) {
    const s = seqSaliente;
    seqSaliente += 1;
    return { p: CANVAS_PROTOCOL_TAG, v: CANVAS_PROTOCOL_VERSION, seq: s, ...cuerpo } as unknown as CanvasOutbound;
  }

  function emitir(mensaje: CanvasOutbound): void {
    if (!puerto) return;
    try {
      puerto.postMessage(mensaje);
    } catch {
      /* el padre cerró el puerto: no hay a quién avisar */
    }
  }

  function procesar(data: unknown, soloHello: boolean, puertoNuevo: MessagePort | null): void {
    const veredicto = classifyInbound(data);
    if (veredicto.status === "foreign") return;
    if (veredicto.status === "incompatible") {
      handlers.onIncompatible?.(veredicto.version);
      return;
    }
    if (veredicto.status === "invalid") return; // v1 malformado: se descarta ENTERO, nunca a medias (P1)
    const m = veredicto.message;

    if (m.t === "HELLO") {
      if (!puertoNuevo) return;
      // Convergencia: se adopta el puerto del ÚLTIMO `HELLO` (`handoffs/3-0b.md` §1).
      if (puerto && puerto !== puertoNuevo) {
        try {
          puerto.close();
        } catch {
          /* ya cerrado */
        }
      }
      puerto = puertoNuevo;
      puerto.onmessage = (e: MessageEvent) => procesar(e.data, false, null);
      puerto.start?.();
      ultimoSeqEntrante = -1;
      emitir(sobre({ t: "READY", protocolVersion: CANVAS_PROTOCOL_VERSION, buildId, nonce: m.nonce }));
      handlers.onConnected?.();
      return;
    }
    if (soloHello) return; // por `window` solo se acepta `HELLO` tras el saludo.

    if (m.seq <= ultimoSeqEntrante) return; // duplicado tras reconexión (04 §9.2)
    ultimoSeqEntrante = m.seq;

    switch (m.t) {
      case "RENDER":
        handlers.onRender(m.composed, m.revision);
        break;
      case "PATCH":
        handlers.onPatch(m.entries as unknown as PatchEntryIn[]);
        break;
      case "SELECT_BLOCK":
        handlers.onSelect(m.ref);
        break;
      case "SCROLL_TO_SECTION":
        handlers.onScrollToSection(m.sectionKey);
        break;
      case "SET_VIEWPORT":
        handlers.onViewport(m.width);
        break;
      case "PREVIEW_THEME":
        handlers.onPreviewTheme(m.paletteId, m.fontSetId);
        break;
      case "PING":
        emitir(sobre({ t: "PONG", replyTo: m.id }));
        break;
    }
  }

  function onWindowMessage(evento: MessageEvent): void {
    // El PADRE no es opaco: su origen SÍ es comprobable, y comprobarlo es lo que impide que otra
    // página embeba el lienzo y le inyecte contenido (04 §9.2).
    if (origenPadre !== "" && evento.origin !== origenPadre) return;
    procesar(evento.data, true, evento.ports[0] ?? null);
  }

  return {
    start(): void {
      if (activo || typeof window === "undefined") return;
      activo = true;
      // 1. Drenar lo que el `<script nonce>` del layout acumuló antes de que React hidratara.
      const pendientes = window.__pendientes ?? [];
      window.__pendientes = [];
      if (window.__bufferMensajes) {
        window.removeEventListener("message", window.__bufferMensajes);
        window.__bufferMensajes = undefined;
      }
      // 2. Escuchar de verdad. Se sigue escuchando `window` SIEMPRE (los reintentos del padre).
      window.addEventListener("message", onWindowMessage);
      for (const evento of pendientes) onWindowMessage(evento);
    },
    stop(): void {
      if (!activo || typeof window === "undefined") return;
      activo = false;
      window.removeEventListener("message", onWindowMessage);
      try {
        puerto?.close();
      } catch {
        /* ya cerrado */
      }
      puerto = null;
    },
    connected: () => puerto !== null,
    sendBlockClicked: (ref) => emitir(sobre({ t: "BLOCK_CLICKED", ref })),
    sendSectionInView: (sectionKey) => emitir(sobre({ t: "SECTION_IN_VIEW", sectionKey })),
    sendResized: (height) => emitir(sobre({ t: "CANVAS_RESIZED", height: Math.max(0, Math.min(200000, Math.round(height))) })),
    sendKeyCommand: (command) => emitir(sobre({ t: "KEY_COMMAND", command })),
    sendRenderError: (info) =>
      emitir(
        sobre({
          t: "RENDER_ERROR",
          ...(info.sectionKey === undefined ? {} : { sectionKey: info.sectionKey }),
          message: info.message.slice(0, 500),
          ...(info.digest === undefined ? {} : { digest: info.digest.slice(0, 64) }),
        }),
      ),
    sendRenderWarning: (info) => emitir(sobre({ t: "RENDER_WARNING", code: info.code, detail: info.detail.slice(0, 200) })),
  };
}
