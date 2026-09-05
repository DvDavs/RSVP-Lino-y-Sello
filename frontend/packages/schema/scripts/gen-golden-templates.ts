// packages/schema/scripts/gen-golden-templates.ts — golden/templates/<slug>-<version>/
// Ejecuta compose() DE VERDAD sobre los dos ejemplos completos de diseno/ejemplos/ (contratos.md §3)
// y escribe su salida como golden (ADR-1R-D-09: el golden ES la salida de compose, nunca se teclea).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TemplateManifest, ThemeSpec, DefaultsFile } from "../src/manifest.ts";
import { InvitationDocument } from "../src/document.ts";
import { compose, type TemplatePackage } from "../src/compose.ts";
import type { AssetIndex, BusinessSnapshot } from "../src/composed.ts";
import {
  textSpec, richTextSpec, sectionSpec, themeFixture, manifestFixture, defaultsFixture,
  documentFixture, textValue, richTextValueMarcado,
} from "./fixtures.ts";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const EJEMPLOS = HERE + "../../../../docs/rediseno-plantillas/diseno/ejemplos/";
const OUT = HERE + "../golden/templates/";

const readJson = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

/**
 * URL de CDN determinista a partir del assetId: la misma regla usada para producir los
 * `compuesto.json` de referencia de la ronda 1R (verificado por igualdad byte a byte más abajo).
 *
 * **CONVENCIÓN DE FIXTURE, NO REGLA DE PRODUCCIÓN** (objeción O-06 de `bitacora/2-0a-REV.md`). En
 * producción `AssetUrlResolver` construye `"{templates2.assets.public-base-url}/{s3_key}"` a partir de
 * la columna `s3_key` de `tpl_asset` (`02 §10.4`): deriva de un dato almacenado, no del `assetId`.
 * Por eso el `AssetIndex` resultante se emite como DATO (`assets.json`) en cada carpeta de golden: así
 * el lado Kotlin reproduce `compuesto.json` sin conocer —ni poder copiar— esta convención (remedio
 * real que la revisión dejó pendiente; ADR-2-2-02).
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
  for (const id of [...ids].sort()) idx[id] = { url: cdnUrl(id) };   // ordenado: el golden es dato estable
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
    writeJson(outDir + "assets.json", assets);   // O-06: el AssetIndex es DATO del golden, no un .ts
    writeJson(outDir + "compuesto.json", result.composed);
    writeJson(outDir + "reporte.json", result.report);

    results.push({ dir, matched });
  }
  return results;
}

// ---------------------------------------------------------------------------------------------
// Caso SINTETIZADO — `richtext-marcas-1.0.0` (I-01).
//
// Los dos golden de arriba vienen de `diseno/ejemplos/`, y **ninguno de sus documentos lleva un solo
// `marks`**: hasta la fase 3-B `marks` sólo aparecía en `golden/blocks/richText.cases.json`, que es un
// fichero de casos de ESQUEMA y no pasa jamás por `DomainJson.encode`. Resultado medido (H-ADV-01):
// poner negrita o cursiva en el editor devolvía `500 TPL_INTERNAL` con 2 390 pruebas en verde.
//
// Este caso no puede salir de `diseno/ejemplos/` (esa carpeta es la referencia INMUTABLE de la ronda
// 1R y su `compuesto.json` no se toca), así que se SINTETIZA con los constructores de `fixtures.ts`
// y se compone con el `compose()` real. ADR-1R-D-09 prohíbe *escribir* golden a mano, no
// *sintetizarlos* — es el mismo camino que `gen-golden-compose.ts` y `gen-golden-migrations.ts`.
//
// Cubre las tres procedencias de un `richText` con marcas: `user` (story.body, en `content`),
// `default` (story.note, sólo en `defaults.json`) y un span con `href` además de `marks`.
// ---------------------------------------------------------------------------------------------
const DIR_MARCAS = "richtext-marcas-1.0.0";

export function genGoldenMarcas(): string {
  const theme = themeFixture();
  const manifest = manifestFixture(
    [
      sectionSpec("cover", "cover", [
        textSpec("cover.title", "coverTitle", { maxLength: 80, required: true }),
      ], { required: true }),
      sectionSpec("story", "story", [
        richTextSpec("story.body", "storyBody"),
        richTextSpec("story.note", "sectionIntro"),
      ]),
    ],
    { slug: "richtext-marcas", version: "1.0.0" },
  );

  const defaults = defaultsFixture(manifest, {
    "cover.title": textValue("Camila & Antonio"),
    // Escalón `default` (R2) con marcas: el codificador lo ve también por `defaults.json`.
    "story.note": richTextValueMarcado([
      [{ text: "Escribe aquí vuestra historia. " }, { text: "En cursiva", marks: ["italic"] }, { text: "." }],
    ]),
  });

  const documento = documentFixture(manifest, theme, {
    content: {
      "cover.title": textValue("Camila & Antonio"),
      // Escalón `user` (R2): exactamente la forma que emite el editor al teclear `**negrita**`
      // y `*cursiva*` (`apps/web/lib/rich-text.ts:43`), más un span con las dos marcas y otro con href.
      "story.body": richTextValueMarcado([
        [
          { text: "Nos conocimos en " },
          { text: "Oaxaca", marks: ["bold"] },
          { text: " un martes " },
          { text: "cualquiera", marks: ["italic"] },
          { text: "." },
        ],
        [
          { text: "Las dos marcas a la vez", marks: ["bold", "italic"] },
          { text: " y un enlace ", marks: [] },
          { text: "al mapa", href: "https://maps.example.com/oaxaca" },
        ],
        [],
      ]),
    },
  });

  const business: BusinessSnapshot = {
    invitationId: 9301, date: "2027-05-22", time: "18:00", hashtag: "#CamilaYAntonio",
    coverPhotoUrl: null, childrenAllowed: true, youngAllowed: true, eventKind: "generic",
    planTier: 1, timezone: "America/Mexico_City",
  };
  const assets: AssetIndex = {};   // este caso no referencia ningún asset: el foco es `marks`.

  // Las entradas se validan con el Zod real ANTES de componer: un golden sintetizado que no pase el
  // esquema sería un golden inválido, y aquí no hay `compuesto.json` de referencia que lo delate.
  const manifestOk = TemplateManifest.parse(manifest);
  const themeOk = ThemeSpec.parse(theme);
  const defaultsOk = DefaultsFile.parse(defaults);
  const docOk = InvitationDocument.parse(documento);

  const pkg: TemplatePackage = { manifest: manifestOk, theme: themeOk, defaults: defaultsOk };
  const r = compose(pkg, docOk, business, assets, docOk.meta.locale);
  const dos = compose(pkg, docOk, business, assets, docOk.meta.locale);
  if (JSON.stringify(r) !== JSON.stringify(dos)) throw new Error(`${DIR_MARCAS}: compose() no es idempotente`);

  const outDir = OUT + DIR_MARCAS + "/";
  mkdirSync(outDir, { recursive: true });
  writeJson(outDir + "template.json", manifestOk);
  writeJson(outDir + "theme.json", themeOk);
  writeJson(outDir + "defaults.json", defaultsOk);
  writeJson(outDir + "documento.json", docOk);
  writeJson(outDir + "business.json", business);
  writeJson(outDir + "assets.json", assets);
  writeJson(outDir + "compuesto.json", r.composed);
  writeJson(outDir + "reporte.json", r.report);
  return DIR_MARCAS;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = genGoldenTemplates();
  for (const { dir, matched } of r) {
    console.log(`golden/templates/${dir}: ${matched ? "coincide byte a byte con diseno/ejemplos" : "NO coincide con diseno/ejemplos (ver consola)"}`);
  }
  console.log(`golden/templates/${genGoldenMarcas()}: sintetizado (richText con marks, I-01)`);
}
