// U-08 (04 §20.1): "contrast.ts con las tres paletas de boda-clasica → las cinco parejas de §17.1
// cumplen su umbral."
//
// HALLAZGO REGISTRADO (bitácora/3-2a.md, preguntas-abiertas.md): la paleta "blush" —la PRIMERA y
// `defaultPaletteId` de `boda-clasica@1.0.0/theme.json`— NO cumple AA en 2 de las 5 parejas:
// `accentInk/accent` (2.78, exige ≥ 4.5) y `accent/bg` (2.62, exige ≥ 3.0). Verificado [V] con la
// fórmula de `04 §17.1` de forma independiente (python, ver bitácora). Esto NO es un defecto de
// `contrast.ts` — es un dato real de la plantilla registrada, y `I-31_PALETTE_CONTRAST_BELOW_AA`
// sigue "reservada" (ADR-1R-F-06 "propuesta", contratos.md §8): hoy nada más que esta prueba lo
// detecta contra los paquetes del repositorio. Esta prueba afirma la VERDAD (qué pasa y qué no),
// no una aspiración — si alguien corrige la paleta, esta prueba debe actualizarse para reflejarlo,
// y si una paleta NUEVA falla una pareja no listada aquí, esta prueba debe fallar y avisar.
import { describe, expect, it } from "vitest";
import { contrastRatio, evaluatePaletteContrast, relativeLuminance, PALETTE_AA_PAIRS } from "../../src/theme/contrast.ts";

describe("contrast.ts — fórmula WCAG 2.x", () => {
  it("negro sobre blanco = 21:1 (caso de referencia de la especificación)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("un color contra sí mismo = 1:1", () => {
    expect(contrastRatio("#3a2e2b", "#3a2e2b")).toBeCloseTo(1, 5);
  });

  it("el orden de los argumentos no importa", () => {
    expect(contrastRatio("#111111", "#eeeeee")).toBeCloseTo(contrastRatio("#eeeeee", "#111111"), 10);
  });

  it("relativeLuminance(#ffffff) = 1, relativeLuminance(#000000) = 0", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("rechaza un color que no es #rrggbb", () => {
    expect(() => relativeLuminance("red")).toThrow();
    expect(() => relativeLuminance("#fff")).toThrow(); // forma corta no admitida por HexColor
  });
});

describe("U-08 — evaluatePaletteContrast contra las tres paletas de boda-clasica@1.0.0", () => {
  // Valores tal cual `frontend/templates/boda-clasica/1.0.0/theme.json` (verificado [V]).
  const blush = { bg: "#FDF7F5", surface: "#FFFFFF", ink: "#3A2E2B", accent: "#C98B8B", accentInk: "#FFFFFF", muted: "#9A8A86" };
  const olive = { bg: "#F7F5EE", surface: "#FFFFFF", ink: "#2F3A2B", accent: "#6B7B4A", accentInk: "#FFFFFF", muted: "#8A9178" };
  const navy = { bg: "#F4F6FA", surface: "#FFFFFF", ink: "#1E2A44", accent: "#2E4A7D", accentInk: "#FFFFFF", muted: "#7C889E" };

  it("evalúa exactamente las cinco parejas de 04 §17.1, en el mismo orden", () => {
    const results = evaluatePaletteContrast(blush);
    expect(results.map((r) => r.pair)).toEqual(PALETTE_AA_PAIRS.map((p) => p.pair));
  });

  it('"olive": las cinco parejas cumplen su umbral AA', () => {
    for (const result of evaluatePaletteContrast(olive)) {
      expect(result.passes, `${result.pair}: ${result.ratio.toFixed(2)} < ${result.threshold}`).toBe(true);
    }
  });

  it('"navy": las cinco parejas cumplen su umbral AA', () => {
    for (const result of evaluatePaletteContrast(navy)) {
      expect(result.passes, `${result.pair}: ${result.ratio.toFixed(2)} < ${result.threshold}`).toBe(true);
    }
  });

  it('"blush": tres parejas cumplen; DOS NO (hallazgo real, no un umbral relajado)', () => {
    const byPair = Object.fromEntries(evaluatePaletteContrast(blush).map((r) => [r.pair, r]));

    expect(byPair["ink/bg"]!.passes).toBe(true);
    expect(byPair["ink/surface"]!.passes).toBe(true);
    expect(byPair["muted/bg"]!.passes).toBe(true);

    // Ambas fallan: acento demasiado claro sobre fondo claro y sobre blanco.
    expect(byPair["accentInk/accent"]!.passes).toBe(false);
    expect(byPair["accentInk/accent"]!.ratio).toBeCloseTo(2.78, 1);
    expect(byPair["accent/bg"]!.passes).toBe(false);
    expect(byPair["accent/bg"]!.ratio).toBeCloseTo(2.62, 1);
  });
});
