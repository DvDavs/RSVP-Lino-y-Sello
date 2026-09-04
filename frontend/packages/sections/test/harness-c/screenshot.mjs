// packages/sections/test/harness-c/screenshot.mjs — TAREA 3 del brief 3-2c: dos capturas
// (390×844 móvil, 1440×900 escritorio) por cada una de las 6 secciones, contra el servidor de
// desarrollo de `vite.config.ts` de este mismo directorio. Usa el Chromium preinstalado de
// `/opt/pw-browsers` (PLAYWRIGHT_BROWSERS_PATH) — NUNCA `playwright install` (brief §Capturas).
// Se invoca con Node directo: `node test/harness-c/screenshot.mjs`.
// `playwright` no es dependencia de `packages/sections/package.json` (correcto: no debe serlo —
// no es una dependencia de RUNTIME del paquete, solo de esta utilidad de evidencia) y Node ESM
// no consulta `NODE_PATH` (a diferencia de `require`, verificado [V] en este entorno) — se importa
// por RUTA ABSOLUTA al global preinstalado (`04-frontend-y-editor.md` §21: Playwright 1.62.1;
// aquí 1.56.1, la versión real preinstalada en este entorno de ejecución, ver bitácora 3-2c).
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { createServer } from "vite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(here, "../../../../../docs/rediseno-plantillas/evidencia/fase-3/secciones");
const CHROME_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SECTIONS = ["giftTable", "suggestions", "amenities", "rsvp", "family", "footer"];
const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "escritorio", width: 1440, height: 900 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await createServer({ configFile: resolve(here, "vite.config.ts") });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address !== null ? address.port : 4173;
  const baseUrl = `http://localhost:${port}`;
  console.log(`harness-c: servidor vite en ${baseUrl}`);

  const browser = await chromium.launch({ executablePath: CHROME_PATH });

  try {
    for (const type of SECTIONS) {
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const url = `${baseUrl}/?type=${type}`;
        // NUNCA "networkidle": el cliente HMR de Vite mantiene un WebSocket abierto a propósito,
        // así que la red nunca queda "idle" y la espera colgaría para siempre. "load" + esperar
        // el nodo real es determinista y no depende de que el socket de desarrollo se cierre.
        await page.goto(url, { waitUntil: "load", timeout: 15000 });
        const section = page.locator("section[data-section-type]").first();
        await section.waitFor({ timeout: 10000 });
        // Deja asentar fuentes/transiciones de un primer pintado antes de la captura.
        await page.waitForTimeout(200);
        const outPath = resolve(OUT_DIR, `${type}-${viewport.name}.png`);
        // Recorta al elemento <section> (no `fullPage`): el banco monta UNA sección aislada, así
        // que el resto del documento (fuera de su fondo `--inv-color-bg`) no debe colarse en la
        // captura como un vacío blanco de página (medido, ver bitácora 3-2c).
        await section.screenshot({ path: outPath });
        console.log(`✓ ${outPath}`);
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
