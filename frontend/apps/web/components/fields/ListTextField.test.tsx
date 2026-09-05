import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ListTextSpec } from "@/lib/block-types.ts";
import { ListTextField } from "./ListTextField.tsx";

function espec(): ListTextSpec {
  return {
    id: "dressCodeRules.items",
    role: "sectionIntro",
    label: { "es-MX": "Reglas" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "listText",
    constraints: { minItems: 0, maxItems: 3, maxItemLength: 10 },
  };
}

describe("ListTextField", () => {
  it("agrega, edita y quita elementos", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<ListTextField id="c-reglas" spec={espec()} value={[]} onCommit={onCommit} />);

    await usuario.click(screen.getByRole("button", { name: /agregar/i }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: "listText", items: [""] });
  });

  it("no deja pasar del máximo de elementos", () => {
    render(<ListTextField id="c-reglas" spec={espec()} value={["a", "b", "c"]} onCommit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /agregar/i }) as HTMLButtonElement).toHaveProperty("disabled", true);
  });

  it("Subir/Bajar reordenan sin arrastre", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<ListTextField id="c-reglas" spec={espec()} value={["uno", "dos"]} onCommit={onCommit} />);
    await usuario.click(screen.getByRole("button", { name: "Mover el elemento 1 abajo" }));
    expect(onCommit).toHaveBeenLastCalledWith({ kind: "listText", items: ["dos", "uno"] });
  });
});
