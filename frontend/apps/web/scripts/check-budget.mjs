#!/usr/bin/env node
// scripts/check-budget.mjs — presupuesto de JS de PRIMERA CARGA por ruta (04 §16.2 / contratos §8).
// `process.exit(1)` con un informe si excede: es una compuerta que ROMPE, nunca solo avisa (§16.2:
// "un presupuesto que solo avisa se ignora").
//
// ============================================================================================
// DOS CORRECCIONES DE MEDICIÓN del bloque 3-3. Ninguna afloja un umbral: los dos límites siguen
// siendo los de `contratos.md §8` (150 KB para la ruta pública, 600 KB para el editor). Lo que
// cambia es QUÉ se pesa, porque lo que se pesaba antes no era el JS de primera carga de la ruta.
//
// (A) FALTABA el JavaScript propio de la ruta — la compuerta era CIEGA a lo que mide.
//     `build-manifest.json` de una ruta solo trae `rootMainFiles` + `polyfillFiles`, que son
//     COMUNES a todas las rutas de la aplicación. Medido: antes de esta corrección,
//     `/i/[publicToken]` y `/editor/[invitationId]` daban EXACTAMENTE el mismo número (165,9 KB),
//     con el editor cargando `zustand`, `dnd-kit`, `react-hook-form` y shadcn/ui y la ruta pública
//     nada. Es decir: se podía meter cualquier cantidad de JS en la ruta pública sin que la
//     compuerta se enterara — justo lo que `04 §16.2` quería impedir ("¿se coló el chrome en la
//     ruta pública?" era indetectable).
//     Los chunks propios de la ruta están en `page_client-reference-manifest.js`, que asigna a cada
//     módulo cliente sus chunks. Se suman a los comunes, sin duplicar.
//
// (B) Los *polyfills* NO son JS de primera carga en los navegadores del objetivo, y se cuentan
//     aparte. `polyfillFiles` se sirve con el atributo `nomodule` — verificado en el HTML real
//     (`<script src="/_next/static/chunks/0cz…js" noModule="">`) y en el código de Next
//     (`next/dist/server/app-render/app-render.js:1895-1899`, `noModule: true`). Un navegador que
//     entiende módulos ES **ni siquiera lo descarga**, y el `browserslist` de este proyecto
//     (`apps/web/package.json`: chrome ≥ 96, edge ≥ 96, firefox ≥ 91, safari ≥ 15) no incluye
//     ninguno que no los entienda: todos soportan `<script type="module">` desde 2017-2018.
//     Contarlos contra el presupuesto de un usuario moderno mide bytes que ese usuario nunca pide.
//     NO se ocultan: se imprimen siempre, con su propio límite (`LIMITE_POLYFILLS_KB`) para que un
//     crecimiento ahí tampoco pase desapercibido.
//
// (C) HALLAZGO del bloque 3-1 que se conserva: `04 §16.2` dice "lee `.next/app-build-manifest.json`".
//     Ese fichero NO existe en `next@16.3.4` (ni con Turbopack ni con `--webpack`). El manifiesto
//     real por ruta es `.next/server/app/<ruta-con-grupos>/page/build-manifest.json`.
// ============================================================================================
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const DIR_APP = path.join(RAIZ, ".next", "server", "app");

// `CHECK_BUDGET_OVERRIDE_KB` existe SOLO para la prueba negativa ("bájalo a un valor imposible y
// enseña la salida en rojo") — nunca se usa en CI.
const LIMITES_BASE = {
  "/i/[publicToken]": 150 * 1024,
  // Fase 3-C (3C-5): la PORTADA es pública y de primera impresión, así que entra en la compuerta
  // con el mismo techo que la ruta del invitado (`contratos.md §8`, brief del bloque 3). Sin esta
  // línea, la landing podía engordar sin que nadie se enterara — el mismo defecto (A) que este
  // fichero corrigió para `/i`.
  "/": 150 * 1024,
  "/editor/[invitationId]": 600 * 1024,
};
const LIMITES = process.env.CHECK_BUDGET_OVERRIDE_KB
  ? Object.fromEntries(Object.keys(LIMITES_BASE).map((k) => [k, Number(process.env.CHECK_BUDGET_OVERRIDE_KB) * 1024]))
  : LIMITES_BASE;

/** Los polyfills `nomodule` tienen su propio techo: no cuentan contra el presupuesto de la ruta
 *  (nadie del `browserslist` los descarga) pero tampoco pueden crecer sin que nadie lo vea. */
const LIMITE_POLYFILLS = 64 * 1024;

if (!existsSync(DIR_APP)) {
  console.error(`check-budget: no existe ${DIR_APP}. Ejecuta "next build" antes de "pnpm run budget".`);
  process.exit(1);
}

/** Recorre `.next/server/app/**` buscando `page/build-manifest.json` y devuelve, por cada uno, la
 *  URL normalizada (sin segmentos "(grupo)") y el directorio del segmento (donde vive el
 *  `page_client-reference-manifest.js`). */
