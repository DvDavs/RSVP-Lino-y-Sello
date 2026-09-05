import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PersonSpec } from "@/lib/block-types.ts";
import { PersonField } from "./PersonField.tsx";

function espec(): PersonSpec {
  return {
    id: "godparentA",
    role: "godparentA",
    label: { "es-MX": "Padrino" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "person",
  };
}

describe("PersonField", () => {
  it("guarda nombre y nota opcional", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<PersonField id="c-padrino" spec={espec()} value={{ name: "" }} onCommit={onCommit} />);
    await usuario.type(screen.getByPlaceholderText("Nombre"), "Juan Pérez");
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ kind: "person", name: "Juan Pérez" }));
  });
});
