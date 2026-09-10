// PanelPagos.test.tsx — la pestaña «Pagos»: listo (con la nota de origen), vacío, error, sesión.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { PaginaPagos } from "@/lib/admin/tipos";

const listarPagos = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  listarPagos: (...args: never[]) => listarPagos(...args),
}));

const { SessionError } = await import("@/lib/errors");
const { PanelPagos } = await import("./PanelPagos.tsx");

const PAGINA: PaginaPagos = {
  total: 1,
  pagina: 0,
  tamano: 20,
  origen: "invitaciones",
  elementos: [
    { id: "inv-7", invitacionId: 7, clientaId: 1, clienta: "Ana Torres", plan: "Fiesta", importe: 1490, moneda: "MXN", estado: "pagado", fecha: "2026-03-02T10:00:00Z" },
  ],
};
const PAGINA_VACIA: PaginaPagos = { total: 0, pagina: 0, tamano: 20, origen: "invitaciones", elementos: [] };

beforeEach(() => {
  listarPagos.mockReset();
});

describe("PanelPagos", () => {
  it("listo: pinta clienta, importe formateado y la nota de origen (contrato §5)", async () => {
    listarPagos.mockResolvedValue(PAGINA);
    render(<PanelPagos onSesionInvalida={vi.fn()} />);
    expect(await screen.findAllByText("Ana Torres")).toBeTruthy();
    expect(screen.getByText(textosAdmin.pagos.fuenteDatos)).toBeTruthy();
  });

  it("vacío: el texto propio de Pagos", async () => {
    listarPagos.mockResolvedValue(PAGINA_VACIA);
    render(<PanelPagos onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.pagos.vacio.sinFiltro)).toBeTruthy();
  });

  it("error: pinta BloqueConError y reintenta", async () => {
    const usuario = userEvent.setup();
    listarPagos.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(PAGINA);
    render(<PanelPagos onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.pagos.error.titulo)).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: textosAdmin.pagos.error.accion }));
    await waitFor(() => expect(listarPagos).toHaveBeenCalledTimes(2));
  });

  it("SessionError delega a onSesionInvalida", async () => {
    const onSesionInvalida = vi.fn();
    listarPagos.mockRejectedValue(new SessionError(403, ""));
    render(<PanelPagos onSesionInvalida={onSesionInvalida} />);
    await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(403));
  });
});
