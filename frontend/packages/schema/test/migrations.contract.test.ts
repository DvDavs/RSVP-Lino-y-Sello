// packages/schema/test/migrations.contract.test.ts — golden/migrations/.
// Desde 2-2 hay pares antes/después REALES (sintetizados con código, ADR-1R-D-09 lo permite: prohíbe
// escribirlos a mano, no sintetizarlos), los cinco MigrationError y un caso de switchTemplate.
import { describe, it, expect } from "vitest";
import { MigrationOp, TemplateManifest, ThemeSpec, DefaultsFile, type MigrationPlan } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { migrate, switchTemplate } from "../src/migrate.ts";
import type { TemplatePackage } from "../src/compose.ts";
import { loadCases, loadJson } from "./golden.ts";

type OpShapeCase = { name: string; op: unknown; expectZodValid: boolean };

const REQUIRED_OPS = [
  "renameBlock", "removeBlock", "addBlock", "renameSection", "removeSection", "renamePalette",
  "renameFontSet", "changeBlockType", "moveIntoGroup", "flattenGroup", "shrinkGroup",
];

const paquete = (dir: string, prefijo: string): TemplatePackage => ({
  manifest: TemplateManifest.parse(loadJson(`migrations/${dir}/${prefijo}-template.json`)),
  theme: ThemeSpec.parse(loadJson(`migrations/${dir}/${prefijo}-theme.json`)),
  defaults: DefaultsFile.parse(loadJson(`migrations/${dir}/${prefijo}-defaults.json`)),
});

const indice = loadJson<{ migrate: string[]; switch: string[] }>("migrations/index.json");

describe("golden/migrations/op-shapes.cases.json", () => {
  const cases = loadCases<OpShapeCase>("migrations", "op-shapes.cases.json");

  it("cubre las 11 MigrationOp cerradas de 01 §6.2", () => {
    for (const op of REQUIRED_OPS) expect(cases.some(c => (c.op as { op: string }).op === op)).toBe(true);
  });

  for (const c of cases) {
    it(c.name, () => {
      expect(MigrationOp.safeParse(c.op).success).toBe(c.expectZodValid);
    });
  }
});

describe("golden/migrations — pares antes/después", () => {
  it("hay al menos un par (06 §3; cierra ADR-2-0a-03)", () => {
    expect(indice.migrate.length).toBeGreaterThan(0);
  });

  it("entre todos los pares se ejercitan las 11 operaciones de 01 §6.2", () => {
    const usadas = new Set<string>();
    for (const dir of indice.migrate)
      for (const o of loadJson<MigrationPlan>(`migrations/${dir}/plan.json`).ops) usadas.add(o.op);
    for (const op of REQUIRED_OPS) expect(usadas.has(op)).toBe(true);
  });

  for (const dir of indice.migrate) {
    describe(dir, () => {
      const from = paquete(dir, "from");
      const to = paquete(dir, "to");
      const plan = loadJson<MigrationPlan>(`migrations/${dir}/plan.json`);
      const antes = InvitationDocument.parse(loadJson(`migrations/${dir}/antes.json`));

      it("migrate() reproduce despues-esperado.json y reporte-esperado.json", () => {
        const r = migrate(antes, from, to, plan);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.doc).toEqual(loadJson(`migrations/${dir}/despues-esperado.json`));
        expect(r.report).toEqual(loadJson(`migrations/${dir}/reporte-esperado.json`));
      });

      it("es pura: dos llamadas dan el mismo resultado (01 §6.3)", () => {
        expect(JSON.stringify(migrate(antes, from, to, plan))).toBe(JSON.stringify(migrate(antes, from, to, plan)));
      });

      it("nada se borra: todo lo que sale de content está en el attic", () => {
        const r = migrate(antes, from, to, plan);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const key = `${from.manifest.slug}@${from.manifest.version}`;
        for (const t of r.report.toAttic) expect(r.doc.attic[key]![t.blockId]).toBeDefined();
      });
    });
  }
});

describe("golden/migrations/errors.cases.json — los cinco MigrationError", () => {
  const f = loadJson<{ from: unknown; to: unknown; casos: Array<{ name: string; plan: MigrationPlan; antes: unknown; expectError: unknown }> }>("migrations/errors.cases.json");
  const from: TemplatePackage = {
    manifest: TemplateManifest.parse((f.from as TemplatePackage).manifest),
    theme: ThemeSpec.parse((f.from as TemplatePackage).theme),
    defaults: DefaultsFile.parse((f.from as TemplatePackage).defaults),
  };
  const to: TemplatePackage = {
    manifest: TemplateManifest.parse((f.to as TemplatePackage).manifest),
    theme: ThemeSpec.parse((f.to as TemplatePackage).theme),
    defaults: DefaultsFile.parse((f.to as TemplatePackage).defaults),
  };

  for (const c of f.casos) {
    it(c.name, () => {
      const r = migrate(InvitationDocument.parse(c.antes), from, to, c.plan);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toEqual(c.expectError);
    });
  }
});

describe("golden/migrations/switch — switchTemplate (01 §6.4)", () => {
  for (const dir of indice.switch) {
    describe(dir, () => {
      const from = paquete(dir, "from");
      const to = paquete(dir, "to");
      const antes = InvitationDocument.parse(loadJson(`migrations/${dir}/antes.json`));

      it("reproduce despues-esperado.json y reporte-esperado.json", () => {
        const r = switchTemplate(antes, from, to);
        expect(r.doc).toEqual(loadJson(`migrations/${dir}/despues-esperado.json`));
        expect(r.report).toEqual(loadJson(`migrations/${dir}/reporte-esperado.json`));
      });

      it("ningún grupo se transporta (ADR-1R-D-07)", () => {
        const r = switchTemplate(antes, from, to);
        for (const [, v] of Object.entries(r.doc.content)) expect((v as { kind: string }).kind).not.toBe("group");
      });
    });
  }
});
