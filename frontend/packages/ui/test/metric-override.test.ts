// packages/ui/test/metric-override.test.ts — `11 §2.4`, `ADR-3C-0-02`, brief 3c-2b tarea 2. El
// bloque de `@font-face` de las tres fuentes de respaldo («Fraunces Fallback», «Onest Fallback»,
// «Red Hat Mono Fallback») en `src/fonts/fonts.css` es GENERADO por
// `scripts/metric-override.ts` a partir de métricas reales (`@capsizecss/metrics`) — nunca a mano:
// esta prueba, igual que `packages/tokens/test/css-generado.test.ts` con `tokens.css`, compara byte
// a byte lo commiteado con lo que el script calcularía ahora mismo.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calcularAjusteMetrico,
  FUENTES_DE_RESPALDO,
  generarBloqueMetricOverride,
  insertarBloqueEnFonts,
  METRICAS_LOCALES,
} from "../scripts/metric-override.ts";

const RAIZ_UI = path.resolve(import.meta.dirname, "..");
const FONTS_CSS = readFileSync(path.join(RAIZ_UI, "src/fonts/fonts.css"), "utf8");

describe("fonts.css — metric override de las fuentes de respaldo es GENERADO (11 §2.4)", () => {
  it("el bloque commiteado es exactamente el que emite el script ahora mismo", () => {
    const bloque = generarBloqueMetricOverride();
    expect(insertarBloqueEnFonts(FONTS_CSS, bloque), "ejecuta `node scripts/metric-override.ts`").toBe(FONTS_CSS);
  });

  it("un valor sabotea el bloque: la comparación cae (evidencia en bitácora 3c-2b)", () => {
    const bloqueSaboteado = generarBloqueMetricOverride().replace("92.96%", "50.00%");
    expect(insertarBloqueEnFonts(FONTS_CSS, bloqueSaboteado)).not.toBe(FONTS_CSS);
  });

  it("las 3 fuentes de respaldo existen en fonts.css con local() (nunca url: no son descarga)", () => {
    for (const f of FUENTES_DE_RESPALDO) {
      const escapado = f.nombreRespaldo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const m = new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*"${escapado}"[^}]*\\}`).exec(FONTS_CSS);
      expect(m, `falta @font-face de "${f.nombreRespaldo}" en fonts.css`).not.toBeNull();
      const bloque = m![0];
      expect(bloque, `"${f.nombreRespaldo}" debe ser local(), nunca una descarga`).not.toMatch(/url\(/);
      for (const local of f.locales) expect(bloque).toContain(`local("${local}")`);
      expect(bloque).toMatch(/ascent-override:\s*[\d.]+%;/);
      expect(bloque).toMatch(/descent-override:\s*[\d.]+%;/);
      expect(bloque).toMatch(/line-gap-override:\s*[\d.]+%;/);
      expect(bloque).toMatch(/size-adjust:\s*[\d.]+%;/);
    }
  });

  it("las cuatro cifras salen de métricas reales, no de un número inventado (rango físico válido)", () => {
    for (const f of FUENTES_DE_RESPALDO) {
      const fallback = METRICAS_LOCALES[f.locales[0]!]!;
      const ajuste = calcularAjusteMetrico(f.real, fallback);
      // Metric override razonable: `size-adjust` y `ascent-override` de dos fuentes latinas
      // corrientes caen entre 50 % y 150 % (un valor fuera de ese rango delataría una métrica
      // leída de la fuente equivocada, o unidades sin normalizar por `unitsPerEm`).
      for (const valor of [ajuste.sizeAdjust, ajuste.ascentOverride]) {
        const n = Number(valor.replace("%", ""));
        expect(n, `${f.nombreRespaldo}: ${valor} fuera de rango físico razonable`).toBeGreaterThan(50);
        expect(n).toBeLessThan(150);
      }
      // `descent-override` es más pequeño por definición (el descendente pesa menos que el
      // ascendente en cualquier fuente latina): entre 5 % y 60 %.
      const descentPct = Number(ajuste.descentOverride.replace("%", ""));
      expect(descentPct, `${f.nombreRespaldo}: descent-override ${ajuste.descentOverride} fuera de rango`).toBeGreaterThan(5);
      expect(descentPct).toBeLessThan(60);
    }
  });
});
