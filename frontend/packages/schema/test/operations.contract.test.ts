// packages/schema/test/operations.contract.test.ts — golden/operations/*.cases.json (contratos.md §3/§6:
// 11 operaciones, clearItemBlock incluida — ADR-1R-X-01).
//
// Desde 2-2 esta prueba ya no comprueba solo la FORMA: ejecuta el reductor real y el validador real
// contra el fixture base emitido en `golden/fixtures/operations-base.json` (objeción O-01: antes
// `expectManifestError` no lo verificaba NADIE en ninguno de los dos lados).
import { describe, it, expect } from "vitest";
import { Operation } from "../src/operations.ts";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { applyOperation, type AssetMeta, type ReducerContext } from "../src/operations-reducer.ts";
import { validateOperations } from "../src/operations-validate.ts";
import type { TemplatePackage } from "../src/compose.ts";
import { listCases, loadCases, loadJson } from "./golden.ts";

const EXPECTED_OPS = [
  "setBlock", "clearBlock", "addItem", "removeItem", "moveItem", "setItemBlock", "clearItemBlock",
  "setSectionVisible", "setSectionVariant", "reorderSections", "setTheme",
];

type Base = {
  manifest: unknown; theme: unknown; defaults: unknown; documento: unknown;
  assetMeta: Record<string, AssetMeta>; ulidSeed: string;
};
const base = loadJson<Base>("fixtures/operations-base.json");
const manifest = TemplateManifest.parse(base.manifest);
const theme = ThemeSpec.parse(base.theme);
const defaults = DefaultsFile.parse(base.defaults);
const documento = InvitationDocument.parse(base.documento);
const pkg: TemplatePackage = { manifest, theme, defaults };
const ctx: ReducerContext = {
  pkg, newUlid: () => base.ulidSeed, assetMeta: (id: string) => base.assetMeta[id] ?? null,
};

type OpCase = {
  name: string; tag: string; operation: unknown; expectZodValid: boolean;
  expectOpViolations: string[]; reducerResult: unknown;
};

describe("golden/operations — inventario y fixture", () => {
  it("11 ficheros (contratos.md §3: 11, no 10)", () => {
    expect(EXPECTED_OPS.length).toBe(11);
    expect(listCases("operations")).toEqual(EXPECTED_OPS.map(op => `${op}.cases.json`).sort());
  });

  it("el fixture base es DATO válido contra el esquema (O-01)", () => {
    expect(manifest.slug).toBe("fixture-tpl");
    expect(Object.keys(base.assetMeta).length).toBeGreaterThan(0);
    expect(base.ulidSeed).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});

/**
 * I-01 (`issues-fase-3.md`, H-ADV-01 de `handoffs/3-adv.md`): un `RichSpan` con `marks` tiene que
 * pasar por el REDUCTOR, no sólo por el validador de esquema. Hasta la fase 3-B `marks` únicamente
 * aparecía en `golden/blocks/richText.cases.json` —casos de esquema que nunca llegan al codificador—,
 * así que escribir negrita o cursiva devolvía `500 TPL_INTERNAL` con 2 390 pruebas en verde.
 *
 * El caso vive en `golden/operations/setBlock.cases.json` y lo consume el bucle de abajo en TS y
 * `OperationReducerGoldenTest` en Kotlin. Esta prueba lo ANCLA: si alguien lo quita del generador,
 * falla aquí en vez de desaparecer en silencio (que es exactamente cómo se coló el defecto).
 */
describe("golden/operations — richText con marks pasa por el reductor (I-01)", () => {
  const casos = loadCases<OpCase>("operations", "setBlock.cases.json");
  const conMarcas = casos.filter(c => JSON.stringify(c.operation).includes('"marks"'));

  it("hay al menos un caso de setBlock con marks", () => {
    expect(conMarcas.length).toBeGreaterThan(0);
  });

  it("el documento que devuelve el reductor conserva bold, italic, las dos juntas y el href", () => {
    for (const c of conMarcas) {
      const r = c.reducerResult as { ok: boolean; doc: unknown };
      expect(r.ok).toBe(true);
      const spans = JSON.stringify(r.doc);
      expect(spans).toContain('"marks":["bold"]');
      expect(spans).toContain('"marks":["italic"]');
      expect(spans).toContain('"marks":["bold","italic"]');
      expect(spans).toContain('"href":"https://ejemplo.mx/mapa"');
    }
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
        if (!zr.success) { expect(c.reducerResult).toBeNull(); return; }
        expect(validateOperations([zr.data], manifest, theme, documento, { aiOnly: false }).map(v => v.code))
          .toEqual(c.expectOpViolations);
        expect(applyOperation(documento, zr.data, ctx)).toEqual(c.reducerResult);
      });
    }
  });
}
