import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { CanvasProvider } from "../../src/canvas/CanvasContext.tsx";
import { SectionsRoot } from "../../src/SectionsRoot.tsx";
import { composedSection, blushTheme } from "../fixtures.ts";
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

describe("SelectionOverlay (vía SectionsRoot + CanvasProvider)", () => {
  it("sin selección, el overlay no se muestra (display: none, valor de reserva del .module.css)", () => {
    const { container } = render(
      <CanvasProvider onActivate={vi.fn()}>
        <SectionsRoot composed={makeDocument()} mode="canvas" />
      </CanvasProvider>,
    );
    // El overlay es el único <div> con aria-hidden="true" en el árbol (las secciones no llevan
    // esa combinación); las demás <div> son huecos de bloque de SectionPlaceholder.
    const candidates = Array.from(container.querySelectorAll<HTMLElement>("div")).filter(
      (el) => el.getAttribute("aria-hidden") === "true",
    );
    expect(candidates.length).toBe(1);
    expect(candidates[0]!.style.display).toBe("none");
  });

  it("con selección apuntando a un bloque real (data-block-id), el overlay se muestra", () => {
    const { container } = render(
      <CanvasProvider selected={{ sectionKey: "cover", blockId: "cover.title" }} onActivate={vi.fn()}>
        <SectionsRoot composed={makeDocument()} mode="canvas" />
      </CanvasProvider>,
    );
    const overlay = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
      (el) => el.getAttribute("aria-hidden") === "true",
    )!;
    expect(overlay.style.display).toBe("block");
  });

  it("con selección que NO corresponde a ningún bloque presente, se mantiene oculto", () => {
    const { container } = render(
      <CanvasProvider selected={{ sectionKey: "cover", blockId: "no.existe" }} onActivate={vi.fn()}>
        <SectionsRoot composed={makeDocument()} mode="canvas" />
      </CanvasProvider>,
    );
    const overlay = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
      (el) => el.getAttribute("aria-hidden") === "true",
    )!;
    expect(overlay.style.display).toBe("none");
  });

  it("fuera de un CanvasProvider, SelectionOverlay no se monta en absoluto", () => {
    const { container } = render(<SectionsRoot composed={makeDocument()} mode="public" />);
    const overlay = Array.from(container.querySelectorAll<HTMLElement>("div")).find(
      (el) => el.getAttribute("aria-hidden") === "true",
    );
    expect(overlay).toBeUndefined();
  });
});
