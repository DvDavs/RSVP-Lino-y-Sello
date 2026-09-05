#!/usr/bin/env node
/* eslint-disable no-undef -- `page.evaluate(() => ...)` corre en el NAVEGADOR: `window`/`navigator`
   son globales de ahí, no de este script Node; el linter de este proyecto no distingue el contexto
   de una función pasada a `evaluate`. */
// scripts/capturas-editor.mjs — captura las 6 imágenes de evidencia del bloque 3-5 (brief §7), a
// 1440×900, contra el backend real y la build de producción ya generada (`pnpm run build`).
//
// No es un e2e (no se ejecuta con Playwright Test ni cuenta como archivo del bloque 3-5 en `e2e/`,
// que son solo `paneles.spec.ts`/`secciones.spec.ts`/`publicar.spec.ts`/`imagenes.spec.ts`): es un
// script de un solo uso para las capturas de `docs/rediseno-plantillas/evidencia/fase-3/editor/`.
// Reutiliza el gancho `NEXT_PUBLIC_E2E_HOOKS=1` para sembrar el manifiesto/tema REALES de
// `boda-clasica@1.0.0` (mismo fixture que `e2e/preparar-panel.ts`), porque el contrato nuevo
// (`manifest` en `GET .../document`) todavía no llega por HTTP.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..");
const PUERTO = 3012;
const ORIGEN = `http://127.0.0.1:${PUERTO}`;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
const EVIDENCIA = path.resolve(RAIZ, "../../../docs/rediseno-plantillas/evidencia/fase-3/editor");
const DEMO_EMAIL = "demo.boda@example.com";
const DEMO_PASS = "Demo1234!";
const INVITATION_ID = 3;

const MANIFIESTO = JSON.parse(readFileSync(path.join(RAIZ, "test/fixtures/boda-clasica.manifest.json"), "utf8"));
const TEMA = JSON.parse(readFileSync(path.join(RAIZ, "test/fixtures/boda-clasica.theme.json"), "utf8"));

mkdirSync(EVIDENCIA, { recursive: true });

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function operaciones(token, ops) {
  const docRes = await fetch(`${API_BASE}/editor/invitations/${INVITATION_ID}/document`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const doc = await docRes.json();
  const r = await fetch(`${API_BASE}/editor/invitations/${INVITATION_ID}/document/operations`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ baseRevision: doc.revision, clientBatchId: `captura${Date.now().toString(36)}`, operations: ops }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function esperarServidor(url, intentos = 60) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* aún no arranca */
    }
    await esperar(1000);
  }
  throw new Error(`El servidor no respondió en ${url}`);
}

