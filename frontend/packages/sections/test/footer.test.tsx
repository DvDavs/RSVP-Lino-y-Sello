// packages/sections/test/footer.test.tsx — `FooterSection` (tipo `footer`, 01 §3.1), variante
// `simple` (única declarada).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { FooterSection } from "../src/sections/FooterSection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "../src/schema-types.ts";
import { goldenSection, goldenTheme } from "./golden-c.ts";

const REAL_SECTION = goldenSection("footer");

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

describe("FooterSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("variant fuera de supportedVariants ⇒ data-variant='simple' (defaultVariant)", () => {
    const { container } = render(<FooterSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("simple");
  });

  it("avisa por consola SOLO en mode='canvas'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<FooterSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<FooterSection section={REAL_SECTION} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("FooterSection — footerNote fijo del golden real se pinta", () => {
  it("contiene la nota legal real de boda-clasica", () => {
    const { container } = render(<FooterSection section={REAL_SECTION} variant="simple" mode="public" />);
    expect(container.textContent).toContain("Invitaciones Digitales Agape");
  });
});

describe("FooterSection — música NUNCA autorreproducida (04 §17.5, 1.4.2 Audio Control)", () => {
  const withMusic = ComposedSectionSchema.parse({
    key: "footer", type: "footer", variant: "simple", visible: true, title: "Pie",
    blocks: [
      ComposedBlockSchema.parse({
        id: "footer.music", role: "backgroundMusic", type: "audio", label: "Música de fondo",
        provenance: "user", value: { kind: "audio", url: "https://cdn.ejemplo.mx/musica.mp3" },
      }),
    ],
  });

  it("el <audio> no lleva autoPlay y sí lleva controls + muted (red de seguridad adicional)", () => {
    const { container } = render(<FooterSection section={withMusic} variant="simple" mode="public" />);
    const audio = container.querySelector("audio")!;
    expect(audio).not.toBeNull();
    expect(audio.hasAttribute("autoplay")).toBe(false);
    expect(audio.hasAttribute("controls")).toBe(true);
  });

  it("R4 — con backgroundMusicEnabled:false NO se pinta el reproductor aunque haya audio", () => {
    const disabled = ComposedSectionSchema.parse({
      ...withMusic,
      blocks: [
        ...withMusic.blocks,
        ComposedBlockSchema.parse({
          id: "footer.musicEnabled", role: "backgroundMusicEnabled", type: "boolean", label: "Activada",
          provenance: "business", value: { kind: "boolean", value: false },
        }),
      ],
    });
    const { container } = render(<FooterSection section={disabled} variant="simple" mode="public" />);
    expect(container.querySelector("audio")).toBeNull();
  });
});

describe("FooterSection — value:null en cada rol propio no rompe (R2/R5)", () => {
  const emptySection = ComposedSectionSchema.parse({
    key: "footer", type: "footer", variant: "simple", visible: true, title: "Pie",
    blocks: [
      ComposedBlockSchema.parse({
        id: "footer.note", role: "footerNote", type: "text", label: "Nota legal",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "footer.logo", role: "footerLogo", type: "image", label: "Logo",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "footer.link", role: "footerLink", type: "link", label: "Enlace",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "footer.music", role: "backgroundMusic", type: "audio", label: "Música",
        provenance: "empty", value: null,
      }),
    ],
  });

  it("no lanza y cae al título fijo del manifiesto", () => {
    const { container } = render(<FooterSection section={emptySection} variant="simple" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Pie");
    expect(container.querySelector("audio")).toBeNull();
  });
});

describe("FooterSection — mode='public' no lleva data-block-*", () => {
  it("cero atributos data-block-id/data-item-id/data-item-block-id", () => {
    const { container } = withRoot(REAL_SECTION, "public");
    expect(container.querySelectorAll("[data-block-id], [data-item-id], [data-item-block-id]").length).toBe(0);
  });

  it("mode='canvas' sí los lleva", () => {
    const { container } = withRoot(REAL_SECTION, "canvas", vi.fn());
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("FooterSection — a11y (jest-axe, datos reales de boda-clasica)", () => {
  it("cero violaciones", async () => {
    const { container } = withRoot(REAL_SECTION, "public");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
