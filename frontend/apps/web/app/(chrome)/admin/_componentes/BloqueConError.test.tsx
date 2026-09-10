// BloqueConError.test.tsx — el error POR BLOQUE de la consola: título, cuerpo, UNA sola acción.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BloqueConError } from "./BloqueConError.tsx";

describe("BloqueConError", () => {
  it("enseña título y cuerpo, y UNA sola acción (nunca dos primarias)", () => {
    render(
      <BloqueConError
        titulo="No pudimos cargar los pagos"
        cuerpo="Vuelve a intentarlo en unos segundos."
        etiquetaReintentar="Reintentar"
        onReintentar={vi.fn()}
      />,
    );
    expect(screen.getByText("No pudimos cargar los pagos")).toBeTruthy();
    expect(screen.getByText("Vuelve a intentarlo en unos segundos.")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("se anuncia como alert", () => {
    render(<BloqueConError titulo="t" cuerpo="c" etiquetaReintentar="Reintentar" onReintentar={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("llama a onReintentar al pulsar el botón, y no ejecuta nada por sí mismo", async () => {
    const usuario = userEvent.setup();
    const onReintentar = vi.fn();
    render(<BloqueConError titulo="t" cuerpo="c" etiquetaReintentar="Reintentar" onReintentar={onReintentar} />);
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onReintentar).toHaveBeenCalledTimes(1);
  });

  it("reintentando: el botón queda ocupado (aria-busy) con su propio texto", () => {
    render(
      <BloqueConError
        titulo="t"
        cuerpo="c"
        etiquetaReintentar="Reintentar"
        etiquetaReintentando="Reintentando…"
        reintentando
        onReintentar={vi.fn()}
      />,
    );
    const boton = screen.getByRole("button", { name: "Reintentando…" });
    expect(boton.getAttribute("aria-busy")).toBe("true");
  });
});
