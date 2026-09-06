import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasoDatos } from "./PasoDatos.tsx";
import type { CampoDeDatos } from "./datos-basicos.ts";

const CAMPOS: readonly CampoDeDatos[] = [
  { id: "quienes-0", etiqueta: "Novio", grupo: "quienes", destino: { tipo: "person", blockId: "couple.groom" }, valorInicial: "", maxLength: 120 },
  { id: "quienes-1", etiqueta: "Novia", grupo: "quienes", destino: { tipo: "person", blockId: "couple.bride" }, valorInicial: "", maxLength: 120 },
  { id: "donde", etiqueta: "Dónde", grupo: "donde", destino: { tipo: "location", blockId: "event.place" }, valorInicial: "", maxLength: 120 },
];

function pintar(parcial: Partial<Parameters<typeof PasoDatos>[0]> = {}) {
  const alCambiarValor = vi.fn();
  const alCambiarFecha = vi.fn();
  const alCambiarHora = vi.fn();
  render(
    <PasoDatos
      campos={CAMPOS}
      valores={{}}
      alCambiarValor={alCambiarValor}
      fecha="2027-04-18"
      hora="17:00"
      alCambiarFecha={alCambiarFecha}
      alCambiarHora={alCambiarHora}
      errorFecha={null}
      errorGuardado={null}
      {...parcial}
    />,
  );
  return { alCambiarValor, alCambiarFecha, alCambiarHora };
}

describe("paso 3 — Los datos básicos", () => {
  it("agrupa los campos en las tres preguntas de `11 §7` y usa las etiquetas de la plantilla", () => {
    pintar();
    expect(screen.getByRole("group", { name: "¿Quiénes celebran?" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "¿Cuándo?" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "¿Dónde?" })).toBeTruthy();
    expect(screen.getByLabelText("Novio")).toBeTruthy();
    expect(screen.getByLabelText("Novia")).toBeTruthy();
    expect(screen.getByLabelText("Dónde")).toBeTruthy();
  });

  it("la fecha y la hora llegan rellenas con lo que ya tiene la invitación", () => {
    pintar();
    expect(screen.getByLabelText("Fecha del evento").getAttribute("value")).toBe("2027-04-18");
    expect(screen.getByLabelText("Hora de inicio").getAttribute("value")).toBe("17:00");
  });

  it("escribir un nombre avisa al asistente con el id del campo", async () => {
    const { alCambiarValor } = pintar();
    await userEvent.type(screen.getByLabelText("Novia"), "A");
    expect(alCambiarValor).toHaveBeenCalledWith("quienes-1", "A");
  });

  it("una fecha inválida se anuncia como error del campo, no como un mensaje suelto", () => {
    pintar({ errorFecha: "Escribe la fecha como día, mes y año. Por ejemplo: 18 de abril de 2027." });
    const campo = screen.getByLabelText("Fecha del evento");
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain("18 de abril de 2027");
  });

  it("un fallo al guardar se cuenta y no bloquea: el texto dice que se puede seguir", () => {
    pintar({ errorGuardado: "No pudimos guardar estos datos." });
    expect(screen.getByRole("alert").textContent).toContain("No pudimos guardar");
  });

  it("una plantilla sin campos derivables deja solo la fecha (nunca un formulario vacío)", () => {
    pintar({ campos: [] });
    expect(screen.queryByRole("group", { name: "¿Quiénes celebran?" })).toBeNull();
    expect(screen.queryByRole("group", { name: "¿Dónde?" })).toBeNull();
    expect(screen.getByRole("group", { name: "¿Cuándo?" })).toBeTruthy();
  });
});
