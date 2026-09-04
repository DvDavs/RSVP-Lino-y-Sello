// packages/sections/test/golden-c.ts — carga las secciones REALES de
// `packages/schema/golden/templates/boda-clasica-1.0.0/compuesto.json` (el golden de `compose()`
// de la fase 2, no un fixture escrito a mano) para las pruebas del bloque 3-2c. Sufijo "-c" a
// propósito, igual criterio que `test/harness-c/`: el agente de la mitad A del catálogo (3-2b)
// tiene su propio espacio (`-b`) y no lo tocamos, para no chocar en la integración.
//
// Mismo patrón que `test/registry.contract.test.ts` (lee `template.json` real de
// `frontend/templates/` en tiempo de prueba): aquí se lee el `compuesto.json` real de
// `packages/schema/golden/`, se valida con `.parse()` (nunca `as ComposedDocument` a ciegas) y se
// expone por `section.type` para que cada archivo de prueba pida exactamente la sección que
// necesita con datos reales de `boda-clasica@1.0.0`.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ComposedDocument } from "@invitaciones/schema";
import type { SectionType } from "@invitaciones/schema";
import type { ComposedSection, ResolvedTheme } from "../src/schema-types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = resolve(
  here,
  "../../schema/golden/templates/boda-clasica-1.0.0/compuesto.json",
);

function loadGolden() {
  const raw = JSON.parse(readFileSync(GOLDEN_PATH, "utf8"));
  return ComposedDocument.parse(raw);
}

let cached: ReturnType<typeof loadGolden> | null = null;
function golden() {
  cached ??= loadGolden();
  return cached;
}

/** Sección real de `boda-clasica@1.0.0`, tal cual la produce `compose()` (fase 2). */
export function goldenSection(type: SectionType): ComposedSection {
  const section = golden().sections.find((s) => s.type === type);
  if (section === undefined) {
    throw new Error(`golden-c.ts: boda-clasica-1.0.0/compuesto.json no tiene una sección "${type}"`);
  }
  return section as ComposedSection;
}

/** El tema real de `boda-clasica@1.0.0` (paleta "blush", ver preguntas-abiertas.md: no cumple AA
 *  en 2 de 5 parejas — dato real, no un fixture inventado, y no es de este bloque corregirlo). */
export function goldenTheme(): ResolvedTheme {
  return golden().theme as ResolvedTheme;
}
