// packages/sections/test/footer.test.tsx — `FooterSection` (tipo `footer`, 01 §3.1), variante
// `simple` (única declarada).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { FooterSection } from "../src/sections/FooterSection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "./schema-values.ts";
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

/**
 * A5 del bloque 3-9 (objeción ALTA de `3-CV`, evidencia `O-05`) — LA INVITACIÓN IMPRIMÍA «PIE».
 *
 * `section.title` del pie es la etiqueta INTERNA del editor: `template.json` la declara como
 * `"Pie"` en `boda-clasica@1.0.0` y en `xv-jardin@1.0.0`, y NINGUNA de las dos declara un bloque
 * `sectionTitle` para el pie — así que `{titleNode ?? section.title}` la pintaba, en versalitas de
 * acento, encima del aviso legal. Es exactamente el caso que `CoverSection.tsx:70` ya resolvía con
 * «Portada».
 *
 * Estas pruebas fallan sin el arreglo [V]: con el `className={styles.title}` incondicional,
 * `position` resuelve a `static` y `textTransform` a `uppercase` — la etiqueta se VE.
 */
describe("FooterSection — A5 (3-9): la etiqueta de editor «Pie» no se pinta nunca", () => {
  it("sin bloque `sectionTitle`, el <h2> se oculta VISUALMENTE (clip), no con display:none", () => {
    const { container } = render(<FooterSection section={REAL_SECTION} variant="simple" mode="public" />);
    const h2 = container.querySelector("h2")!;
    // El golden real de boda-clasica@1.0.0 no trae `sectionTitle` en el pie: cae a la etiqueta.
    expect(h2.textContent).toBe("Pie");
    const cs = getComputedStyle(h2);
    expect(cs.position).toBe("absolute"); // técnica de clip de shared.visuallyHidden
    expect(cs.clip).toBe("rect(0px, 0px, 0px, 0px)");
    // NUNCA display:none — borraría el nombre accesible de la <section> (aria-labelledby, 04 §17.3).
    expect(cs.display).not.toBe("none");
    expect(container.querySelector("section")!.getAttribute("aria-labelledby")).toBe(h2.id);
  });

  it("con `sectionTitle` real, el <h2> SÍ se ve y usa la tipografía del pie", () => {
    const conTitulo = ComposedSectionSchema.parse({
      key: "footer", type: "footer", variant: "simple", visible: true, title: "Pie",
      blocks: [
        ComposedBlockSchema.parse({
          id: "footer.title", role: "sectionTitle", type: "text", label: "Título",
          provenance: "user", value: { kind: "text", value: "Con cariño" },
        }),
      ],
    });
    const { container } = render(<FooterSection section={conTitulo} variant="simple" mode="public" />);
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent).toBe("Con cariño");
    expect(getComputedStyle(h2).position).toBe("static");
    expect(getComputedStyle(h2).textTransform).toBe("uppercase");
  });

  it("el bloque `sectionTitle` VACÍO también oculta la etiqueta (titleNode === null)", () => {
    const vacio = ComposedSectionSchema.parse({
      key: "footer", type: "footer", variant: "simple", visible: true, title: "Pie",
      blocks: [
        ComposedBlockSchema.parse({
          id: "footer.title", role: "sectionTitle", type: "text", label: "Título",
          provenance: "empty", value: null,
        }),
      ],
    });
    const { container } = render(<FooterSection section={vacio} variant="simple" mode="public" />);
    expect(getComputedStyle(container.querySelector("h2")!).position).toBe("absolute");
  });
});
