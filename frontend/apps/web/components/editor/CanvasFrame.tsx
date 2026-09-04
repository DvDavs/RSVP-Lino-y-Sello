"use client";

// components/editor/CanvasFrame.tsx — el `<iframe>` aislado del lienzo (04 §8, §18). ESQUELETO: solo
// monta el iframe con el `sandbox` correcto y un título accesible. El puente `postMessage`
// (`lib/canvas-bridge.ts`, protocolo de `@invitaciones/schema/canvas`) es del bloque 3-4/3-5; hasta
// entonces el lienzo no recibe ningún `HELLO` del padre y se queda en su propio estado "esperando".
import { es_MX } from "@/lib/i18n";

export interface CanvasFrameProps {
  invitationId: string;
}

export function CanvasFrame({ invitationId }: CanvasFrameProps) {
  return (
    <iframe
      title={es_MX.editor.lienzo.tituloIframe}
      src={`/editor/${invitationId}/canvas`}
      // Sin `allow-same-origin`: origen OPACO a propósito (ADR-018/031, compuerta A1-A8 en
      // `handoffs/3-0b.md`, VEREDICTO: viable, 8/8). No añadir `allow-same-origin` sin repetir la
      // compuerta completa.
      sandbox="allow-scripts"
      style={{ width: "100%", height: "100%", border: "1px solid #e7e5e4", borderRadius: 8 }}
    />
  );
}
