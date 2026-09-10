#!/usr/bin/env node
/* eslint-disable no-undef -- el cuerpo de `page.evaluate()` corre en el NAVEGADOR: `document` y
   `window` son globales de ahí, no de este script Node. */
// scripts/capturas-admin.mjs — capturas de `/admin` (sesión E5-I) para que el dueño del producto
// juzgue el diseño de la consola con datos reales en pantalla. No es una prueba: no afirma nada.
// Mismo patrón que capturas-cierre-3c.mjs: backend real + `next start` ya sirviendo el build de
// producción, sesión MASTER creada por este propio script (signup + `UPDATE customer SET role`,
// receta de `.claude/skills/pruebas-producto/SKILL.md §3`), tres anchos (390/768/1280).
//
// Requiere backend arriba con datos (`scripts/dev-backend.sh start`, `scripts/seed-demo.sh`,
// `eval "$(scripts/seed/admin.sh)"`) y `PORT=3000 pnpm --filter web run start` sobre un
// `pnpm run build` reciente (fuentes copiadas a `apps/web/public/fonts/`).
//
// HALLAZGO (documentado en la bitácora, NO se arregla aquí): las cinco `TabsContent`
// (`ConsolaAdmin.tsx`) llevan `forceMount`, y Radix calcula `hidden = !(forceMount || isSelected)`
// — con `forceMount` fijo en `true` esa expresión es SIEMPRE `false`, así que NINGÚN panel recibe
// el atributo `hidden`: las cinco pestañas se ven apiladas a la vez, siempre, sin importar cuál
// esté "activa" (solo cambia la píldora resaltada). Por eso este script toma captura de página
// completa (para dejar constancia del defecto, `admin-bug-pestanas-apiladas-<ancho>.png`) Y ADEMÁS
// una captura recortada a la sección de cada pestaña (`section[aria-labelledby="admin-<x>-titulo"]`,
// vía `locator.screenshot()`) para que el resto de capturas sí sirvan para juzgar el diseño de esa
// pestaña sola — sin tocar el DOM ni el CSS, solo eligiendo qué región de la misma página guardar.
//
//   node scripts/capturas-admin.mjs [--port 3000] [--salida <dir>]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const PGBIN = process.env.TPL_TEST_PGBIN ?? "/usr/lib/postgresql/16/bin";
const ESTADO = `${process.env.TPL_TEST_STATE_DIR ?? "/tmp/templates2-pg"}/state.env`;
const DB = process.env.TPL_DEV_DB ?? "invitaciones_dev";
const CLAVE_TOKEN = "invitaciones.auth.token";
const PASS = "Demo1234!";

let puerto = process.env.PORT_WEB ?? "3000";
let salida = "/tmp/claude-0/-home-user-RSVP-Lino-y-Sello/0d371c90-7612-5d50-bc43-3665855ea9c5/scratchpad/capturas";
for (let i = 2; i < process.argv.length; i += 2) {
  if (process.argv[i] === "--port") puerto = process.argv[i + 1];
  if (process.argv[i] === "--salida") salida = path.resolve(process.argv[i + 1]);
}
if (!existsSync(salida)) mkdirSync(salida, { recursive: true });
const ORIGEN = `http://127.0.0.1:${puerto}`;

const ANCHOS = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "768", width: 768, height: 1024 },
  { nombre: "1280", width: 1280, height: 900 },
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

// Sesión MASTER propia de este script: signup por la ruta real (siempre crea USER,
// `CustomerService.kt:81`) y se eleva por SQL — el MISMO token sirve después, el rol se relee en
// cada petición desde `customer.role` (`JwtTokenFilter.kt:47`), nunca va en el JWT como claim fijo.
async function cuentaMaster() {
  const sufijo = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const email = `capturas-admin-${sufijo}@example.com`;
  const telefono = `+5255${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const alta = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Captura",
      lastName: "Admin",
      email,
      phone: telefono,
      birthdate: null,
      address: null,
      city: null,
      postalCode: null,
      state: null,
      howKnow: null,
      password: PASS,
    }),
  });
  if (!alta.ok) throw new Error(`signup falló: HTTP ${alta.status}: ${await alta.text()}`);
  const login = await fetch(`${API_BASE}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASS }),
  });
  if (!login.ok) throw new Error(`login falló: HTTP ${login.status}`);
  const { accessToken } = await login.json();
  sql(`UPDATE customer SET role = 'MASTER' WHERE email = '${email}';`);
  return { email, token: accessToken };
}

async function esperarFuentes(pagina) {
  await pagina.evaluate(async () => {
    await document.fonts.ready;
  });
  await pagina.waitForTimeout(250);
}

async function tirar(pagina, nombre, ancho, opciones = {}) {
  const { completa = true, locator = null } = opciones;
  await esperarFuentes(pagina);
  const destino = path.join(salida, `${nombre}-${ancho}.png`);
  if (locator) {
    await locator.screenshot({ path: destino, animations: "disabled" });
  } else {
    await pagina.screenshot({ path: destino, fullPage: completa, animations: "disabled" });
  }
  console.log(`  ${nombre}-${ancho}.png`);
}

