#!/usr/bin/env node
/* eslint-disable no-undef -- el cuerpo de `page.evaluate()` corre en el NAVEGADOR: `document` y
   `window` son globales de ahí, no de este script Node. */
// scripts/capturas-cierre-3c.mjs — capturas de la REVISIÓN DE CALIDAD VISUAL del cierre de la
// fase 3-C. No es una prueba: no afirma nada. Genera, de forma reproducible, todas las pantallas del
// producto en tres anchos (390, 768, 1440) para que la revisión humana mire exactamente lo mismo.
//
// Requiere: backend real con `scripts/seed-demo.sh` ya corrido y un `next start` escuchando.
//   TPL_TEST_STATE_DIR=/tmp/pg-cv TPL_DEV_DB=invitaciones_cv \
//   NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:6109 node scripts/capturas-cierre-3c.mjs --port 3109
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6109";
const DEMO_EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const DEMO_PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";
const PGBIN = process.env.TPL_TEST_PGBIN ?? "/usr/lib/postgresql/16/bin";
const ESTADO = `${process.env.TPL_TEST_STATE_DIR ?? "/tmp/pg-cv"}/state.env`;
const DB = process.env.TPL_DEV_DB ?? "invitaciones_cv";
const CLAVE_TOKEN = "invitaciones.auth.token";

let puerto = process.env.PORT_WEB ?? "3109";
let salida = path.resolve(AQUI, "../../../../docs/rediseno-plantillas/evidencia/fase-3c/cierre/visual");
let soloGrupo = null;
for (let i = 2; i < process.argv.length; i += 2) {
  if (process.argv[i] === "--port") puerto = process.argv[i + 1];
  if (process.argv[i] === "--salida") salida = path.resolve(process.argv[i + 1]);
  if (process.argv[i] === "--grupo") soloGrupo = process.argv[i + 1];
}
if (!existsSync(salida)) mkdirSync(salida, { recursive: true });
const ORIGEN = `http://127.0.0.1:${puerto}`;

const ANCHOS = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "768", width: 768, height: 1024 },
  { nombre: "1440", width: 1440, height: 900 },
];

function sql(consulta) {
  const puertoPg = readFileSync(ESTADO, "utf8").match(/TPL_TEST_PGPORT=(\d+)/)?.[1];
  if (!puertoPg) throw new Error(`No encuentro el clúster efímero en ${ESTADO}`);
  return execFileSync(
    `${PGBIN}/psql`,
    ["-h", "127.0.0.1", "-p", puertoPg, "-U", "postgres", "-d", DB, "-v", "ON_ERROR_STOP=1", "-Atqc", consulta],
    { encoding: "utf8" },
  ).trim();
}

async function jwtDemo() {
  const r = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASS }),
  });
  if (!r.ok) throw new Error(`login falló: HTTP ${r.status}`);
  return (await r.json()).accessToken;
}

async function esperarFuentes(pagina) {
  await pagina.evaluate(async () => {
    await document.fonts.ready;
  });
  await pagina.waitForTimeout(250);
}

async function tirar(pagina, nombre, ancho, { completa = true } = {}) {
  await esperarFuentes(pagina);
  const destino = path.join(salida, `${nombre}-${ancho}.png`);
  await pagina.screenshot({ path: destino, fullPage: completa, animations: "disabled" });
  console.log(`  ${nombre}-${ancho}.png`);
}

const navegador = await chromium.launch({
  executablePath: existsSync(RUTA_CHROMIUM) ? RUTA_CHROMIUM : undefined,
});
const token = await jwtDemo();
const invitacion = sql("SELECT id FROM invitation WHERE uses_templates2 ORDER BY id LIMIT 1;");
console.log(`invitación sembrada: ${invitacion}`);

