import { describe, expect, it } from "vitest";
import { casar, desescaparSegmento, escaparSegmento, expandir, patronDe, puntero, segmentosDe } from "../src/puntero.ts";

describe("RFC 6901", () => {
  it("escapa y desescapa en el orden correcto (~1 antes que ~0)", () => {
    expect(escaparSegmento("a/b~c")).toBe("a~1b~0c");
    expect(desescaparSegmento("a~1b~0c")).toBe("a/b~c");
    expect(desescaparSegmento(escaparSegmento("~01"))).toBe("~01");
  });
  it("construye y parte punteros", () => {
    expect(puntero(["config", "sectionCover", "title"])).toBe("/config/sectionCover/title");
    expect(segmentosDe("/config/a~1b")).toEqual(["config", "a/b"]);
    expect(segmentosDe("")).toEqual([]);
  });
  it("rechaza un puntero que no empieza por /", () => {
    expect(() => segmentosDe("config/x")).toThrowError('Puntero RFC 6901 inválido (no empieza por "/"): config/x');
  });
});

describe("lenguaje de patrones", () => {
  it("* casa exactamente un segmento y lo captura", () => {
    expect(casar("/a/*/c", "/a/0/c")?.comodines).toEqual(["0"]);
    expect(casar("/a/*/c", "/a/0/1/c")).toBeNull();
  });
  it("** casa uno o más segmentos en cualquier posición y no captura", () => {
    expect(casar("/config/**/md/**", "/config/sectionCover/title/md/color/0")?.comodines).toEqual([]);
    expect(casar("/config/**/fontFamily", "/config/a/b/c/fontFamily")).not.toBeNull();
    expect(casar("/config/**/fontFamily", "/config/fontFamily")).toBeNull(); // ** exige >= 1 segmento
  });
  it("patronDe sustituye SOLO los índices de array", () => {
    expect(patronDe("/config/items/0/title/content", [false, false, true, false, false]))
      .toBe("/config/items/*/title/content");
  });
  it("expandir resuelve {n} y {n+1}", () => {
    expect(expandir("family.group{1}", { comodines: ["0"] })).toBe("family.group0");
    expect(expandir("family.group{1+1}", { comodines: ["0"] })).toBe("family.group1");
    expect(() => expandir("x{2}", { comodines: ["0"] }))
      .toThrowError('La plantilla "x{2}" pide el comodín 2 y la regla sólo capturó 1');
    expect(() => expandir("x{1+1}", { comodines: ["women"] }))
      .toThrowError('La plantilla "x{1+1}" pide sumar a un comodín que no es un índice: "women"');
  });
});
