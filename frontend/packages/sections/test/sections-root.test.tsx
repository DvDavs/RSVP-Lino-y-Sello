import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { composedSection, blushTheme } from "./fixtures.ts";
import { ComposedDocument } from "@invitaciones/schema";

function doc(sections: ReturnType<typeof composedSection>[]) {
  return ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: blushTheme(),
    sections,
  });
}

describe("SectionsRoot", () => {
  it("no renderiza secciones con visible:false", () => {
    const { container } = render(
      <SectionsRoot
        composed={doc([composedSection({ key: "cover" }), composedSection({ key: "story", type: "story", visible: false })])}
        mode="public"
      />,
    );
    expect(container.querySelectorAll("section").length).toBe(1);
    expect(container.querySelector('[data-section-type="story"]')).toBeNull();
  });

  it("respeta el orden de composed.sections (R1: autoridad del array del cliente)", () => {
    const { container } = render(
      <SectionsRoot
        composed={doc([
          composedSection({ key: "footer", type: "footer", title: "Pie", blocks: [] }),
          composedSection({ key: "cover", type: "cover", title: "Portada" }),
        ])}
        mode="public"
      />,
    );
    const headings = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(headings).toEqual(["Pie", "Portada"]);
  });

  it("acepta selected/onActivate/pending directos sin necesitar un CanvasProvider", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <SectionsRoot
        composed={doc([composedSection()])}
        mode="canvas"
        onActivate={onActivate}
        selected={{ sectionKey: "cover", blockId: "cover.title" }}
        pending={new Set(["cover.title"])}
      />,
    );
    const el = container.querySelector('[data-block-id="cover.title"]')!;
    expect(el.getAttribute("aria-busy")).toBe("true");
  });

  it('mode="public" ignora cualquier selected/onActivate/pending que se le pase', () => {
    const onActivate = vi.fn();
    const { container } = render(
      <SectionsRoot
        composed={doc([composedSection()])}
        mode="public"
        onActivate={onActivate}
        selected={{ sectionKey: "cover", blockId: "cover.title" }}
        pending={new Set(["cover.title"])}
      />,
    );
    expect(container.querySelectorAll("[data-block-id]").length).toBe(0);
  });

  it("aplica el tema del documento (ThemeProvider por debajo, U-06 lo prueba a fondo)", () => {
    const { container } = render(<SectionsRoot composed={doc([composedSection()])} mode="public" />);
    const themed = container.querySelector('[data-theme-palette="blush"]');
    expect(themed).not.toBeNull();
  });
});
