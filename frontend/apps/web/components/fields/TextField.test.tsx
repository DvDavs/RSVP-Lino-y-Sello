// components/fields/TextField.test.tsx — U-17 (`04 §20.1`): un `TextSpec` con `maxLength: 40` impide
// guardar con 41 caracteres y anuncia el error con `aria-describedby`.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TextSpec } from "@/lib/block-types.ts";
import { TextField } from "./TextField.tsx";

function espec(overrides: Partial<TextSpec["constraints"]> = {}): TextSpec {
  return {
    id: "coverTitle",
    role: "coverTitle",
    label: { "es-MX": "Título" },
    required: true,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "text",
    constraints: { minLength: 0, maxLength: 40, multiline: false, ...overrides },
  };
}

describe("TextField — U-17", () => {
  it("impide guardar con 41 caracteres y lo anuncia con aria-describedby", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<TextField id="campo-titulo" spec={espec()} value="" onCommit={onCommit} />);

    const input = screen.getByRole("textbox", { name: /título/i });
    await usuario.type(input, "a".repeat(41));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // Cada tecla VÁLIDA (1..40) sí se guarda de camino — es lo esperado (autoguardado incremental).
    // Lo que U-17 exige es que la 41.ª, la que rompe `maxLength`, NUNCA se envíe.
    for (const llamada of onCommit.mock.calls) {
      expect((llamada[0] as { value: string }).value.length).toBeLessThanOrEqual(40);
    }

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const idsDescritos = describedBy.split(" ");
    const idDelError = screen.getByRole("alert").id;
    expect(idsDescritos).toContain(idDelError);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("guarda con 40 caracteres (justo en el límite)", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<TextField id="campo-titulo" spec={espec()} value="" onCommit={onCommit} />);

    const input = screen.getByRole("textbox", { name: /título/i });
    await usuario.type(input, "a".repeat(40));

    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith({ kind: "text", value: "a".repeat(40) }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("muestra la insignia de contenido de ejemplo cuando el bloque sigue en demo", () => {
    render(<TextField id="campo-titulo" spec={espec()} value="Ana & Luis" esContenidoDeEjemplo onCommit={vi.fn()} />);
    expect(screen.getByText(/contenido de ejemplo/i)).toBeTruthy();
  });
});
