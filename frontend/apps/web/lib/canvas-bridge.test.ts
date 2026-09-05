// lib/canvas-bridge.test.ts — U-15 de `04 §20.1` (mensaje con `v: 2` ⇒ estado "incompatible") y el
// saludo con reintento y convergencia de puerto de `handoffs/3-0b.md` §1.
//
// Se conducen los DOS lados reales: `createCanvasBridge` (padre) y `createCanvasClient` (hijo),
// conectados por un `MessageChannel` de jsdom. Nada de dobles del protocolo: si `classify*` cambia,
// estas pruebas lo notan.
import { afterEach, describe, expect, it, vi } from "vitest";
import { CANVAS_PROTOCOL_TAG } from "@invitaciones/schema/canvas";
import { createCanvasBridge, HELLO_MAX_ATTEMPTS } from "./canvas-bridge.ts";
import { createCanvasClient, origenDelPadre } from "./canvas-client.ts";
import { composedFixture } from "../test/fixtures/composed.ts";

/** `iframe.contentWindow` simulado: recibe el `HELLO` y lo entrega al cliente hijo. */
function marcoSimulado(): { frame: HTMLIFrameElement; ventana: { postMessage: ReturnType<typeof vi.fn> } } {
  const ventana = { postMessage: vi.fn() };
  const frame = { contentWindow: ventana } as unknown as HTMLIFrameElement;
  return { frame, ventana };
}

/** `MessageEvent.source` es de solo lectura en jsdom y solo acepta `Window`/`MessagePort`: se fija
 *  con `defineProperty` para poder simular "este mensaje viene del iframe". */
function eventoDe(data: unknown, source: unknown): MessageEvent {
  const evento = new MessageEvent("message", { data });
  Object.defineProperty(evento, "source", { value: source, configurable: true });
  return evento;
}

const temporizadores: (() => void)[] = [];
function setTimeoutFalso(fn: () => void): ReturnType<typeof setTimeout> {
  temporizadores.push(fn);
  return temporizadores.length as unknown as ReturnType<typeof setTimeout>;
}

afterEach(() => {
  temporizadores.length = 0;
});

describe("U-15 · protocolo incompatible (04 §9.5)", () => {
  it("un mensaje con `v: 2` pone el puente en «incompatible», no se interpreta", () => {
    const { frame } = marcoSimulado();
    const incompatibles: number[] = [];
    const puente = createCanvasBridge(
      frame,
      { onIncompatible: (v) => incompatibles.push(v) },
      { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} },
    );
    puente.start();
    // Llega por `window` desde el iframe correcto, pero con otra versión de protocolo.
    window.dispatchEvent(eventoDe({ p: CANVAS_PROTOCOL_TAG, v: 2, seq: 0, t: "READY" }, frame.contentWindow));
    expect(incompatibles).toEqual([2]);
    expect(puente.status()).toBe("incompatible");
    puente.destroy();
  });

  it("ruido ajeno al protocolo se ignora sin ruido (`foreign`), y un v1 malformado se registra", () => {
    const { frame } = marcoSimulado();
    const invalidos: string[] = [];
    const incompatibles: number[] = [];
    const puente = createCanvasBridge(
      frame,
      { onInvalid: (d) => invalidos.push(d), onIncompatible: (v) => incompatibles.push(v) },
      { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} },
    );
    puente.start();
    const emitir = (data: unknown) => window.dispatchEvent(eventoDe(data, frame.contentWindow));
    emitir({ tipo: "react-devtools-bridge" }); // ruido de una extensión
    emitir("hola");
    expect(invalidos).toHaveLength(0);
    expect(incompatibles).toHaveLength(0);
    // Marca y versión correctas, mensaje malformado: se rechaza ENTERO y se registra (P1).
    emitir({ p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "BLOCK_CLICKED" });
    expect(invalidos).toHaveLength(1);
    expect(puente.status()).not.toBe("ready");
    puente.destroy();
  });

  it("un mensaje de OTRA ventana se descarta: se valida por `event.source`, nunca por `event.origin`", () => {
    const { frame } = marcoSimulado();
    const listos: string[] = [];
    const puente = createCanvasBridge(frame, { onReady: (b) => listos.push(b) }, { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} });
    puente.start();
    window.dispatchEvent(
      // Otra ventana: `event.source` no es el `contentWindow` del iframe.
      eventoDe({ p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "READY", protocolVersion: 1, buildId: "x", nonce: "a".repeat(32) }, window),
    );
    expect(listos).toHaveLength(0);
    puente.destroy();
  });
});

