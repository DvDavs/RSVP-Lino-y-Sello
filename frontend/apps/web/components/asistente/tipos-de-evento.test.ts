import { describe, expect, it } from "vitest";
import { EventKind } from "@invitaciones/schema";
import { TIPOS_DE_EVENTO, esEventKind, eventKindDeNombre, nombreDeTipo, tipoDeEvento } from "./tipos-de-evento.ts";

describe("catálogo de tipos de evento del asistente", () => {
  it("cubre los ocho EventKind del esquema, sin sobrar ni faltar ninguno", () => {
    expect([...TIPOS_DE_EVENTO].map((t) => t.kind).sort()).toEqual([...EventKind.options].sort());
  });

  it("cada tipo trae nombre en es-MX, icono propio e id de imagen pendiente", () => {
    for (const tipo of TIPOS_DE_EVENTO) {
      expect(tipo.nombre.length).toBeGreaterThan(0);
      expect(typeof tipo.Icono).not.toBe("undefined");
      expect(tipo.imagenId).toMatch(/^asistente\/tipo-[a-z-]+$/);
    }
  });

  it("ningún nombre lleva emoji (regla dura de la fase 3-C)", () => {
    for (const tipo of TIPOS_DE_EVENTO) {
      expect(tipo.nombre).toMatch(/^[\p{L}\p{M}\s]+$/u);
    }
  });

  it("tipoDeEvento devuelve el tipo pedido y nombreDeTipo su nombre", () => {
    expect(tipoDeEvento("quince").nombre).toBe("XV años");
    expect(nombreDeTipo("wedding")).toBe("Boda");
  });
});

describe("esEventKind", () => {
  it("acepta los valores del enum y rechaza lo demás", () => {
    expect(esEventKind("wedding")).toBe(true);
    expect(esEventKind("quince")).toBe(true);
    expect(esEventKind("bodas")).toBe(false);
    expect(esEventKind(null)).toBe(false);
    expect(esEventKind(undefined)).toBe(false);
  });
});

describe("eventKindDeNombre — espejo de BusinessSnapshotReader (backend)", () => {
  // Los nombres son los del catálogo REAL sembrado (`event_type.name`, verificado por SQL contra
  // el clúster de este worktree): Boda, Quince años, Bautizo, Comunión, Confirmación, Cumpleaños.
  it.each([
    ["Boda", "wedding"],
    ["Quince años", "quince"],
    ["XV Años", "quince"],
    ["Bautizo", "baptism"],
    ["Comunión", "communion"],
    ["Confirmación", "confirmation"],
    ["Cumpleaños", "birthday"],
    ["Graduación", "graduation"],
  ] as const)("«%s» → %s", (nombre, esperado) => {
    expect(eventKindDeNombre(nombre)).toBe(esperado);
  });

  it("normaliza acentos, mayúsculas y espacios de más igual que el backend", () => {
    expect(eventKindDeNombre("  quince   ANOS ")).toBe("quince");
    expect(eventKindDeNombre("COMUNION")).toBe("communion");
  });

  it("un nombre fuera del catálogo cae en `generic`, que es un valor de dominio legítimo", () => {
    expect(eventKindDeNombre("Aniversario de la empresa")).toBe("generic");
    expect(eventKindDeNombre("")).toBe("generic");
    expect(eventKindDeNombre(null)).toBe("generic");
  });
});
