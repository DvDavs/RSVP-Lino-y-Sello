import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TimeSpec } from "@/lib/block-types.ts";
import { TimeField } from "./TimeField.tsx";

function espec(): TimeSpec {
  return {
    id: "eventTime",
    role: "eventTime",
    label: { "es-MX": "Hora" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "time",
    formatId: "h12",
  };
}

describe("TimeField", () => {
  it("guarda el valor en formato 24h del input nativo", () => {
    const onCommit = vi.fn();
    render(<TimeField id="c-hora" spec={espec()} value="" onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText(/hora/i), { target: { value: "18:30" } });
    expect(onCommit).toHaveBeenCalledWith({ kind: "time", value: "18:30" });
  });
});
