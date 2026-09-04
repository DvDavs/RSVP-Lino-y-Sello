// U-07 (04 §20.1): "Misma sección en mode:'public' y mode:'canvas' → el HTML público NO contiene
// data-block-* ni manejadores; la instantánea de texto es idéntica."
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { composedSection, blushTheme } from "./fixtures.ts";
import { ComposedDocument } from "@invitaciones/schema";

function makeDocument() {
  return ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: blushTheme(),
    sections: [composedSection()],
  });
}

describe("U-07 — public vs canvas: mismo texto, HTML público sin data-block-* ni manejadores", () => {
  it("mode='public' no lleva ningún atributo data-block-*/data-item-*", () => {
    const { container } = render(<SectionsRoot composed={makeDocument()} mode="public" />);
    const withDataBlock = container.querySelectorAll(
      "[data-block-id], [data-item-id], [data-item-block-id]",
    );
    expect(withDataBlock.length).toBe(0);
  });

  it("mode='canvas' SÍ lleva data-block-id en los bloques activables", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <SectionsRoot composed={makeDocument()} mode="canvas" onActivate={onActivate} />,
    );
    const withDataBlock = container.querySelectorAll("[data-block-id]");
    expect(withDataBlock.length).toBeGreaterThan(0);
  });

  it("la instantánea de TEXTO es idéntica entre los dos modos", () => {
    // Se compara el contenido del árbol de secciones, NO `container.textContent` completo: el
    // `<style nonce>` de `ThemeProvider` (hermano del árbol, no ancestro) lleva un nombre de clase
    // generado por `useId()` que es distinto en cada `render()` — ruido de la prueba, no una
    // divergencia real de contenido entre modos.
    const { container: pub } = render(<SectionsRoot composed={makeDocument()} mode="public" />);
    const { container: canvas } = render(
      <SectionsRoot composed={makeDocument()} mode="canvas" onActivate={vi.fn()} />,
    );
    const pubTree = pub.querySelector("[data-theme-palette]")!;
    const canvasTree = canvas.querySelector("[data-theme-palette]")!;
    expect(canvasTree.textContent).toBe(pubTree.textContent);
  });

  it("mode='public' no registra ningún manejador de clic (un click no invoca nada, no lanza)", () => {
    const { container } = render(<SectionsRoot composed={makeDocument()} mode="public" />);
    const heading = container.querySelector("h2")!;
    // No debe lanzar y no hay onActivate que llamar — si activationAttrs hubiese colado un
    // manejador en público, `getEventListeners`-equivalente no existe en jsdom, así que la
    // afirmación fuerte y determinista es la de arriba (cero data-block-*): esta prueba solo
    // confirma que un clic no rompe nada.
    expect(() => heading.dispatchEvent(new MouseEvent("click", { bubbles: true }))).not.toThrow();
  });
});
