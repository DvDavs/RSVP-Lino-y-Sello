// test/contraste.test.ts — la compuerta. Además de comprobar que hoy está en verde, SABOTEA un rol
// y exige que caiga: una compuerta que nunca se ha visto fallar no es una compuerta.
import { describe, expect, it } from "vitest";
import { PALETAS, paletaActiva } from "../src/paletas.ts";
import { PAREJAS, semantica } from "../src/semantica.ts";
import { contraste, luminancia, tablaContraste, verificarParejas } from "../src/contraste.ts";

describe("contraste WCAG 2.x", () => {
  it("la matemática es la de la norma (blanco 21:1 contra negro, 1:1 contra sí mismo)", () => {
    expect(luminancia("#ffffff")).toBeCloseTo(1, 10);
    expect(luminancia("#000000")).toBeCloseTo(0, 10);
    expect(contraste("#ffffff", "#000000")).toBeCloseTo(21, 10);
    expect(contraste("#bb0076", "#bb0076")).toBeCloseTo(1, 10);
    expect(contraste("#ffffff", "#bb0076")).toBeCloseTo(contraste("#bb0076", "#ffffff"), 10);
  });

  it("252 filas, 240 con umbral, 0 fallos (el estado del bloque 0, conservado)", () => {
    const r = verificarParejas();
    expect(r.filas).toHaveLength(252);
    expect(r.evaluadas).toBe(240);
    expect(r.fallos).toBe(0);
    expect(r.filas.filter((f) => f.ok === false)).toEqual([]);
  });

  it("los ratios coinciden con los publicados en 11 §1.6 para la paleta activa", () => {
    const claro = semantica(paletaActiva(), "light");
    const oscuro = semantica(paletaActiva(), "dark");
    expect(contraste(claro["on-primary"], claro.primary).toFixed(2)).toBe("6.22");
    expect(contraste(claro.link, claro.surface).toFixed(2)).toBe("8.23");
    expect(contraste(claro.focus, claro.surface).toFixed(2)).toBe("3.61");
    expect(contraste(claro.ink, claro.surface).toFixed(2)).toBe("15.26");
    expect(contraste(oscuro["on-primary"], oscuro.primary).toFixed(2)).toBe("10.42");
    expect(contraste(oscuro.ink, oscuro.surface).toFixed(2)).toBe("18.27");
  });

  it("cada pareja con umbral lo cumple en las tres paletas y en los dos temas", () => {
    for (const fila of verificarParejas().filas) {
      if (fila.umbral === null) continue;
      expect(fila.ratio, `${fila.paleta}/${fila.tema}: ${fila.figura} sobre ${fila.fondo}`).toBeGreaterThanOrEqual(fila.umbral);
    }
  });

  it("SABOTAJE: la tinta del color del papel tumba las tres parejas de `ink` del tema claro", () => {
    const sano = verificarParejas([paletaActiva()]);
    expect(sano.fallos).toBe(0);
    const saboteado = verificarParejas([paletaActiva()], { ink: "#fdf9f6" });
    const caidas = saboteado.filas.filter((f) => f.ok === false).map((f) => `${f.tema}:${f.figura}/${f.fondo}`);
    expect(caidas).toEqual(["light:ink/surface", "light:ink/surface-raised", "light:ink/surface-alt"]);
    expect(saboteado.fallos).toBe(3);
    expect(tablaContraste(saboteado)).toContain("FALLA");
  });

  it("SABOTAJE: la tinta del color del papel OSCURO tumba las tres parejas de `ink` del tema oscuro", () => {
    const saboteado = verificarParejas([paletaActiva()], { ink: "#150e07" });
    const caidas = saboteado.filas.filter((f) => f.ok === false).map((f) => `${f.tema}:${f.figura}/${f.fondo}`);
    expect(caidas).toEqual(["dark:ink/surface", "dark:ink/surface-raised", "dark:ink/surface-alt"]);
  });

  it("SABOTAJE: un anillo de foco flojo cae por el umbral gráfico de 3,0", () => {
    const saboteado = verificarParejas([paletaActiva()], { focus: "#fff3f8" });
    const caidas = saboteado.filas.filter((f) => f.ok === false && f.figura === "focus");
    expect(caidas).toHaveLength(3);
    for (const f of caidas) expect(f.umbral).toBe(3);
  });

  it("la tabla imprime una fila por medición más cabecera y pie", () => {
    const tabla = tablaContraste().split("\n");
    expect(tabla).toHaveLength(252 + 4);
    expect(tabla[0]).toContain("paleta");
    expect(tabla.at(-1)).toBe(`${Object.keys(PALETAS).length} paletas x 2 temas x ${PAREJAS.length} parejas = 252 filas; 240 con umbral; 0 fallos.`);
  });
});
