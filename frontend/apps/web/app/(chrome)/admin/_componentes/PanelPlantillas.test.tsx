// PanelPlantillas.test.tsx — la pestaña «Plantillas»: solo lectura, sin controles de alta, funciona
// igual con 2 filas (hoy) que con 15 (tras el merge de fase 4) — nunca una cifra codificada.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { textosAdmin } from "@/lib/admin/textos";
import type { ListaPlantillas, PlantillaAdmin } from "@/lib/admin/tipos";

const listarPlantillas = vi.fn();
vi.mock("@/lib/admin/cliente", () => ({
  listarPlantillas: (...args: never[]) => listarPlantillas(...args),
}));

const { SessionError } = await import("@/lib/errors");
const { PanelPlantillas } = await import("./PanelPlantillas.tsx");

function plantilla(slug: string, version = "1.0.0"): PlantillaAdmin {
  return { slug, version, estado: "published", tiposDeEvento: ["wedding"], registradaEn: "2026-03-02T10:00:00Z", invitaciones: 3 };
}

beforeEach(() => {
  listarPlantillas.mockReset();
});

describe("PanelPlantillas", () => {
  it("listo con 2 plantillas (lo que hay hoy): sin controles de alta en ninguna parte", async () => {
    const dos: ListaPlantillas = { total: 2, elementos: [plantilla("boda-clasica"), plantilla("xv-jardin")] };
    listarPlantillas.mockResolvedValue(dos);
    render(<PanelPlantillas onSesionInvalida={vi.fn()} />);
    expect((await screen.findAllByText("boda-clasica")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("xv-jardin").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /registrar|nueva plantilla|agregar/i })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("listo con 15 plantillas (tras el merge de fase 4): ninguna cifra codificada, se pintan todas", async () => {
    const quince: ListaPlantillas = { total: 15, elementos: Array.from({ length: 15 }, (_, i) => plantilla(`plantilla-${i}`)) };
    listarPlantillas.mockResolvedValue(quince);
    render(<PanelPlantillas onSesionInvalida={vi.fn()} />);
    expect((await screen.findAllByText("plantilla-0")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("plantilla-14").length).toBeGreaterThan(0);
  });

  it("vacío: el texto propio de Plantillas", async () => {
    listarPlantillas.mockResolvedValue({ total: 0, elementos: [] } satisfies ListaPlantillas);
    render(<PanelPlantillas onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.plantillas.vacio)).toBeTruthy();
  });

  it("error: pinta BloqueConError y reintenta", async () => {
    const usuario = userEvent.setup();
    listarPlantillas.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ total: 0, elementos: [] } satisfies ListaPlantillas);
    render(<PanelPlantillas onSesionInvalida={vi.fn()} />);
    expect(await screen.findByText(textosAdmin.plantillas.error.titulo)).toBeTruthy();
    await usuario.click(screen.getByRole("button", { name: textosAdmin.plantillas.error.accion }));
    await waitFor(() => expect(listarPlantillas).toHaveBeenCalledTimes(2));
  });

  it("SessionError delega a onSesionInvalida", async () => {
    const onSesionInvalida = vi.fn();
    listarPlantillas.mockRejectedValue(new SessionError(401, ""));
    render(<PanelPlantillas onSesionInvalida={onSesionInvalida} />);
    await waitFor(() => expect(onSesionInvalida).toHaveBeenCalledWith(401));
  });
});
