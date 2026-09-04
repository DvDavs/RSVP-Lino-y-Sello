#!/usr/bin/env node
// scripts/check-budget.mjs — presupuesto de JS de primera carga (04-frontend-y-editor.md §16.2).
// `process.exit(1)` con un informe si excede — es una compuerta que ROMPE, nunca solo avisa (§16.2:
// "un presupuesto que solo avisa se ignora").
//
// HALLAZGO no cubierto por `04 §16.2` (verificado, no supuesto): esa sección dice "lee
// `.next/app-build-manifest.json`". Con `next@16.3.4` (Turbopack, el bundler por defecto de `next
// build` en esta versión) ese fichero **no existe**; tampoco con `next build --webpack`. El
// manifiesto real y ESTABLE por ruta es `.next/server/app/<ruta-con-grupos>/page/build-manifest.json`
// → `{ rootMainFiles, polyfillFiles }`, verificado con las dos rutas de este proyecto. Se registra
// como corrección al diseño en `memoria/bitacora/3-1.md` y `preguntas-abiertas.md`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const DIR_APP = path.join(RAIZ, ".next", "server", "app");

// `CHECK_BUDGET_OVERRIDE_KB` existe SOLO para la prueba negativa que exige el brief de 3-1
// ("bájalo a un valor imposible y enseña la salida en rojo") — nunca se usa en CI.
const LIMITES_BASE = {
  "/i/[publicToken]": 150 * 1024,
  "/editor/[invitationId]": 600 * 1024,
};
const LIMITES = process.env.CHECK_BUDGET_OVERRIDE_KB
  ? Object.fromEntries(Object.keys(LIMITES_BASE).map((k) => [k, Number(process.env.CHECK_BUDGET_OVERRIDE_KB) * 1024]))
  : LIMITES_BASE;

if (!existsSync(DIR_APP)) {
  console.error(`check-budget: no existe ${DIR_APP}. Ejecuta "next build" antes de "pnpm run budget".`);
  process.exit(1);
}

/** Recorre `.next/server/app/**` buscando `page/build-manifest.json` y devuelve, por cada uno, la
 * URL normalizada (sin segmentos "(grupo)") a la que corresponde. */
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
          resultado.set(url, manifiesto);
        }
        continue;
      }
      recorrer(rutaFisica, siguientesSegmentos);
    }
  }
  recorrer(DIR_APP, []);
  return resultado;
}

const manifiestosPorRuta = encontrarManifiestosPorRuta();

let huboExceso = false;
const informe = [];

for (const [ruta, limiteBytes] of Object.entries(LIMITES)) {
  const manifiesto = manifiestosPorRuta.get(ruta);
  if (!manifiesto) {
    informe.push({ ruta, estado: "no-encontrada" });
    continue;
  }

  const datos = JSON.parse(readFileSync(manifiesto, "utf8"));
  const archivos = [...(datos.polyfillFiles ?? []), ...(datos.rootMainFiles ?? [])].filter((f) => f.endsWith(".js"));

  let totalGzip = 0;
  const detalle = [];
  for (const archivo of archivos) {
    // Las rutas del manifiesto son relativas a `.next/`.
    const rutaArchivo = path.join(RAIZ, ".next", archivo);
    if (!existsSync(rutaArchivo) || !statSync(rutaArchivo).isFile()) continue;
    const bytes = readFileSync(rutaArchivo);
    const gz = gzipSync(bytes, { level: 9 }).length;
    totalGzip += gz;
    detalle.push({ archivo, gz });
  }

  const excedido = totalGzip > limiteBytes;
  if (excedido) huboExceso = true;
  informe.push({ ruta, totalGzip, limiteBytes, excedido, detalle });
}

const ROJO = "\x1b[31m";
const VERDE = "\x1b[32m";
const RESET = "\x1b[0m";

for (const fila of informe) {
  if (fila.estado === "no-encontrada") {
    console.warn(`check-budget: ${fila.ruta} — no aparece bajo .next/server/app (¿la ruta no existe todavía?)`);
    continue;
  }
  const kb = (fila.totalGzip / 1024).toFixed(1);
  const limiteKb = (fila.limiteBytes / 1024).toFixed(0);
  const color = fila.excedido ? ROJO : VERDE;
  console.log(`${color}${fila.ruta}: ${kb} KB gz (límite ${limiteKb} KB)${RESET}`);
  if (fila.excedido) {
    console.log(`${ROJO}  EXCEDIDO por ${((fila.totalGzip - fila.limiteBytes) / 1024).toFixed(1)} KB${RESET}`);
    for (const d of [...fila.detalle].sort((a, b) => b.gz - a.gz).slice(0, 10)) {
      console.log(`${ROJO}    ${(d.gz / 1024).toFixed(1)} KB  ${d.archivo}${RESET}`);
    }
  }
}

if (huboExceso) {
  console.error(
    `${ROJO}check-budget: presupuesto de JS excedido (04 §16.2). Orden de actuación: 1) ¿se coló el` +
      ` chrome en la ruta pública? 2) diferir la isla de RSVP; 3) reducir pesos tipográficos; 4)` +
      ` subconjunto de fuentes más estrecho; 5) si nada basta, ADR para subir el presupuesto.${RESET}`,
  );
  process.exit(1);
}

console.log(`${VERDE}check-budget: dentro de presupuesto.${RESET}`);
