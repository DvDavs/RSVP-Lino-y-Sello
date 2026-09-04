// packages/schema/test/invariants.contract.test.ts — corre golden/invariants/*.json contra las
// funciones reales de src/invariants.ts (06 §4). Kotlin corre el mismo fichero por su lado.
import { describe, it, expect } from "vitest";
import {
  validateManifest, validateDocument, validateValueAgainstSpec, validateReorder, assertNoReservedKeys,
  type Violation,
} from "../src/invariants.ts";
import { listCases, loadCases } from "./golden.ts";

type AnyCase = { name: string; fn: string; expect: string[]; [k: string]: unknown };

const codesOf = (vs: Violation[]): string[] => [...vs.map(v => v.code)].sort();

function run(c: AnyCase): string[] {
  switch (c.fn) {
    case "validateValueAgainstSpec":
      return codesOf(validateValueAgainstSpec(c.spec as any, c.input as any, c.path as string));
    case "validateManifest":
      return codesOf(validateManifest(c.manifest as any, c.theme as any, c.defaults as any));
    case "validateDocument":
      return codesOf(validateDocument(c.doc as any, c.manifest as any, c.theme as any));
    case "validateReorder":
      return codesOf(validateReorder(c.order as string[], c.actuales as string[]));
    case "assertNoReservedKeys":
      return codesOf(assertNoReservedKeys(c.raw));
    default:
      throw new Error(`fn desconocida en golden/invariants: ${c.fn}`);
  }
}

describe("golden/invariants", () => {
  for (const file of listCases("invariants")) {
    const cases = loadCases<AnyCase>("invariants", file);
    describe(file, () => {
      for (const c of cases) {
        it(c.name, () => {
          expect(run(c)).toEqual([...c.expect].sort());
        });
      }
    });
  }
});
