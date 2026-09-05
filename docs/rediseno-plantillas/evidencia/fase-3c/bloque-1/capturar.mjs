#!/usr/bin/env node
// capturar.mjs — capturas de la galería /design con el Chromium preinstalado del entorno
// (`/opt/pw-browsers`, revisión 1194; `contratos.md §7` prohíbe `playwright install`).
//
// Requiere el servidor de producción levantado:
//   cd frontend/apps/web && pnpm run build && PORT=3117 pnpm run start
//   node docs/rediseno-plantillas/evidencia/fase-3c/bloque-1/capturar.mjs
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../../../../..");
const { chromium } = await import(join(RAIZ, "frontend/apps/web/node_modules/@playwright/test/index.mjs"));

const ORIGEN = process.env.ORIGEN ?? "http://127.0.0.1:3117";
const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ANCHURAS = [
  { ancho: 390, alto: 844, nombre: "390" },
  { ancho: 1440, alto: 900, nombre: "1440" },
];
const TEMAS = [
  { boton: "Claro", nombre: "claro" },
  { boton: "Oscuro", nombre: "oscuro" },
];
const PAGINAS = [
  { ruta: "/design/tokens", nombre: "tokens" },
  { ruta: "/design", nombre: "indice" },
];

const navegador = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
try {
  for (const pagina of PAGINAS) {
    for (const anchura of ANCHURAS) {
      for (const tema of TEMAS) {
        const contexto = await navegador.newContext({
          viewport: { width: anchura.ancho, height: anchura.alto },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
        });
        // Nada de red fuera del propio servidor: en este entorno el proxy de salida deja las
        // peticiones externas colgadas y `networkidle` no llegaría nunca.
        await contexto.route("**/*", (ruta) => (ruta.request().url().startsWith(ORIGEN) ? ruta.continue() : ruta.abort()));
        const p = await contexto.newPage();
        await p.goto(`${ORIGEN}${pagina.ruta}`, { waitUntil: "load" });
        await p.getByRole("button", { name: tema.boton, exact: true }).click();
        await p.waitForFunction(
          (esperado) => document.querySelector("[data-galeria-tema]")?.getAttribute("data-galeria-tema") === esperado,
          tema.nombre === "claro" ? "light" : "dark",
        );
        const destino = join(AQUI, `${pagina.nombre}-${tema.nombre}-${anchura.nombre}.png`);
        await p.screenshot({ path: destino, fullPage: pagina.nombre === "indice" ? true : anchura.ancho === 1440 });
        console.log(`capturado ${destino}`);
        await contexto.close();
      }
    }
  }
} finally {
  await navegador.close();
}
