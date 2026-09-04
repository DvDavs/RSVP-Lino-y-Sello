"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_PROTOCOL_VERSION,
  classifyOutbound,
  type BlockRef,
} from "@invitaciones/schema/canvas";
import { DIAGNOSTICO, crearEmisor, nuevoNonce } from "../../lib/protocolo";
import composedFixture from "../../lib/composed.fixture.json";

type Fila = { id: string; nombre: string; valor: string; veredicto: "PASA" | "FALLA" | "—" };

const CRITERIOS: [string, string][] = [
  ["A1", "El iframe carga y envía READY (< 2 s)"],
  ["A2", "La fuente de la plantilla se aplica dentro del iframe"],
  ["A3", "Las imágenes del CDN se pintan (naturalWidth > 0)"],
  ["A4", "La CSP no bloquea nada (0 securitypolicyviolation)"],
  ["A5", "Ciclo RENDER → BLOCK_CLICKED con el ref correcto"],
  ["A6", "CANVAS_RESIZED reporta un alto > 0"],
  ["A7", "Ctrl+Z dentro del lienzo llega como KEY_COMMAND"],
  ["A8", "Ningún fetch sale del lienzo"],
];

/** Reintentos del saludo (ver `saludar`). 6 × 800 ms ≈ los 5 s de espera de `04 §9.2`. */
const REINTENTOS = 6;
const PERIODO_MS = 800;

