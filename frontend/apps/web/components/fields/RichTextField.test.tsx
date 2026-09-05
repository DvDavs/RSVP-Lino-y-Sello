import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RichTextSpec } from "@/lib/block-types.ts";
import { RichTextField } from "./RichTextField.tsx";

function espec(): RichTextSpec {
  return {
    id: "storyBody",
    role: "storyBody",
    label: { "es-MX": "Nuestra historia" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "richText",
    constraints: { maxLength: 8000 },
  };
}

describe("RichTextField — editor propio mínimo (negrita, cursiva, enlace)", () => {
  it("convierte **negrita**/_cursiva_/[enlace](url) a RichDoc al escribir", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<RichTextField id="c-historia" spec={espec()} value={{ type: "doc", content: [] }} onCommit={onCommit} />);

    const area = screen.getByRole("textbox");
    await usuario.type(area, "Nos conocimos en **la universidad**.");

    expect(onCommit).toHaveBeenCalled();
    const ultimo = onCommit.mock.calls.at(-1)?.[0];
    expect(ultimo.kind).toBe("richText");
    const spans = ultimo.doc.content[0].content;
    expect(spans.some((s: { marks?: string[] }) => s.marks?.includes("bold"))).toBe(true);
  });

  it("el botón Negrita envuelve la selección con **…**", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <RichTextField
        id="c-historia"
        spec={espec()}
        value={{ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hola mundo" }] }] }}
        onCommit={onCommit}
      />,
    );
    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    area.setSelectionRange(0, 4); // "hola"
    await usuario.click(screen.getByRole("button", { name: "Negrita" }));
    expect(area.value).toContain("**hola**");
  });

  it("impide guardar por encima de maxLength y anuncia el error", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    const spec = { ...espec(), constraints: { maxLength: 5 } };
    render(<RichTextField id="c-historia" spec={spec} value={{ type: "doc", content: [] }} onCommit={onCommit} />);
    await usuario.type(screen.getByRole("textbox"), "más de cinco caracteres");
    expect(await screen.findByRole("alert")).toBeTruthy();
    for (const llamada of onCommit.mock.calls) {
      expect(llamada[0].doc.content[0]?.content[0]?.text.length ?? 0).toBeLessThanOrEqual(5);
    }
  });
});
