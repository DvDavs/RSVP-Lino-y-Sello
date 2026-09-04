// packages/sections/test/rsvp.test.tsx — `RsvpSection` (tipo `rsvp`, 01 §3.1, 04 §15.6/§8.1/§8.7).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { RsvpSection } from "../src/sections/RsvpSection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "../src/schema-types.ts";
import { goldenSection, goldenTheme } from "./golden-c.ts";

const REAL_SECTION = goldenSection("rsvp");

function withRoot(section: ReturnType<typeof goldenSection>, mode: "public" | "canvas", onActivate?: () => void) {
  const doc = ComposedDocument.parse({
    composedVersion: 1,
    template: { slug: "boda-clasica", version: "1.0.0" },
    locale: "es-MX",
    theme: goldenTheme(),
    sections: [section],
  });
  return render(<SectionsRoot composed={doc} mode={mode} onActivate={onActivate} />);
}

describe("RsvpSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("variant fuera de supportedVariants ⇒ data-variant='banner' (defaultVariant)", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("banner");
  });

  it("avisa por consola SOLO en mode='canvas'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<RsvpSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<RsvpSection section={REAL_SECTION} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("RsvpSection — variante 'form-inline' también renderiza", () => {
  it("data-variant='form-inline' sin lanzar", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="form-inline" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("form-inline");
  });
});

describe("RsvpSection — NO implementa el formulario funcional (04 §15.6/§8.7)", () => {
  it("no renderiza ningún <form>, <input> ni <button type=submit>", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="public" />);
    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button[type=submit]")).toBeNull();
  });

  it("deja un gancho DOM estable para la isla (#rsvp-mount-{key}, data-rsvp-mount)", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="public" />);
    const slot = container.querySelector(`#rsvp-mount-${REAL_SECTION.key}`);
    expect(slot).not.toBeNull();
    expect(slot!.getAttribute("data-rsvp-mount")).toBe(REAL_SECTION.key);
  });
});

describe("RsvpSection — en mode:'canvas' la llamada a la acción queda INERTE (04 §8.1: sin allow-forms)", () => {
  it("public: la CTA es un <a href> real, operable por teclado", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="public" />);
    const cta = Array.from(container.querySelectorAll("a")).find((a) => a.textContent === "Confirmar asistencia");
    expect(cta).toBeDefined();
    expect(cta!.getAttribute("href")).toBe(`#rsvp-mount-${REAL_SECTION.key}`);
  });

  it("canvas: la CTA NO es un enlace ni un botón — es un span aria-disabled con tabIndex=-1", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="canvas" />);
    const ctaLink = Array.from(container.querySelectorAll("a")).find((a) => a.textContent === "Confirmar asistencia");
    expect(ctaLink).toBeUndefined();
    const ctaSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Confirmar asistencia",
    )!;
    expect(ctaSpan.getAttribute("aria-disabled")).toBe("true");
    expect(ctaSpan.getAttribute("tabIndex")).toBe("-1");
  });

  it("canvas: un clic en la CTA inerte no lanza ni invoca onActivate", () => {
    const onActivate = vi.fn();
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="canvas" onActivate={onActivate} />);
    const ctaSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Confirmar asistencia",
    )!;
    expect(() => ctaSpan.dispatchEvent(new MouseEvent("click", { bubbles: true }))).not.toThrow();
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe("RsvpSection — rsvpChildrenAllowed se redacta en es-MX, no como 'Sí'/'No' genérico", () => {
  it("childrenAllowed:true ⇒ 'Este evento admite niños'", () => {
    const { container } = render(<RsvpSection section={REAL_SECTION} variant="banner" mode="public" />);
    expect(container.textContent).toContain("Este evento admite niños");
  });
});

describe("RsvpSection — value:null en cada rol propio no rompe (R2/R5)", () => {
  const emptySection = ComposedSectionSchema.parse({
    key: "rsvp", type: "rsvp", variant: "banner", visible: true, title: "Confirmación",
    blocks: [
      ComposedBlockSchema.parse({
        id: "rsvp.title", role: "sectionTitle", type: "text", label: "Título",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "rsvp.deadline", role: "rsvpDeadline", type: "date", label: "Fecha límite",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "rsvp.note", role: "rsvpNote", type: "text", label: "Nota",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "rsvp.children", role: "rsvpChildrenAllowed", type: "boolean", label: "Niños",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "rsvp.background", role: "rsvpBackground", type: "image", label: "Fondo",
        provenance: "empty", value: null,
      }),
    ],
  });

  it("no lanza, cae al título fijo del manifiesto y la CTA sigue presente", () => {
    const { container } = render(<RsvpSection section={emptySection} variant="banner" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Confirmación");
    expect(container.textContent).toContain("Confirmar asistencia");
  });
});

describe("RsvpSection — mode='public' no lleva data-block-*", () => {
  it("cero atributos data-block-id/data-item-id/data-item-block-id", () => {
    const { container } = withRoot(REAL_SECTION, "public");
    expect(container.querySelectorAll("[data-block-id], [data-item-id], [data-item-block-id]").length).toBe(0);
  });

  it("mode='canvas' sí los lleva en los bloques de contenido (no en la CTA, que no es un bloque)", () => {
    const { container } = withRoot(REAL_SECTION, "canvas", vi.fn());
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("RsvpSection — a11y (jest-axe, datos reales de boda-clasica)", () => {
  it("cero violaciones en mode='public'", async () => {
    const { container } = withRoot(REAL_SECTION, "public");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
