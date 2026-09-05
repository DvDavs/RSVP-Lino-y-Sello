// app/(canvas)/editor/[invitationId]/canvas/LienzoCliente.test.tsx — bloque 3-5b.
//
// Qué protege: que la vista previa de paleta (`04 §7.1` paso 8) cambie el COLOR del lienzo, no solo
// el atributo `data-theme-palette`. Comprobar el atributo era exactamente el falso positivo que dejó
// pasar el defecto (`preguntas-abiertas.md` § "Fase 3 · 3-5", entrada ALTA): el atributo cambiaba y
// los seis `--inv-color-*` se quedaban en la paleta anterior, porque `PREVIEW_THEME` solo transporta
// identificadores y `ThemeProvider` pinta desde `theme.tokens`.
//
// Se mide `element.style.getPropertyValue(...)` —lo que `ThemeProvider` escribe por CSSOM, la vía
// que la CSP del lienzo SÍ permite— y no `getComputedStyle`: jsdom no resuelve la cascada de un
// `<style>`, y es el propio `ThemeProvider` quien documenta que por eso reafirma los valores por
// CSSOM (`packages/sections/src/theme/ThemeProvider.tsx:12-16`). La comprobación en un navegador de
// verdad, con el valor COMPUTADO dentro del iframe, la hace `e2e/paleta-preview.spec.ts`.
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ComposedDocument } from "@invitaciones/schema";
import { composedFixture } from "@/test/fixtures/composed.ts";
import { THEME_BODA_CLASICA } from "@/test/fixtures/manifest.ts";
import { LienzoCliente } from "./LienzoCliente.tsx";

const NONCE_SALUDO = "a".repeat(32);
const paleta = (id: string) => THEME_BODA_CLASICA.palettes.find((p) => p.id === id)!;

function documentoCon(paletteId: string): ComposedDocument {
  const base = composedFixture();
  const p = paleta(paletteId);
  return { ...base, theme: { ...base.theme, paletteId: p.id, tokens: p.tokens } };
}

function sobre(seq: number, cuerpo: Record<string, unknown>): Record<string, unknown> {
  return { p: "inv-canvas", v: 1, seq, ...cuerpo };
}

/** Deja el `HELLO` en la cola que el `<script nonce>` del layout llena antes de que React hidrate. */
function encolarSaludo(): MessagePort {
  const canal = new MessageChannel();
  (window as unknown as { __pendientes: unknown[] }).__pendientes = [
    { origin: "", data: sobre(0, { t: "HELLO", nonce: NONCE_SALUDO }), ports: [canal.port2] },
  ];
  return canal.port1;
}

async function enviar(puerto: MessagePort, mensaje: Record<string, unknown>): Promise<void> {
  await act(async () => {
    puerto.postMessage(mensaje);
    await new Promise((r) => setTimeout(r, 0));
  });
}

function raizDelTema(): HTMLElement {
  const el = document.querySelector("[data-theme-palette]");
  if (!(el instanceof HTMLElement)) throw new Error("El lienzo no montó ThemeProvider");
  return el;
}

function tema(): { paleta: string | null; acento: string; fondo: string } {
  const el = raizDelTema();
  return {
    paleta: el.getAttribute("data-theme-palette"),
    acento: el.style.getPropertyValue("--inv-color-accent"),
    fondo: el.style.getPropertyValue("--inv-color-bg"),
  };
}

describe("LienzoCliente · vista previa de tema (04 §7.1 paso 8)", () => {
  let puerto: MessagePort;

  beforeEach(() => {
    puerto = encolarSaludo();
  });

  afterEach(() => {
    delete (window as unknown as { __pendientes?: unknown[] }).__pendientes;
  });

  it("un RENDER con otra paleta repinta los --inv-color-* de verdad, no solo el atributo", async () => {
    render(<LienzoCliente nonce="n0nc3" />);
    await enviar(puerto, sobre(1, { t: "RENDER", composed: documentoCon("blush"), revision: 7 }));
    expect(tema()).toEqual({ paleta: "blush", acento: "#B05555", fondo: "#FDF7F5" });

    // Vista previa: `PREVIEW_THEME` (identificadores) + el `RENDER` efímero del padre con los
    // tokens ya resueltos y la MISMA revisión. Los dos, en ese orden, como los manda `lib/store.ts`.
    await enviar(puerto, sobre(2, { t: "PREVIEW_THEME", paletteId: "olive", fontSetId: null }));
    await enviar(puerto, sobre(3, { t: "RENDER", composed: documentoCon("olive"), revision: 7 }));
    expect(tema()).toEqual({ paleta: "olive", acento: "#657446", fondo: "#F7F5EE" });

    // Al retirar el ratón vuelve el tema REAL (mismo camino, en sentido contrario).
    await enviar(puerto, sobre(4, { t: "PREVIEW_THEME", paletteId: null, fontSetId: null }));
    await enviar(puerto, sobre(5, { t: "RENDER", composed: documentoCon("blush"), revision: 7 }));
    expect(tema()).toEqual({ paleta: "blush", acento: "#B05555", fondo: "#FDF7F5" });
  });

  it("PREVIEW_THEME sin RENDER (padre SIN catálogo) cambia el identificador y NO miente con el color", async () => {
    render(<LienzoCliente nonce="n0nc3" />);
    await enviar(puerto, sobre(1, { t: "RENDER", composed: documentoCon("blush"), revision: 7 }));
    await enviar(puerto, sobre(2, { t: "PREVIEW_THEME", paletteId: "olive", fontSetId: null }));

    // Degradación explícita (P1): el lienzo no inventa tokens que no tiene, y tampoco se rompe.
    expect(tema()).toEqual({ paleta: "olive", acento: "#B05555", fondo: "#FDF7F5" });
  });

  it("el RENDER efímero de la vista previa no borra las marcas de bloque sin confirmar (§12.4)", async () => {
    render(<LienzoCliente nonce="n0nc3" />);
    await enviar(puerto, sobre(1, { t: "RENDER", composed: documentoCon("blush"), revision: 7 }));
    await enviar(
      puerto,
      sobre(2, {
        t: "PATCH",
        entries: [
          {
            ref: { sectionKey: "cover", blockId: "cover.title" },
            value: { kind: "text", value: "Ana & Luis" },
            provenance: "user",
            pending: true,
          },
        ],
      }),
    );
    const ocupadosAntes = document.querySelectorAll('[aria-busy="true"]').length;
    expect(ocupadosAntes).toBeGreaterThan(0);

    // Misma revisión ⇒ es un repintado del padre, no verdad nueva del servidor.
    await enviar(puerto, sobre(3, { t: "RENDER", composed: documentoCon("olive"), revision: 7 }));
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(ocupadosAntes);

    // Revisión nueva ⇒ el servidor ya confirmó: las marcas sí se limpian.
    await enviar(puerto, sobre(4, { t: "RENDER", composed: documentoCon("olive"), revision: 8 }));
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
  });
});