function encontrarManifiestosPorRuta() {
  const resultado = new Map();
  function recorrer(dirActual, segmentosUrl) {
    for (const entrada of readdirSync(dirActual, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;
      const rutaFisica = path.join(dirActual, entrada.name);
      const esGrupo = entrada.name.startsWith("(") && entrada.name.endsWith(")");
      const siguientesSegmentos = esGrupo ? segmentosUrl : [...segmentosUrl, entrada.name];

      if (entrada.name === "page") {
        const manifiesto = path.join(rutaFisica, "build-manifest.json");
        if (existsSync(manifiesto)) {
          const url = `/${segmentosUrl.join("/")}`.replace(/\/+/g, "/");
          resultado.set(url, { manifiesto, dirSegmento: dirActual });
        }
        continue;
      }
      recorrer(rutaFisica, siguientesSegmentos);
    }
  }
  recorrer(DIR_APP, []);
  return resultado;
}

/** Chunks que la ruta carga por sus PROPIOS componentes cliente (corrección (A)). El manifiesto es
 *  un `.js` que asigna `globalThis.__RSC_MANIFEST[...] = {...}`; se leen las rutas de chunk con una
 *  expresión regular en vez de evaluarlo — nunca se ejecuta código de build para medirlo. */
function chunksDeLaRuta(dirSegmento) {
  const archivo = path.join(dirSegmento, "page_client-reference-manifest.js");
  if (!existsSync(archivo)) return [];
  const fuente = readFileSync(archivo, "utf8");
  const encontrados = new Set();
  for (const m of fuente.matchAll(/"\/_next\/(static\/chunks\/[^"]+\.js)"/g)) encontrados.add(m[1]);
  return [...encontrados];
}

function pesarGzip(archivos) {
  let total = 0;
  const detalle = [];
  for (const archivo of archivos) {
    // Las rutas del manifiesto son relativas a `.next/`.
    const rutaArchivo = path.join(RAIZ, ".next", archivo);
    if (!existsSync(rutaArchivo) || !statSync(rutaArchivo).isFile()) continue;
    const gz = gzipSync(readFileSync(rutaArchivo), { level: 9 }).length;
    total += gz;
    detalle.push({ archivo, gz });
  }
  detalle.sort((a, b) => b.gz - a.gz);
  return { total, detalle };
}

const manifiestosPorRuta = encontrarManifiestosPorRuta();
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const ROJO = "\x1b[31m";
const VERDE = "\x1b[32m";
const GRIS = "\x1b[90m";
const RESET = "\x1b[0m";

let huboExceso = false;

for (const [ruta, limiteBytes] of Object.entries(LIMITES)) {
  const entrada = manifiestosPorRuta.get(ruta);
  if (!entrada) {
    console.warn(`check-budget: ${ruta} — no aparece bajo .next/server/app (¿la ruta no existe todavía?)`);
    continue;
  }

  const datos = JSON.parse(readFileSync(entrada.manifiesto, "utf8"));
  const comunes = (datos.rootMainFiles ?? []).filter((f) => f.endsWith(".js"));
  const polyfills = (datos.polyfillFiles ?? []).filter((f) => f.endsWith(".js"));
  const propios = chunksDeLaRuta(entrada.dirSegmento).filter((f) => !comunes.includes(f));

  const runtime = pesarGzip(comunes);
  const ruta_ = pesarGzip(propios);
  const poly = pesarGzip(polyfills);

  const total = runtime.total + ruta_.total;
  const excedido = total > limiteBytes;
  if (excedido) huboExceso = true;

  const color = excedido ? ROJO : VERDE;
  console.log(`\n${color}${ruta}: ${kb(total)} gz de primera carga (límite ${kb(limiteBytes)})${RESET}`);
  console.log(`  runtime común de Next  ${kb(runtime.total).padStart(9)}   (${runtime.detalle.length} chunks)`);
  for (const d of runtime.detalle) console.log(`${GRIS}      ${kb(d.gz).padStart(9)}  ${d.archivo}${RESET}`);
  console.log(`  JS propio de la ruta   ${kb(ruta_.total).padStart(9)}   (${ruta_.detalle.length} chunks)`);
  for (const d of ruta_.detalle) console.log(`${GRIS}      ${kb(d.gz).padStart(9)}  ${d.archivo}${RESET}`);

  const polyExcedido = poly.total > LIMITE_POLYFILLS;
  if (polyExcedido) huboExceso = true;
  console.log(
    `  ${polyExcedido ? ROJO : GRIS}polyfills (nomodule)   ${kb(poly.total).padStart(9)}   ` +
      `NO cuentan: ningún navegador del browserslist los descarga (límite propio ${kb(LIMITE_POLYFILLS)})${RESET}`,
  );

  if (excedido) {
    console.log(`${ROJO}  EXCEDIDO por ${kb(total - limiteBytes)}${RESET}`);
  }
}

if (huboExceso) {
  console.error(
    `\n${ROJO}check-budget: presupuesto de JS excedido (04 §16.2). Orden de actuación: 1) ¿se coló el` +
      ` chrome en la ruta pública? 2) diferir la isla de RSVP; 3) reducir pesos tipográficos; 4)` +
      ` subconjunto de fuentes más estrecho; 5) si nada basta, ADR para subir el presupuesto.${RESET}`,
  );
  process.exit(1);
}

console.log(`\n${VERDE}check-budget: dentro de presupuesto.${RESET}`);
