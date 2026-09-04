"use client";

// components/editor/CanvasFrame.tsx — el `<iframe>` aislado del lienzo y su puente (04 §8, §9, §18).
//
// Este componente es el ÚNICO sitio de `apps/web` que crea un `CanvasBridge`. Conecta las dos
// direcciones con el store: los mensajes salientes van por el `CanvasSink` que registra en
// `attachCanvas`, y los entrantes se traducen a acciones (`select`, `undoOnce`, …).
//
// Degradación (04 §8.8): si el lienzo no arranca tras DOS intentos, el editor sigue usable — el
// panel funciona íntegro, que es donde se edita de verdad — y se ofrece `/preview/{invitationId}`
// en pestaña nueva. La ruta existe justo para esto.
//
// P8/C4: al iframe no viaja NINGÚN secreto. `sandbox="allow-scripts"` sin `allow-same-origin`
// (ADR-018/031, compuerta A1-A8 8/8 en `handoffs/3-0b.md`). No añadir `allow-same-origin` sin
// repetir la compuerta completa.
import { useCallback, useEffect, useRef, useState } from "react";
import { createCanvasBridge, type CanvasBridge } from "@/lib/canvas-bridge";
import { useEditorStore } from "@/lib/store";
import { es_MX } from "@/lib/i18n";

export interface CanvasFrameProps {
  invitationId: string;
}

export function CanvasFrame({ invitationId }: CanvasFrameProps) {
  const marcoRef = useRef<HTMLIFrameElement>(null);
  const puenteRef = useRef<CanvasBridge | null>(null);
  const [recarga, setRecarga] = useState(0);
  const estadoLienzo = useEditorStore((s) => s.canvas.status);
  const intentos = useEditorStore((s) => s.canvas.attempts);
  const viewport = useEditorStore((s) => s.viewport);

  const alCargar = useCallback(() => {
    puenteRef.current?.start();
  }, []);

  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return;
    const tienda = useEditorStore.getState();

    const puente = createCanvasBridge(marco, {
      onReady: (buildId) => tienda.onCanvasReady(buildId),
      onBlockClicked: (ref) => useEditorStore.getState().select(ref),
      onSectionInView: () => {
        /* EXTENSIÓN 3-5: resaltar la fila correspondiente de `SectionList`. */
      },
      onResized: (h) => useEditorStore.getState().onCanvasResized(h),
      onKeyCommand: (comando) => {
        const s = useEditorStore.getState();
        if (comando === "undo") s.undoOnce();
        else if (comando === "redo") s.redoOnce();
        else if (comando === "save") s.flushNow();
        else s.select(null);
      },
      onRenderError: (info) =>
        useEditorStore.getState().pushWarning({
          nivel: "warning",
          texto: info.sectionKey
            ? `No pudimos mostrar la sección «${info.sectionKey}» en la vista previa.`
            : "No pudimos mostrar una parte de la vista previa.",
        }),
      onRenderWarning: (info) =>
        useEditorStore.getState().pushWarning({ nivel: "info", texto: `Vista previa: ${info.detail}`, codigo: info.code }),
      onIncompatible: (v) => useEditorStore.getState().onCanvasIncompatible(v),
      onInvalid: (detalle) =>
        useEditorStore.getState().pushWarning({ nivel: "info", texto: `La vista previa envió un mensaje que no entendimos (${detalle}).` }),
      onReadyTimeout: (intento) => {
        useEditorStore.getState().onCanvasError();
        // Primer vencimiento: se recarga el iframe UNA vez con `?r=2` (04 §9.2). Segundo: §8.8.
        if (intento === 1) setRecarga((n) => n + 1);
      },
    });
    puenteRef.current = puente;

    useEditorStore.getState().attachCanvas({
      render: (composed, revision) => puente.sendRender(composed, revision),
      patch: (entries) => puente.sendPatch(entries),
      select: (ref) => puente.sendSelect(ref),
      scrollToSection: (key) => puente.sendScrollToSection(key),
      viewport: (w) => puente.sendViewport(w),
      previewTheme: (p, f) => puente.sendPreviewTheme(p, f),
    });

    // El `load` puede adelantarse al montaje y `onLoad` no ejecutarse nunca: se arranca igual aquí,
    // y el reintento cada 800 ms del puente cubre el caso contrario (`handoffs/3-0b.md` §1).
    puente.start();

    return () => {
      useEditorStore.getState().attachCanvas(null);
      puente.destroy();
      puenteRef.current = null;
    };
  }, [recarga]);

  const degradado = estadoLienzo === "error" && intentos >= 2;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex-1 overflow-hidden rounded-ui-card border border-ui-border bg-ui-bg-alt">
        {degradado ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-prose text-ui-body text-ui-ink">{es_MX.editor.lienzo.noDisponible}</p>
            <div className="flex gap-3">
              <button
                type="button"
                className="min-h-11 rounded-ui-pill bg-ui-accent px-5 text-ui-aux font-semibold text-ui-accent-ink"
                onClick={() => {
                  useEditorStore.setState((s) => ({ canvas: { ...s.canvas, status: "loading", attempts: 0 } }));
                  setRecarga((n) => n + 1);
                }}
              >
                {es_MX.comun.reintentar}
              </button>
              <a
                className="min-h-11 rounded-ui-pill border border-ui-border px-5 leading-11 text-ui-aux font-semibold text-ui-ink"
                href={`/preview/${invitationId}`}
                target="_blank"
                rel="noreferrer"
              >
                {es_MX.editor.lienzo.irAPreview}
              </a>
            </div>
          </div>
        ) : (
          <iframe
            key={recarga}
            ref={marcoRef}
            title={es_MX.editor.lienzo.tituloIframe}
            src={recarga === 0 ? `/editor/${invitationId}/canvas` : `/editor/${invitationId}/canvas?r=${recarga + 1}`}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            onLoad={alCargar}
            data-viewport={viewport}
            aria-busy={estadoLienzo !== "ready"}
            className={
              viewport === "mobile"
                ? "mx-auto block h-full w-[390px] border-0 bg-white shadow-ui-1"
                : "block h-full w-full border-0 bg-white"
            }
          />
        )}
      </div>
    </div>
  );
}
