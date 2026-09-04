// packages/schema/test/invariant-catalog.contract.test.ts — falla si un código de InvariantCode entra
// sin fichero de casos en golden/invariants/, o si un fichero no trae al menos un caso que viola y
// uno que no (contratos.md §6, 06 §4.2).
import { describe, it, expect } from "vitest";
import type { InvariantCode } from "../src/invariants.ts";
import { listCases, loadCases } from "./golden.ts";

// Catálogo completo, mantenido a mano AQUÍ (no en src/invariants.ts, que no se toca en esta fase).
// La comprobación de tipo de abajo obliga a que este array sea EXACTAMENTE `InvariantCode`: si el
// código fuente gana un miembro que no está aquí, `tsc --noEmit --strict` deja de compilar.
const ALL_CODES = [
  "I-01_RANGE_END_BEFORE_START", "I-02_CHOICE_UNKNOWN_OPTION", "I-03_ITEM_ID_DUPLICATE",
  "I-04_GROUP_SIZE_OUT_OF_BOUNDS", "I-05_BUSINESS_FIELD_MISSING", "I-06_BUSINESS_TYPE_MISMATCH",
  "I-07_GROUP_MIN_GT_MAX", "I-08_DEFAULT_VARIANT_UNKNOWN", "I-09_THEME_DEFAULT_UNKNOWN",
  "I-10_DEFAULT_KEY_UNKNOWN", "I-11_STRUCTURE_DUPLICATE_KEY", "I-12_CONTENT_KEY_UNKNOWN",
  "I-13_BLOCK_ID_DUPLICATE", "I-14_SECTION_KEY_DUPLICATE", "I-15_BLOCK_KIND_MISMATCH",
  "I-16_TEXT_TOO_LONG", "I-17_REQUIRED_SECTION_HIDDEN", "I-18_ITEM_BLOCK_UNKNOWN",
  "I-19_STRUCTURE_KEY_UNKNOWN", "I-20_THEME_ID_UNKNOWN", "I-21_BUSINESS_BLOCK_WRITTEN",
  "I-22_ITEM_BLOCK_SOURCE_NOT_USER", "I-23_LOCALE_NOT_SUPPORTED", "I-24_REORDER_NOT_A_PERMUTATION",
  "I-25_GROUP_ROLE_MISMATCH", "I-26_SINGLETON_ROLE_DUPLICATE", "I-27_LOCALIZED_TEXT_MISSING_LOCALE",
  "I-28_DEFAULT_FOR_BUSINESS_BLOCK", "I-29_RESERVED_OBJECT_KEY", "I-30_TEXT_MULTILINE_NOT_ALLOWED",
] as const satisfies readonly InvariantCode[];

// Exhaustividad en tiempo de compilación: si InvariantCode gana un miembro ausente de ALL_CODES,
// `_Missing` deja de ser `never` y esta línea deja de tipar.
type _Missing = Exclude<InvariantCode, (typeof ALL_CODES)[number]>;
const _assertNoMissingCode: [_Missing] extends [never] ? true : false = true;
void _assertNoMissingCode;

const filenameFor = (code: string): string => {
  const [num, ...rest] = code.split("_");
  return `${num}-${rest.join("_").toLowerCase().replace(/_/g, "-")}.json`;
};

describe("invariant-catalog", () => {
  it("tiene 30 códigos (contratos.md §3)", () => {
    expect(ALL_CODES.length).toBe(30);
  });

  it("golden/invariants/ no tiene ficheros huérfanos ni le faltan", () => {
    const onDisk = listCases("invariants");
    const expected = ALL_CODES.map(filenameFor).sort();
    expect(onDisk).toEqual(expected);
  });

  for (const code of ALL_CODES) {
    it(`${code}: tiene al menos un caso que viola y uno que no viola`, () => {
      const file = filenameFor(code);
      const cases = loadCases<{ expect: string[] }>("invariants", file);
      expect(cases.some(c => c.expect.length > 0)).toBe(true);
      expect(cases.some(c => c.expect.length === 0)).toBe(true);
    });
  }
});