async function main() {
  console.log("→ token demo…");
  const token = await jwtDemo();
  const contenidoAntes = await (
    await fetch(`${API_BASE}/editor/invitations/${INVITATION_ID}/document`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  const tituloOriginal = contenidoAntes.document.content["cover.title"];

  // `NEXT_PUBLIC_*` se INCRUSTA en el bundle en tiempo de `next build`, no de `next start`
  // (hallazgo real de esta sesión): hace falta reconstruir con la variable puesta, igual que
  // `playwright.config.ts` hace en un solo `command`.
  console.log("→ reconstruyendo con NEXT_PUBLIC_E2E_HOOKS=1 y arrancando en", PUERTO, "…");
  const rutaChromiumLocal = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const envServidor = {
    ...process.env,
    PORT: String(PUERTO),
    NEXT_PUBLIC_API_BASE_URL: API_BASE,
    NEXT_PUBLIC_EDITOR_ORIGIN: ORIGEN,
    NEXT_PUBLIC_CDN_ORIGIN: API_BASE,
    NEXT_PUBLIC_E2E_HOOKS: "1",
  };
  await new Promise((resolve, reject) => {
    const build = spawn("pnpm", ["run", "build"], { cwd: RAIZ, env: envServidor, stdio: "inherit" });
    build.on("exit", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`build salió con ${codigo}`))));
  });
  const servidor = spawn("pnpm", ["run", "start"], {
    cwd: RAIZ,
    env: envServidor,
    stdio: ["ignore", "pipe", "pipe"],
  });
  servidor.stdout.on("data", () => {});
  servidor.stderr.on("data", (d) => process.stderr.write(d));

  try {
    await esperarServidor(`${ORIGEN}/editor`);
    console.log("→ servidor listo, abriendo navegador…");

    const browser = await chromium.launch({
      executablePath: existsSync(rutaChromiumLocal) ? rutaChromiumLocal : undefined,
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.addInitScript(([clave, valor]) => {
      try {
        window.sessionStorage.setItem(clave, valor);
      } catch {
        /* ventana privada */
      }
    }, ["invitaciones.auth.token", token]);

    await page.goto(`${ORIGEN}/editor/${INVITATION_ID}`);
    await page.getByTestId("section-row-cover").waitFor({ timeout: 20_000 });
    await page.waitForFunction(() => Boolean(window.__seedManifestFixture));
    await page.evaluate(
      ([id, clave, manifest, theme]) => window.__seedManifestFixture(id, clave, manifest, theme),
      [INVITATION_ID, "boda-clasica@1.0.0", MANIFIESTO, TEMA],
    );
    await esperar(400); // el store reacciona al cambio de época del fixture

    // ── 1. panel-contenido.png — sección "Los novios": variante, texto, persona, richText, fotos, fecha de negocio
    console.log("→ panel-contenido.png");
    await page.getByTestId("section-row-couple").click();
    await page.getByRole("heading", { name: /los novios/i }).waitFor();
    await esperar(300);
    await page.screenshot({ path: path.join(EVIDENCIA, "panel-contenido.png") });

    // ── 2. paleta-tipografia.png — Apariencia con vista previa en vivo (hover sobre "Olivo y marfil")
    console.log("→ paleta-tipografia.png");
    await page.getByRole("button", { name: /volver a secciones/i }).click();
    await page.getByTestId("paleta-olive").waitFor({ timeout: 5_000 });
    await page.getByTestId("paleta-olive").hover();
    await esperar(900); // `PREVIEW_THEME` es efímero (sin operación, 04 §9.3): da tiempo al repintado
    await page.screenshot({ path: path.join(EVIDENCIA, "paleta-tipografia.png") });
    await page.mouse.move(10, 10); // quita el hover antes de seguir
    await esperar(300);

    // ── 3. reordenar.png — el menú ⋮ (alternativa sin arrastre, requisito AA 2.5.7) abierto
    console.log("→ reordenar.png");
    await page.getByTestId("section-menu-event").click();
    await page.getByRole("menuitem", { name: "Subir" }).waitFor();
    await esperar(200);
    await page.screenshot({ path: path.join(EVIDENCIA, "reordenar.png") });
    await page.keyboard.press("Escape");

    // ── 4. gestor-fotos.png — galería con fotos, dnd-kit y zona de soltar
    console.log("→ gestor-fotos.png");
    await page.getByTestId("section-row-gallery").click();
    await page.getByText("Galería — 6 de 12 fotos").waitFor({ timeout: 10_000 });
    await esperar(1200); // el desplazamiento suave del lienzo (§17.5) tarda más que el del panel
    await page.screenshot({ path: path.join(EVIDENCIA, "gestor-fotos.png") });

    // ── 5. publicar.png — preflight con un bloqueo real y accionable ───────────────────────────
    console.log("→ publicar.png (con un bloqueo temporal)");
    await operaciones(token, [{ op: "clearBlock", blockId: "cover.title" }]);
    await page.getByTestId("abrir-publicar").click();
    await page.getByText(/sigue con el texto de ejemplo/i).waitFor({ timeout: 10_000 });
    await esperar(200);
    await page.screenshot({ path: path.join(EVIDENCIA, "publicar.png") });
    await page.getByRole("button", { name: "Cerrar" }).click();
    await operaciones(token, [{ op: "setBlock", blockId: "cover.title", value: tituloOriginal }]);

    // ── 6. enlace-copiado.png — publicar sin bloqueos y copiar el enlace ───────────────────────
    console.log("→ enlace-copiado.png");
    await page.reload();
    await page.getByTestId("section-row-cover").waitFor({ timeout: 20_000 });
    // El fixture del manifiesto vive solo en memoria del cliente (el contrato `manifest` en
    // `GET .../document` todavía no existe, `lib/manifest.ts`): un `reload()` limpia ese estado, así
    // que hay que volver a sembrarlo o la lista de secciones no puede confirmar cuáles son
    // obligatorias (cae al valor conservador `required: true` para TODAS, `SectionList.tsx`).
    await page.waitForFunction(() => Boolean(window.__seedManifestFixture));
    await page.evaluate(
      ([id, clave, manifest, theme]) => window.__seedManifestFixture(id, clave, manifest, theme),
      [INVITATION_ID, "boda-clasica@1.0.0", MANIFIESTO, TEMA],
    );
    await esperar(400);
    await page.getByTestId("abrir-publicar").waitFor({ timeout: 20_000 });
    await page.evaluate(() => {
      window.navigator.clipboard = { writeText: async () => undefined };
    });
    await page.getByTestId("abrir-publicar").click();
    await page.getByTestId("confirmar-publicar").waitFor({ timeout: 10_000 });
    await page.getByTestId("confirmar-publicar").click();
    await page.getByTestId("enlace-publicado").waitFor({ timeout: 15_000 });
    await page.getByTestId("copiar-enlace").click();
    await page.getByText(/enlace copiado/i).waitFor({ timeout: 5_000 });
    await esperar(200);
    await page.screenshot({ path: path.join(EVIDENCIA, "enlace-copiado.png") });

    await browser.close();
    console.log("✓ 6 capturas listas en", EVIDENCIA);
  } finally {
    servidor.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
