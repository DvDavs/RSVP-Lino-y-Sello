#!/usr/bin/env node
// packages/sections/test/harness-b/generate-fixture.ts — 3-2b, banco de capturas.
//
// Genera `composed.json`: el `ComposedDocument` REAL de `boda-clasica@1.0.0` (mismo mecanismo que
// `test/fixtures.ts` → `realBodaClasicaDocument()`, duplicado aquí a propósito porque este script
// corre con `node --experimental-strip-types` FUERA de Vitest — `test/fixtures.ts` no se puede
// importar tal cual porque no es el punto de entrada de un paquete y arrastra `vitest`/jsdom). Lo
// sirve el servidor Vite del harness (`vite.config.ts`, `root: "."`) para que `main.tsx` (código de
// NAVEGADOR, sin `node:fs`) lo cargue con `fetch("./composed.json")`.
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compose,
  TemplateManifest,
  ThemeSpec,
  DefaultsFile,
  type TemplatePackage,
  type BusinessSnapshot,
  type AssetIndex,
} from "@invitaciones/schema";

const here = dirname(fileURLToPath(import.meta.url));
const BODA_CLASICA_DIR = resolve(here, "../../../../templates/boda-clasica/1.0.0");
const OUTPUT_PATH = resolve(here, "composed.json");

function readJson(fileName: string): unknown {
  return JSON.parse(new TextDecoder().decode(readFileSyncPolyfill(resolve(BODA_CLASICA_DIR, fileName))));
}

// `node --experimental-strip-types` corre este archivo como ESM normal: `node:fs` sí está
// disponible en tiempo de ejecución (esto NO es código de navegador, a diferencia de `main.tsx`).
import { readFileSync as readFileSyncPolyfill } from "node:fs";

// Imágenes SIN red: el banco de capturas debe funcionar en un entorno sin salida a Internet
// (mismo criterio que "connect-src 'none'" del lienzo, 04 §8.4) y sin depender de la
// disponibilidad de un servicio externo el día de la captura. Cada assetId resuelve a un SVG
// `data:` generado en memoria — un degradado de color CON UNA TEXTURA suave (círculos
// translúcidos, simulan foco/bokeh de una fotografía real) y SIN NINGÚN TEXTO: una versión
// anterior de este generador incrustaba una etiqueta ("Portada", "Antonio"…) dentro de la propia
// imagen para distinguirlas a simple vista, y en la captura de `cover` esa palabra quedó
// superpuesta al contenido real, indistinguible del `<h2>` de la sección a primera vista — un
// texto renderizado por el propio SVG, no un fallo de `shared.visuallyHidden` (que sí oculta el
// `<h2>` correctamente, comprobado con `getComputedStyle`). Aquí no hay ambigüedad posible: cero
// texto dentro del placeholder.
function placeholderImage(seed: number, from: string, to: string): string {
  const dots = Array.from({ length: 5 }, (_, i) => {
    const cx = 90 + ((seed * 137 + i * 211) % 720);
    const cy = 120 + ((seed * 271 + i * 163) % 960);
    const r = 90 + ((seed + i) % 4) * 40;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="0.06"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="900" height="1200" fill="url(#g)"/>
    ${dots}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

const ASSETS: AssetIndex = {
  as_01J8DEM000000000000000C0V1: { url: placeholderImage(1, "#C98B8B", "#7A4E4E") },
  as_01J8DEM000000000000000N0V1: { url: placeholderImage(2, "#8A6D6D", "#4A2E2E") },
  as_01J8DEM000000000000000N0V2: { url: placeholderImage(3, "#C98B8B", "#9A6666") },
  as_01J8DEM0000000000000000GA1: { url: placeholderImage(4, "#B79C8C", "#6B5648") },
  as_01J8DEM0000000000000000GA2: { url: placeholderImage(5, "#9E8776", "#584739") },
  as_01J8DEM000000000000000H1S1: { url: placeholderImage(6, "#A98F87", "#5E463F") },
  as_01J8DEM000000000000000RSV1: { url: placeholderImage(7, "#C98B8B", "#4A2E2E") },
};

const BUSINESS: BusinessSnapshot = {
  invitationId: 1,
  date: "2026-12-12",
  time: "16:30",
  hashtag: "#CamilaYAntonio",
  coverPhotoUrl: null,
  childrenAllowed: true,
  youngAllowed: true,
  eventKind: "wedding",
  planTier: 2,
  timezone: "America/Mexico_City",
};

function main(): void {
  const pkg: TemplatePackage = {
    manifest: TemplateManifest.parse(readJson("template.json")),
    theme: ThemeSpec.parse(readJson("theme.json")),
    defaults: DefaultsFile.parse(readJson("defaults.json")),
  };
  const doc = {
    schemaVersion: 1 as const,
    template: { slug: "boda-clasica", version: "1.0.0" },
    theme: { paletteId: "blush", fontSetId: "serif-elegante" },
    structure: { sections: [] },
    content: {},
    attic: {},
    meta: { locale: "es-MX" as const },
  };
  const { composed } = compose(pkg, doc, BUSINESS, ASSETS, "es-MX");
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(composed, null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`composed.json escrito en ${OUTPUT_PATH} (${composed.sections.length} secciones)`);
}

main();
