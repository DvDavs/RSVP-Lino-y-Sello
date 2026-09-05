import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChoiceSpec } from "@/lib/block-types.ts";
import { ChoiceField } from "./ChoiceField.tsx";

function espec(opciones: number): ChoiceSpec {
  return {
    id: "hashtagPlatform",
    role: "hashtagPlatform",
    label: { "es-MX": "Plataforma" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "choice",
    options: Array.from({ length: opciones }, (_, i) => ({ id: `op-${i}`, label: { "es-MX": `Opción ${i + 1}` } })),
  };
}

describe("ChoiceField — opciones CURADAS (P7)", () => {
  it("con ≤5 opciones usa un radiogroup", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<ChoiceField id="c-plataforma" spec={espec(3)} value={null} onCommit={onCommit} />);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    await usuario.click(screen.getByRole("radio", { name: "Opción 2" }));
    expect(onCommit).toHaveBeenCalledWith({ kind: "choice", optionId: "op-1" });
  });

  it("con más de 5 opciones se degrada a <select>", () => {
    render(<ChoiceField id="c-plataforma" spec={espec(8)} value="op-0" onCommit={vi.fn()} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
