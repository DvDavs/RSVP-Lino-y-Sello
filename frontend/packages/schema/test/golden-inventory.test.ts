// packages/schema/test/golden-inventory.test.ts — inventario de golden/templates/ (06 §3: la
// prueba de inventario complementaria a invariant-catalog/block-kinds/operations, que ya cubren sus
// propias subcarpetas). Falla si una carpeta de plantilla pierde alguno de sus 7 ficheros.
import { describe, it, expect } from "vitest";
import { listDirs, goldenDir } from "./golden.ts";
import { readdirSync } from "node:fs";

const EXPECTED_TEMPLATE_DIRS = ["boda-clasica-1.0.0", "xv-jardin-1.0.0"];
const EXPECTED_FILES = ["template.json", "theme.json", "defaults.json", "documento.json", "business.json", "compuesto.json", "reporte.json"].sort();

describe("golden/templates — inventario", () => {
  it("exactamente las 2 plantillas de ejemplo (contratos.md §3)", () => {
    expect(listDirs("templates")).toEqual([...EXPECTED_TEMPLATE_DIRS].sort());
  });

  for (const dir of EXPECTED_TEMPLATE_DIRS) {
    it(`${dir}: los 7 ficheros`, () => {
      const files = readdirSync(goldenDir("templates") + "/" + dir).sort();
      expect(files).toEqual(EXPECTED_FILES);
    });
  }
});
