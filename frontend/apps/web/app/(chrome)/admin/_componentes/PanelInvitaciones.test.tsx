// PanelInvitaciones.test.tsx — la pestaña «Invitaciones»: listo, vacío, error, sesión, y la acción
// de alternar estado (deshabilitar con confirmación, y que un fallo del alternado no se confunde con
// un fallo de la tabla).
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { InvitacionAdmin, PaginaInvitaciones, PlanAdmin } from "@/lib/admin/tipos";

// `apps/web/test/setup.ts` (compartido, ajeno) no trae el polyfill de `scrollIntoView` que sí trae
// `packages/ui/test/setup.ts`: Radix `Select` lo llama al abrir un panel con más de una opción, y
// jsdom no lo implementa. Se polyfilla aquí, local a este fichero, en vez de tocar el `setup.ts`
// compartido — mismo arreglo, alcance mínimo.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

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

  // Arreglo de seguimiento: el filtro «Plan» viaja al SERVIDOR como `plan=<id>` — nunca se recorta
  // en el navegador. Esta prueba cae si alguien vuelve al filtrado en cliente: se planta una fila
  // devuelta por el "servidor" con un plan DISTINTO del elegido (algo que el backend real nunca
  // haría, pero que probaría que el componente ya no desconfía de la respuesta y la recorta él
  // mismo) y se comprueba que la fila sigue apareciendo tal cual la mandó el mock.
  describe("filtro «Plan» — arreglo de seguimiento (viaja el id al servidor, contrato ya lo soporta)", () => {
    const PLANES: PlanAdmin[] = [
      { id: 1, nombre: "Básico", invitaciones: 5 },
      { id: 2, nombre: "Premium", invitaciones: 12 },
    ];

    it("elegir un plan hace una petición NUEVA con plan=<id> (el id, no el nombre) y reinicia la página", async () => {
      const usuario = userEvent.setup();
      listarPlanes.mockResolvedValue({ elementos: PLANES });
      listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
      render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
      await screen.findAllByText("Boda Ana y Luis");
      listarInvitaciones.mockClear();

      const disparador = await screen.findByRole("combobox", { name: textosAdmin.invitaciones.filtros.plan });
      disparador.focus();
      await usuario.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await usuario.click(within(listbox).getByRole("option", { name: "Premium" }));

      await waitFor(() => expect(listarInvitaciones).toHaveBeenCalled());
      const consulta = listarInvitaciones.mock.calls.at(-1)?.[0];
      expect(consulta.plan).toBe(2);
      expect(consulta.pagina).toBe(0);
    });

    it("el resultado del servidor se pinta tal cual: NINGÚN recorte en el cliente", async () => {
      const usuario = userEvent.setup();
      listarPlanes.mockResolvedValue({ elementos: PLANES });
      // El "servidor" devuelve una fila cuyo texto de plan no coincide con la etiqueta elegida — si
      // el componente todavía filtrara en cliente por nombre, la escondería.
      listarInvitaciones.mockResolvedValue(pagina([{ ...PUBLICADA, plan: "Otro plan cualquiera" }]));
      render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
      await screen.findAllByText("Boda Ana y Luis");

      const disparador = await screen.findByRole("combobox", { name: textosAdmin.invitaciones.filtros.plan });
      disparador.focus();
      await usuario.keyboard("{Enter}");
      const listbox = await screen.findByRole("listbox");
      await usuario.click(within(listbox).getByRole("option", { name: "Premium" }));

      // Sigue en pantalla: la respuesta del servidor manda, el cliente no vuelve a decidir.
      expect((await screen.findAllByText("Boda Ana y Luis")).length).toBeGreaterThan(0);
    });
  });

  // Arreglo de seguimiento (hallazgo MEDIA-1): 401 vs 403 de `alternarEstadoInvitacion` NO se
  // tratan igual — un 403 de jerarquía no es sesión caducada.
  describe("alternar: 401 caduca la sesión, 403 de jerarquía NO", () => {
    it("401: escala a onSesionInvalida(401), sin pintar 'esta invitación no es tuya'", async () => {
      const usuario = userEvent.setup();
      const onSesionInvalida = vi.fn();
      listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
      alternarEstadoInvitacion.mockRejectedValue(new SessionError(401, ""));
      render(<PanelInvitaciones onSesionInvalida={onSesionInvalida} />);
      await screen.findAllByText("Boda Ana y Luis");

      await usuario.click(screen.getAllByTestId("accion-fila-escritorio")[0]!);
      await usuario.click(await screen.findByTestId("accion-fila-confirmar"));

      await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(401));
      expect(screen.queryByText(textosAdmin.invitaciones.alternarProhibido.titulo)).toBeNull();
    });

    it("403 de jerarquía: NO escala a onSesionInvalida, pinta 'esta invitación no es tuya' y la fila sigue en la consola", async () => {
      const usuario = userEvent.setup();
      const onSesionInvalida = vi.fn();
      listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
      alternarEstadoInvitacion.mockRejectedValue(new SessionError(403, ""));
      render(<PanelInvitaciones onSesionInvalida={onSesionInvalida} />);
      await screen.findAllByText("Boda Ana y Luis");

      await usuario.click(screen.getAllByTestId("accion-fila-escritorio")[0]!);
      await usuario.click(await screen.findByTestId("accion-fila-confirmar"));

      expect(await screen.findByText(textosAdmin.invitaciones.alternarProhibido.titulo)).toBeTruthy();
      expect(onSesionInvalida).not.toHaveBeenCalled();
      // La fila sigue en la consola: un 403 puntual no la saca de la tabla.
      expect(screen.getAllByText("Boda Ana y Luis").length).toBeGreaterThan(0);
    });

    it("el aviso de 'no es tuya' se descarta con 'Entendido', sin volver a llamar a alternarEstadoInvitacion", async () => {
      const usuario = userEvent.setup();
      listarInvitaciones.mockResolvedValue(pagina([PUBLICADA]));
      alternarEstadoInvitacion.mockRejectedValue(new SessionError(403, ""));
      render(<PanelInvitaciones onSesionInvalida={vi.fn()} />);
      await screen.findAllByText("Boda Ana y Luis");

      await usuario.click(screen.getAllByTestId("accion-fila-escritorio")[0]!);
      await usuario.click(await screen.findByTestId("accion-fila-confirmar"));
      await screen.findByText(textosAdmin.invitaciones.alternarProhibido.titulo);

      await usuario.click(screen.getByRole("button", { name: textosAdmin.comun.entendido }));
      expect(screen.queryByText(textosAdmin.invitaciones.alternarProhibido.titulo)).toBeNull();
      expect(alternarEstadoInvitacion).toHaveBeenCalledTimes(1);
    });
  });
});
