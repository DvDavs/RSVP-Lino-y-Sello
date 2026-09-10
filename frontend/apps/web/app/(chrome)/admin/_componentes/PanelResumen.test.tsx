// PanelResumen.test.tsx — la pestaña «Resumen»: carga, error, listo, y que un `SessionError` se
// delega a `onSesionInvalida` en vez de pintarse como un error de bloque cualquiera.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { MetricasAdmin } from "@/lib/admin/tipos";

const obtenerMetricas = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  obtenerMetricas: (...args: never[]) => obtenerMetricas(...args),
}));

const { SessionError } = await import("@/lib/errors");
const { PanelResumen } = await import("./PanelResumen.tsx");

const METRICAS: MetricasAdmin = { clientas: 128, invitaciones: 141, publicadas: 96, pagadas: 103, rsvpUltimos7Dias: 412 };

beforeEach(() => {
  obtenerMetricas.mockReset();
});

describe("PanelResumen", () => {
  it("listo: las cinco cifras del contrato, sin ningún agregado inventado", async () => {
    obtenerMetricas.mockResolvedValue(METRICAS);
    render(<PanelResumen onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText("128")).toBeTruthy();
    expect(screen.getByText("141")).toBeTruthy();
    expect(screen.getByText("96")).toBeTruthy();
    expect(screen.getByText("103")).toBeTruthy();
    expect(screen.getByText("412")).toBeTruthy();
  });

  it("cargando: las etiquetas ya están, el valor todavía no", async () => {
    let resolver: (valor: MetricasAdmin) => void = () => {};
    obtenerMetricas.mockReturnValue(new Promise((resolve) => (resolver = resolve)));
    render(<PanelResumen onSesionInvalida={vi.fn()} />);
    expect(screen.getByText(textosAdmin.resumen.tarjetas.clientas)).toBeTruthy();
    expect(screen.queryByText("128")).toBeNull();
    resolver(METRICAS);
    await screen.findByText("128");
  });

  it("error (no de sesión): pinta BloqueConError y reintentar vuelve a pedir el dato", async () => {
    const usuario = userEvent.setup();
    obtenerMetricas.mockRejectedValueOnce(new Error("500 boom")).mockResolvedValueOnce(METRICAS);
    render(<PanelResumen onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.resumen.error.titulo)).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: textosAdmin.resumen.error.accion }));
    await waitFor(() => expect(obtenerMetricas).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("128")).toBeTruthy();
  });

  it("SessionError: NO pinta un error de bloque, delega el statusCode a onSesionInvalida", async () => {
    const onSesionInvalida = vi.fn();
    obtenerMetricas.mockRejectedValue(new SessionError(403, ""));
    render(<PanelResumen onSesionInvalida={onSesionInvalida} />);
    await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(403));
    expect(screen.queryByText(textosAdmin.resumen.error.titulo)).toBeNull();
  });
});
