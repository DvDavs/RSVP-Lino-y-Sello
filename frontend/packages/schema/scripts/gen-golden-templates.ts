// packages/schema/scripts/gen-golden-templates.ts — golden/templates/<slug>-<version>/
// Ejecuta compose() DE VERDAD sobre los dos ejemplos completos de diseno/ejemplos/ (contratos.md §3)
// y escribe su salida como golden (ADR-1R-D-09: el golden ES la salida de compose, nunca se teclea).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { compose, type TemplatePackage } from "../src/compose.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const EJEMPLOS = HERE + "../../../../docs/rediseno-plantillas/diseno/ejemplos/";
const OUT = HERE + "../golden/templates/";

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

/**
 * URL de CDN determinista a partir del assetId: la misma regla usada para producir los
 * `compuesto.json` de referencia de la ronda 1R (verificado por igualdad byte a byte más abajo).
 */
const cdnUrl = (id: string): string => `https://cdn.invitaciones.evolutiondev.mx/a/${id.slice(3)}.webp`;

/** Recorre content/defaults (incluidos los items de grupo) y recoge todo assetId referenciado. */
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

function buildAssetIndex(ids: Set<string>): AssetIndex {
  const idx: AssetIndex = {};
  for (const id of ids) idx[id] = { url: cdnUrl(id) };
  return idx;
}

type CaseDef = { dir: string; business: BusinessSnapshot };

const CASES: CaseDef[] = [
  {
    dir: "boda-clasica-1.0.0",
    // Valores literales de docs/rediseno-plantillas/diseno/ejemplos/boda-clasica-1.0.0/NOTAS.md
    // ("BusinessSnapshot asumido"). Es el que produjo el compuesto.json ya verificado en la ronda 1R.
    business: {
      invitationId: 4821, date: "2026-12-12", time: "16:30", hashtag: "#CamilaYAntonio2026",
      coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "wedding",
      planTier: 2, timezone: "America/Mexico_City",
    },
  },
  {
    dir: "xv-jardin-1.0.0",
    // NOTAS.md de este ejemplo no fija un BusinessSnapshot explícito. Se reconstruye el único
    // campo que el manifiesto realmente consume (cover.date, source:business) a partir de la
    // fecha que ya aparece en compuesto.json (2026-11-14); el resto son valores conservadores
    // sin efecto observable (ningún otro bloque de esta plantilla es `source:"business"`).
    // Registrado como supuesto en memoria/preguntas-abiertas.md (2-0a).
    business: {
      invitationId: 5190, date: "2026-11-14", time: null, hashtag: null,
      coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "quince",
      planTier: 2, timezone: "America/Mexico_City",
    },
  },
];

export function genGoldenTemplates(): { dir: string; matched: boolean }[] {
  const results: { dir: string; matched: boolean }[] = [];
  for (const { dir, business } of CASES) {
    const src = EJEMPLOS + dir + "/";
    const manifest = TemplateManifest.parse(readJson(src + "template.json"));
    const theme = ThemeSpec.parse(readJson(src + "theme.json"));
    const defaults = DefaultsFile.parse(readJson(src + "defaults.json"));
    const doc = InvitationDocument.parse(readJson(src + "documento.json"));

    const assets = buildAssetIndex(collectAssetIds(doc.content, defaults.content));
    const pkg: TemplatePackage = { manifest, theme, defaults };
    const result = compose(pkg, doc, business, assets, doc.meta.locale);

    // Autoverificación ANTES de escribir nada (revisión 2-0a-REV, objeción O-01): el golden de
    // referencia de la ronda 1R (`diseno/ejemplos/**/compuesto.json`) es inmutable y es la única
    // prueba independiente de que el AssetIndex y el BusinessSnapshot de arriba son correctos.
    // Si `compose()` regresara, escribir primero y avisar después dejaría el golden REESCRITO con
    // la salida errónea y `compose.templates.test.ts` seguiría en verde comparándose consigo mismo.
    // Por eso se lanza y no se escribe: ADR-1R-D-09 exige que el golden sea la salida verificada.
    const referencia = readFileSync(src + "compuesto.json", "utf8");
    const propio = JSON.stringify(result.composed, null, 2) + "\n";
    if (referencia !== propio)
      throw new Error(
        `golden/templates/${dir}: compose() ya NO reproduce diseno/ejemplos/${dir}/compuesto.json ` +
        `byte a byte. No se ha escrito ningún golden. Corrige compose()/AssetIndex/BusinessSnapshot, ` +
        `nunca el golden (ADR-1R-D-09).`);
    const matched = true;

    const outDir = OUT + dir + "/";
    mkdirSync(outDir, { recursive: true });
    writeJson(outDir + "template.json", manifest);
    writeJson(outDir + "theme.json", theme);
    writeJson(outDir + "defaults.json", defaults);
    writeJson(outDir + "documento.json", doc);
    writeJson(outDir + "business.json", business);
    writeJson(outDir + "compuesto.json", result.composed);
    writeJson(outDir + "reporte.json", result.report);

    results.push({ dir, matched });
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = genGoldenTemplates();
  for (const { dir, matched } of r) {
    console.log(`golden/templates/${dir}: ${matched ? "coincide byte a byte con diseno/ejemplos" : "NO coincide con diseno/ejemplos (ver consola)"}`);
  }
}
