// packages/schema/test/migrations.contract.test.ts — golden/migrations/ (ver golden/README.md:
// 0 pares antes/despues-esperado en esta fase, justificado; sí se prueba la forma de las 11 MigrationOp).
import { describe, it, expect } from "vitest";
import { MigrationOp } from "../src/manifest.ts";
import { loadCases } from "./golden.ts";

type OpShapeCase = { name: string; op: unknown; expectZodValid: boolean };

const REQUIRED_OPS = [
  "renameBlock", "removeBlock", "addBlock", "renameSection", "removeSection", "renamePalette",
  "renameFontSet", "changeBlockType", "moveIntoGroup", "flattenGroup", "shrinkGroup",
];

describe("golden/migrations/op-shapes.cases.json", () => {
  const cases = loadCases<OpShapeCase>("migrations", "op-shapes.cases.json");

  it("cubre las 11 MigrationOp cerradas de 01 §6.2", () => {
    for (const op of REQUIRED_OPS) expect(cases.some(c => (c.op as any).op === op)).toBe(true);
  });

  for (const c of cases) {
    it(c.name, () => {
      expect(MigrationOp.safeParse(c.op).success).toBe(c.expectZodValid);
    });
  }
});
