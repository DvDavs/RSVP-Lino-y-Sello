#!/usr/bin/env node
// contraste-en-pantalla.mjs — la OTRA compuerta de contraste: la de `10 §4.2` y `11 §8.3`. En vez
// de medir los datos (eso lo hace `packages/tokens: pnpm run verify-contrast`), abre /design/tokens
// en un Chromium real y mide la PILA RENDERIZADA con `getComputedStyle` sobre cada muestra de
// pareja, en los dos temas. Sale con 1 si alguna baja de su umbral.
//
//   node contraste-en-pantalla.mjs               mide y sale con 0
//   node contraste-en-pantalla.mjs --sabotear    pinta --ui-ink del color del papel: DEBE salir 1
//
// Requiere el servidor levantado (ORIGEN, por defecto http://127.0.0.1:3117).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../../../../..");
const { chromium } = await import(join(RAIZ, "frontend/apps/web/node_modules/@playwright/test/index.mjs"));

const ORIGEN = process.env.ORIGEN ?? "http://127.0.0.1:3117";
const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const sabotear = process.argv.includes("--sabotear");

const canal = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminancia = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const contraste = (a, b) => (Math.max(luminancia(a), luminancia(b)) + 0.05) / (Math.min(luminancia(a), luminancia(b)) + 0.05);
const rgb = (css) => css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);

const navegador = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
await contexto.route("**/*", (r) => (r.request().url().startsWith(ORIGEN) ? r.continue() : r.abort()));
const p = await contexto.newPage();
await p.goto(`${ORIGEN}/design/tokens`, { waitUntil: "load" });

// El sabotaje entra por CSS, como entraría un despiste real: un token redefinido con un valor que
// no contrasta. Si la compuerta no cae aquí, no vale para nada.
if (sabotear) await p.addStyleTag({ content: ':root, [data-theme="light"] { --ui-ink: #fdf9f6; }' });

const col = (t, n) => String(t).padEnd(n);
let fallos = 0;
let medidas = 0;
console.log(col("tema", 7) + col("figura", 17) + col("fondo", 15) + col("rgb figura/fondo", 30) + col("px", 5) + col("ratio", 7) + col("umbral", 8) + "estado");
console.log("-".repeat(110));
for (const tema of ["Claro", "Oscuro"]) {
  await p.getByRole("button", { name: tema, exact: true }).click();
  await p.waitForFunction(
    (esperado) => document.querySelector("[data-galeria-tema]")?.getAttribute("data-galeria-tema") === esperado,
    tema === "Claro" ? "light" : "dark",
  );
  const filas = await p.$$eval("[data-pareja]", (nodos) =>
    nodos.map((n) => {
      const e = getComputedStyle(n);
      return {
        figura: n.dataset.figura,
        fondo: n.dataset.fondo,
        umbral: n.dataset.umbral,
        color: e.color,
        fondoCss: e.backgroundColor,
        px: Number.parseFloat(e.fontSize),
      };
    }),
  );
  for (const f of filas) {
    const ratio = contraste(rgb(f.color), rgb(f.fondoCss));
    const umbral = f.umbral === "informativa" ? null : Number(f.umbral);
    const ok = umbral === null ? null : ratio >= umbral;
    if (umbral !== null) {
      medidas++;
      if (!ok) fallos++;
    }
    console.log(
      col(tema.toLowerCase(), 7) + col(f.figura, 17) + col(f.fondo, 15) +
        col(`${rgb(f.color).join(",")} / ${rgb(f.fondoCss).join(",")}`, 30) + col(f.px, 5) +
        col(ratio.toFixed(2), 7) + col(f.umbral, 8) + (ok === null ? "info" : ok ? "OK" : "FALLA"),
    );
  }
}
console.log("-".repeat(110));
console.log(`${medidas} mediciones con umbral sobre la pila renderizada; ${fallos} fallos.${sabotear ? " (con sabotaje --ui-ink)" : ""}`);
await navegador.close();
process.exit(fallos > 0 ? 1 : 0);
