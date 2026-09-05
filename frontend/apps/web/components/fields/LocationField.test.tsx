import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LocationSpec } from "@/lib/block-types.ts";
import { LocationField } from "./LocationField.tsx";

function espec(): LocationSpec {
  return {
    id: "eventPlace",
    role: "eventPlace",
    label: { "es-MX": "Lugar" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "location",
  };
}

describe("LocationField", () => {
  it("no guarda sin nombre, y anuncia el error", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<LocationField id="c-lugar" spec={espec()} value={{ name: "Salón Jardín" }} onCommit={onCommit} />);
    const nombre = screen.getByPlaceholderText("Nombre del lugar");
    await usuario.clear(nombre);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("guarda nombre + dirección", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<LocationField id="c-lugar" spec={espec()} value={{ name: "" }} onCommit={onCommit} />);
    await usuario.type(screen.getByPlaceholderText("Nombre del lugar"), "Salón Jardín");
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ kind: "location", name: "Salón Jardín" }));
  });
});
