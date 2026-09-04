"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_PROTOCOL_VERSION,
  classifyInbound,
  configureZodForCanvas,
  type BlockRef,
  type CanvasInbound,
} from "@invitaciones/schema/canvas";
import { DIAGNOSTICO, EDITOR_ORIGIN, crearEmisor } from "../../../lib/protocolo";

// A4 de la compuerta: sin esto, la sonda `Function("")` de Zod produce un `securitypolicyviolation`
// de `script-src` (blockedURI "eval") en cuanto se valida el primer mensaje. Debe llamarse sobre la
// MISMA instancia de Zod que hace el `safeParse`, y por eso la exporta el propio protocolo.
configureZodForCanvas();

type Composed = Extract<CanvasInbound, { t: "RENDER" }>["composed"];
type Seccion = Composed["sections"][number];
type Bloque = Seccion["blocks"][number];
type Valor = Extract<Bloque, { value: unknown }>["value"];

const BUILD_ID = "spike-3-0b";

const mismoRef = (a: BlockRef | null, b: BlockRef | null) =>
  !!a && !!b && a.sectionKey === b.sectionKey && a.blockId === b.blockId &&
  a.itemId === b.itemId && a.itemBlockId === b.itemBlockId;

/** Pinta un `ResolvedValue`. El lienzo SELECCIONA Y MUESTRA; no edita (P7). */
function ValorPintado({ v, portada }: { v: Valor; portada: boolean }) {
  if (!v) return null;
  switch (v.kind) {
    case "text":
      return portada ? <h1 className="portada">{v.value}</h1> : <span className="valor">{v.value}</span>;
    case "richText":
      return (
        <span className="valor">
          {v.doc.content.map((p, i) => (
            <span key={i}>{(p.content ?? []).map((t) => ("text" in t ? t.text : "")).join("")}</span>
          ))}
        </span>
      );
    case "listText":
      return <ul className="lista">{v.items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case "image":
      // `<img>` sin `crossorigin`: NO es una petición en modo CORS, así que el CDN no necesita
      // cabecera para que se pinte dentro de un origen opaco (`04 §8.1`). A3 lo mide.
      return <img className={portada ? "foto portada" : "foto"} src={v.url} alt={v.alt} />;
    case "audio":
      return <span className="valor">♪ {v.url}</span>;
    case "date":
    case "time":
    case "dateTimeRange":
      return <span className="valor">{v.formatted}</span>;
    case "link":
      return <span className="valor">{v.label ?? v.href}</span>;
    case "location":
      return <span className="valor">{v.name}{v.address ? ` · ${v.address}` : ""}</span>;
    case "choice":
      return <span className="valor">{v.label}</span>;
    case "boolean":
      return <span className="valor">{v.value ? "Sí" : "No"}</span>;
    case "person":
      return <span className="valor">{v.name}</span>;
    default:
      return null;
  }
}

export default function CanvasApp({ probeFetch = false }: { probeFetch?: boolean }) {
  const [composed, setComposed] = useState<Composed | null>(null);
  const [seleccion, setSeleccion] = useState<BlockRef | null>(null);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [incompatible, setIncompatible] = useState(false);
  const emitir = useRef<((c: Record<string, unknown>) => void) | null>(null);
  const rechazados = useRef<string[]>([]);
  const raiz = useRef<HTMLDivElement>(null);

  const rechazar = useCallback((motivo: string) => {
    // P1: nada se descarta en silencio. Se registra y se cuenta.
    rechazados.current.push(motivo);
    // eslint-disable-next-line no-console
    console.warn("[lienzo] mensaje rechazado:", motivo);
  }, []);

  const clic = useCallback((ref: BlockRef) => {
    setSeleccion(ref);
    emitir.current?.({ t: "BLOCK_CLICKED", ref });
  }, []);

  useEffect(() => {
    // ── Diagnóstico del spike (NO es protocolo): mide el origen opaco desde dentro del iframe.
    try {
      window.parent.postMessage(
        { p: DIAGNOSTICO, childOrigin: window.origin, childLocation: window.location.href },
        "*",
      );
    } catch { /* sin padre */ }

    const aplicarTema = (c: Composed) => {
      // CSSOM, no atributo `style=`: `style-src` con nonce NO habilita atributos en línea.
      for (const [k, val] of Object.entries(c.theme.tokens)) {
        document.documentElement.style.setProperty(`--inv-color-${k}`, val);
      }
    };

    const procesar = (data: unknown) => {
      const v = classifyInbound(data);
      if (v.status === "incompatible") { setIncompatible(true); rechazar(`versión ${v.version} incompatible`); return; }
      if (v.status === "foreign") { rechazar("ajeno al protocolo"); return; }
      if (v.status === "invalid") { rechazar(`inválido: ${v.error.issues[0]?.path.join(".")} ${v.error.issues[0]?.message}`); return; }
      const m = v.message;
      switch (m.t) {
        case "RENDER": setComposed(m.composed); aplicarTema(m.composed); break;
        case "PATCH":
          setComposed((prev) => {
            if (!prev) return prev;
            const copia = structuredClone(prev) as Composed;
            for (const e of m.entries) {
              for (const s of copia.sections) {
                if (s.key !== e.ref.sectionKey) continue;
                for (const b of s.blocks) {
                  if (b.id === e.ref.blockId && "value" in b) (b as { value: unknown }).value = e.value;
                }
              }
            }
            return copia;
          });
          break;
        case "SELECT_BLOCK":
          setSeleccion(m.ref);
          if (m.ref) {
            document.querySelector(`[data-block-id="${CSS.escape(m.ref.blockId)}"]`)
              ?.scrollIntoView({ block: "center" });
          }
          break;
        case "SCROLL_TO_SECTION":
          document.querySelector(`[data-section-key="${CSS.escape(m.sectionKey)}"]`)?.scrollIntoView();
          break;
        case "SET_VIEWPORT": setViewport(m.width); break;
        case "PREVIEW_THEME":
          document.documentElement.style.setProperty("--inv-color-accent", m.paletteId ? "#8B2E4F" : "#6B7B4A");
          break;
        case "PING": emitir.current?.({ t: "PONG", replyTo: m.id }); break;
        case "HELLO": rechazar("HELLO repetido"); break;
      }
    };

    const alMensajeDeVentana = (ev: MessageEvent) => {
      // El HIJO sí valida por `event.origin`: el padre NO es opaco (`04 §9.2`). Es la comprobación
      // que impide que otra página embeba el lienzo y le inyecte contenido.
      if (ev.origin !== EDITOR_ORIGIN) { rechazar(`origen inesperado: ${ev.origin}`); return; }
      const v = classifyInbound(ev.data);
      if (v.status !== "ok" || v.message.t !== "HELLO") { rechazar(`por window solo se acepta HELLO (${v.status})`); return; }
      const puerto = ev.ports[0];
      if (!puerto) { rechazar("HELLO sin MessagePort"); return; }
      // DESVIACIÓN DELIBERADA de `04 §9.2` ("deja de escuchar window"): el lienzo SIGUE escuchando
      // `window`, pero solo acepta ahí `HELLO` y solo desde `EDITOR_ORIGIN`. Motivo medido: el padre
      // reintenta el saludo cuando el primero se pierde (el `load` del iframe puede adelantarse al
      // montaje de React), y sin este oyente el reintento no llegaría nunca. **Gana el último
      // HELLO**: se adopta el puerto nuevo y se responde por él, así los dos extremos convergen.
      // La superficie no crece: la comprobación de origen sigue siendo la misma.
      if (emitir.current) rechazar("saludo repetido: se adopta el puerto nuevo");
      emitir.current = crearEmisor((m) => puerto.postMessage(m));
      puerto.onmessage = (e) => procesar(e.data); // punto a punto: no hay `origin` que validar
      puerto.start();
      emitir.current({ t: "READY", protocolVersion: CANVAS_PROTOCOL_VERSION, buildId: BUILD_ID, nonce: v.message.nonce });
    };
    // Toma el relevo del buffer que instaló el script en línea del layout y drena lo acumulado:
    // el HELLO puede haber llegado antes de que React montara.
    const w = window as unknown as { __bufferMensajes?: EventListener; __pendientes?: MessageEvent[] };
    if (w.__bufferMensajes) window.removeEventListener("message", w.__bufferMensajes);
    window.addEventListener("message", alMensajeDeVentana);
    const pendientes = w.__pendientes ?? [];
    w.__pendientes = [];
    for (const ev of pendientes) alMensajeDeVentana(ev);

    // Medición de alto: el padre NO puede hacerla (`04 §8.3`).
    let ultimo = 0;
    let pendiente: ReturnType<typeof setTimeout> | null = null;
    const reportarAlto = () => {
      const h = Math.round(document.documentElement.scrollHeight);
      if (h === ultimo) return;
      ultimo = h;
      emitir.current?.({ t: "CANVAS_RESIZED", height: h });
    };
    const ro = new ResizeObserver(() => {
      if (pendiente) return;
      pendiente = setTimeout(() => { pendiente = null; reportarAlto(); }, 100);
    });
    ro.observe(document.documentElement);

    const alTeclado = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      let command: "undo" | "redo" | "save" | "escape" | null = null;
      if (mod && e.key.toLowerCase() === "z") command = e.shiftKey ? "redo" : "undo";
      else if (mod && e.key.toLowerCase() === "s") command = "save";
      else if (e.key === "Escape") command = "escape";
      if (!command) return;
      e.preventDefault();
      emitir.current?.({ t: "KEY_COMMAND", command });
    };
    document.addEventListener("keydown", alTeclado);

    // Los enlaces no navegan (falta `allow-top-navigation`), pero no se deja un clic muerto sin
    // explicación: se intercepta (`04 §8.1`).
    const alClicDocumento = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.("a")) e.preventDefault();
    };
    document.addEventListener("click", alClicDocumento);

    // Diagnóstico del spike: prueba de que `connect-src 'none'` bloquea de verdad (control de A8).
    if (probeFetch) {
      (window as unknown as { __probeFetch?: string }).__probeFetch = "lanzado";
      fetch("/probe-de-red")
        .then(() => { (window as unknown as { __probeFetch?: string }).__probeFetch = "PASÓ (mal)"; })
        .catch((err) => { (window as unknown as { __probeFetch?: string }).__probeFetch = `bloqueado: ${err}`; });
    }

    (window as unknown as { __canvas?: unknown }).__canvas = {
      rechazados: rechazados.current,
      buildId: BUILD_ID,
      origin: window.origin,
    };

    return () => {
      window.removeEventListener("message", alMensajeDeVentana);
      document.removeEventListener("keydown", alTeclado);
      document.removeEventListener("click", alClicDocumento);
      ro.disconnect();
    };
  }, [probeFetch, rechazar]);

  // Sincroniza el resaltado de la lista al hacer scroll (`04 §8.3`).
  useEffect(() => {
    if (!composed) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (!en.isIntersecting) continue;
          const key = (en.target as HTMLElement).dataset.sectionKey;
          if (key) emitir.current?.({ t: "SECTION_IN_VIEW", sectionKey: key });
        }
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll("[data-section-key]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [composed]);

  if (incompatible) {
    return <div className="espera">Vista previa incompatible. Recarga la página.</div>;
  }

  return (
    <div id="lienzo" ref={raiz} tabIndex={-1} data-viewport={viewport} data-ready={composed ? "1" : "0"}>
      {!composed ? (
        <p className="espera">Esperando el saludo del editor…</p>
      ) : (
        composed.sections.map((s) => (
          <section key={s.key} className="seccion" data-section-key={s.key} hidden={!s.visible}>
            <p className="seccion-titulo">{s.title}</p>
            {s.blocks.map((b) => {
              if (b.type === "group" && "items" in b) {
                return (
                  <div key={b.id} data-group-id={b.id}>
                    <span className="etiqueta">{b.label}</span>
                    {b.items.map((it) =>
                      it.blocks.map((ib) => {
                        const ref: BlockRef = { sectionKey: s.key, blockId: b.id, itemId: it.itemId, itemBlockId: ib.id };
                        return (
                          <div
                            key={`${it.itemId}:${ib.id}`}
                            className="bloque"
                            role="button"
                            tabIndex={0}
                            data-block-id={b.id}
                            data-item-block-id={ib.id}
                            data-selected={mismoRef(seleccion, ref) ? "true" : "false"}
                            onClick={() => clic(ref)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") clic(ref); }}
                          >
                            <span className="etiqueta">{ib.label}</span>
                            <ValorPintado v={"value" in ib ? ib.value : null} portada={false} />
                          </div>
                        );
                      }),
                    )}
                  </div>
                );
              }
              const ref: BlockRef = { sectionKey: s.key, blockId: b.id };
              return (
                <div
                  key={b.id}
                  className="bloque"
                  role="button"
                  tabIndex={0}
                  data-block-id={b.id}
                  data-selected={mismoRef(seleccion, ref) ? "true" : "false"}
                  onClick={() => clic(ref)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") clic(ref); }}
                >
                  <span className="etiqueta">{b.label}</span>
                  <ValorPintado v={"value" in b ? b.value : null} portada={b.id === "cover.title" || b.id === "cover.image"} />
                </div>
              );
            })}
          </section>
        ))
      )}
      <p id="control-sin-cors">
        Control negativo C1: esta línea usa una fuente servida SIN Access-Control-Allow-Origin.
      </p>
    </div>
  );
}
