// packages/schema/test/compose.golden.test.ts — golden/compose/*.case.json.
// Cada caso ejercita una rama concreta de R1-R9 que los dos golden de `golden/templates/` NO cubren
// (objeción O-10). La misma tabla la ejecuta Kotlin: por eso son casos golden y no pruebas TS sueltas.
import { describe, it, expect } from "vitest";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { compose, canonicalJson, type TemplatePackage } from "../src/compose.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";
import type { Locale } from "../src/common.ts";
import { listCases, loadJson } from "./golden.ts";

type Caso = {
  name: string; descripcion: string;
  manifest: unknown; theme: unknown; defaults: unknown; documento: unknown;
  business: BusinessSnapshot; assets: AssetIndex; locale: Locale;
  compuesto: unknown; reporte: unknown;
};

const ficheros = listCases("compose");

describe("golden/compose — inventario", () => {
  it("hay casos y todos terminan en .case.json", () => {
    expect(ficheros.length).toBeGreaterThan(0);
    for (const f of ficheros) expect(f.endsWith(".case.json")).toBe(true);
  });

  it("cubre las ramas que la revisión 2-0a-REV señaló sin probar (O-10)", () => {
    const nombres = ficheros.join(" ");
    for (const marca of ["r8-fallback", "r1c-", "r2-tres-escalones", "r4-negocio", "r6-formatos", "r7-grupos", "kinds-", "o12-"])
      expect(nombres).toContain(marca);
  });
});

for (const f of ficheros) {
  const c = loadJson<Caso>(`compose/${f}`);
  describe(`golden/compose/${f}`, () => {
    const pkg: TemplatePackage = {
      manifest: TemplateManifest.parse(c.manifest),
      theme: ThemeSpec.parse(c.theme),
      defaults: DefaultsFile.parse(c.defaults),
    };
    const doc = InvitationDocument.parse(c.documento);

    it(c.descripcion, () => {
      const r = compose(pkg, doc, c.business, c.assets, c.locale);
      expect(r.composed).toEqual(c.compuesto);
      expect(r.report).toEqual(c.reporte);
    });

    it("es idempotente y determinista (R9)", () => {
      const a = compose(pkg, doc, c.business, c.assets, c.locale);
      const b = compose(pkg, doc, c.business, c.assets, c.locale);
      expect(canonicalJson(a)).toBe(canonicalJson(b));
    });
  });
}
