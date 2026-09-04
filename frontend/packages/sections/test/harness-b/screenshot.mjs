#!/usr/bin/env node
// packages/sections/test/harness-b/screenshot.mjs — 3-2b, TAREA 3 del brief.
//
// Levanta el servidor Vite del harness (`vite.config.ts`) en memoria, abre cada una de las 6
// secciones con Chromium (el preinstalado en `/opt/pw-browsers`, NUNCA `playwright install` —
// mismo criterio que `frontend/spikes/canvas-gate/playwright.config.ts`) en dos tamaños de
// ventana (390×844 móvil, 1440×900 escritorio) y guarda 12 PNG en
// `docs/rediseno-plantillas/evidencia/fase-3/secciones/<tipo>-{movil,escritorio}.png`.
//
// Se usa el paquete `playwright` preinstalado GLOBALMENTE en el entorno (`/opt/node22/lib/
// node_modules/playwright`, verificado [V] con `npm ls -g`) en vez de añadirlo como dependencia de
// `packages/sections` — evita tocar `package.json`/`pnpm-lock.yaml` del paquete solo por un script
// de evidencia que no corre en CI.
import { createServer } from "vite";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "../../../../../docs/rediseno-plantillas/evidencia/fase-3/secciones");
const CHROMIUM_PATH =
  process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SECTIONS = ["cover", "celebrant", "event", "gallery", "story", "dressCode"];
const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "escritorio", width: 1440, height: 900 },
];

async function loadPlaywright() {
  // `createRequire` para poder `require()` el paquete global desde un módulo ESM sin depender de
  // que esté en la resolución de `packages/sections` (no lo está, a propósito).
  const req = createRequire(import.meta.url);
  const globalPath = "/opt/node22/lib/node_modules/playwright";
  return req(globalPath);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({ configFile: resolve(here, "vite.config.ts") });
  await server.listen();
  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[harness-b] servidor Vite en ${baseUrl}`);

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });

  try {
    for (const type of SECTIONS) {
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        const url = `${baseUrl}/index.html?type=${type}`;
        await page.goto(url, { waitUntil: "networkidle" });
        await page.waitForSelector('body[data-harness-ready="true"]', { timeout: 15_000 });
        // Deja asentar la animación de entrada (`--inv-motion-normal`, 200ms) antes de fotografiar
        // — que la captura muestre el estado final, no un fotograma a mitad de la transición.
        await page.waitForTimeout(400);
        const outPath = resolve(OUT_DIR, `${type}-${viewport.name}.png`);
        await page.screenshot({ path: outPath, fullPage: true });
        console.log(`[harness-b] ${outPath}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
