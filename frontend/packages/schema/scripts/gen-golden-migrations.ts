// packages/schema/scripts/gen-golden-migrations.ts — golden/migrations/ (06 §3, "casos de migración
// de versión que puedas derivar de 01 §6").
//
// ALCANCE REAL DE ESTA FASE (2-0a) — documentado también en golden/README.md y en el handoff:
// `frontend/packages/schema/src/migrate.ts` (la función `migrate()`, 01 §6.1) NO es uno de los 10
// archivos que esta fase movió (no está en diseno/esquema/): implementarla es lógica de negocio del
// módulo templates2, fuera del alcance de 2-0a. Y de los DOS ejemplos completos disponibles
// (boda-clasica-1.0.0, xv-jardin-1.0.0) NINGUNO declara `migrationsFrom` (ambos: `[]`, verificado
// abajo en tiempo de generación) ni trae `migrations/*.json`, así que no hay un MigrationPlan real
// del que derivar un par antes/después.
//
// Por eso este generador entrega **0 pares `<slug>/<from>-to-<to>/{antes,despues-esperado}.json`**
// — no hay material para producirlos sin fabricar un plan y una plantilla origen ficticios, y
// ADR-1R-D-09 prohíbe justo eso (nunca a mano) — y SÍ entrega, con código real y autoverificado, la
// validación de FORMA de las 11 operaciones declarativas cerradas de `01 §6.2` / `manifest.ts`
// `MigrationOp`: `golden/migrations/op-shapes.cases.json`. La ejecución de `migrate()` contra estos
// casos queda para cuando exista `migrate.ts` (probablemente 2-0b o posterior).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MigrationOp, TemplateManifest } from "../src/manifest.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const EJEMPLOS = HERE + "../../../../docs/rediseno-plantillas/diseno/ejemplos/";
const OUT = HERE + "../golden/migrations/";
mkdirSync(OUT, { recursive: true });
const write = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

// Verificación en tiempo de generación de la afirmación de arriba (falla si deja de ser cierta).
for (const dir of ["boda-clasica-1.0.0", "xv-jardin-1.0.0"]) {
  const m = TemplateManifest.parse(JSON.parse(readFileSync(EJEMPLOS + dir + "/template.json", "utf8")));
  if (m.migrationsFrom.length !== 0)
    throw new Error(`${dir} SÍ declara migrationsFrom (${m.migrationsFrom.join(",")}) — actualizar este generador para derivar un caso real`);
}

type Case = { name: string; op: unknown; expectZodValid: boolean };
function opCase(name: string, op: unknown, expectZodValid: boolean): Case {
  const zr = MigrationOp.safeParse(op);
  if (zr.success !== expectZodValid) throw new Error(`${name}: esperaba zodValid=${expectZodValid}, obtuve ${zr.success}`);
  return { name, op, expectZodValid };
}

const cases: Case[] = [
  opCase("renameBlock: forma válida", { op: "renameBlock", from: "a.old", to: "a.new" }, true),
  opCase("renameBlock: falta to", { op: "renameBlock", from: "a.old" }, false),
  opCase("removeBlock: forma válida", { op: "removeBlock", id: "a.old" }, true),
  opCase("removeBlock: id con forma inválida de BlockId", { op: "removeBlock", id: "A-old!" }, false),
  opCase("addBlock: forma válida", { op: "addBlock", id: "a.new" }, true),
  opCase("addBlock: campo extra", { op: "addBlock", id: "a.new", value: "x" }, false),
  opCase("renameSection: forma válida", { op: "renameSection", from: "old", to: "new" }, true),
  opCase("renameSection: from con forma inválida de SectionKey", { op: "renameSection", from: "old-section", to: "new" }, false),
  opCase("removeSection: forma válida", { op: "removeSection", key: "old" }, true),
  opCase("removeSection: falta key", { op: "removeSection" }, false),
  opCase("renamePalette: forma válida", { op: "renamePalette", from: "olive", to: "sage" }, true),
  opCase("renamePalette: from mayúsculas (Ident es kebab minúscula)", { op: "renamePalette", from: "Olive", to: "sage" }, false),
  opCase("renameFontSet: forma válida", { op: "renameFontSet", from: "clasica", to: "moderna" }, true),
  opCase("renameFontSet: falta to", { op: "renameFontSet", from: "clasica" }, false),
  opCase("changeBlockType: forma válida", { op: "changeBlockType", id: "a.text", converterId: "textToRichText" }, true),
  opCase("changeBlockType: converterId fuera del catálogo cerrado de 4", { op: "changeBlockType", id: "a.text", converterId: "textToDate" }, false),
  opCase("moveIntoGroup: forma válida", { op: "moveIntoGroup", blockId: "a.old", groupId: "g.items", itemBlockId: "title" }, true),
  opCase("moveIntoGroup: falta itemBlockId", { op: "moveIntoGroup", blockId: "a.old", groupId: "g.items" }, false),
  opCase("flattenGroup: forma válida", { op: "flattenGroup", groupId: "g.items", itemBlockId: "title", toBlockId: "a.new" }, true),
  opCase("flattenGroup: falta toBlockId", { op: "flattenGroup", groupId: "g.items", itemBlockId: "title" }, false),
  opCase("shrinkGroup: forma válida", { op: "shrinkGroup", groupId: "g.items", max: 4 }, true),
  opCase("shrinkGroup: max fuera de rango (1..24)", { op: "shrinkGroup", groupId: "g.items", max: 0 }, false),
];

const requiredOps = [
  "renameBlock", "removeBlock", "addBlock", "renameSection", "removeSection", "renamePalette",
  "renameFontSet", "changeBlockType", "moveIntoGroup", "flattenGroup", "shrinkGroup",
];
for (const op of requiredOps) if (!cases.some(c => (c.op as any).op === op)) throw new Error(`falta MigrationOp ${op}`);

write(OUT + "op-shapes.cases.json", cases);
console.log(`golden/migrations: op-shapes.cases.json (${cases.length} casos, ${requiredOps.length} operaciones); 0 pares antes/despues-esperado (migrate() no existe aún en esta fase; ver comentario de cabecera)`);
