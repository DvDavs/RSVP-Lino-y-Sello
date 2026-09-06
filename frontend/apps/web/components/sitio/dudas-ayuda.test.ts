// components/sitio/dudas-ayuda.test.ts — el buscador de `/ayuda` tiene que encontrar la duda aunque
// se escriba sin acentos y aunque la palabra esté en la RESPUESTA y no en la pregunta.
import { describe, expect, it } from "vitest";
import { DUDAS, filtrarDudas, normalizar } from "./dudas-ayuda.ts";

describe("normalizar", () => {
  it("quita acentos y mayúsculas para que «publicacion» encuentre «publicación»", () => {
    expect(normalizar("Publicación")).toBe("publicacion");
    // La Ñ se descompone y pierde la virgulilla: es lo que se quiere, así «quinceanera» encuentra
    // «quinceañera» sin que nadie tenga que acertar con el teclado.
    expect(normalizar("QUINCEAÑERA")).toBe("quinceanera");
  });
});

describe("filtrarDudas", () => {
  it("sin consulta devuelve todo, tal cual", () => {
    expect(filtrarDudas(DUDAS, "   ")).toHaveLength(DUDAS.length);
  });

  it("busca también dentro de la respuesta, no solo en el título", () => {
    const encontradas = filtrarDudas(DUDAS, "webp");
    expect(encontradas.map((d) => d.id)).toEqual(["fotos"]);
  });

  it("encuentra la duda de la fecha escribiéndola sin acento", () => {
    expect(filtrarDudas(DUDAS, "itinerario").map((d) => d.id)).toContain("fecha");
  });

  it("una consulta que no está en ninguna duda devuelve cero (y la pantalla enseña el vacío)", () => {
    expect(filtrarDudas(DUDAS, "criptomoneda")).toHaveLength(0);
  });

  it("cada duda tiene un ancla única: `/ayuda#fecha` no puede volverse ambiguo", () => {
    expect(new Set(DUDAS.map((d) => d.id)).size).toBe(DUDAS.length);
  });
});
