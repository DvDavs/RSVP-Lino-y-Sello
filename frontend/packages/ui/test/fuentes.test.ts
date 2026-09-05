// packages/ui/test/fuentes.test.ts — `11 §2.1/§2.3/§2.4` + brief 3c-2, entregable 1 y 4(c)/4(d).
//
// (1) Cada fichero del manifiesto (`src/fonts/preload.ts`) existe de verdad en
//     `node_modules/@fontsource-variable/*/files/*latin*` con el peso exacto que registró
//     `npm view`/`npm pack` en `11 §2.3` — si `pnpm add -E` instalara otra versión con otro
//     subsetting, esta prueba cae antes que un `document.fonts.check` en Playwright.
// (2) El peso real (suma de bytes leídos del disco, no el número hardcodeado) del subconjunto
//     LATINO que se carga en primera vista es el presupuesto de `11 §2.4` (177 188 B): Fraunces
//     `full` + Onest `wght` + Red Hat Mono `wght`, sin `latin-ext` (es-MX no lo necesita).
// (3) `RUTAS_PRECARGA` solo contiene la voz `display`, subconjunto latino (una única ruta).
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FUENTES_AUTOALOJADAS, PRESUPUESTO_PRIMERA_VISTA_BYTES, RUTAS_PRECARGA } from "../src/fonts/preload.ts";

const RAIZ_UI = path.resolve(import.meta.dirname, "..");

describe("fuentes autoalojadas — existencia y peso real (11 §2.3/§2.4)", () => {
  it("el manifiesto declara las 3 familias × 2 subconjuntos (latino + latin-ext)", () => {
    expect(FUENTES_AUTOALOJADAS).toHaveLength(6);
    const familias = new Set(FUENTES_AUTOALOJADAS.map((f) => f.familia));
    expect(familias).toEqual(new Set(["Fraunces", "Onest", "Red Hat Mono"]));
  });

  for (const fuente of FUENTES_AUTOALOJADAS) {
    it(`${fuente.rutaNodeModules} existe y pesa ${fuente.bytes} B`, () => {
      const ruta = path.join(RAIZ_UI, fuente.rutaNodeModules);
      expect(existsSync(ruta), `Falta ${ruta}. ¿pnpm install / versión de ${fuente.paquete} distinta a ${fuente.version}?`).toBe(true);
      const { size } = statSync(ruta);
      expect(size, `${fuente.archivo} pesa ${size} B en disco, el manifiesto dice ${fuente.bytes} B`).toBe(fuente.bytes);
    });
  }

  it("peso real de la primera vista (solo subconjunto latino) <= presupuesto de 11 §2.4", () => {
    const latinas = FUENTES_AUTOALOJADAS.filter((f) => f.subconjunto === "latin");
    let total = 0;
    const detalle: string[] = [];
    for (const f of latinas) {
      const ruta = path.join(RAIZ_UI, f.rutaNodeModules);
      const { size } = statSync(ruta);
      total += size;
      detalle.push(`  ${f.familia.padEnd(14)} ${f.archivo} = ${size} B`);
    }
    console.log(`[fuentes] presupuesto primera vista (subconjunto latino):\n${detalle.join("\n")}\n  TOTAL = ${total} B (presupuesto 11 §2.4: ${PRESUPUESTO_PRIMERA_VISTA_BYTES} B)`);
    expect(total).toBe(PRESUPUESTO_PRIMERA_VISTA_BYTES);
    expect(total).toBeLessThanOrEqual(PRESUPUESTO_PRIMERA_VISTA_BYTES);
  });

  it("RUTAS_PRECARGA solo trae la voz display, subconjunto latino", () => {
    expect(RUTAS_PRECARGA).toEqual(["/fonts/fraunces-latin-full-normal.woff2"]);
  });

  it("cada ruta de RUTAS_PRECARGA corresponde a un fichero de origen existente", () => {
    for (const rutaPublica of RUTAS_PRECARGA) {
      const fuente = FUENTES_AUTOALOJADAS.find((f) => f.rutaPublica === rutaPublica);
      expect(fuente, `${rutaPublica} no aparece en el manifiesto`).toBeDefined();
      const ruta = path.join(RAIZ_UI, fuente!.rutaNodeModules);
      expect(existsSync(ruta), `${rutaPublica} apunta a un fichero que no existe: ${ruta}`).toBe(true);
    }
  });
});
