// U-02 (04 §20.1): "Bloque con value: null → no renderiza ningún nodo para ese bloque (R2/R5)."
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  TextBlock,
  RichTextBlock,
  ListTextBlock,
  ImageBlock,
  DateBlock,
  LinkBlock,
  GroupBlock,
} from "../../src/blocks/index.ts";
import { nullTextBlock } from "../fixtures.ts";
import { ComposedBlockSchema, ComposedGroupSchema } from "../schema-values.ts";

const ref_ = { sectionKey: "cover", blockId: "cover.subtitle" };

describe("U-02 — value:null no renderiza ningún nodo", () => {
  it("TextBlock", () => {
    const { container } = render(<TextBlock block={nullTextBlock()} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("RichTextBlock", () => {
    const block = ComposedBlockSchema.parse({
      id: "couple.groomText", role: "celebrantAText", type: "richText",
      label: "Mensaje", provenance: "empty", value: null,
    });
    const { container } = render(<RichTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("ListTextBlock", () => {
    const block = ComposedBlockSchema.parse({
      id: "family.intro", role: "familyIntro", type: "listText",
      label: "Introducción", provenance: "empty", value: null,
    });
    const { container } = render(<ListTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("ListTextBlock con items:[] (presente pero vacío) tampoco pinta nada", () => {
    const block = ComposedBlockSchema.parse({
      id: "family.intro", role: "familyIntro", type: "listText",
      label: "Introducción", provenance: "user", value: { kind: "listText", items: [] },
    });
    const { container } = render(<ListTextBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("ImageBlock", () => {
    const block = ComposedBlockSchema.parse({
      id: "cover.image", role: "coverImage", type: "image",
      label: "Foto", provenance: "empty", value: null,
    });
    const { container } = render(<ImageBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("DateBlock", () => {
    const block = ComposedBlockSchema.parse({
      id: "cover.date", role: "coverDate", type: "date",
      label: "Fecha", provenance: "empty", value: null,
    });
    const { container } = render(<DateBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("LinkBlock", () => {
    const block = ComposedBlockSchema.parse({
      id: "event.mapLink", role: "eventMapLink", type: "link",
      label: "Mapa", provenance: "empty", value: null,
    });
    const { container } = render(<LinkBlock block={block} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });

  it("GroupBlock con items: [] no renderiza ningún nodo", () => {
    const group = ComposedGroupSchema.parse({
      id: "family.godparents", role: "familyGroup", type: "group",
      label: "Padrinos", provenance: "empty", items: [],
    });
    const { container } = render(<GroupBlock group={group} mode="public" ref_={ref_} />);
    expect(container.innerHTML).toBe("");
  });
});
