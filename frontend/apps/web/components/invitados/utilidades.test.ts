import { describe, expect, it } from "vitest";
import { etiquetaEstado, formatoRelativo, nombreVisible, tonoEstado } from "./utilidades";

describe("etiquetaEstado / tonoEstado", () => {
  it("traduce los tres estados del contrato", () => {
    expect(etiquetaEstado("CONFIRMED")).toBe("Confirmada");
    expect(etiquetaEstado("PENDING")).toBe("Pendiente");
    expect(etiquetaEstado("DECLINED")).toBe("No asiste");
  });

  it("usa un tono AA distinto por estado", () => {
    expect(tonoEstado("CONFIRMED")).toBe("success");
    expect(tonoEstado("PENDING")).toBe("neutro");
    expect(tonoEstado("DECLINED")).toBe("danger");
  });
});

describe("nombreVisible", () => {
  it("usa el nombre cuando existe", () => {
    expect(nombreVisible("María Fernanda Cruz")).toBe("María Fernanda Cruz");
  });

  it("cae a un texto honesto cuando el backend manda null o solo espacios (GuestItem.fullName es nulable)", () => {
    expect(nombreVisible(null)).toBe("Invitado sin nombre");
    expect(nombreVisible("   ")).toBe("Invitado sin nombre");
  });
});

describe("formatoRelativo", () => {
  const ahora = new Date("2026-03-03T18:22:10Z");

  it("cadena vacía para null o fecha inválida (nunca inventa una fecha)", () => {
    expect(formatoRelativo(null, ahora)).toBe("");
    expect(formatoRelativo("no-es-una-fecha", ahora)).toBe("");
  });

  it("menos de un minuto también lleva el «hace», como los otros tres tramos", () => {
    expect(formatoRelativo("2026-03-03T18:21:40Z", ahora)).toBe("hace un momento");
  });

  it("minutos, horas y días", () => {
    expect(formatoRelativo("2026-03-03T18:20:10Z", ahora)).toBe("hace 2 minutos");
    expect(formatoRelativo("2026-03-03T15:22:10Z", ahora)).toBe("hace 3 horas");
    expect(formatoRelativo("2026-03-01T18:22:10Z", ahora)).toBe("hace 2 días");
  });
});
