// PanelInvitaciones.test.tsx — la pestaña «Invitaciones»: listo, vacío, error, sesión, y la acción
// de alternar estado (deshabilitar con confirmación, y que un fallo del alternado no se confunde con
// un fallo de la tabla).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { InvitacionAdmin, PaginaInvitaciones } from "@/lib/admin/tipos";

const listarInvitaciones = vi.fn();
const alternarEstadoInvitacion = vi.fn();
const listarPlanes = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  listarInvitaciones: (...args: never[]) => listarInvitaciones(...args),
  alternarEstadoInvitacion: (...args: never[]) => alternarEstadoInvitacion(...args),
  listarPlanes: (...args: never[]) => listarPlanes(...args),
}));

const { SessionError } = await import("@/lib/errors");
const { PanelInvitaciones } = await import("./PanelInvitaciones.tsx");

const PUBLICADA: InvitacionAdmin = {
  id: 1,
  evento: "Boda Ana y Luis",
  fecha: "2026-11-14",
  hora: "18:00",
  clientaId: 10,
  clienta: "Ana Torres",
  plan: "Fiesta",
  pagada: true,
  importe: 1490,
  estado: "publicada",
  enlacePublico: "pub_abc123",
  usaTemplates2: true,
  creadaEn: "2026-01-01T10:00:00Z",
};
const DESHABILITADA: InvitacionAdmin = {
  ...PUBLICADA,
  id: 2,
  evento: "XV de Sofía",
  plan: null,
  pagada: false,
  estado: "deshabilitada",
  enlacePublico: null,
};

function pagina(elementos: InvitacionAdmin[]): PaginaInvitaciones {
  return { total: elementos.length, pagina: 0, tamano: 20, elementos };
}

beforeEach(() => {
  listarInvitaciones.mockReset();
  alternarEstadoInvitacion.mockReset();
  listarPlanes.mockReset();
  listarPlanes.mockResolvedValue({ elementos: [] });
});

describe("PanelInvitaciones", () => {
  it("listo: evento, clienta, y '—' para el plan ausente (nunca vacío ni 'null')", async () => {
    listarInvitaciones.mockResolvedValue(pagina([PUBLICADA, DESHABILITADA]));
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    expect((await screen.findAllByText("Boda Ana y Luis")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("vacío: el texto propio de Invitaciones", async () => {
    listarInvitaciones.mockResolvedValue(pagina([]));
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.invitaciones.vacio.sinFiltro)).toBeTruthy();
  });

  it("error: pinta BloqueConError y reintenta", async () => {
    const usuario = userEvent.setup();
    listarInvitaciones.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(pagina([]));
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.invitaciones.error.titulo)).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: textosAdmin.invitaciones.error.accion }));
    await waitFor(() => expect(listarInvitaciones).toHaveBeenCalledTimes(2));
  });

  it("SessionError de la tabla delega a onSesionInvalida", async () => {
    const onSesionInvalida = vi.fn();
    listarInvitaciones.mockRejectedValue(new SessionError(403, ""));
    render(<PanelInvitaciones onSesionInvalida={onSesionInvalida} />);
    await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(403));
  });

  it("deshabilitar: pide confirmación, y al confirmar alterna y vuelve a pedir la lista", async () => {
    const usuario = userEvent.setup();
    listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
    alternarEstadoInvitacion.mockResolvedValue({ status: "success", message: "ok", invitation: {} as never });
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    await screen.findAllByText("Boda Ana y Luis");

    await usuario.click(screen.getAllByTestId("accion-fila-escritorio")[0]!);
    expect(await screen.findByText(textosAdmin.invitaciones.confirmacionDeshabilitar.titulo)).toBeTruthy();

    await usuario.click(await screen.findByTestId("accion-fila-confirmar"));

    await waitFor(() => expect(alternarEstadoInvitacion).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listarInvitaciones).toHaveBeenCalledTimes(2));
  });

  it("el fallo de alternar NO se confunde con el fallo de la tabla: aparece su propio aviso", async () => {
    const usuario = userEvent.setup();
    listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
    alternarEstadoInvitacion.mockRejectedValue(new Error("500 boom"));
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    await screen.findAllByText("Boda Ana y Luis");

    await usuario.click(screen.getAllByTestId("accion-fila-escritorio")[0]!);
    await usuario.click(await screen.findByTestId("accion-fila-confirmar"));

    expect(await screen.findByText(textosAdmin.invitaciones.alternarError.titulo)).toBeTruthy();
    // La tabla sigue enseñando su fila: el error de alternar no tumbó el bloque de la tabla.
    expect(screen.getAllByText("Boda Ana y Luis").length).toBeGreaterThan(0);
  });

  it("una invitación deshabilitada ofrece 'Habilitar', no la acción destructiva", async () => {
    listarInvitaciones.mockResolvedValue(pagina([DESHABILITADA]));
    render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
    expect((await screen.findAllByText(textosAdmin.invitaciones.acciones.habilitar)).length).toBeGreaterThan(0);
    expect(screen.queryByText(textosAdmin.invitaciones.acciones.deshabilitar)).toBeNull();
  });
});
