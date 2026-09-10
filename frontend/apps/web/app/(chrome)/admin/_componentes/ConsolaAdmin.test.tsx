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

describe("ConsolaAdmin — pestañas: montadas las cinco, visible SOLO una (compuerta del defecto 1)", () => {
  // Esta es la prueba que faltaba. `forceMount` mantiene las cinco `TabsContent` montadas (y por eso
  // las cinco piden su dato en paralelo desde el primer render), pero Radix calcula
  // `hidden = !(forceMount || isSelected)`: con `forceMount` eso es SIEMPRE `false`, así que ningún
  // panel inactivo recibía `hidden` y los cinco se pintaban apilados a la vez, en los tres anchos
  // (`bitacora/5-E5-I.md §1`, capturas `admin-bug-pestanas-apiladas-*`). Ni las pruebas de unidad ni
  // los e2e caían: todas acotaban sus aserciones al panel que les interesaba (por nombre accesible o
  // por `section[aria-labelledby]`), y ninguna afirmaba «solo uno visible».
  //
  // En jsdom esto SÍ se puede afirmar, y sale barato, porque el arreglo pone un ATRIBUTO (`hidden`)
  // y no una clase de CSS: `*ByRole` de Testing Library excluye por defecto lo que no está en el
  // árbol de accesibilidad (`hidden`, `aria-hidden`, `display:none`), así que «cuántos tabpanel hay»
  // y «cuántos se ven» son dos cuentas distintas y comparables.
  async function consolaLista() {
    getAuthToken.mockReturnValue("jwt-master");
    obtenerMetricas.mockResolvedValue({ clientas: 0, invitaciones: 0, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 });
    listarClientas.mockResolvedValue(PAGINA_VACIA);
    listarInvitaciones.mockResolvedValue(PAGINA_VACIA);
    listarPagos.mockResolvedValue({ ...PAGINA_VACIA, origen: "invitaciones" });
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] });
    render(<ConsolaAdmin />);
    await screen.findByRole("tab", { name: textosAdmin.pestanas.resumen });
  }

  const NOMBRES = [
    textosAdmin.pestanas.resumen,
    textosAdmin.pestanas.clientas,
    textosAdmin.pestanas.invitaciones,
    textosAdmin.pestanas.pagos,
    textosAdmin.pestanas.plantillas,
  ];

  it("de entrada: los cinco paneles están en el documento, pero solo «Resumen» se ve", async () => {
    await consolaLista();

    // Montados los cinco (la mitad que `forceMount` sí daba y que hay que conservar).
    expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(5);

    // Visible exactamente uno, y es el de la pestaña activa.
    // `apps/web` no carga `jest-dom`: aquí se afirma con el propio DOM y con el filtro de
    // accesibilidad que `*ByRole` ya trae de serie.
    const visibles = screen.getAllByRole("tabpanel");
    expect(visibles).toHaveLength(1);
    expect(visibles[0]).toBe(screen.getByRole("tabpanel", { name: textosAdmin.pestanas.resumen }));

    // Y los otros cuatro llevan `hidden` de verdad: fuera del árbol accesible y del tabulador — no
    // un `opacity-0` ni un `visibility` a medias, que dejarían el panel alcanzable con el teclado.
    const ocultos = [...document.querySelectorAll<HTMLElement>('[role="tabpanel"]')].filter(
      (panel) => panel !== visibles[0],
    );
    expect(ocultos).toHaveLength(4);
    for (const panel of ocultos) {
      expect(panel.hidden).toBe(true);
      expect(panel.hasAttribute("hidden")).toBe(true);
    }
  });

  it.each(NOMBRES)("al abrir «%s» sigue habiendo UN solo panel visible, y es el suyo", async (nombre) => {
    const usuario = userEvent.setup();
    await consolaLista();

    await usuario.click(screen.getByRole("tab", { name: nombre }));

    const visibles = screen.getAllByRole("tabpanel");
    expect(visibles).toHaveLength(1);
    expect(visibles[0]).toBe(screen.getByRole("tabpanel", { name: nombre }));
    expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(5);
  });

  it("cambiar de pestaña NO vuelve a pedir el dato: el panel que se deja atrás sigue montado", async () => {
    const usuario = userEvent.setup();
    await consolaLista();
    await waitFor(() => expect(listarClientas).toHaveBeenCalled());
    const peticionesIniciales = listarClientas.mock.calls.length;

    await usuario.click(screen.getByRole("tab", { name: textosAdmin.pestanas.clientas }));
    await usuario.click(screen.getByRole("tab", { name: textosAdmin.pestanas.resumen }));
    await usuario.click(screen.getByRole("tab", { name: textosAdmin.pestanas.clientas }));

    // La otra mitad de la propiedad: ocultar no es desmontar. Si alguien "arreglara" el defecto 1
    // quitando `forceMount`, cada ida y vuelta volvería a montar el panel y a pedir la lista.
    expect(listarClientas.mock.calls.length).toBe(peticionesIniciales);
  });

  it("los cinco bloques piden su dato desde el primer render, sin abrir ninguna pestaña", async () => {
    await consolaLista();
    await waitFor(() => {
      expect(obtenerMetricas).toHaveBeenCalled();
      expect(listarClientas).toHaveBeenCalled();
      expect(listarInvitaciones).toHaveBeenCalled();
      expect(listarPagos).toHaveBeenCalled();
      expect(listarPlantillas).toHaveBeenCalled();
    });
  });
});
