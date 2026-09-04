// packages/schema/test/operation-batches.contract.test.ts — golden/fixtures/operations-batches.json.
// Resolución de `tempId` DENTRO del lote y política todo-o-nada del editor humano (01 §6.5, ADR-014).
// Viven en `golden/fixtures/` para no alterar el recuento contractual de 11 ficheros de
// `golden/operations/` (contratos.md §6). La misma tabla la ejecuta Kotlin.
import { describe, it, expect } from "vitest";
import { Operation } from "../src/operations.ts";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { applyBatch, type AssetMeta, type ReducerContext } from "../src/operations-reducer.ts";
import type { TemplatePackage } from "../src/compose.ts";
import { loadJson } from "./golden.ts";

type Base = { manifest: unknown; theme: unknown; defaults: unknown; documento: unknown; assetMeta: Record<string, AssetMeta> };
type Lotes = { ulidsDelLote: string[]; casos: Array<{ name: string; descripcion: string; operations: unknown[]; expect: unknown }> };

const base = loadJson<Base>("fixtures/operations-base.json");
const lotes = loadJson<Lotes>("fixtures/operations-batches.json");
const pkg: TemplatePackage = {
  manifest: TemplateManifest.parse(base.manifest),
  theme: ThemeSpec.parse(base.theme),
  defaults: DefaultsFile.parse(base.defaults),
};
const documento = InvitationDocument.parse(base.documento);

describe("golden/fixtures/operations-batches.json", () => {
  for (const c of lotes.casos) {
    it(`${c.name} — ${c.descripcion}`, () => {
      let n = 0;
      const ctx: ReducerContext = {
        pkg, newUlid: () => lotes.ulidsDelLote[n++]!, assetMeta: (id: string) => base.assetMeta[id] ?? null,
      };
      const ops = c.operations.map(o => {
        const r = Operation.safeParse(o);
        expect(r.success).toBe(true);
        return (r as { data: Operation }).data;
      });
      expect(applyBatch(documento, ops, ctx)).toEqual(c.expect);
    });
  }

  it("el documento de entrada NO se muta (el reductor es puro)", () => {
    const antes = JSON.stringify(documento);
    for (const c of lotes.casos) {
      let n = 0;
      const ctx: ReducerContext = { pkg, newUlid: () => lotes.ulidsDelLote[n++]!, assetMeta: () => null };
      applyBatch(documento, c.operations.map(o => Operation.parse(o)), ctx);
    }
    expect(JSON.stringify(documento)).toBe(antes);
  });
});