describe("saludo con reintento y convergencia de puerto (handoffs/3-0b.md §1, ADR-3-0b-03)", () => {
  it("reintenta el HELLO hasta 6 veces, con un MessageChannel NUEVO cada vez", () => {
    const { frame, ventana } = marcoSimulado();
    const puente = createCanvasBridge(frame, {}, { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} });
    puente.start();
    expect(ventana.postMessage).toHaveBeenCalledTimes(1);
    // Cada disparo del temporizador reintenta.
    for (let i = 0; i < HELLO_MAX_ATTEMPTS + 3; i += 1) {
      const fn = temporizadores.shift();
      fn?.();
    }
    expect(ventana.postMessage.mock.calls.length).toBeLessThanOrEqual(HELLO_MAX_ATTEMPTS);
    // `targetOrigin: "*"` siempre (un origen opaco no es direccionable) y un puerto transferido.
    const [mensaje, targetOrigin, transfer] = ventana.postMessage.mock.calls[0] as unknown as [
      { t: string; nonce: string },
      string,
      MessagePort[],
    ];
    expect(mensaje.t).toBe("HELLO");
    expect(mensaje.nonce).toHaveLength(32);
    expect(targetOrigin).toBe("*");
    expect(transfer).toHaveLength(1);
    // C4/P8: ningún mensaje al lienzo lleva secretos.
    expect(JSON.stringify(mensaje)).not.toMatch(/token|authorization|bearer/i);
    puente.destroy();
  });

  it("el padre adopta el puerto POR EL QUE llegó el READY y acepta cualquier nonce que él envió", () => {
    const { frame, ventana } = marcoSimulado();
    const listos: string[] = [];
    const puente = createCanvasBridge(frame, { onReady: (b) => listos.push(b) }, { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} });
    puente.start();
    temporizadores.shift()?.(); // segundo HELLO, canal distinto
    const primerNonce = (ventana.postMessage.mock.calls[0] as unknown as [{ nonce: string }])[0].nonce;
    const segundoPuerto = (ventana.postMessage.mock.calls[1] as unknown as [unknown, string, MessagePort[]])[2][0];
    // El lienzo responde por el puerto del SEGUNDO HELLO pero con el nonce del PRIMERO.
    segundoPuerto?.postMessage({
      p: CANVAS_PROTOCOL_TAG,
      v: 1,
      seq: 0,
      t: "READY",
      protocolVersion: 1,
      buildId: "lienzo-1",
      nonce: primerNonce,
    });
    return vi.waitFor(() => {
      expect(listos).toEqual(["lienzo-1"]);
      expect(puente.status()).toBe("ready");
      puente.destroy();
    });
  });

  it("un READY con un nonce que este padre NUNCA envió se descarta", () => {
    const { frame, ventana } = marcoSimulado();
    const listos: string[] = [];
    const puente = createCanvasBridge(frame, { onReady: (b) => listos.push(b) }, { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} });
    puente.start();
    const puerto = (ventana.postMessage.mock.calls[0] as unknown as [unknown, string, MessagePort[]])[2][0];
    puerto?.postMessage({ p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "READY", protocolVersion: 1, buildId: "x", nonce: "z".repeat(32) });
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(listos).toHaveLength(0);
        puente.destroy();
        resolve();
      }, 20),
    );
  });

  it("`RENDER`/`PATCH` emitidos antes del READY se ENCOLAN, nunca se descartan (04 §9.2)", async () => {
    const { frame, ventana } = marcoSimulado();
    const puente = createCanvasBridge(frame, {}, { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {} });
    puente.start();
    puente.sendRender(composedFixture(), 3);
    puente.sendPatch([{ ref: { sectionKey: "cover", blockId: "cover.title" }, value: { kind: "text", value: "x" }, provenance: "user", pending: false }]);

    const canal = ventana.postMessage.mock.calls[0] as unknown as [{ nonce: string }, string, MessagePort[]];
    const puerto = canal[2][0];
    const recibidos: { t: string }[] = [];
    // Un puerto de un `MessageChannel` no se puede escuchar por los dos extremos a la vez en jsdom
    // con el mismo objeto, así que se escucha el puerto que el padre conserva (`port1`) desde el
    // lado del "hijo" reutilizando el transferido.
    if (puerto) {
      puerto.onmessage = (e: MessageEvent) => recibidos.push(e.data as { t: string });
      puerto.start?.();
      puerto.postMessage({
        p: CANVAS_PROTOCOL_TAG,
        v: 1,
        seq: 0,
        t: "READY",
        protocolVersion: 1,
        buildId: "x",
        nonce: canal[0].nonce,
      });
    }
    await vi.waitFor(() => expect(puente.status()).toBe("ready"));
    // 04 §9.2: se guarda como mucho UN `RENDER` (solo importa el último) y todos los `PATCH`
    // POSTERIORES a él, que se colapsan contra ese estado. Ninguno se descarta.
    await vi.waitFor(() => expect(recibidos.map((m) => m.t)).toEqual(["RENDER", "PATCH"]));
    puente.destroy();
  });

  it("tras dos vencimientos del READY se avisa dos veces (04 §8.8: degradación)", () => {
    const { frame } = marcoSimulado();
    const vencimientos: number[] = [];
    const puente = createCanvasBridge(
      frame,
      { onReadyTimeout: (n) => vencimientos.push(n) },
      { setTimeoutImpl: setTimeoutFalso, clearTimeoutImpl: () => {}, readyTimeoutMs: 5 },
    );
    puente.start();
    // El primer temporizador es el del reintento; el segundo, el del `READY`.
    temporizadores[1]?.();
    puente.restart();
    temporizadores[3]?.();
    expect(vencimientos).toEqual([1, 2]);
    puente.destroy();
  });
});

