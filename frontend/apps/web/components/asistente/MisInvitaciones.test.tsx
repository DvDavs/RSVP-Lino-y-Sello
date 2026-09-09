import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MisInvitaciones, fechaLegible } from "./MisInvitaciones.tsx";
import type { FilaInvitacion } from "./invitaciones.ts";

function fila(parcial: Partial<FilaInvitacion>): FilaInvitacion {
  return {
    id: 3,
    status: "paid",
    event: "Boda",
    plan: "Premium",
    date: "2027-04-18",
    time: "17:00",
    estado: "sin-plantilla",
    nombre: null,
    eventKind: "wedding",
    nivel: 2,
    publicada: false,
    publicToken: null,
    publicUrl: null,
    ...parcial,
  };
}

describe("Mis invitaciones (paso 1 del asistente)", () => {
  it("sin invitaciones y sin `alEmpezar`, el estado vacío lleva a los planes (respaldo)", () => {
    render(<MisInvitaciones invitaciones={[]} idTitulo="t" />);
    expect(screen.getByRole("heading", { name: "Todavía no tienes invitaciones" })).toBeTruthy();
    const accion = screen.getByRole("link", { name: "Empezar mi invitación" });
    expect(accion.getAttribute("href")).toBe("/ayuda#planes");
    expect(document.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it("fase 5, E3 (cierre de G-01): con `alEmpezar`, la acción es un botón que lleva al formulario de alta", () => {
    const alEmpezar = vi.fn();
    render(<MisInvitaciones invitaciones={[]} idTitulo="t" alEmpezar={alEmpezar} />);
    const accion = screen.getByRole("button", { name: "Empezar mi invitación" });
    expect(accion.getAttribute("href")).toBeNull();
    fireEvent.click(accion);
    expect(alEmpezar).toHaveBeenCalledTimes(1);
  });

  it("enseña el nombre humano cuando la invitación ya tiene documento", () => {
    render(<MisInvitaciones invitaciones={[fila({ estado: "con-plantilla", nombre: "Mariana & Rodrigo" })]} idTitulo="t" />);
    expect(screen.getByText("Mariana & Rodrigo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir en el editor" }).getAttribute("href")).toBe("/editor/3");
    // Sin publicar, el estado lo dice y no hay enlace público que enseñar.
    expect(screen.getByText("En edición")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copiar" })).toBeNull();
  });

  it("3C-UX G-06: publicada, la fila enseña el enlace de las invitadas con «Copiar» y «Ver como invitada»", () => {
    render(
      <MisInvitaciones
        invitaciones={[
          fila({
            estado: "con-plantilla",
            nombre: "Mariana & Rodrigo",
            publicada: true,
            publicToken: "pub_abc",
            publicUrl: "https://invitaciones.mx/i/pub_abc",
          }),
        ]}
        idTitulo="t"
      />,
    );
    expect(screen.getByText("Publicada")).toBeTruthy();
    // El enlace lo arma `lib/enlace-publico.ts` con el origen por el que la clienta está entrando
    // (ADR-3C-N02-01), igual que el diálogo de publicar: nunca el `http://localhost/i/…` crudo.
    expect(screen.getByText(/\/i\/pub_abc$/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver como invitada" }).getAttribute("href")).toMatch(/\/i\/pub_abc$/);
  });

  it("la fila dice de qué tipo es la invitación, no solo su número", () => {
    render(<MisInvitaciones invitaciones={[fila({ eventKind: "quince" })]} idTitulo="t" />);
    expect(screen.getByText(/XV años/)).toBeTruthy();
  });

  it("una invitación sin plantilla invita a elegir una", () => {
    render(<MisInvitaciones invitaciones={[fila({})]} idTitulo="t" />);
    expect(screen.getByRole("link", { name: "Elegir plantilla" }).getAttribute("href")).toBe("/editor/3");
    expect(screen.getByText(/Fecha del evento: 18 de abril de 2027/)).toBeTruthy();
  });

  it("una invitación sin acceso no ofrece un camino que no funcionaría", () => {
    render(<MisInvitaciones invitaciones={[fila({ estado: "sin-acceso" })]} idTitulo="t" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("No disponible")).toBeTruthy();
  });

  it("sin fecha registrada lo dice en vez de dejar un hueco", () => {
    render(<MisInvitaciones invitaciones={[fila({ date: "" })]} idTitulo="t" />);
    expect(screen.getByText("Sin fecha registrada")).toBeTruthy();
  });

  it("sin `onBorrar`, ninguna fila ofrece «Eliminar» (solo lectura)", () => {
    render(<MisInvitaciones invitaciones={[fila({})]} idTitulo="t" />);
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
  });

  it("con `onBorrar`, pide confirmación explícita antes de llamar (contrato §1 bis)", () => {
    const onBorrar = vi.fn();
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MisInvitaciones invitaciones={[fila({})]} idTitulo="t" onBorrar={onBorrar} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(onBorrar).not.toHaveBeenCalled(); // canceló la confirmación: no se llama
    confirmar.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onBorrar).toHaveBeenCalledWith(3);
    confirmar.mockRestore();
  });

  it("mientras se borra OTRA fila, la de aquí queda deshabilitada", () => {
    render(
      <MisInvitaciones
        invitaciones={[fila({ id: 3 }), fila({ id: 4 })]}
        idTitulo="t"
        onBorrar={vi.fn()}
        borrandoId={4}
      />,
    );
    expect((screen.getByTestId("asistente-eliminar-3") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("fechaLegible", () => {
  it("formatea una fecha ISO en es-MX y deja intacto lo que no lo es", () => {
    expect(fechaLegible("2027-04-18")).toBe("18 de abril de 2027");
    expect(fechaLegible("")).toBe("");
    expect(fechaLegible(null)).toBe("");
    expect(fechaLegible("mañana")).toBe("mañana");
  });
});
