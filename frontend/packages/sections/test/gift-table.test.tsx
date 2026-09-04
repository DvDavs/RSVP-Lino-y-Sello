// packages/sections/test/gift-table.test.tsx — `GiftTableSection` (tipo `giftTable`, 01 §3.1).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { GiftTableSection } from "../src/sections/GiftTableSection.tsx";
import { SectionsRoot } from "../src/SectionsRoot.tsx";
import { ComposedDocument } from "@invitaciones/schema";
import { ComposedBlockSchema, ComposedSectionSchema } from "../src/schema-types.ts";
import { goldenSection, goldenTheme } from "./golden-c.ts";

const REAL_SECTION = goldenSection("giftTable");

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

describe("GiftTableSection — U-01: variante desconocida cae a defaultVariant y avisa solo en canvas", () => {
  it("variant fuera de supportedVariants ⇒ data-variant='cards' (defaultVariant)", () => {
    const { container } = render(
      <GiftTableSection section={REAL_SECTION} variant="no-existe" mode="public" />,
    );
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("cards");
  });

  it("avisa por consola SOLO en mode='canvas'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<GiftTableSection section={REAL_SECTION} variant="no-existe" mode="public" />);
    expect(warnSpy).not.toHaveBeenCalled();
    render(<GiftTableSection section={REAL_SECTION} variant="no-existe" mode="canvas" />);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("GiftTableSection — variante 'list' también renderiza (registry-data.ts)", () => {
  it("data-variant='list' sin lanzar", () => {
    const { container } = render(<GiftTableSection section={REAL_SECTION} variant="list" mode="public" />);
    expect(container.querySelector("section")!.getAttribute("data-variant")).toBe("list");
  });
});

describe("GiftTableSection — value:null en cada rol propio no rompe (R2/R5)", () => {
  const emptySection = ComposedSectionSchema.parse({
    key: "giftTable",
    type: "giftTable",
    variant: "cards",
    visible: true,
    title: "Mesa de regalos",
    blocks: [
      ComposedBlockSchema.parse({
        id: "gifts.title", role: "sectionTitle", type: "text", label: "Título",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "gifts.intro", role: "sectionIntro", type: "text", label: "Introducción",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "gifts.background", role: "sectionBackground", type: "image", label: "Fondo",
        provenance: "empty", value: null,
      }),
      ComposedBlockSchema.parse({
        id: "gifts.decor", role: "decorative", type: "image", label: "Ornamento",
        provenance: "empty", value: null,
      }),
    ],
  });

  it("no lanza y cae al título fijo del manifiesto", () => {
    const { container } = render(<GiftTableSection section={emptySection} variant="cards" mode="public" />);
    expect(container.querySelector("h2")!.textContent).toBe("Mesa de regalos");
  });

  it("el grupo `giftOptions` ausente no pinta nada adicional", () => {
    const { container } = render(<GiftTableSection section={emptySection} variant="cards" mode="public" />);
    expect(container.querySelectorAll("ul").length).toBe(0);
  });
});

describe("GiftTableSection — mode='public' no lleva data-block-*", () => {
  it("cero atributos data-block-id/data-item-id/data-item-block-id", () => {
    const { container } = withRoot(REAL_SECTION, "public");
    expect(container.querySelectorAll("[data-block-id], [data-item-id], [data-item-block-id]").length).toBe(0);
  });

  it("mode='canvas' sí los lleva", () => {
    const { container } = withRoot(REAL_SECTION, "canvas", vi.fn());
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(0);
  });
});

describe("GiftTableSection — enlace externo con rel seguro", () => {
  it("el enlace de la opción de regalo lleva target=_blank y rel=noopener noreferrer cuando hay href", () => {
    // El golden real de boda-clasica no trae `giftOptionLink` con valor (provenance:"empty"); se
    // arma una sección mínima con un enlace real para probar el contrato de LinkBlock (04 §17.3).
    const withLink = ComposedSectionSchema.parse({
      key: "giftTable", type: "giftTable", variant: "cards", visible: true, title: "Mesa de regalos",
      blocks: [
        {
          id: "gifts.options", role: "giftOptions", type: "group", label: "Opciones", provenance: "user",
          items: [
            {
              itemId: "01J8DEM0000000000000000GF9",
              blocks: [
                ComposedBlockSchema.parse({
                  id: "title", role: "giftOptionTitle", type: "text", label: "Título", provenance: "user",
                  value: { kind: "text", value: "Mesa en tienda" },
                }),
                ComposedBlockSchema.parse({
                  id: "link", role: "giftOptionLink", type: "link", label: "Enlace", provenance: "user",
                  value: { kind: "link", href: "https://www.liverpool.com.mx/mesaderegalos/1" },
                }),
              ],
            },
          ],
        },
      ],
    });
    const { container } = render(<GiftTableSection section={withLink} variant="cards" mode="public" />);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

describe("GiftTableSection — a11y (jest-axe, datos reales de boda-clasica)", () => {
  it("cero violaciones", async () => {
    const { container } = withRoot(REAL_SECTION, "public");
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
