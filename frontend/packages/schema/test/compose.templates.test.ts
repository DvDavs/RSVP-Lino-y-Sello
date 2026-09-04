// packages/schema/test/compose.templates.test.ts — golden/templates/: compose() debe reproducir
// compuesto.json/reporte.json byte-a-byte (R9, 01 §5.2) y ser idempotente. Prueba de solo lectura
// (no reescribe golden/; ver scripts/gen-golden-templates.ts para el generador).
import { describe, it, expect } from "vitest";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { compose, canonicalJson, type TemplatePackage } from "../src/compose.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";
import { listDirs, loadJson } from "./golden.ts";

const cdnUrl = (id: string): string => `https://cdn.invitaciones.evolutiondev.mx/a/${id.slice(3)}.webp`;
function collectAssetIds(...roots: unknown[]): Set<string> {
  const ids = new Set<string>();
  const walk = (n: unknown) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n === null || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.assetId === "string") ids.add(o.assetId);
    for (const v of Object.values(o)) walk(v);
  };
  roots.forEach(walk);
  return ids;
}

for (const dir of listDirs("templates")) {
  describe(`golden/templates/${dir}`, () => {
    const manifest = TemplateManifest.parse(loadJson(`templates/${dir}/template.json`));
    const theme = ThemeSpec.parse(loadJson(`templates/${dir}/theme.json`));
    const defaults = DefaultsFile.parse(loadJson(`templates/${dir}/defaults.json`));
    const doc = InvitationDocument.parse(loadJson(`templates/${dir}/documento.json`));
    const business = loadJson<BusinessSnapshot>(`templates/${dir}/business.json`);
    const assets: AssetIndex = {};
    for (const id of collectAssetIds(doc.content, defaults.content)) assets[id] = { url: cdnUrl(id) };
    const pkg: TemplatePackage = { manifest, theme, defaults };

    it("reproduce compuesto.json byte a byte", () => {
      const result = compose(pkg, doc, business, assets, doc.meta.locale);
      const expected = loadJson(`templates/${dir}/compuesto.json`);
      expect(result.composed).toEqual(expected);
    });

    it("reproduce reporte.json byte a byte", () => {
      const result = compose(pkg, doc, business, assets, doc.meta.locale);
      const expected = loadJson(`templates/${dir}/reporte.json`);
      expect(result.report).toEqual(expected);
    });

    it("es idempotente: dos llamadas producen el mismo canonicalJson", () => {
      const a = compose(pkg, doc, business, assets, doc.meta.locale);
      const b = compose(pkg, doc, business, assets, doc.meta.locale);
      expect(canonicalJson(a)).toBe(canonicalJson(b));
    });
  });
}