describe("lado hijo · `createCanvasClient` (04 §9.2)", () => {
  it("valida `event.origin` del PADRE (su origen sí es comprobable) y responde READY", async () => {
    const conectado: boolean[] = [];
    const cliente = createCanvasClient(
      {
        onRender: () => {},
        onPatch: () => {},
        onSelect: () => {},
        onScrollToSection: () => {},
        onViewport: () => {},
        onPreviewTheme: () => {},
        onConnected: () => conectado.push(true),
      },
      { expectedParentOrigin: "http://padre.example", buildId: "hijo-1" },
    );
    cliente.start();

    const canal = new MessageChannel();
    const recibidos: { t: string; nonce?: string }[] = [];
    canal.port1.onmessage = (e: MessageEvent) => recibidos.push(e.data as { t: string });
    canal.port1.start();

    // Origen equivocado: se descarta (frame-ancestors + esta comprobación).
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "HELLO", nonce: "a".repeat(32) },
        origin: "http://otro.example",
        ports: [canal.port2],
      }),
    );
    expect(cliente.connected()).toBe(false);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "HELLO", nonce: "b".repeat(32) },
        origin: "http://padre.example",
        ports: [canal.port2],
      }),
    );
    expect(cliente.connected()).toBe(true);
    await vi.waitFor(() => expect(recibidos[0]?.t).toBe("READY"));
    expect(recibidos[0]?.nonce).toBe("b".repeat(32));
    expect(conectado).toEqual([true]);
    cliente.stop();
  });

  it("drena la cola que el `<script nonce>` del layout acumuló antes de hidratar", async () => {
    const canal = new MessageChannel();
    const recibidos: { t: string }[] = [];
    canal.port1.onmessage = (e: MessageEvent) => recibidos.push(e.data as { t: string });
    canal.port1.start();
    window.__pendientes = [
      new MessageEvent("message", {
        data: { p: CANVAS_PROTOCOL_TAG, v: 1, seq: 0, t: "HELLO", nonce: "c".repeat(32) },
        origin: "http://padre.example",
        ports: [canal.port2],
      }),
    ];
    const cliente = createCanvasClient(
      { onRender: () => {}, onPatch: () => {}, onSelect: () => {}, onScrollToSection: () => {}, onViewport: () => {}, onPreviewTheme: () => {} },
      { expectedParentOrigin: "http://padre.example" },
    );
    cliente.start();
    expect(cliente.connected()).toBe(true);
    await vi.waitFor(() => expect(recibidos[0]?.t).toBe("READY"));
    expect(window.__pendientes).toEqual([]);
    cliente.stop();
  });

  it("un HELLO con `v: 2` deja el lienzo en «incompatible» y no conecta (U-15, lado hijo)", () => {
    const incompatibles: number[] = [];
    const cliente = createCanvasClient(
      {
        onRender: () => {},
        onPatch: () => {},
        onSelect: () => {},
        onScrollToSection: () => {},
        onViewport: () => {},
        onPreviewTheme: () => {},
        onIncompatible: (v) => incompatibles.push(v),
      },
      { expectedParentOrigin: "http://padre.example" },
    );
    cliente.start();
    window.dispatchEvent(
      new MessageEvent("message", { data: { p: CANVAS_PROTOCOL_TAG, v: 2, seq: 0, t: "HELLO" }, origin: "http://padre.example" }),
    );
    expect(incompatibles).toEqual([2]);
    expect(cliente.connected()).toBe(false);
    cliente.stop();
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// N-02 (`ADR-3C-N02-01`) · contra QUÉ origen valida el hijo
// ───────────────────────────────────────────────────────────────────────────────────────────────
//
// Antes de la fase 3-C esto era `process.env.NEXT_PUBLIC_EDITOR_ORIGIN`, una constante horneada al
// construir. Con el mismo artefacto servido en otro puerto, el hijo descartaba el `HELLO` del padre
// legítimo y el lienzo se quedaba en «Esperando al editor…» sin decir por qué: es el SEGUNDO candado
// del defecto medido en `bitacora/3b-adv.md §6.2`, el que sigue matando la vista previa aunque la
// CSP ya esté bien. Ahora el origen se resuelve en ejecución, preguntándole al navegador quién
// embebe de verdad.
describe("origenDelPadre · N-02, el origen del padre se resuelve en EJECUCIÓN", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lo que pase quien monta el lienzo manda sobre todo lo demás", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://horneado.example");
    expect(origenDelPadre("http://impuesto.example")).toBe("http://impuesto.example");
  });

  it("usa `location.ancestorOrigins` —lo que dice el navegador— antes que la constante horneada", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    vi.stubGlobal("location", { ancestorOrigins: ["http://127.0.0.1:3000"], origin: "null" });
    expect(origenDelPadre()).toBe("http://127.0.0.1:3000");
  });

  it("cae a `document.referrer` donde no hay `ancestorOrigins` (Firefox), quedándose con el origen", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    vi.stubGlobal("location", { origin: "null" });
    vi.stubGlobal("document", { referrer: "http://127.0.0.1:3000/editor/3" });
    expect(origenDelPadre()).toBe("http://127.0.0.1:3000");
  });

  it("un `ancestorOrigins` opaco («null») no cuenta: se sigue al referrer", () => {
    vi.stubGlobal("location", { ancestorOrigins: ["null"] });
    vi.stubGlobal("document", { referrer: "http://127.0.0.1:3000/editor/3" });
    expect(origenDelPadre()).toBe("http://127.0.0.1:3000");
  });

  it("sin nada que preguntar cae a la constante horneada, que es el último recurso", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    vi.stubGlobal("location", {});
    vi.stubGlobal("document", { referrer: "" });
    expect(origenDelPadre()).toBe("http://127.0.0.1:3050");
  });

  it("un referrer que no es una URL no rompe nada", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "");
    vi.stubGlobal("location", {});
    vi.stubGlobal("document", { referrer: "no-es-una-url" });
    expect(origenDelPadre()).toBe("");
  });
});
