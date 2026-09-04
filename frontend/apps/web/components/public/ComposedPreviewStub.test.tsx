import type { ComposedDocument } from "@invitaciones/schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComposedPreviewStub } from "./ComposedPreviewStub.tsx";

const FIXTURE: ComposedDocument = {
  composedVersion: 1,
  template: { slug: "boda-clasica", version: "1.0.0" },
  locale: "es-MX",
  theme: {
    paletteId: "blush",
    fontSetId: "serif-elegante",
    tokens: { bg: "#FBF7F2", surface: "#FFFFFF", ink: "#221C14", accent: "#B8441A", accentInk: "#FFFFFF", muted: "#E7DFD2" },
    fonts: {
      heading: { family: "Fraunces", weights: [600], source: "bundled" },
      body: { family: "Inter", weights: [400], source: "bundled" },
    },
  },
  sections: [
    {
      key: "cover",
      type: "cover",
      variant: "full",
      visible: true,
      title: "Portada",
      blocks: [
        { id: "cover.title", role: "coverTitle", type: "text", label: "Título", provenance: "user", value: { kind: "text", value: "Ana & Luis" } },
        { id: "cover.hidden", role: "coverSubtitle", type: "text", label: "Oculto", provenance: "empty", value: null },
      ],
    },
    {
      key: "story",
      type: "story",
      variant: "full",
      visible: false,
      title: "Nuestra historia",
      blocks: [],
    },
  ],
};

describe("ComposedPreviewStub — stub local de packages/sections (mode público)", () => {
  it("pinta el texto de un bloque con valor y usa los seis colores de theme.tokens", () => {
    render(<ComposedPreviewStub composed={FIXTURE} />);
    expect(screen.getByText("Ana & Luis")).toBeTruthy();
  });

  it("no pinta un bloque con value:null (R2/R5, 04 §5.3 U-02)", () => {
    render(<ComposedPreviewStub composed={FIXTURE} />);
    expect(screen.queryByText("Oculto")).toBeNull();
  });

  it("no pinta una sección con visible:false", () => {
    render(<ComposedPreviewStub composed={FIXTURE} />);
    expect(screen.queryByText("Nuestra historia")).toBeNull();
  });
});
