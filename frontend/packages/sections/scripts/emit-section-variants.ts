#!/usr/bin/env node
// packages/sections/scripts/emit-section-variants.ts — 04 §5.2 regla 4.
// `pnpm --filter @invitaciones/sections run emit:variants`, mismo patrón que
// `packages/schema/scripts/emit-json-schema.ts` (`node --experimental-strip-types`, cero
// dependencias nuevas). Importa SOLO `registry-data.ts` (sin JSX) — ver el comentario de cabecera
// de ese archivo para el porqué.
//
// DESVIACIÓN DE RUTA REGISTRADA (brief 3-2a §4, handoffs/3-2a.md): el contrato (04 §5.2 regla 4)
// dice que este script escribe `packages/schema/generated/section-variants.json`, pero
// `packages/schema` es de SOLO LECTURA para este agente. Escribe aquí, en
// `packages/sections/generated/`, con la MISMA forma exacta que pide el contrato
// (`{ [sectionType]: string[] }`) — la integración decide si mueve el archivo o cambia
// OUTPUT_PATH de vuelta a `../../schema/generated/section-variants.json` (una sola constante).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTION_REGISTRY_DATA } from "../src/registry-data.ts";

const here = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(here, "../generated/section-variants.json");

function main(): void {
  const out: Record<string, string[]> = {};
  for (const sectionType of Object.keys(SECTION_REGISTRY_DATA).sort()) {
    out[sectionType] = [...SECTION_REGISTRY_DATA[sectionType as keyof typeof SECTION_REGISTRY_DATA].supportedVariants];
  }
  const json = `${JSON.stringify(out, null, 2)}\n`;
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, json, "utf8");
  console.log(`section-variants.json escrito en ${OUTPUT_PATH}`);
}

main();
