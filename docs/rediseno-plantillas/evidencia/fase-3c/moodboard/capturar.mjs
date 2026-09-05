#!/usr/bin/env node
// capturar.mjs — renderiza `index.html` con el Chromium preinstalado (NUNCA `playwright install`) y
// guarda una captura `fullPage` de cada sección en `capturas/`, a 390 px (móvil) y, para paleta,
// tipografía y pantallas, también a 1440 px (`*-escritorio.png`). Antes de capturar comprueba con
// `document.fonts.check()` que cada familia autoalojada cargó de verdad y lo imprime.
//
// Ejecutar desde cualquier sitio:  node capturar.mjs
// Usa `@playwright/test` de `frontend/apps/web` (ya instalado) y el Chromium de `/opt/pw-browsers`.

import { createRequire } from "node:module";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../../../..");
const require = createRequire(join(RAIZ, "frontend/apps/web/package.json"));
const { chromium } = require("@playwright/test");

const CHROMIUM = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ...(process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : []),
].find((p) => existsSync(p));

const SECCIONES = [
  { id: "paleta-a", escritorio: true },
  { id: "paleta-b", escritorio: true },
  { id: "paleta-c", escritorio: true },
  { id: "tipografia-1", escritorio: true },
  { id: "tipografia-2", escritorio: true },
  { id: "tipografia-3", escritorio: true },
  { id: "formas", escritorio: false },
  { id: "iconos", escritorio: false },
  { id: "componentes", escritorio: false },
  { id: "pantallas", escritorio: true },
];

const FAMILIAS = [
  ["Fraunces", "700 40px"], ["Onest", "400 16px"], ["Red Hat Mono", "500 12px"],
  ["Bricolage Grotesque", "700 40px"], ["Figtree", "400 16px"], ["Azeret Mono", "500 12px"],
  ["Gabarito", "700 40px"], ["Instrument Sans", "400 16px"], ["Spline Sans Mono", "500 12px"],
];

/** Tope de peso por captura. Si una supera el límite a 2×, se repite a 1× (misma sección, mismo recorte). */
const LIMITE_BYTES = 2.5 * 1024 * 1024;

async function abrir(browser, url, ancho, escala) {
  // `reducedMotion: "reduce"`: sin scroll suave ni formas respirando, la captura es determinista.
  const page = await browser.newPage({ viewport: { width: ancho, height: ancho === 390 ? 844 : 900 }, deviceScaleFactor: escala, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "load" });
  // La barra de anclas es `position: sticky`: en una captura `fullPage` de una sección se pintaría a
  // media página tapando contenido. Es navegación de la página, no del sistema: se oculta al capturar.
  await page.addStyleTag({ content: ".nav-anclas { display: none !important; }" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function main() {
  mkdirSync(join(AQUI, "capturas"), { recursive: true });
  const url = pathToFileURL(join(AQUI, "index.html")).href;
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  try {
    for (const [ancho, sufijo] of [[390, ""], [1440, "-escritorio"]]) {
      const page = await abrir(browser, url, ancho, 2);
      const fuentes = await page.evaluate((fam) => fam.map(([f, spec]) => [f, document.fonts.check(`${spec} "${f}"`)]), FAMILIAS);
      const faltan = fuentes.filter(([, ok]) => !ok).map(([f]) => f);
      console.log(`[${ancho}px] document.fonts.check: ${fuentes.map(([f, ok]) => `${f}=${ok ? "ok" : "NO"}`).join(", ")}`);
      if (faltan.length) throw new Error(`Fuentes que NO cargaron: ${faltan.join(", ")}`);
      const barraOculta = await page.evaluate(() => getComputedStyle(document.querySelector(".nav-anclas")).display === "none");
      if (!barraOculta) throw new Error("La barra de anclas sigue visible: la captura taparía contenido");
      let page1x = null;
      for (const s of SECCIONES) {
        if (ancho === 1440 && !s.escritorio) continue;
        const ruta = join(AQUI, "capturas", `${s.id}${sufijo}.png`);
        let el = page.locator(`#${s.id}`);
        await el.scrollIntoViewIfNeeded();
        await el.screenshot({ path: ruta, animations: "disabled" });
        let escala = 2;
        if (statSync(ruta).size > LIMITE_BYTES) {
          page1x ??= await abrir(browser, url, ancho, 1);
          el = page1x.locator(`#${s.id}`);
          await el.scrollIntoViewIfNeeded();
          await el.screenshot({ path: ruta, animations: "disabled" });
          escala = 1;
        }
        const caja = await el.boundingBox();
        const kb = (statSync(ruta).size / 1024).toFixed(0);
        console.log(`  ${s.id}${sufijo}.png  ${Math.round(caja.width)}×${Math.round(caja.height)} css px · ${escala}x · ${kb} KB`);
        if (statSync(ruta).size > LIMITE_BYTES) throw new Error(`${ruta} supera ${LIMITE_BYTES} bytes incluso a 1x`);
      }
      // Desbordamiento horizontal: la página nunca debe scrollear en horizontal.
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      console.log(`  desborde horizontal a ${ancho}px: ${desborde}px`);
      if (desborde > 0) throw new Error(`Desborde horizontal de ${desborde}px a ${ancho}px`);
      await page.close();
      if (page1x) await page1x.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
