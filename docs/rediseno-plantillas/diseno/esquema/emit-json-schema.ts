// packages/schema/scripts/emit-json-schema.ts — genera el JSON Schema (draft 2020-12) que valida Kotlin.
// Ejecutar: pnpm --filter @invitaciones/schema schema:emit   (CI falla si `git diff --exit-code` detecta deriva)
// Salida:
//   frontend/packages/schema/json-schema/templates2.schema.json   ← BUNDLE único con $defs (el que carga Kotlin)
//   frontend/packages/schema/json-schema/<nombre>.schema.json     ← puntero de una línea: {"$ref":"…#/$defs/<Id>"}
// Gradle lo incluye como recurso (sourceSets.main.resources.srcDir("frontend/packages/schema/json-schema"))
// y `templates2` lo carga con com.networknt:json-schema-validator. Nunca se copia a mano.
//
// POR QUÉ UN BUNDLE Y NO 10 ARCHIVOS AUTOCONTENIDOS (corrección de la ronda 1R, ver 01 §8):
// `z.toJSONSchema(schema)` en solitario NO produce `$defs` ni `$ref` — inserta cada subesquema en línea.
// Medido con zod@4.5.4: 10 archivos independientes = 469 KB (indentados) con el catálogo de 14 bloques
// repetido en 5 de ellos; el mismo contenido emitido desde un `z.registry()` = 80.7 KB con 42 `$ref`.
import { z } from "zod";
import { writeFileSync, mkdirSync } from "node:fs";
import { TemplateManifest, ThemeSpec, DefaultsFile, MigrationPlan } from "./manifest.ts";
import { InvitationDocument } from "./document.ts";
import { OperationBatch, EditProposal } from "./operations.ts";
import { ComposedDocument, BusinessSnapshot, CompositionReport } from "./composed.ts";
import { BlockValue, BlockSpec, ScalarValue, ScalarSpec, BlockRole } from "./blocks.ts";

const BASE = "https://invitaciones.evolutiondev.mx/schema/templates2.schema.json";

/** Subesquemas compartidos: existen en $defs para que los 10 esquemas raíz los referencien en vez de repetirlos. */
const COMPARTIDOS = { BlockRole, BlockValue, ScalarValue, BlockSpec, ScalarSpec };
/** Esquemas raíz: cada uno recibe además su propio archivo-puntero. */
const RAICES = {
  "template-manifest": TemplateManifest, "theme": ThemeSpec, "defaults": DefaultsFile,
  "migration-plan": MigrationPlan, "invitation-document": InvitationDocument,
  "operation-batch": OperationBatch, "edit-proposal": EditProposal,
  "composed-document": ComposedDocument, "business-snapshot": BusinessSnapshot,
  "composition-report": CompositionReport,
};
/** nombre-de-archivo → id dentro de $defs. */
const ID = (nombre: string) => nombre.split("-").map(s => s[0].toUpperCase() + s.slice(1)).join("");

const OUT = process.argv[2] ?? "json-schema";
mkdirSync(OUT, { recursive: true });

const reg = z.registry<{ id: string }>();
for (const [id, s] of Object.entries(COMPARTIDOS)) reg.add(s as z.ZodType, { id });
for (const [nombre, s] of Object.entries(RAICES)) reg.add(s as z.ZodType, { id: ID(nombre) });

// unrepresentable:"throw" NO detecta .refine(): por eso está prohibido por lint (06 §5.2), no por este script.
const emitido = z.toJSONSchema(reg, {
  target: "draft-2020-12", unrepresentable: "throw", io: "input",
  uri: (id) => `#/$defs/${id}`,
}) as { schemas: Record<string, unknown> };

// `uri` hace que Zod escriba `$id: "#/$defs/<Id>"` DENTRO de cada definición, y eso es un `$id` inválido
// (draft 2020-12 exige `^[^#]*#?$`): ajv rechaza el bundle entero con "schema is invalid". Se quita.
// Verificado con zod@4.5.4 + ajv@8.20.0 en la ronda 1R.
for (const def of Object.values(emitido.schemas)) delete (def as Record<string, unknown>).$id;

const bundle = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: BASE,
  $defs: emitido.schemas,
};
writeFileSync(`${OUT}/templates2.schema.json`, JSON.stringify(bundle, null, 2) + "\n");
console.log(`wrote ${OUT}/templates2.schema.json (${Object.keys(emitido.schemas).length} definiciones)`);

for (const nombre of Object.keys(RAICES)) {
  const puntero = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://invitaciones.evolutiondev.mx/schema/${nombre}.schema.json`,
    $ref: `${BASE}#/$defs/${ID(nombre)}`,
  };
  writeFileSync(`${OUT}/${nombre}.schema.json`, JSON.stringify(puntero, null, 2) + "\n");
  console.log(`wrote ${OUT}/${nombre}.schema.json -> #/$defs/${ID(nombre)}`);
}
