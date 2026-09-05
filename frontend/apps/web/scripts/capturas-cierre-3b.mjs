/* eslint-disable no-undef -- `page.evaluate(() => ...)` y `addInitScript` corren en el NAVEGADOR:
   `window` y `document` existen ahí, no en Node. Misma convención —y misma razón— que
   `scripts/capturas-editor.mjs:2`. Añadido en la fase 3-C: la regla ya fallaba antes de este
   bloque (comprobado sobre el árbol sin tocar) y dejaba `pnpm run lint` en rojo. */
// frontend/apps/web/scripts/capturas-cierre-3b.mjs — capturas finales del cierre de la fase 3 (3-B).
//
// Toma la invitación PUBLICADA y el EDITOR en los tres viewports de la revisión de calidad visual.
// A diferencia de `capturar-invitaciones.mjs`, no lleva tokens escritos a mano: el token público y
// el id de invitación se pasan por variable de entorno, porque el `publicToken` cambia cada vez que
// se vuelve a sembrar la demostración (y en la fase 3-B cambió tres veces).
//
//   ORIGEN=http://127.0.0.1:3050 TOKEN_PUBLICO=pub_… INVITACION=3 \
//   API=http://127.0.0.1:6003 node scripts/capturas-cierre-3b.mjs <directorio>
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ORIGEN = process.env.ORIGEN ?? "http://127.0.0.1:3050";
const API = process.env.API ?? "http://127.0.0.1:6003";
const TOKEN_PUBLICO = process.env.TOKEN_PUBLICO;
const INVITACION = process.env.INVITACION ?? "3";
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";
const CLAVE_TOKEN = "invitaciones.auth.token";

const VIEWPORTS = [
  { nombre: "movil", width: 390, height: 844 },
  { nombre: "tableta", width: 820, height: 1180 },
  { nombre: "escritorio", width: 1440, height: 900 },
];

const destino = process.argv[2];
if (!destino) throw new Error("uso: node capturas-cierre-3b.mjs <directorio-destino>");
if (!TOKEN_PUBLICO) throw new Error("falta TOKEN_PUBLICO (el publicToken de la invitación sembrada)");
mkdirSync(destino, { recursive: true });

// Un solo `POST /auth/token` en todo el script: dos autenticaciones simultáneas de la misma cuenta
// dan 500 (`RefreshTokenService.kt:20`, ajeno), y desde I-02 encadenar fallos activa el 429.
const r = await fetch(`${API}/auth/token`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
if (!r.ok) throw new Error(`/auth/token respondió ${r.status}: ¿está sembrada la demostración?`);
const { accessToken } = await r.json();

const navegador = await chromium.launch({ executablePath: CHROMIUM });
const hechas = [];
try {
  for (const vp of VIEWPORTS) {
    const contexto = await navegador.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    await contexto.addInitScript(
      ([clave, valor]) => {
        try {
          window.sessionStorage.setItem(clave, valor);
        } catch {
          /* almacenamiento bloqueado: se verá en la captura */
        }
      },
      [CLAVE_TOKEN, accessToken],
    );

    const pagina = await contexto.newPage();

    // 1. La invitación publicada, tal y como la ve el invitado.
    await pagina.goto(`${ORIGEN}/i/${TOKEN_PUBLICO}`, { waitUntil: "networkidle" });
    // Las tipografías autoalojadas cargan después del primer pintado: sin esto la captura sale con
    // la familia de reserva y el juicio visual sería sobre algo que nadie ve (3-6, ADR-3-6-03).
    await pagina.evaluate(() => document.fonts.ready);
    const invitacion = path.join(destino, `invitacion-${vp.nombre}.png`);
    await pagina.screenshot({ path: invitacion, fullPage: false });
    hechas.push(invitacion);

    // 2. El editor.
    await pagina.goto(`${ORIGEN}/editor/${INVITACION}`, { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.waitForTimeout(1200); // la vista previa del lienzo pinta tras el saludo postMessage
    const editor = path.join(destino, `editor-${vp.nombre}.png`);
    await pagina.screenshot({ path: editor, fullPage: false });
    hechas.push(editor);

    await contexto.close();
    console.log(`  ${vp.nombre.padEnd(11)} ${vp.width}x${vp.height}  invitación + editor`);
  }
} finally {
  await navegador.close();
}
console.log(`\n${hechas.length} capturas en ${destino}`);
