import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BooleanSpec } from "@/lib/block-types.ts";
import { BooleanField } from "./BooleanField.tsx";

function espec(): BooleanSpec {
  return {
    id: "backgroundMusicEnabled",
    role: "backgroundMusicEnabled",
    label: { "es-MX": "Reproducir música" },
    required: false,
    editable: true,
    source: "user",
    aiEditable: true,
    type: "boolean",
  };
}

describe("BooleanField", () => {
  it("es un switch (rol switch), no una casilla", () => {
    render(<BooleanField id="c-musica" spec={espec()} value={false} onCommit={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("alterna el valor al activarlo", async () => {
    const usuario = userEvent.setup();
    const onCommit = vi.fn();
    render(<BooleanField id="c-musica" spec={espec()} value={false} onCommit={onCommit} />);
    await usuario.click(screen.getByRole("switch"));
    expect(onCommit).toHaveBeenCalledWith({ kind: "boolean", value: true });
  });
});
