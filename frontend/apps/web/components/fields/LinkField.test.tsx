import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LinkSpec } from "@/lib/block-types.ts";
import { LinkField } from "./LinkField.tsx";

function espec(): LinkSpec {
  return {
    id: "hashtagLink",
    role: "hashtagLink",
    label: { "es-MX": "Enlace" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "link",
  };
}

describe("LinkField", () => {
  it("no guarda una URL sin http(s):// y anuncia el error", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<LinkField id="c-enlace" spec={espec()} value={{ href: "" }} onCommit={onCommit} />);
    await usuario.type(screen.getByPlaceholderText("https://…"), "notaurl");
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("guarda href + label cuando ambos son válidos", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<LinkField id="c-enlace" spec={espec()} value={{ href: "" }} onCommit={onCommit} />);
    await usuario.type(screen.getByPlaceholderText("https://…"), "https://ejemplo.mx");
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith({ kind: "link", href: "https://ejemplo.mx" }));
  });
});
