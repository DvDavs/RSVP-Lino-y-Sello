// packages/schema/test/golden-inventory.test.ts — inventario de golden/templates/ (06 §3: la
// prueba de inventario complementaria a invariant-catalog/block-kinds/operations, que ya cubren sus
// propias subcarpetas). Falla si una carpeta de plantilla pierde alguno de sus 7 ficheros.
import { describe, it, expect } from "vitest";
import { listDirs, goldenDir } from "./golden.ts";
import { readdirSync } from "node:fs";

// `richtext-marcas-1.0.0` (I-01) es SINTETIZADO por `gen-golden-templates.ts`, no viene de
// `diseno/ejemplos/`: esa carpeta es la referencia inmutable de la ronda 1R y ninguno de sus dos
// documentos lleva un solo `marks`. ADR-1R-D-09 prohíbe escribir golden a mano, no sintetizarlos.
const EXPECTED_TEMPLATE_DIRS = ["boda-clasica-1.0.0", "richtext-marcas-1.0.0", "xv-jardin-1.0.0"];
// OCHO ficheros desde 2-2: `assets.json` emite el `AssetIndex` como DATO (objeción O-06). Antes la
// regla `assetId → url` vivía solo en un `.ts` del generador, así que Kotlin no podía reproducir
// `compuesto.json` sin copiar una convención de fixture que NO es la regla de producción (02 §10.4).
const EXPECTED_FILES = ["template.json", "theme.json", "defaults.json", "documento.json", "business.json", "assets.json", "compuesto.json", "reporte.json"].sort();

describe("golden/templates — inventario", () => {
  it("exactamente las 3 carpetas: las 2 de diseno/ejemplos más la sintetizada de I-01", () => {
    expect(listDirs("templates")).toEqual([...EXPECTED_TEMPLATE_DIRS].sort());
  });

  for (const dir of EXPECTED_TEMPLATE_DIRS) {
    it(`${dir}: los 8 ficheros`, () => {
      const files = readdirSync(goldenDir("templates") + "/" + dir).sort();
      expect(files).toEqual(EXPECTED_FILES);
    });
  }
});

describe("golden/ — las seis subcarpetas más fixtures", () => {
  it("existen todas y ninguna está vacía", () => {
    for (const sub of ["templates", "compose", "invariants", "blocks", "operations", "migrations", "fixtures"])
      expect(readdirSync(goldenDir(sub)).length).toBeGreaterThan(0);
  });

  it("el fixture base del reductor está emitido como dato (O-01)", () => {
    expect(readdirSync(goldenDir("fixtures"))).toContain("operations-base.json");
  });
});
