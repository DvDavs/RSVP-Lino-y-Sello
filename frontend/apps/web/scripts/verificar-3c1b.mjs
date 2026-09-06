/* eslint-disable no-undef -- `page.evaluate(() => ...)` corre en el NAVEGADOR: `document` y
   `getComputedStyle` existen ahí, no en Node. Misma convención que `scripts/capturas-editor.mjs:2`. */
// scripts/verificar-3c1b.mjs — verificación DOM de la capa de compatibilidad (3C-1b): la tipografía
// de cuerpo empieza por Onest, un h1 del chrome usa Fraunces, el fondo de <body> es el
// `--ui-surface` nuevo y `document.fonts` no contiene Inter/Bricolage/Outfit.
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
await page.goto("http://localhost:3134/acceso", { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(500);

const resultado = await page.evaluate(() => {
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const h1 = document.querySelector("h1");
  const h1Font = h1 ? getComputedStyle(h1).fontFamily : null;
  const familias = new Set();
  document.fonts.forEach((f) => familias.add(f.family));
  const uiSurface = getComputedStyle(document.documentElement)
    .getPropertyValue("--ui-surface")
    .trim();
  return {
    bodyFont,
    bodyBg,
    h1Font,
    familias: [...familias],
    uiSurface,
  };
});

console.log(JSON.stringify(resultado, null, 2));

const problemas = [];
if (!/^"?Onest/.test(resultado.bodyFont)) problemas.push(`body no empieza por Onest: ${resultado.bodyFont}`);
if (!resultado.h1Font || !resultado.h1Font.includes("Fraunces")) problemas.push(`h1 no usa Fraunces: ${resultado.h1Font}`);
const hexAaRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
if (resultado.bodyBg !== hexAaRgb(resultado.uiSurface)) {
  problemas.push(`fondo de body (${resultado.bodyBg}) no coincide con --ui-surface (${resultado.uiSurface} = ${hexAaRgb(resultado.uiSurface)})`);
}
for (const prohibida of ["Inter", "Bricolage", "Outfit"]) {
  if (resultado.familias.some((f) => f.includes(prohibida))) problemas.push(`document.fonts contiene ${prohibida}`);
}

console.log(problemas.length === 0 ? "OK: todas las comprobaciones pasan" : `FALLA: ${problemas.join(" | ")}`);

await browser.close();
process.exit(problemas.length === 0 ? 0 : 1);
