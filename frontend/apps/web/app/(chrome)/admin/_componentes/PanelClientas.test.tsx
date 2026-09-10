// PanelClientas.test.tsx — la pestaña «Clientas»: listo, vacío (con y sin filtro), error, y que el
// buscador manda `buscar` tras el retardo.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { PaginaClientas } from "@/lib/admin/tipos";

const listarClientas = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  listarClientas: (...args: never[]) => listarClientas(...args),
}));

const { SessionError } = await import("@/lib/errors");
const { PanelClientas } = await import("./PanelClientas.tsx");

const PAGINA: PaginaClientas = {
  total: 2,
  pagina: 0,
  tamano: 20,
  elementos: [
    { id: 1, nombre: "Ana Torres", correo: "ana@ejemplo.mx", rol: "USER", habilitada: true, invitaciones: 2, altaEn: "2026-03-02T10:00:00Z" },
    { id: 2, nombre: "M. Cruz", correo: "cruz@ejemplo.mx", rol: "ADMIN", habilitada: false, invitaciones: 0, altaEn: "2026-02-01T10:00:00Z" },
  ],
};
const PAGINA_VACIA: PaginaClientas = { total: 0, pagina: 0, tamano: 20, elementos: [] };

beforeEach(() => {
  listarClientas.mockReset();
});

describe("PanelClientas", () => {
  it("listo: pinta nombre, rol y estado habilitada/deshabilitada de cada fila", async () => {
    listarClientas.mockResolvedValue(PAGINA);
    render(<PanelClientas onSesionInvalida={vi.fn()} />);
    expect((await screen.findAllByText("Ana Torres")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(textosAdmin.clientas.roles.ADMIN).length).toBeGreaterThan(0);
    expect(screen.getAllByText(textosAdmin.clientas.deshabilitada).length).toBeGreaterThan(0);
  });

  it("vacío sin filtro: el texto propio de esta tabla, no el de otra", async () => {
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    render(<PanelClientas onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.clientas.vacio.sinFiltro)).toBeTruthy();
  });

  it("buscar: tras el retardo, manda `buscar` y pinta el vacío CON filtro (no el de sin filtro)", async () => {
    const usuario = userEvent.setup();
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    render(<PanelClientas onSesionInvalida={vi.fn()} />);
    await screen.findByText(textosAdmin.clientas.vacio.sinFiltro);
    await usuario.type(screen.getByLabelText(textosAdmin.clientas.filtros.buscar), "zzz");
    await waitFor(() => {
      const ultimaLlamada = listarClientas.mock.calls.at(-1)?.[0];
      expect(ultimaLlamada?.buscar).toBe("zzz");
    });
    expect(await screen.findByText(textosAdmin.clientas.vacio.conFiltro)).toBeTruthy();
  });

  it("error: pinta BloqueConError con el texto de Clientas y reintenta", async () => {
    const usuario = userEvent.setup();
    listarClientas.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(PAGINA);
    render(<PanelClientas onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.clientas.error.titulo)).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: textosAdmin.clientas.error.accion }));
    await waitFor(() => expect(listarClientas).toHaveBeenCalledTimes(2));
  });

  it("SessionError delega a onSesionInvalida y no pinta el bloque de error", async () => {
    const onSesionInvalida = vi.fn();
    listarClientas.mockRejectedValue(new SessionError(401, ""));
    render(<PanelClientas onSesionInvalida={onSesionInvalida} />);
    await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(401));
    expect(screen.queryByText(textosAdmin.clientas.error.titulo)).toBeNull();
  });
});