export default function Harness() {
  const marco = useRef<HTMLIFrameElement>(null);
  const emitir = useRef<((c: Record<string, unknown>) => void) | null>(null);
  const noncesEnviados = useRef<Set<string>>(new Set());
  const t0 = useRef<number>(0);
  const cola = useRef<Record<string, unknown>[]>([]);
  const listo = useRef(false);
  const intentos = useRef(0);

  const [filas, setFilas] = useState<Fila[]>(
    CRITERIOS.map(([id, nombre]) => ({ id, nombre, valor: "sin medir", veredicto: "—" })),
  );
  const [foco, setFoco] = useState<string | null>(null);
  const [bitacora, setBitacora] = useState<string[]>([]);
  const estado = useRef({
    readyMs: -1,
    readyBuildId: "",
    saludos: 0,
    incompatible: false,
    ultimoRefClic: null as BlockRef | null,
    ultimoAlto: 0,
    ultimoComando: "",
    ultimaSeccion: "",
    pong: "",
    rechazados: [] as string[],
    diagOrigenVistoPorElPadre: "",
    diagOrigenSegunElHijo: "",
    encolados: 0,
  });

  const log = useCallback((s: string) => setBitacora((b) => [...b.slice(-40), s]), []);

  const enviar = useCallback((cuerpo: Record<string, unknown>) => {
    if (!listo.current || !emitir.current) {
      // Mensajes previos al READY se ENCOLAN, nunca se descartan (`04 §9.2`, P1).
      cola.current.push(cuerpo);
      estado.current.encolados = cola.current.length;
      log(`↩ encolado ${String(cuerpo.t)} (aún no hay READY)`);
      return;
    }
    emitir.current(cuerpo);
  }, [log]);

  /**
   * `puerto` es el `MessagePort` que ENTREGÓ el mensaje. Importa: si hubo más de un saludo (ver
   * `saludar`), el padre adopta el puerto por el que llegó el `READY`, que es el que el lienzo
   * está usando. Así los dos extremos convergen siempre en el mismo canal.
   */
  const procesar = useCallback((data: unknown, puerto?: MessagePort) => {
    const v = classifyOutbound(data);
    if (v.status === "incompatible") {
      estado.current.incompatible = true;
      estado.current.rechazados.push(`v=${v.version} incompatible`);
      log(`✗ versión ${v.version}: vista previa incompatible`);
      return;
    }
    if (v.status !== "ok") {
      estado.current.rechazados.push(v.status);
      log(`✗ mensaje ${v.status} descartado y registrado`);
      return;
    }
    const m = v.message;
    switch (m.t) {
      case "READY": {
        if (!noncesEnviados.current.has(m.nonce) || m.protocolVersion !== CANVAS_PROTOCOL_VERSION) {
          estado.current.incompatible = true;
          estado.current.rechazados.push("READY con nonce o versión que no casan");
          log("✗ READY con nonce/versión que no casan");
          return;
        }
        if (puerto) emitir.current = crearEmisor((x) => puerto.postMessage(x), 1);
        estado.current.readyBuildId = m.buildId;
        if (!listo.current) {
          estado.current.readyMs = Math.round(performance.now() - t0.current);
          listo.current = true;
          log(`✓ READY en ${estado.current.readyMs} ms (buildId ${m.buildId}, ${estado.current.saludos} saludo/s)`);
          log(`→ vaciando la cola: ${cola.current.length} mensaje(s) acumulados antes del READY`);
          for (const c of cola.current) emitir.current?.(c);
          cola.current = [];
        } else {
          // Reconstrucción por estado, no por reproducción de eventos (`04 §9.2`).
          log("· READY de nuevo (lienzo recargado o saludo repetido): reenvío un RENDER completo");
          emitir.current?.({ t: "RENDER", composed: composedFixture, revision: 7 });
        }
        break;
      }
      case "BLOCK_CLICKED":
        estado.current.ultimoRefClic = m.ref;
        log(`✓ BLOCK_CLICKED ${m.ref.sectionKey}/${m.ref.blockId}`);
        break;
      case "CANVAS_RESIZED":
        estado.current.ultimoAlto = m.height;
        break;
      case "KEY_COMMAND":
        estado.current.ultimoComando = m.command;
        log(`✓ KEY_COMMAND ${m.command}`);
        break;
      case "SECTION_IN_VIEW":
        estado.current.ultimaSeccion = m.sectionKey;
        break;
      case "PONG":
        estado.current.pong = m.replyTo;
        break;
      case "RENDER_ERROR":
        log(`✗ RENDER_ERROR ${m.sectionKey ?? "?"}: ${m.message}`);
        break;
      case "RENDER_WARNING":
        log(`! RENDER_WARNING ${m.code}: ${m.detail}`);
        break;
    }
  }, [log]);

  /**
   * Saludo de `04 §9.2`. **Se reintenta**, y no es un adorno: medido en este spike, el `load` del
   * iframe puede dispararse ANTES de que React haya montado el `onLoad` (documento en caché), y
   * entonces el HELLO no se envía nunca y el editor se queda mudo. El lienzo, por su parte, ya
   * amortigua el caso simétrico (HELLO antes de hidratar) con un buffer en su script en línea.
   */
  const saludar = useCallback(() => {
    const ventana = marco.current?.contentWindow;
    if (!ventana || listo.current) return;
    const nonce = nuevoNonce();
    noncesEnviados.current.add(nonce);
    if (estado.current.saludos === 0) t0.current = performance.now();
    estado.current.saludos += 1;
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => procesar(e.data, canal.port1); // punto a punto: sin `origin` que validar
    canal.port1.start();
    // C4: `targetOrigin: "*"` — un origen opaco NO es direccionable. Aceptable porque el mensaje no
    // lleva secretos: nunca el token de sesión ni datos sin resolver (`04 §8.4`).
    ventana.postMessage(
      { p: "inv-canvas", v: CANVAS_PROTOCOL_VERSION, seq: 0, t: "HELLO", nonce },
      "*",
      [canal.port2],
    );
    log(`→ HELLO #${estado.current.saludos} con targetOrigin "*" y port2 transferido`);
    // El RENDER se emite ANTES del READY a propósito: comprueba el encolado de `04 §9.2`.
    if (cola.current.length === 0) enviar({ t: "RENDER", composed: composedFixture, revision: 7 });
  }, [enviar, log, procesar]);

  useEffect(() => {
    // No se saluda aquí: el camino normal es el `onLoad` del iframe. Este temporizador es la RED DE
    // SEGURIDAD para el caso medido en que el `load` se adelanta al montaje de React y el `onLoad`
    // no llega a ejecutarse nunca.
    const t = setInterval(() => {
      if (listo.current || intentos.current >= REINTENTOS) { clearInterval(t); return; }
      intentos.current += 1;
      log(`· sin READY todavía: reintento de saludo ${intentos.current}/${REINTENTOS}`);
      saludar();
    }, PERIODO_MS);
    return () => clearInterval(t);
  }, [log, saludar]);

  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      // **VALIDACIÓN DEL PADRE: por identidad, NUNCA por `event.origin`** (`04 §8.2`, §9.2).
      // El lienzo es un origen opaco y su `event.origin` es "null": comparar contra
      // `window.location.origin` rechazaría TODOS sus mensajes.
      if (ev.source !== marco.current?.contentWindow) return;
      const d = ev.data as { p?: string; childOrigin?: string };
      if (d?.p === DIAGNOSTICO) {
        estado.current.diagOrigenVistoPorElPadre = ev.origin;
        estado.current.diagOrigenSegunElHijo = String(d.childOrigin);
        log(`· diagnóstico: event.origin="${ev.origin}", location.origin del hijo="${d.childOrigin}"`);
        return;
      }
      procesar(ev.data);
    };
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
  }, [log, procesar]);

  // API que maneja la prueba de Playwright.
  useEffect(() => {
    (window as unknown as { __gate?: unknown }).__gate = {
      estado: () => ({ ...estado.current }),
      reportar: (id: string, valor: string, pasa: boolean) =>
        setFilas((f) => f.map((x) => (x.id === id ? { ...x, valor, veredicto: pasa ? "PASA" : "FALLA" } : x))),
      enfocar: (id: string | null) => setFoco(id),
      seleccionar: (ref: BlockRef | null) => enviar({ t: "SELECT_BLOCK", ref }),
      scrollA: (sectionKey: string) => enviar({ t: "SCROLL_TO_SECTION", sectionKey }),
      viewport: (width: "mobile" | "desktop") => enviar({ t: "SET_VIEWPORT", width }),
      ping: (id: string) => enviar({ t: "PING", id }),
      render: () => enviar({ t: "RENDER", composed: composedFixture, revision: 7 }),
      // Inyecta un mensaje v:2 en el puente para comprobar U-15 en vivo.
      inyectarV2: () =>
        procesar({ p: "inv-canvas", v: 2, seq: 0, t: "READY", protocolVersion: 2, buildId: "x", nonce: "0".repeat(32) }),
    };
  }, [enviar, procesar]);

  const total = filas.filter((f) => f.veredicto === "PASA").length;

  return (
    <main className="editor">
      <aside className="panel">
        <h1>Compuerta A1-A8 · lienzo en iframe de origen opaco</h1>
        <p className="sub">
          <code>sandbox=&quot;allow-scripts&quot;</code> sin <code>allow-same-origin</code> ·
          ADR-018 / ADR-031 / ADR-1R-F-02 · <code>04 §8.5</code>
        </p>
        <table className="resultados">
          <thead>
            <tr><th>#</th><th>Criterio</th><th>Valor medido</th><th>Veredicto</th></tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} data-foco={foco === f.id ? "true" : "false"} data-veredicto={f.veredicto} data-fila={f.id}>
                <td className="id">{f.id}</td>
                <td>{f.nombre}</td>
                <td className="valor">{f.valor}</td>
                <td className="veredicto">{f.veredicto}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="marcador" data-total={total}>{total} / 8 criterios en verde</p>
        <h2>Bitácora del puente</h2>
        <ol className="log">{bitacora.map((l, i) => <li key={i}>{l}</li>)}</ol>
      </aside>
      <section className="lienzo-hueco">
        <iframe
          ref={marco}
          id="lienzo"
          title="Vista previa de la invitación"
          src="/canvas"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          onLoad={saludar}
        />
      </section>
    </main>
  );
}
