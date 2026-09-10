// ConsolaAdmin.test.tsx — el armazón: puerta de sesión (401 → `/acceso`, 403 → estado honesto de
// página entera) y, sobre todo, la propiedad que más fácil se rompe: el error de UN bloque no tumba
// los demás (con `forceMount`, las cinco pestañas están montadas desde el primer render).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";

const push = vi.fn();
const replace = vi.fn();
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const getAuthToken = vi.fn();
const clearAuthToken = vi.fn();
vi.mock("@/lib/api-client", () => ({
  getAuthToken: () => getAuthToken(),
  clearAuthToken: () => clearAuthToken(),
}));

const obtenerMetricas = vi.fn();
const listarClientas = vi.fn();
const listarInvitaciones = vi.fn();
const listarPagos = vi.fn();
const listarPlantillas = vi.fn();
const listarPlanes = vi.fn();
const alternarEstadoInvitacion = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  obtenerMetricas: (...a: never[]) => obtenerMetricas(...a),
  listarClientas: (...a: never[]) => listarClientas(...a),
  listarInvitaciones: (...a: never[]) => listarInvitaciones(...a),
  listarPagos: (...a: never[]) => listarPagos(...a),
  listarPlantillas: (...a: never[]) => listarPlantillas(...a),
  listarPlanes: (...a: never[]) => listarPlanes(...a),
  alternarEstadoInvitacion: (...a: never[]) => alternarEstadoInvitacion(...a),
}));

const { SessionError } = await import("@/lib/errors");
const { ConsolaAdmin } = await import("./ConsolaAdmin.tsx");

const PAGINA_VACIA = { total: 0, pagina: 0, tamano: 20, elementos: [] };

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  getAuthToken.mockReset();
  clearAuthToken.mockReset();
  obtenerMetricas.mockReset();
  listarClientas.mockReset();
  listarInvitaciones.mockReset();
  listarPagos.mockReset();
  listarPlantillas.mockReset();
  listarPlanes.mockReset();
  alternarEstadoInvitacion.mockReset();
  listarPlanes.mockResolvedValue({ elementos: [] });
});

describe("ConsolaAdmin — puerta de sesión", () => {
  it("sin token: manda a /acceso?volver=/admin sin pedir ni un dato", async () => {
    getAuthToken.mockReturnValue(null);
    render(<ConsolaAdmin />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/acceso?volver=%2Fadmin"));
    expect(obtenerMetricas).not.toHaveBeenCalled();
    expect(listarClientas).not.toHaveBeenCalled();
  });

  it("con token: pinta las cinco pestañas y el botón de cerrar sesión", async () => {
    getAuthToken.mockReturnValue("jwt-master");
    obtenerMetricas.mockResolvedValue({ clientas: 1, invitaciones: 1, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 });
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockResolvedValue({ ...PAGINA_VACIA, origen: "invitaciones" });
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });
    render(<ConsolaAdmin />);
    expect(await screen.findByRole("tab", { name: textosAdmin.pestanas.resumen })).toBeTruthy();
    expect(screen.getByRole("tab", { name: textosAdmin.pestanas.plantillas })).toBeTruthy();
    expect(screen.getByRole("button", { name: textosAdmin.pagina.cerrarSesion })).toBeTruthy();
  });

  it("cerrar sesión: limpia el token y manda a /acceso", async () => {
    const usuario = userEvent.setup();
    getAuthToken.mockReturnValue("jwt-master");
    obtenerMetricas.mockResolvedValue({ clientas: 0, invitaciones: 0, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 });
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockResolvedValue({ ...PAGINA_VACIA, origen: "invitaciones" });
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });
    render(<ConsolaAdmin />);
    await usuario.click(await screen.findByRole("button", { name: textosAdmin.pagina.cerrarSesion }));
    expect(clearAuthToken).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/acceso");
  });

  it("403 en un bloque: sustituye las CINCO pestañas por el estado honesto, con una salida real", async () => {
    getAuthToken.mockReturnValue("jwt-user");
    obtenerMetricas.mockRejectedValue(new SessionError(403, ""));
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockResolvedValue({ ...PAGINA_VACIA, origen: "invitaciones" });
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });
    render(<ConsolaAdmin />);
    expect(await screen.findByText(textosAdmin.sesion.sinPermiso.titulo)).toBeTruthy();
    expect(screen.getByRole("link", { name: textosAdmin.sesion.sinPermiso.accion }).getAttribute("href")).toBe("/editor");
    expect(screen.queryByRole("tab", { name: textosAdmin.pestanas.resumen })).toBeNull();
    // No es "no hay clientas": nunca redirige como si fuera un 401.
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("/acceso"));
  });

  it("401 en un bloque cualquiera (no solo Resumen): manda a /acceso igual que sin token", async () => {
    getAuthToken.mockReturnValue("jwt-expirado");
    obtenerMetricas.mockResolvedValue({ clientas: 0, invitaciones: 0, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 });
    listarClientas.mockRejectedValue(new SessionError(401, ""));
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockResolvedValue({ ...PAGINA_VACIA, origen: "invitaciones" });
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });
    render(<ConsolaAdmin />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/acceso?volver=%2Fadmin"));
  });
});

describe("ConsolaAdmin — el error de un bloque no tumba los demás (regla dura del wireframe)", () => {
  it("Pagos falla (error genérico, no de sesión): Clientas sigue enseñando su dato bueno", async () => {
    getAuthToken.mockReturnValue("jwt-master");
    obtenerMetricas.mockResolvedValue({ clientas: 1, invitaciones: 1, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 });
    listarClientas.mockResolvedValue({
      total: 1,
      pagina: 0,
      tamano: 20,
      elementos: [{ id: 1, nombre: "Ana Torres", correo: "ana@ejemplo.mx", rol: "USER", habilitada: true, invitaciones: 1, altaEn: "2026-03-02T10:00:00Z" }],
    });
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockRejectedValue(new Error("500 - pagos caído"));
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });

    render(<ConsolaAdmin />);

    // Pagos (montada por `forceMount` aunque la pestaña activa sea «Resumen») pinta SU error.
    expect(await screen.findByText(textosAdmin.pagos.error.titulo)).toBeTruthy();
    // Clientas, montada a la vez, sigue enseñando el dato que sí llegó — no un vacío, no un error.
    expect(screen.getAllByText("Ana Torres").length).toBeGreaterThan(0);
    expect(screen.queryByText(textosAdmin.clientas.error.titulo)).toBeNull();
    expect(screen.queryByText(textosAdmin.clientas.vacio.sinFiltro)).toBeNull();
    // La pantalla entera sigue en pie: las pestañas siguen ahí, no el estado de sin-permiso.
    expect(screen.getByRole("tab", { name: textosAdmin.pestanas.pagos })).toBeTruthy();
    expect(screen.queryByText(textosAdmin.sesion.sinPermiso.titulo)).toBeNull();
  });
});
