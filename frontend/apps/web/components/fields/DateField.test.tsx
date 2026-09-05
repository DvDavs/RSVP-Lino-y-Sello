import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DateSpec } from "@/lib/block-types.ts";
import { DateField } from "./DateField.tsx";

function espec(): DateSpec {
  return {
    id: "eventDate",
    role: "eventDate",
    label: { "es-MX": "Fecha" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "date",
    formatId: "long",
  };
}

describe("DateField", () => {
  it("guarda el valor con formato IsoDate del input nativo", () => {
    const onCommit = vi.fn();
    render(<DateField id="c-fecha" spec={espec()} value="" onCommit={onCommit} />);
    const input = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-12-12" } });
    expect(onCommit).toHaveBeenCalledWith({ kind: "date", value: "2026-12-12" });
  });
});