try {
  for (const ancho of ANCHOS) {
    console.log(`== ${ancho.nombre} px ==`);
    const contexto = await navegador.newContext({
      viewport: { width: ancho.width, height: ancho.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const pagina = await contexto.newPage();

    // ---------- web pública, sin sesión ----------
    if (!soloGrupo || soloGrupo === "sitio") {
      await pagina.goto(`${ORIGEN}/`, { waitUntil: "networkidle" });
      await tirar(pagina, "01-portada", ancho.nombre);

      await pagina.goto(`${ORIGEN}/acceso`, { waitUntil: "networkidle" });
      await tirar(pagina, "02-acceso-entrar", ancho.nombre);

      // Error de credenciales: es una pantalla del sistema, no un `alert`.
      await pagina.getByLabel("Correo electrónico").fill("nadie@example.com");
      await pagina.getByLabel("Contraseña", { exact: true }).fill("Incorrecta123!");
      await pagina.getByRole("button", { name: "Iniciar sesión" }).click();
      await pagina.waitForTimeout(1500);
      await tirar(pagina, "03-acceso-error", ancho.nombre);

      await pagina.goto(`${ORIGEN}/acceso`, { waitUntil: "networkidle" });
      await pagina.getByRole("tab", { name: "Crear cuenta" }).click();
      await tirar(pagina, "04-acceso-crear-cuenta", ancho.nombre);

      await pagina.goto(`${ORIGEN}/acceso`, { waitUntil: "networkidle" });
      await pagina.getByRole("button", { name: /olvid/i }).click();
      await tirar(pagina, "05-acceso-recuperar", ancho.nombre);

      await pagina.goto(`${ORIGEN}/ayuda`, { waitUntil: "networkidle" });
      await tirar(pagina, "06-ayuda", ancho.nombre);

      await pagina.getByRole("searchbox").fill("zzzz");
      await pagina.waitForTimeout(400);
      await tirar(pagina, "07-ayuda-sin-resultados", ancho.nombre);

      await pagina.goto(`${ORIGEN}/esta-ruta-no-existe`, { waitUntil: "networkidle" });
      await tirar(pagina, "08-404", ancho.nombre);
    }

    // ---------- con sesión ----------
    if (!soloGrupo || soloGrupo === "editor") {
      await contexto.addInitScript(
        ([clave, valor]) => {
          try {
            window.sessionStorage.setItem(clave, valor);
          } catch {
            /* almacenamiento bloqueado */
          }
        },
        [CLAVE_TOKEN, token],
      );

      await pagina.goto(`${ORIGEN}/editor?paso=evento`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1200);
      await tirar(pagina, "09-asistente-1-evento", ancho.nombre);

      await pagina.goto(`${ORIGEN}/editor?paso=plantilla&tipo=WEDDING`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1500);
      await tirar(pagina, "10-asistente-2-plantilla", ancho.nombre);

      await pagina.goto(`${ORIGEN}/editor?paso=datos&tipo=WEDDING&inv=${invitacion}`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1500);
      await tirar(pagina, "11-asistente-3-datos", ancho.nombre);

      await pagina.goto(`${ORIGEN}/editor?paso=listo&tipo=WEDDING&inv=${invitacion}`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(1200);
      await tirar(pagina, "12-asistente-4-listo", ancho.nombre);

      // Editor
      await pagina.goto(`${ORIGEN}/editor/${invitacion}`, { waitUntil: "networkidle" });
      await pagina.getByRole("heading", { name: "Secciones" }).waitFor({ timeout: 30_000 });
      await pagina.waitForTimeout(2500);
      await tirar(pagina, "13-editor-secciones", ancho.nombre, { completa: false });

      if (ancho.width >= 768) {
        await pagina.getByTestId("section-row-cover").click();
        await pagina.waitForTimeout(900);
        await tirar(pagina, "14-editor-panel-bloque", ancho.nombre, { completa: false });
        await pagina.getByRole("button", { name: "Volver a secciones" }).click();
        await pagina.waitForTimeout(500);

        const galeria = pagina.getByTestId("section-row-gallery");
        if (await galeria.count()) {
          await galeria.click();
          await pagina.waitForTimeout(900);
          await tirar(pagina, "15-editor-fotos", ancho.nombre, { completa: false });
          await pagina.getByRole("button", { name: "Volver a secciones" }).click();
          await pagina.waitForTimeout(500);
        }

        await pagina.getByTestId("abrir-publicar").click();
        await pagina.waitForTimeout(2500);
        await tirar(pagina, "16-publicar-antes", ancho.nombre, { completa: false });
        const confirmar = pagina.getByTestId("confirmar-publicar");
        if (await confirmar.isEnabled()) {
          await confirmar.click();
          await pagina.waitForTimeout(4000);
          await tirar(pagina, "17-publicar-despues", ancho.nombre, { completa: false });
        }
        await pagina.keyboard.press("Escape");
      } else {
        await pagina.getByRole("tab", { name: "Vista previa" }).click();
        await pagina.waitForTimeout(1500);
        await tirar(pagina, "14-editor-vista-previa", ancho.nombre, { completa: false });
      }

      // Estado de error del editor: invitación inexistente.
      await pagina.goto(`${ORIGEN}/editor/99999`, { waitUntil: "networkidle" });
      await pagina.waitForTimeout(2000);
      await tirar(pagina, "18-editor-error", ancho.nombre);
    }

    await contexto.close();
  }
} finally {
  await navegador.close();
}
