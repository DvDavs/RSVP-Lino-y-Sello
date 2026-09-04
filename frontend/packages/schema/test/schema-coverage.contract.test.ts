// packages/schema/test/schema-coverage.contract.test.ts — 06 §5.3: cada caso se corre contra Zod
// Y contra el JSON Schema emitido (Ajv 2020), y ambos deben coincidir en el veredicto. Es la prueba
// que detecta un `.refine()`/`.transform()` colado (Zod diría inválido, el JSON Schema válido).
//
// ALCANCE (registrado en preguntas-abiertas.md, 2-0a): `@invitaciones/schema` exporta ~70 esquemas
// Zod individuales (uno por tipo de valor/spec/etc. en common.ts/blocks.ts/...). El JSON Schema
// emitido solo HOSPEDA como `$defs` independientes los 15 que `emit-json-schema.ts` registra
// explícitamente (COMPARTIDOS + RAICES) — son exactamente los que cruzan a Kotlin vía
// `json-schema-validator` (contratos.md §5). Esta prueba cubre esos 15 con al menos un caso válido
// y uno inválido reales (reusando golden/ existente o corrompiendo un clon de forma documentada,
// nunca inventando un veredicto). Cubrir además los ~55 esquemas primitivos/intermedios que NO se
// hospedan de forma independiente (se inlinean dentro de estos 15) queda pendiente de una fase
// posterior si se decide emitirlos también como `$defs` propios.
// Import con nombre, no por defecto: bajo NodeNext + verbatimModuleSyntax, el default-import de
// `ajv/dist/2020.js` (paquete CJS sin "type":"module") tipa mal ("no construct signatures") aunque
// funciona en runtime — verificado en la bitácora de 2-0a. `Ajv2020` también se exporta con nombre.
// No hace falta ajv-formats: el bundle emitido no usa ninguna palabra clave `format` (verificado con
// grep sobre json-schema/templates2.schema.json — HttpUrl es un patrón propio, no `.url()` de Zod).
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  BlockValue, ScalarValue, BlockSpec, ScalarSpec, BlockRole,
} from "../src/blocks.ts";
import { TemplateManifest, ThemeSpec, DefaultsFile, MigrationPlan } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { OperationBatch, EditProposal } from "../src/operations.ts";
import { ComposedDocument, BusinessSnapshot, CompositionReport } from "../src/composed.ts";
import { loadJson, listDirs, loadCases } from "./golden.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const bundle = JSON.parse(readFileSync(HERE + "../json-schema/templates2.schema.json", "utf8"));
const ajv = new Ajv2020({ strict: false });
ajv.addSchema(bundle);
const validatorFor = (defName: string) => ajv.getSchema(`${bundle.$id}#/$defs/${defName}`)
  ?? ajv.compile({ $ref: `${bundle.$id}#/$defs/${defName}` });

const clone = <T>(v: T): T => structuredClone(v);
const drop = <T extends object>(v: T, key: keyof T): T => { const c = clone(v); delete (c as any)[key]; return c; };

type Sample = { name: string; value: unknown; valid: boolean };

function agree(defName: string, zodSchema: { safeParse: (v: unknown) => { success: boolean } }, samples: Sample[]) {
  const validate = validatorFor(defName);
  describe(`$defs/${defName}`, () => {
    for (const s of samples) {
      it(`${s.valid ? "válido" : "inválido"}: ${s.name}`, () => {
        const zr = zodSchema.safeParse(s.value).success;
        const ar = validate!(s.value) as boolean;
        expect(zr).toBe(s.valid);
        expect(ar).toBe(s.valid); // si difiere de zr, Zod y el JSON Schema discrepan (ADR-005)
      });
    }
  });
}

const templateDirs = listDirs("templates");
const manifests = templateDirs.map(d => loadJson(`templates/${d}/template.json`));
const themes = templateDirs.map(d => loadJson(`templates/${d}/theme.json`));
const defaultsFiles = templateDirs.map(d => loadJson(`templates/${d}/defaults.json`));
const documentos = templateDirs.map(d => loadJson(`templates/${d}/documento.json`));
const compuestos = templateDirs.map(d => loadJson(`templates/${d}/compuesto.json`));
const negocios = templateDirs.map(d => loadJson(`templates/${d}/business.json`));
const reportes = templateDirs.map(d => loadJson(`templates/${d}/reporte.json`));

const blockValues = ["text", "image", "group"].map(k => loadCases<{ tag: string; value: unknown }>("blocks", `${k}.cases.json`));
const validBlockValue = blockValues[0]!.find(c => c.tag === "P")!.value;
const invalidBlockValue = blockValues[0]!.find(c => c.tag === "N-shape")!.value;
const validScalarValue = blockValues[1]!.find(c => c.tag === "P")!.value; // image: es ScalarValue (no group)

