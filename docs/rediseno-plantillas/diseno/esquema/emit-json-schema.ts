// packages/schema/scripts/emit-json-schema.ts — genera los JSON Schema (draft 2020-12) que valida Kotlin.
// Ejecutar: pnpm --filter @invitaciones/schema schema:emit   (CI falla si `git diff --exit-code` detecta deriva)
// Salida: frontend/packages/schema/json-schema/<nombre>.schema.json — Gradle la incluye como recurso
// (sourceSets.main.resources.srcDir("frontend/packages/schema/json-schema")) → templates2 la carga con
// com.networknt:json-schema-validator. Nunca se copia a mano.
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { TemplateManifest, ThemeSpec, DefaultsFile, MigrationPlan } from "./manifest.ts";
import { InvitationDocument } from "./document.ts";
import { OperationBatch, EditProposal } from "./operations.ts";
import { ComposedDocument, BusinessSnapshot, CompositionReport } from "./composed.ts";

const OUT = process.argv[2] ?? "json-schema";
mkdirSync(OUT, { recursive: true });
const targets: Record<string, z.ZodType> = {
  "template-manifest": TemplateManifest, "theme": ThemeSpec, "defaults": DefaultsFile, "migration-plan": MigrationPlan,
  "invitation-document": InvitationDocument, "operation-batch": OperationBatch, "edit-proposal": EditProposal,
  "composed-document": ComposedDocument, "business-snapshot": BusinessSnapshot, "composition-report": CompositionReport,
};
for (const [name, schema] of Object.entries(targets)) {
  // unrepresentable:"throw" NO detecta .refine(): por eso está prohibido por lint (06 §5.2), no por este script.
  const json = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "throw", io: "input" });
  (json as any).$id = `https://invitaciones.evolutiondev.mx/schema/${name}.schema.json`;
  writeFileSync(`${OUT}/${name}.schema.json`, JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote ${OUT}/${name}.schema.json`);
}
