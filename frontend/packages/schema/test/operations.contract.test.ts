// packages/schema/test/operations.contract.test.ts — golden/operations/*.cases.json (contratos.md §3/§6:
// 11 operaciones, clearItemBlock incluida — ADR-1R-X-01).
import { describe, it, expect } from "vitest";
import { Operation } from "../src/operations.ts";
import { listCases, loadCases } from "./golden.ts";

const EXPECTED_OPS = [
  "setBlock", "clearBlock", "addItem", "removeItem", "moveItem", "setItemBlock", "clearItemBlock",
  "setSectionVisible", "setSectionVariant", "reorderSections", "setTheme",
];

type OpCase = { name: string; tag: string; operation: unknown; expectZodValid: boolean; expectManifestError: string | null };

describe("golden/operations — inventario", () => {
  it("11 ficheros (contratos.md §3: 11, no 10)", () => {
    expect(EXPECTED_OPS.length).toBe(11);
    expect(listCases("operations")).toEqual(EXPECTED_OPS.map(op => `${op}.cases.json`).sort());
  });
});

for (const op of EXPECTED_OPS) {
  describe(`golden/operations/${op}.cases.json`, () => {
    const cases = loadCases<OpCase>("operations", `${op}.cases.json`);

    it("trae valid-shape, invalid-shape e invalid-manifest", () => {
      for (const tag of ["valid-shape", "invalid-shape", "invalid-manifest"])
        expect(cases.some(c => c.tag === tag)).toBe(true);
    });

    for (const c of cases) {
      it(`${c.tag}: ${c.name}`, () => {
        const zr = Operation.safeParse(c.operation);
        expect(zr.success).toBe(c.expectZodValid);
      });
    }
  });
}
