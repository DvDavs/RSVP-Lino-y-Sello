#!/usr/bin/env node
// scripts/capturas-sitio.mjs — capturas de evidencia de la WEB PÚBLICA (fase 3-C, bloque 3, 3C-5).
//
// No es una prueba: no afirma nada y no falla si algo cambia. Es el generador reproducible de las
// imágenes de `docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/3c-5/`, para que la revisión humana
// mire lo mismo que se midió. La regresión visual de verdad vive en `e2e/design.spec.ts` (galería)
// y las afirmaciones de la portada en `e2e/landing.spec.ts`.
//
// Uso (con un `next start` ya escuchando en PORT_WEB):
//   node scripts/capturas-sitio.mjs [--port 3105] [--salida <dir>]
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let puerto = process.env.PORT_WEB ?? "3105";
let salida = path.resolve(AQUI, "../../../../docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/3c-5");
for (let i = 2; i < process.argv.length; i += 2) {
  if (process.argv[i] === "--port") puerto = process.argv[i + 1];
  if (process.argv[i] === "--salida") salida = path.resolve(process.argv[i + 1]);
}
if (!existsSync(salida)) mkdirSync(salida, { recursive: true });

const ORIGEN = `http://127.0.0.1:${puerto}`;
const ANCHOS = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "1440", width: 1440, height: 900 },
];
const PANTALLAS = [
  { ruta: "/", nombre: "portada", completa: true },
  { ruta: "/acceso", nombre: "acceso", completa: true },
  { ruta: "/ayuda", nombre: "ayuda", completa: true },
  { ruta: "/esta-ruta-no-existe", nombre: "404", completa: true },
];

const navegador = await chromium.launch({
  executablePath: existsSync(RUTA_CHROMIUM) ? RUTA_CHROMIUM : undefined,
});
try {
  for (const ancho of ANCHOS) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho.width, height: ancho.height },
      reducedMotion: "reduce",
    });
    const pagina = await contexto.newPage();
    for (const pantalla of PANTALLAS) {
      await pagina.goto(`${ORIGEN}${pantalla.ruta}`, { waitUntil: "networkidle" });
      await pagina.evaluate(async () => {
        // eslint-disable-next-line no-undef -- el cuerpo de `page.evaluate` corre en el navegador
        await document.fonts.ready;
      });
      const destino = path.join(salida, `3c-5-${pantalla.nombre}-${ancho.nombre}.png`);
      await pagina.screenshot({ path: destino, fullPage: pantalla.completa, animations: "disabled" });
      console.log(`capturado ${pantalla.ruta} @${ancho.nombre} → ${destino}`);
    }

    // La pestaña «Crear cuenta» de `/acceso` es otra pantalla, no otro estado del mismo formulario.
    await pagina.goto(`${ORIGEN}/acceso`, { waitUntil: "networkidle" });
    await pagina.getByRole("tab", { name: "Crear cuenta" }).click();
    await pagina.evaluate(async () => {
      // eslint-disable-next-line no-undef -- el cuerpo de `page.evaluate` corre en el navegador
      await document.fonts.ready;
    });
    const registro = path.join(salida, `3c-5-acceso-registro-${ancho.nombre}.png`);
    await pagina.screenshot({ path: registro, fullPage: true, animations: "disabled" });
    console.log(`capturado /acceso (crear cuenta) @${ancho.nombre} → ${registro}`);

    await contexto.close();
  }
} finally {
  await navegador.close();
}
