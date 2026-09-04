"use client";

// app/(canvas)/editor/[invitationId]/canvas/page.tsx — documento del iframe (04 §6, §8, §9).
// ESQUELETO: implementa el saludo real `HELLO` → `READY` (el único tramo medido por la compuerta
// A1-A8, `handoffs/3-0b.md`) para probar que el mecanismo sigue vivo, y se queda "esperando datos"
// después. NO hace fetch (`connect-src 'none'`, verificado por la regla de ESLint de esta carpeta) y
// NO importa `lib/api-client.ts` ni `lib/store.ts`. El bloque 3-4/3-5 añade aquí: `RENDER`/`PATCH`
// entrantes → `SectionsRoot` de `@invitaciones/sections` (mode="canvas"), y `BLOCK_CLICKED`,
// `SECTION_IN_VIEW`, `CANVAS_RESIZED`, `KEY_COMMAND` salientes (04 §9.4).
// ISSUE ABIERTO, verificado con Playwright, NO resuelto (registrado en `preguntas-abiertas.md` y
// `memoria/bitacora/3-1.md`; `handoffs/3-1.md` lo entrega al bloque 3-4/3-5): dentro de `apps/web`
// (a diferencia de `spikes/canvas-gate`, que corrió FUERA del workspace pnpm), esta ruta sigue
// registrando `{directive:"script-src", blockedURI:"eval", sourceFile:".../chunks/<hash>.js"}` en
// `e2e/lienzo-csp.spec.ts` pese a `canvas-runtime.ts` (`import "./canvas-runtime.ts"` primero en
// `canvas-protocol.ts`, ADR-3-0b-02) y a esta llamada explícita a nivel de módulo. Descartado: NO es
// una segunda instalación física de `zod` — `pnpm` confirma un único `.pnpm/zod@4.5.4` en el árbol
// (`node-linker=isolated` no lo duplicó). La sospecha con más evidencia, sin confirmar del todo, es
// que Turbopack separa el chunk de `zod` en un contexto de módulo propio para el *chunk group* de
// esta ruta, con su propia instancia del `eN` de configuración interna de Zod — pendiente de
// depurar con el bundle sin minificar. Import y llamada de más abajo se dejan como intento de
// mitigación (no hacen daño; no lo arreglan solos).
import { z } from "zod";
z.config({ jitless: true });

import {
  CANVAS_PROTOCOL_TAG,
  CANVAS_PROTOCOL_VERSION,
  classifyInbound,
  configureZodForCanvas,
  type CanvasOutbound,
} from "@invitaciones/schema/canvas";
import { useEffect, useRef, useState } from "react";

configureZodForCanvas();

type EstadoSaludo = "esperando" | "listo";

declare global {
  interface Window {
    __pendientes?: MessageEvent[];
    __bufferMensajes?: (e: MessageEvent) => void;
    __gate?: { estadoSaludo: EstadoSaludo };
  }
}

export default function PaginaLienzo() {
  const [estadoSaludo, setEstadoSaludo] = useState<EstadoSaludo>("esperando");
  const puertoRef = useRef<MessagePort | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    function siguienteSecuencia(): number {
      const actual = seqRef.current;
      seqRef.current += 1;
      return actual;
    }

    function manejarMensaje(evento: MessageEvent): void {
      const veredicto = classifyInbound(evento.data);
      if (veredicto.status !== "ok") return; // "incompatible" | "foreign" | "invalid": se ignora, no se rompe
      if (veredicto.message.t !== "HELLO") return; // RENDER/PATCH/… son del bloque 3-4/3-5

      const puerto = evento.ports[0];
      if (!puerto) return;
      puertoRef.current = puerto;

      const respuesta: CanvasOutbound = {
        p: CANVAS_PROTOCOL_TAG,
        v: CANVAS_PROTOCOL_VERSION,
        seq: siguienteSecuencia(),
        t: "READY",
        protocolVersion: CANVAS_PROTOCOL_VERSION,
        buildId: "apps-web-3-1-esqueleto",
        nonce: veredicto.message.nonce,
      };
      puerto.postMessage(respuesta);
      setEstadoSaludo("listo");
    }

    // Drena lo acumulado por el script de `layout.tsx` ANTES de que React montara.
    const pendientes = window.__pendientes ?? [];
    for (const evento of pendientes) manejarMensaje(evento);
    window.__pendientes = [];
    if (window.__bufferMensajes) window.removeEventListener("message", window.__bufferMensajes);
    window.addEventListener("message", manejarMensaje);
    return () => window.removeEventListener("message", manejarMensaje);
  }, []);

  useEffect(() => {
    // Punto de enganche para Playwright (mismo patrón que `spikes/canvas-gate`, `handoffs/3-0b.md` §4).
    window.__gate = { estadoSaludo };
  }, [estadoSaludo]);

  return (
    // Sin `style=` en línea (CSP del lienzo, ver `(canvas)/layout.tsx`): la clase la define el
    // único `<style nonce>` del documento.
    <main className="lienzo-main">
      <p>{estadoSaludo === "esperando" ? "Esperando al editor…" : "Conectado. Esperando datos de la invitación…"}</p>
    </main>
  );
}
