import { useState } from "react";
import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog.tsx";

expect.extend(toHaveNoViolations);

function DialogControlado(props: Partial<ComponentProps<typeof Dialog>> = {}) {
  const [open, setOpen] = useState(false);
  return (
    // El disparador va por la prop `trigger` (no un botón suelto aparte): Radix solo devuelve el
    // foco a `context.triggerRef` — el nodo del `Dialog.Trigger` real — nunca a "lo último que tenía
    // el foco" cuando el diálogo abre por control externo sin pasar por su propio disparador.
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={<button type="button">Abrir</button>}
      title="Publicar invitación"
      description="Falta el nombre del lugar de la ceremonia."
      footer={
        <>
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button type="button">Publicar</button>
        </>
      }
      {...props}
    >
      <p>Cuerpo del diálogo</p>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("es role=dialog, aria-modal, con nombre y descripción accesibles", async () => {
    const usuario = userEvent.setup();
    render(<DialogControlado />);
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleName("Publicar invitación");
    expect(dialogo).toHaveAccessibleDescription("Falta el nombre del lugar de la ceremonia.");
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("atrapa el foco dentro del diálogo y lo devuelve al disparador al cerrar", async () => {
    const usuario = userEvent.setup();
    render(<DialogControlado />);
    const disparador = screen.getByRole("button", { name: "Abrir" });
    await usuario.click(disparador);

    // El primer elemento enfocable dentro recibe el foco automático de Radix.
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Radix devuelve el foco desde un `setTimeout(0)` en el `cleanup` de `FocusScope`: hace falta
    // dejar pasar un macrotask real, no solo un `await` de microtareas.
    await waitFor(() => {
      expect(disparador).toHaveFocus();
    });
  });

  it("con `busy`, Esc no cierra y el botón de cerrar queda deshabilitado", async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(
      <Dialog
        open
        onOpenChange={alCambiar}
        busy
        title="Publicando"
        description="Estamos publicando tu invitación."
      >
        <p aria-live="polite">Publicando…</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();

    await usuario.keyboard("{Escape}");
    expect(alCambiar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("descriptionHidden mantiene aria-describedby sin mostrar el texto", async () => {
    render(
      <Dialog
        open
        title="Confirmar"
        description="Vas a despublicar tu invitación."
        descriptionHidden
      >
        <p>Cuerpo visible</p>
      </Dialog>,
    );
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAccessibleDescription("Vas a despublicar tu invitación.");
    const descripcion = screen.getByText("Vas a despublicar tu invitación.");
    expect(descripcion).toHaveStyle({ position: "absolute" });
  });
});
