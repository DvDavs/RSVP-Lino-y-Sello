// test/paletas.test.ts — las escalas. Dos cosas que no se negocian: la forma (11 pasos neutros, 10
// por matiz, luminosidad monótona) y la PROCEDENCIA (los hex tienen que ser los mismos que generó
// el bloque 0 en la evidencia del moodboard: si cambian, cambian los contrastes ya verificados).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFINICIONES, MATICES, PALETAS, PALETA_ACTIVA, PASOS, PASOS_NEUTROS, escala, neutros, paletaActiva,
} from "../src/paletas.ts";
import { luminancia } from "../src/contraste.ts";

const HEX = /^#[0-9a-f]{6}$/;

const RUTA_EVIDENCIA = resolve(
  import.meta.dirname,
  "../../../../docs/rediseno-plantillas/evidencia/fase-3c/moodboard/paletas.generadas.mjs",
);

/** Lee la evidencia del bloque 0 sin importarla como módulo (vive fuera del monorepo). */
function paletasDeLaEvidencia(): Array<{
  id: string;
  escalas: Record<string, { nombre: string; h: number; pasos: Record<string, string> }>;
  neutral: { h: number; pasos: Record<string, string> };
}> {
  const texto = readFileSync(RUTA_EVIDENCIA, "utf8");
  const desde = texto.indexOf("[");
  const hasta = texto.lastIndexOf("]");
  return JSON.parse(texto.slice(desde, hasta + 1));
}

describe("escalas", () => {
  it("hay tres paletas y la activa es la A (Bugambilia)", () => {
    expect(Object.keys(PALETAS)).toEqual(["a", "b", "c"]);
    expect(PALETA_ACTIVA).toBe("a");
    expect(paletaActiva().nombre).toBe("Bugambilia");
  });

  it("cada paleta tiene 8 matices de 10 pasos y neutros de 11", () => {
    for (const p of Object.values(PALETAS)) {
      expect(Object.keys(p.escalas)).toEqual([...MATICES]);
      for (const matiz of MATICES) {
        const pasos = p.escalas[matiz].pasos;
        expect(Object.keys(pasos).map(Number)).toEqual([...PASOS]);
        for (const paso of PASOS) expect(pasos[paso]).toMatch(HEX);
      }
      expect(Object.keys(p.neutral.pasos).map(Number)).toEqual([...PASOS_NEUTROS]);
      for (const paso of PASOS_NEUTROS) expect(p.neutral.pasos[paso]).toMatch(HEX);
    }
  });

  it("la luminosidad baja de forma estrictamente monótona del 50 al 900 en todos los matices", () => {
    for (const p of Object.values(PALETAS)) {
      for (const matiz of MATICES) {
        const l = PASOS.map((paso) => luminancia(p.escalas[matiz].pasos[paso]));
        for (let i = 1; i < l.length; i++) {
          expect(l[i], `${p.id}/${matiz}: paso ${PASOS[i]} no es más oscuro que ${PASOS[i - 1]}`).toBeLessThan(l[i - 1]);
        }
      }
      const ln = PASOS_NEUTROS.map((paso) => luminancia(p.neutral.pasos[paso]));
      for (let i = 1; i < ln.length; i++) expect(ln[i]).toBeLessThan(ln[i - 1]);
    }
  });

  it("ningún neutro es gris puro (croma > 0: el papel es hueso, no zinc)", () => {
    for (const p of Object.values(PALETAS)) {
      for (const paso of PASOS_NEUTROS) {
        const hex = p.neutral.pasos[paso];
        const r = Number.parseInt(hex.slice(1, 3), 16);
        const g = Number.parseInt(hex.slice(3, 5), 16);
        const b = Number.parseInt(hex.slice(5, 7), 16);
        expect(Math.max(r, g, b) - Math.min(r, g, b), `${p.id} neutral-${paso} es gris puro`).toBeGreaterThan(0);
      }
    }
  });

  it("son EXACTAMENTE los hex de la evidencia del bloque 0 (moodboard/paletas.generadas.mjs)", () => {
    const evidencia = paletasDeLaEvidencia();
    expect(evidencia).toHaveLength(3);
    for (const esperada of evidencia) {
      const nuestra = PALETAS[esperada.id as "a" | "b" | "c"];
      for (const [matiz, e] of Object.entries(esperada.escalas)) {
        expect(nuestra.escalas[matiz as (typeof MATICES)[number]].pasos, `${esperada.id}/${matiz}`).toEqual(
          Object.fromEntries(Object.entries(e.pasos).map(([k, v]) => [Number(k), v])),
        );
      }
      expect(nuestra.neutral.pasos, `${esperada.id}/neutral`).toEqual(
        Object.fromEntries(Object.entries(esperada.neutral.pasos).map(([k, v]) => [Number(k), v])),
      );
    }
  });

  it("las escalas son deterministas y el recorte al gamut solo baja el croma", () => {
    expect(escala(352, 0.235)).toEqual(escala(352, 0.235));
    expect(neutros(62)).toEqual(neutros(62));
    // Un croma imposible (0,4 en un matiz que no lo admite) se recorta, no revienta ni cambia la L.
    const recortada = escala(352, 0.4);
    for (const paso of PASOS) expect(recortada[paso]).toMatch(HEX);
    expect(luminancia(recortada[900])).toBeLessThan(luminancia(recortada[50]));
  });

  it("el foco NUNCA sale del matiz principal (11 §1.3)", () => {
    for (const def of DEFINICIONES) expect(def.matizFoco).not.toBe("primary");
  });
});
