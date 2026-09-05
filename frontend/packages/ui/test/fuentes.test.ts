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
// (4) Revisor 3c-rev-2: `fonts.css` y el manifiesto no pueden divergir. Un `@font-face` con una
//     `url(/fonts/…)` que no esté en `FUENTES_AUTOALOJADAS` NO lo copia
//     `scripts/copiar-fuentes-publicas.ts` y da 404 en producción (y no cuenta en el presupuesto);
//     una entrada del manifiesto sin `@font-face` se copia para nada. Se comparan los dos conjuntos.
import { existsSync, readFileSync, statSync } from "node:fs";
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

  it("fonts.css y el manifiesto declaran EXACTAMENTE los mismos ficheros (sin deriva)", () => {
    const css = readFileSync(path.join(RAIZ_UI, "src/fonts/fonts.css"), "utf8");
    const enCss = [...css.matchAll(/url\((\/fonts\/[^)]+\.woff2)\)/g)].map((m) => m[1]!).sort();
    const enManifiesto = FUENTES_AUTOALOJADAS.map((f) => f.rutaPublica).sort();
    expect(enCss, "un @font-face que no está en el manifiesto no se copia a public/fonts: 404").toEqual(enManifiesto);
  });

  it("los seis @font-face autoalojados (con url()) llevan font-display: swap y unicode-range", () => {
    // Desde 3c-2b, fonts.css también trae 3 @font-face de RESPALDO (metric override, `11 §2.4`,
    // `ADR-3C-0-02`): esos son `local()`, no descargan nada, así que no necesitan `swap` ni
    // `unicode-range` (los cubre `test/metric-override.test.ts`). Aquí solo los 6 con `url()`.
    const css = readFileSync(path.join(RAIZ_UI, "src/fonts/fonts.css"), "utf8");
    const reglas = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]).filter((r) => /url\(/.test(r));
    expect(reglas).toHaveLength(FUENTES_AUTOALOJADAS.length);
    for (const regla of reglas) {
      expect(regla, `sin font-display: swap → texto invisible mientras carga:\n${regla}`).toMatch(/font-display:\s*swap/);
      expect(regla, `sin unicode-range → el navegador descarga subconjuntos que no usa:\n${regla}`).toMatch(/unicode-range:\s*U\+/);
    }
  });

  it("las 3 fuentes de respaldo (metric override) son local(), nunca cuentan como descarga", () => {
    const css = readFileSync(path.join(RAIZ_UI, "src/fonts/fonts.css"), "utf8");
    const reglas = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]);
    const respaldo = reglas.filter((r) => /Fallback/.test(r));
    expect(respaldo).toHaveLength(3);
    for (const regla of respaldo) expect(regla).not.toMatch(/url\(/);
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
