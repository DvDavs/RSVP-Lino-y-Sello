import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
    ...parcial,
  };
}

describe("Mis invitaciones (paso 1 del asistente)", () => {
  it("sin invitaciones explica de dónde salen y lleva a los planes, sin botones muertos", () => {
    render(<MisInvitaciones invitaciones={[]} idTitulo="t" />);
    expect(screen.getByRole("heading", { name: "Todavía no tienes invitaciones" })).toBeTruthy();
    const accion = screen.getByRole("link", { name: "Ver planes" });
    expect(accion.getAttribute("href")).toBe("/ayuda#planes");
    expect(document.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it("enseña el nombre humano cuando la invitación ya tiene documento", () => {
    render(<MisInvitaciones invitaciones={[fila({ estado: "con-plantilla", nombre: "Mariana & Rodrigo" })]} idTitulo="t" />);
    expect(screen.getByText("Mariana & Rodrigo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Seguir editando" }).getAttribute("href")).toBe("/editor/3");
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
});

describe("fechaLegible", () => {
  it("formatea una fecha ISO en es-MX y deja intacto lo que no lo es", () => {
    expect(fechaLegible("2027-04-18")).toBe("18 de abril de 2027");
    expect(fechaLegible("")).toBe("");
    expect(fechaLegible(null)).toBe("");
    expect(fechaLegible("mañana")).toBe("mañana");
  });
});