/** Panel accesible de una pestaña (las cinco viven siempre en el DOM, `forceMount`). */
function panelDe(pagina, pestana) {
  return pagina.getByRole("tabpanel", { name: pestana });
}

/** Espera activa a que el panel deje de mostrar Skeleton (role=status) — nunca un timeout fijo. */
async function esperarPanelListo(panel, timeoutMs = 20_000) {
  const desde = Date.now();
  while (Date.now() - desde < timeoutMs) {
    const enCarga = await panel.getByRole("status").count();
    if (enCarga === 0) return;
    await panel.page().waitForTimeout(200);
  }
  throw new Error("el panel no terminó de cargar a tiempo (sigue con Skeleton)");
}

/** Espera activa a que la tabla tenga al menos `minimo` filas — el DOM de `Tabla.tsx` monta tabla Y
 * tarjetas SIEMPRE (CSS decide cuál se ve según el ancho), así que esto vale en los tres anchos. */
async function esperarFilas(panel, minimo = 1, timeoutMs = 15_000) {
  const desde = Date.now();
  while (Date.now() - desde < timeoutMs) {
    const filas = await panel.locator("table tbody tr").count();
    if (filas >= minimo) return filas;
    await panel.page().waitForTimeout(200);
  }
  throw new Error(`la tabla no llegó a ${minimo} fila(s) a tiempo`);
}

const navegador = await chromium.launch({
  executablePath: existsSync(RUTA_CHROMIUM) ? RUTA_CHROMIUM : undefined,
});

console.log("== sesión MASTER ==");
const { email, token } = await cuentaMaster();
console.log(`  ${email}`);

try {
  for (const ancho of ANCHOS) {
    console.log(`== ${ancho.nombre} px ==`);
    const contexto = await navegador.newContext({
      viewport: { width: ancho.width, height: ancho.height },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
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
    const pagina = await contexto.newPage();

    await pagina.goto(`${ORIGEN}/admin`, { waitUntil: "networkidle" });
    await pagina.getByRole("tablist").waitFor({ timeout: 20_000 });

    // ---------- Resumen ----------
    const resumen = panelDe(pagina, "Resumen");
    await esperarPanelListo(resumen);
    // Página completa: deja constancia del HALLAZGO de arriba (las cinco pestañas apiladas).
    await tirar(pagina, "admin-bug-pestanas-apiladas", ancho.nombre);
    // Recorte a solo la sección de Resumen: la vista limpia para juzgar ESA pestaña.
    await tirar(pagina, "admin-resumen", ancho.nombre, {
      locator: pagina.locator('section[aria-labelledby="admin-resumen-titulo"]'),
    });

    // ---------- Invitaciones ----------
    await pagina.getByRole("tab", { name: "Invitaciones" }).click();
    const invitaciones = panelDe(pagina, "Invitaciones");
    await esperarPanelListo(invitaciones);
    const filas = await esperarFilas(invitaciones, 1);
    console.log(`  invitaciones: ${filas} fila(s) en la tabla`);
    await tirar(pagina, "admin-invitaciones", ancho.nombre, {
      locator: pagina.locator('section[aria-labelledby="admin-invitaciones-titulo"]'),
    });

    // ---------- Solo a 390: primer plano del comportamiento móvil ----------
    // Tarjetas apiladas en vez de tabla, y la acción destructiva deshabilitada con su razón
    // visible (`AccionDeFila.tsx`: `data-testid="accion-fila-movil"` + el texto justo al lado).
    if (ancho.width === 390) {
      // `Tabla.tsx` monta tabla Y tarjetas SIEMPRE (CSS decide cuál se ve): el mismo
      // `data-testid="accion-fila-movil"` existe también dentro de la tabla de escritorio (oculta
      // a este ancho, `hidden sm:block`), así que hay que acotar a la instancia VISIBLE — la de la
      // tarjeta — con el pseudo-selector `:visible` de Playwright, nunca `.first()` a secas.
      const accionMovil = invitaciones.locator('[data-testid="accion-fila-movil"]:visible').first();
      await accionMovil.scrollIntoViewIfNeeded();
      await pagina.waitForTimeout(300);
      await tirar(pagina, "admin-invitaciones-movil-tarjetas", ancho.nombre, { completa: false });
    }

    // ---------- Bonus: Plantillas a 1280 (catálogo de solo lectura) ----------
    if (ancho.width === 1280) {
      await pagina.getByRole("tab", { name: "Plantillas" }).click();
      const plantillas = panelDe(pagina, "Plantillas");
      await esperarPanelListo(plantillas);
      await tirar(pagina, "admin-plantillas", ancho.nombre, {
        locator: pagina.locator('section[aria-labelledby="admin-plantillas-titulo"]'),
      });
    }

    await contexto.close();
  }
} finally {
  await navegador.close();
}

console.log(`\nListo. PNG en ${salida}`);
