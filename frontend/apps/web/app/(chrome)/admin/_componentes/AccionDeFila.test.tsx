// AccionDeFila.test.tsx — la acción destructiva de una fila: confirmación antes de ejecutar, y la
// regla literal del wireframe: en pantalla estrecha el control está en el documento y deshabilitado
// con la razón visible, nunca ausente.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccionDeFila } from "./AccionDeFila.tsx";

function montar(onConfirmar: () => void | Promise<void> = vi.fn()) {
  render(
    <AccionDeFila
      etiqueta="Deshabilitar"
      tituloConfirmacion="¿Deshabilitar esta invitación?"
      descripcionConfirmacion="Dejará de verse en internet hasta que la vuelvas a habilitar."
      etiquetaConfirmar="Deshabilitar"
      etiquetaCancelar="Cancelar"
      etiquetaConfirmando="Deshabilitando…"
      onConfirmar={onConfirmar}
      razonAnchoInsuficiente="Necesita pantalla más ancha"
    />,
  );
}

describe("AccionDeFila", () => {
  it("pantalla estrecha: el control está en el documento y deshabilitado, con la razón visible (nunca ausente)", () => {
    montar();
    const boton = screen.getByTestId("accion-fila-movil") as HTMLButtonElement;
    expect(boton).toBeTruthy();
    expect(boton.disabled).toBe(true);
    expect(screen.getByText("Necesita pantalla más ancha")).toBeTruthy();
  });

  it("escritorio: el disparador abre el diálogo de confirmación (título y descripción accesibles)", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByTestId("accion-fila-escritorio"));
    expect(await screen.findByText("¿Deshabilitar esta invitación?")).toBeTruthy();
    expect(screen.getByText("Dejará de verse en internet hasta que la vuelvas a habilitar.")).toBeTruthy();
  });

  it("confirmar llama a onConfirmar y cierra el diálogo", async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn().mockResolvedValue(undefined);
    montar(onConfirmar);
    await usuario.click(screen.getByTestId("accion-fila-escritorio"));
    await usuario.click(await screen.findByTestId("accion-fila-confirmar"));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("¿Deshabilitar esta invitación?")).toBeNull());
  });

  it("cancelar cierra el diálogo SIN llamar a onConfirmar", async () => {
    const usuario = userEvent.setup();
    const onConfirmar = vi.fn();
    montar(onConfirmar);
    await usuario.click(screen.getByTestId("accion-fila-escritorio"));
    await usuario.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByText("¿Deshabilitar esta invitación?")).toBeNull());
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("el control de escritorio y el de móvil son la MISMA acción (mismo texto), no dos distintas", () => {
    montar();
    expect(screen.getByTestId("accion-fila-escritorio").textContent).toBe("Deshabilitar");
    expect(screen.getByTestId("accion-fila-movil").textContent).toBe("Deshabilitar");
  });
});
