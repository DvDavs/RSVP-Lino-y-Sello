import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DateTimeRangeSpec } from "@/lib/block-types.ts";
import { DateTimeRangeField } from "./DateTimeRangeField.tsx";

function espec(): DateTimeRangeSpec {
  return {
    id: "eventWhen",
    role: "eventWhen",
    label: { "es-MX": "Horario" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "dateTimeRange",
    formatId: "long-h12",
  };
}

describe("DateTimeRangeField", () => {
  it("guarda solo el inicio cuando no hay fin", () => {
    const onCommit = vi.fn();
    render(<DateTimeRangeField id="c-horario" spec={espec()} value={{ start: "" }} onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText(/empieza/i), { target: { value: "2026-12-12T18:00" } });
    expect(onCommit).toHaveBeenCalledWith({ kind: "dateTimeRange", start: "2026-12-12T18:00" });
  });

  it("no guarda si el fin es antes que el inicio, y lo anuncia", () => {
    const onCommit = vi.fn();
    render(<DateTimeRangeField id="c-horario" spec={espec()} value={{ start: "2026-12-12T20:00" }} onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText(/termina/i), { target: { value: "2026-12-12T18:00" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/no puede ser antes/i)).toBeTruthy();
  });
});