const opCases = loadCases<{ tag: string; operation: unknown }>("operations", "setBlock.cases.json");
const validOp = opCases.find(c => c.tag === "valid-shape")!.operation;
const invalidOp = opCases.find(c => c.tag === "invalid-shape")!.operation;

const migOpCases = loadCases<{ op: unknown; expectZodValid: boolean }>("migrations", "op-shapes.cases.json");
const validMigOp = migOpCases.find(c => c.expectZodValid)!.op;
const invalidMigOp = migOpCases.find(c => !c.expectZodValid)!.op;

agree("BlockRole", BlockRole, [
  { name: "coverTitle (rol real del catálogo)", value: "coverTitle", valid: true },
  { name: "rol inventado", value: "noEsUnRol", valid: false },
]);

agree("BlockValue", BlockValue, [
  { name: "TextValue P", value: validBlockValue, valid: true },
  { name: "text sin value (N-shape)", value: invalidBlockValue, valid: false },
]);

agree("ScalarValue", ScalarValue, [
  { name: "ImageValue P", value: validScalarValue, valid: true },
  { name: "GroupValue (excluido de ScalarValue)", value: { kind: "group", items: [] }, valid: false },
]);

agree("BlockSpec", BlockSpec, [
  { name: "spec de un caso real de golden/invariants", value: loadCases<{ spec: unknown }>("invariants", "I-01-range-end-before-start.json")[0]!.spec, valid: true },
  { name: "spec sin id", value: drop(loadCases<{ spec: any }>("invariants", "I-01-range-end-before-start.json")[0]!.spec, "id"), valid: false },
]);

agree("ScalarSpec", ScalarSpec, [
  { name: "spec de choice (escalar)", value: loadCases<{ spec: unknown }>("blocks", "choice.cases.json")[0]!.spec, valid: true },
  { name: "spec de group (NO es escalar)", value: loadCases<{ spec: unknown }>("blocks", "group.cases.json")[0]!.spec, valid: false },
]);

agree("TemplateManifest", TemplateManifest, [
  { name: `${templateDirs[0]}/template.json`, value: manifests[0], valid: true },
  { name: "sin slug", value: drop(manifests[0] as any, "slug"), valid: false },
]);
agree("Theme", ThemeSpec, [
  { name: `${templateDirs[0]}/theme.json`, value: themes[0], valid: true },
  { name: "sin palettes", value: drop(themes[0] as any, "palettes"), valid: false },
]);
agree("Defaults", DefaultsFile, [
  { name: `${templateDirs[0]}/defaults.json`, value: defaultsFiles[0], valid: true },
  { name: "sin templateSlug", value: drop(defaultsFiles[0] as any, "templateSlug"), valid: false },
]);
agree("InvitationDocument", InvitationDocument, [
  { name: `${templateDirs[0]}/documento.json`, value: documentos[0], valid: true },
  { name: "sin schemaVersion", value: drop(documentos[0] as any, "schemaVersion"), valid: false },
]);
agree("ComposedDocument", ComposedDocument, [
  { name: `${templateDirs[0]}/compuesto.json`, value: compuestos[0], valid: true },
  { name: "sin sections", value: drop(compuestos[0] as any, "sections"), valid: false },
]);
agree("BusinessSnapshot", BusinessSnapshot, [
  { name: `${templateDirs[0]}/business.json`, value: negocios[0], valid: true },
  { name: "sin eventKind", value: drop(negocios[0] as any, "eventKind"), valid: false },
]);
agree("CompositionReport", CompositionReport, [
  { name: `${templateDirs[0]}/reporte.json`, value: reportes[0], valid: true },
  { name: "sin missingRequired", value: drop(reportes[0] as any, "missingRequired"), valid: false },
]);

agree("MigrationPlan", MigrationPlan, [
  { name: "envuelve un MigrationOp válido de golden/migrations", value: { templateSlug: "fixture-tpl", from: "1.0.0", to: "1.1.0", ops: [validMigOp] }, valid: true },
  { name: "envuelve un MigrationOp inválido", value: { templateSlug: "fixture-tpl", from: "1.0.0", to: "1.1.0", ops: [invalidMigOp] }, valid: false },
]);

agree("OperationBatch", OperationBatch, [
  { name: "envuelve un Operation válido de golden/operations", value: { baseRevision: 0, clientBatchId: "abcdefgh", operations: [validOp] }, valid: true },
  { name: "envuelve un Operation inválido", value: { baseRevision: 0, clientBatchId: "abcdefgh", operations: [invalidOp] }, valid: false },
]);

agree("EditProposal", EditProposal, [
  { name: "propuesta válida (≤10 operaciones, 1 sección)", value: { sectionKey: "cover", rationale: "porque sí", operations: [validOp] }, valid: true },
  { name: "sin operations", value: { sectionKey: "cover", rationale: "porque sí" }, valid: false },
]);
