// Captura de evidencia visual (fase 3-C, bloque 1, 3C-1b) — antes/después de retirar el `@theme`
// provisional. Uso: node capture.mjs <prefijo> (p.ej. "antes" o "despues")
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const prefijo = process.argv[2] ?? "antes";
const outDir =
  "/home/user/RSVP---Lino-Sello/docs/rediseno-plantillas/evidencia/fase-3c/bloque-1";
mkdirSync(outDir, { recursive: true });

const rutas = [
  { nombre: "acceso", url: "/acceso" },
  { nombre: "ayuda", url: "/ayuda" },
  { nombre: "404", url: "/no-existe" },
  { nombre: "design-tokens", url: "/design/tokens" },
];
const viewports = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  for (const ruta of rutas) {
    await page.goto(`http://localhost:3134${ruta.url}`, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(500);
    const archivo = `${outDir}/compat-${prefijo}-${ruta.nombre}-${vp.nombre}.png`;
    await page.screenshot({ path: archivo, fullPage: true });
    console.log(`OK ${archivo}`);
  }
  await context.close();
}

await browser.close();
