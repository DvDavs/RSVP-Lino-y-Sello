// packages/schema/test/block-kinds.contract.test.ts — golden/blocks/*.cases.json contra BlockValue
// (Zod) y validateValueAgainstSpec (06 §5.2): 14 tipos, matriz de 6 casos obligatoria por tipo.
import { describe, it, expect } from "vitest";
import { BlockValue, BlockKind } from "../src/blocks.ts";
import { validateValueAgainstSpec } from "../src/invariants.ts";
import { listCases, loadCases } from "./golden.ts";

type Tag = "P" | "PM" | "N-kind" | "N-shape" | "N-limit" | "N-null" | "extra";
type BlockCase = { name: string; tag: Tag; spec: unknown; value: unknown; path: string; expectZodValid: boolean; expectViolations: string[] };

const REQUIRED_TAGS: Tag[] = ["P", "PM", "N-kind", "N-shape", "N-limit", "N-null"];

describe("golden/blocks — inventario", () => {
  it("14 ficheros, uno por BlockKind", () => {
    const files = listCases("blocks");
    expect(files).toEqual(BlockKind.options.map(k => `${k}.cases.json`).sort());
  });
});

for (const kind of BlockKind.options) {
  describe(`golden/blocks/${kind}.cases.json`, () => {
    const cases = loadCases<BlockCase>("blocks", `${kind}.cases.json`);

    it("trae los 6 casos obligatorios (P/PM/N-kind/N-shape/N-limit/N-null)", () => {
      for (const tag of REQUIRED_TAGS) expect(cases.some(c => c.tag === tag)).toBe(true);
    });

    for (const c of cases) {
      it(`${c.tag}: ${c.name}`, () => {
        const zr = BlockValue.safeParse(c.value);
        expect(zr.success).toBe(c.expectZodValid);
        if (zr.success && c.spec) {
          const got = validateValueAgainstSpec(c.spec as any, c.value as any, c.path).map(v => v.code).sort();
          expect(got).toEqual([...c.expectViolations].sort());
        }
      });
    }
  });
}
