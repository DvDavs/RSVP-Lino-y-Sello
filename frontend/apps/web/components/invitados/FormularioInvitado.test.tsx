import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as invitadosApi from "@/lib/invitados/api";
import type { GuestItem } from "@/lib/invitados/api";
import { FormularioInvitado } from "./FormularioInvitado";

function item(sobrescribir: Partial<GuestItem> = {}): GuestItem {
  return {
    id: 1,
    fullName: "Rocío Delgado",
    email: "rocio@example.mx",
    phone: "9511234567",
    tableNumber: 4,
    adults: 2,
    children: 0,
    young: 0,
    adultsConfirmed: 0,
    childrenConfirmed: 0,
    youngConfirmed: 0,
    status: "PENDING",
    message: null,
    updatedAt: null,
    ...sobrescribir,
  };
}

describe("FormularioInvitado — alta", () => {
  it("los campos de niños/jóvenes solo aparecen si la invitación los permite", async () => {
    const usuario = userEvent.setup();
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: false, youngAllowed: false }}
        onGuardado={vi.fn()}
        trigger={<button type="button">abrir</button>}
      />,
    );
    await usuario.click(screen.getByText("abrir"));
    expect(await screen.findByLabelText(/Nombre completo/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Niños/i)).toBeNull();
    expect(screen.queryByLabelText(/Jóvenes/i)).toBeNull();
  });

  it("con childrenAllowed=true y youngAllowed=false, solo aparece Niños", async () => {
    const usuario = userEvent.setup();
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: true, youngAllowed: false }}
        onGuardado={vi.fn()}
        trigger={<button type="button">abrir</button>}
      />,
    );
    await usuario.click(screen.getByText("abrir"));
    expect(await screen.findByLabelText(/Niños/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Jóvenes/i)).toBeNull();
  });

  it("el nombre es obligatorio: enviar vacío muestra el error y no llama al backend", async () => {
    const usuario = userEvent.setup();
    const crear = vi.spyOn(invitadosApi, "createGuest");
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: false, youngAllowed: false }}
        onGuardado={vi.fn()}
        trigger={<button type="button">abrir</button>}
      />,
    );
    await usuario.click(screen.getByText("abrir"));
    await usuario.click(await screen.findByText("Guardar invitado"));
    expect(await screen.findByText(/Escribe el nombre del invitado/i)).toBeTruthy();
    expect(crear).not.toHaveBeenCalled();
  });

  it("un alta válida llama a createGuest y a onGuardado con el resultado", async () => {
    const usuario = userEvent.setup();
    const creado = item({ id: 9, fullName: "María Fernanda Cruz" });
    vi.spyOn(invitadosApi, "createGuest").mockResolvedValue(creado);
    const alGuardar = vi.fn();
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: true, youngAllowed: false }}
        onGuardado={alGuardar}
        trigger={<button type="button">abrir</button>}
      />,
    );
    await usuario.click(screen.getByText("abrir"));
    await usuario.type(await screen.findByLabelText(/Nombre completo/i), "María Fernanda Cruz");
    await usuario.click(screen.getByText("Guardar invitado"));
    await waitFor(() => expect(alGuardar).toHaveBeenCalledWith(creado));
    expect(invitadosApi.createGuest).toHaveBeenCalledWith(7, expect.objectContaining({ fullName: "María Fernanda Cruz" }));
  });
});

describe("FormularioInvitado — edición y borrado", () => {
  it("precarga los valores del invitado", async () => {
    const usuario = userEvent.setup();
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: false, youngAllowed: false }}
        guest={item()}
        onGuardado={vi.fn()}
        trigger={<button type="button">editar</button>}
      />,
    );
    await usuario.click(screen.getByText("editar"));
    expect((await screen.findByLabelText(/Nombre completo/i) as HTMLInputElement).value).toBe("Rocío Delgado");
  });

  it("el borrado pide confirmación y dice qué se pierde antes de eliminar", async () => {
    const usuario = userEvent.setup();
    const eliminar = vi.spyOn(invitadosApi, "deleteGuest").mockResolvedValue(undefined);
    const alEliminar = vi.fn();
    render(
      <FormularioInvitado
        invitationId={7}
        rules={{ childrenAllowed: false, youngAllowed: false }}
        guest={item()}
        onGuardado={vi.fn()}
        onEliminado={alEliminar}
        trigger={<button type="button">editar</button>}
      />,
    );
    await usuario.click(screen.getByText("editar"));
    await usuario.click(await screen.findByText("Eliminar invitado"));
    // Confirmación: dice qué se pierde, no borra directo.
    expect(await screen.findByText(/¿Eliminar a Rocío Delgado\?/i)).toBeTruthy();
    expect(screen.getByText(/Se pierde su enlace de confirmación y su respuesta/i)).toBeTruthy();
    expect(eliminar).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Eliminar invitado" }));
    await waitFor(() => expect(alEliminar).toHaveBeenCalledWith(1));
    expect(eliminar).toHaveBeenCalledWith(7, 1);
  });
});
