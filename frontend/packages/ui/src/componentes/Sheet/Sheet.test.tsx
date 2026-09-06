import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet.tsx";

expect.extend(toHaveNoViolations);

function SheetControlada() {
  const [open, setOpen] = useState(false);
  return (
    // Disparador por `trigger` (ver el comentario equivalente en `Dialog.test.tsx`): Radix devuelve
    // el foco al nodo de `Sheet.Trigger`, no a "lo último enfocado" si se abre por control externo.
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button">Elegir plantilla</button>}
      title="Elige el punto de partida"
      description="Te mostramos solo las plantillas que le van a tu evento."
      footer={
        <button type="button" onClick={() => setOpen(false)}>
          Confirmar
        </button>
      }
    >
      <p>Lista de plantillas</p>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("es role=dialog con nombre y descripción accesibles, y asa decorativa", async () => {
    const usuario = userEvent.setup();
    render(<SheetControlada />);
    await usuario.click(screen.getByRole("button", { name: "Elegir plantilla" }));

    const hoja = screen.getByRole("dialog");
    expect(hoja).toHaveAccessibleName("Elige el punto de partida");
    expect(hoja).toHaveAccessibleDescription("Te mostramos solo las plantillas que le van a tu evento.");
    // La asa es puramente decorativa: no debe anunciarse.
    const asa = hoja.querySelector('[aria-hidden="true"]');
    expect(asa).not.toBeNull();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("atrapa el foco y lo devuelve al disparador al cerrar con Esc", async () => {
    const usuario = userEvent.setup();
    render(<SheetControlada />);
    const disparador = screen.getByRole("button", { name: "Elegir plantilla" });
    await usuario.click(disparador);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Ver el comentario equivalente en `Dialog.test.tsx`: el retorno de foco de Radix pasa por un
    // `setTimeout(0)` real.
    await waitFor(() => {
      expect(disparador).toHaveFocus();
    });
  });

  it("con `busy`, Esc no cierra", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(
      <Sheet open onOpenChange={alCambiar} busy title="Guardando" description="Estamos guardando tus cambios.">
        <p>Cuerpo</p>
      </Sheet>,
    );
    await usuario.keyboard("{Escape}");
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("el botón del footer queda dentro del diálogo (pegado abajo)", async () => {
    const usuario = userEvent.setup();
    render(<SheetControlada />);
    await usuario.click(screen.getByRole("button", { name: "Elegir plantilla" }));
    expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("button", { name: "Confirmar" }));
  });
});
