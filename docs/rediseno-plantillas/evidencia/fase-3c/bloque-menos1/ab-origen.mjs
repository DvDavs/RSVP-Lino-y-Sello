// docs/rediseno-plantillas/evidencia/fase-3c/bloque-menos1/ab-origen.mjs
//
// N-02 (`ADR-3C-N02-01`) · LA MISMA prueba A/B que midió la revisión adversarial de la fase 3-B
// (`bitacora/3b-adv.md §6.2`), repetida sobre el código corregido.
//
// El protocolo, literal:
//   1. Se construye `apps/web` UNA sola vez, horneando a propósito `NEXT_PUBLIC_EDITOR_ORIGIN` y
//      `NEXT_PUBLIC_SITE_URL` con `http://127.0.0.1:3050` — el origen "equivocado" para uno de los
//      dos servidores. Si esas constantes siguieran mandando, el servidor de `:3000` estaría roto.
//   2. Se sirve ESE MISMO `.next` en `:3050` y en `:3000`, con el backend y la siembra vivos.
//   3. En cada puerto se comprueba, con Chromium de verdad:
//        · el `<iframe>` del lienzo está presente
//        · `frames /canvas` = 1
//        · el lienzo está PINTADO (hay `section[data-section-key]` dentro del marco)
//        · cero violaciones de CSP en la consola del navegador
//        · el enlace público que se enseña usa el puerto por el que navega la clienta
//   4. Una captura por puerto.
//
// POR QUÉ ESTO NO ES UN e2e DE PLAYWRIGHT. La compuerta que faltaba es precisamente que
// `playwright.config.ts` **reconstruye** con el mismo origen que después sirve (`webServer.command`
// es `pnpm run build && pnpm run start`, con `NEXT_PUBLIC_EDITOR_ORIGIN` derivado del propio
// `PW_PORT`). Un spec dentro de ese arnés mediría, otra vez, un build hecho a medida del puerto: es
// el punto ciego que describe `bitacora/3b-adv.md §6.2` («ninguna compuerta lo ve»). Lo que hay que
// demostrar es lo contrario —un build hecho para OTRO puerto—, y eso exige controlar el build y los
// dos servidores desde fuera del arnés. Por eso vive aquí, con su salida guardada, y no en `e2e/`.
// Lo que sí quedó encapsulado en pruebas normales es cada mitad del mecanismo:
// `test/proxy-origen.test.ts` (qué origen nombra la CSP), `lib/canvas-bridge.test.ts`
// (`origenDelPadre`) y `lib/enlace-publico.test.ts` (el orden del enlace y la aserción de arranque).
//
// Uso:
//   scripts/dev-backend.sh start && scripts/seed-demo.sh
//   node docs/rediseno-plantillas/evidencia/fase-3c/bloque-menos1/ab-origen.mjs
//
// Variables: API (por defecto http://127.0.0.1:6003), PUERTO_A (3050), PUERTO_B (3000),
// SALTAR_BUILD=1 para reutilizar el `.next` que ya haya (útil al repetir la medición).
/* eslint-disable no-undef -- los cuerpos de `page.evaluate` corren en el NAVEGADOR. */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../../../../..");
const WEB = path.join(RAIZ, "frontend/apps/web");

// Este archivo vive FUERA del espacio de trabajo de pnpm (está en `docs/`, con la evidencia que
// documenta), así que un `import "@playwright/test"` a secas no resuelve: Node busca desde la
// carpeta del módulo, no desde el `cwd`. Se resuelve a mano contra `frontend/apps/web`, que es quien
// tiene la dependencia. El navegador es el Chromium preinstalado (`contratos.md §7`: nunca
// `playwright install`).
const requiereDesdeWeb = createRequire(path.join(WEB, "package.json"));
const modPw = await import(pathToFileURL(requiereDesdeWeb.resolve("@playwright/test")).href);
const chromium = modPw.chromium ?? modPw.default?.chromium;

const API = process.env.API ?? "http://127.0.0.1:6003";
const PUERTO_A = process.env.PUERTO_A ?? "3050";
const PUERTO_B = process.env.PUERTO_B ?? "3000";
/** El origen que se HORNEA en el build. A propósito el de `PUERTO_A`: para `PUERTO_B` es mentira. */
const ORIGEN_HORNEADO = `http://127.0.0.1:${PUERTO_A}`;
const EMAIL = process.env.TPL_DEMO_EMAIL ?? "demo.boda@example.com";
const PASS = process.env.TPL_DEMO_PASS ?? "Demo1234!";

const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(CHROMIUM) ? CHROMIUM : undefined;

function log(...xs) {
  console.log(...xs);
}

async function esperarPuerto(url, segundos = 180) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      /* todavía no escucha */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Descubre la invitación publicada y su `publicToken` por la API real (como hace `lighthouserc`). */
async function descubrirDemo() {
  const t = await fetch(`${API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!t.ok) throw new Error(`auth/token ${t.status}`);
  const { accessToken } = await t.json();
  for (let id = 1; id <= 24; id++) {
    const r = await fetch(`${API}/editor/invitations/${id}/document`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (r.status !== 200) continue;
    const d = await r.json();
    if (!d.publicToken) continue;
    const e = await fetch(`${API}/public/i/${d.publicToken}/exists`);
    if (!e.ok) continue;
    if (!(await e.json()).published) continue;
    return { accessToken, invitationId: id, publicToken: d.publicToken };
  }
  throw new Error("sin invitación publicada: ejecuta scripts/seed-demo.sh");
}

function arrancar(puerto, extra = {}) {
  const hijo = spawn("pnpm", ["run", "start"], {
    cwd: WEB,
    env: {
      ...process.env,
      PORT: puerto,
      NEXT_PUBLIC_API_BASE_URL: API,
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET ?? "e2e-secreto-de-pruebas",
      NEXT_PUBLIC_E2E_HOOKS: "1",
      ...extra,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let salida = "";
  hijo.stdout.on("data", (b) => (salida += b.toString()));
  hijo.stderr.on("data", (b) => (salida += b.toString()));
  return { hijo, texto: () => salida };
}

/** Mide un puerto: iframe, frames, pintado, violaciones de CSP y enlace público. */
async function medir(navegador, puerto, demo, destino) {
  const base = `http://127.0.0.1:${puerto}`;
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const violaciones = [];
  const consola = [];
  contexto.on("console", (m) => {
    const t = m.text();
    consola.push(t);
    if (/Content Security Policy|Refused to (frame|load|execute)/i.test(t)) violaciones.push(t);
  });

  // La sesión, por la misma clave de `sessionStorage` que usa `e2e/preparar.ts`.
  await contexto.addInitScript(
    ([clave, valor]) => {
      try {
        window.sessionStorage.setItem(clave, valor);
      } catch {
        /* almacenamiento bloqueado */
      }
    },
    ["invitaciones.auth.token", demo.accessToken],
  );

  const pagina = await contexto.newPage();
  await pagina.goto(`${base}/editor/${demo.invitationId}`, { waitUntil: "domcontentloaded" });

  const marco = pagina.frameLocator('iframe[title="Vista previa de la invitación"]');
  let pintado = false;
  try {
    await marco.locator("section[data-section-key]").first().waitFor({ state: "visible", timeout: 45_000 });
    pintado = true;
  } catch {
    pintado = false;
  }

  const hayIframe = (await pagina.locator('iframe[title="Vista previa de la invitación"]').count()) > 0;
  const framesCanvas = pagina.frames().filter((f) => f.url().includes("/canvas")).length;

  // Cabecera servida por el propio servidor para la ruta del lienzo.
  const respuestaCsp = await pagina.request.get(`${base}/editor/${demo.invitationId}/canvas`);
  const csp = respuestaCsp.headers()["content-security-policy"] ?? "";
  const frameAncestors = /frame-ancestors ([^;]+)/.exec(csp)?.[1]?.trim() ?? "(ninguno)";

  // Violaciones vistas DENTRO del documento del lienzo, con su propio recolector.
  const frameLienzo = pagina.frames().find((f) => f.url().includes("/canvas"));
  let violacionesLienzo = [];
  if (frameLienzo) {
    try {
      violacionesLienzo = await frameLienzo.evaluate(() => window.__cspViolations ?? []);
    } catch {
      violacionesLienzo = [{ error: "no se pudo leer __cspViolations" }];
    }
  }

  // El enlace público REAL: el que el diálogo de publicado enseña en «Copiar enlace» y en «Ver como
  // invitado». No se calcula aquí —eso sería medir la propia prueba—: se abre el diálogo del
  // producto, se publica y se lee el texto del widget. Es exactamente el widget que la revisión de
  // 3-B pilló entregando `:3050` mientras la clienta navegaba en `:3000`.
  let enlace = "(no se pudo leer el diálogo de publicado)";
  let enlaceInvitado = "(sin enlace)";
  let enlaceWhatsapp = "(sin enlace)";
  try {
    await pagina.getByTestId("abrir-publicar").click({ timeout: 20_000 });
    const confirmar = pagina.getByTestId("confirmar-publicar");
    await confirmar.waitFor({ state: "visible", timeout: 20_000 });
    await pagina.waitForFunction(
      () => {
        const b = document.querySelector('[data-testid="confirmar-publicar"]');
        return Boolean(b) && !b.disabled;
      },
      undefined,
      { timeout: 30_000 },
    );
    await confirmar.click();
    const salida = pagina.getByTestId("enlace-publicado");
    await salida.waitFor({ state: "visible", timeout: 45_000 });
    enlace = ((await salida.textContent()) ?? "").trim();
    enlaceInvitado = (await pagina.getByRole("link", { name: /ver como invitado/i }).getAttribute("href")) ?? "(sin href)";
    enlaceWhatsapp = (await pagina.getByRole("link", { name: /whatsapp/i }).getAttribute("href")) ?? "(sin href)";
  } catch (e) {
    enlace = `(fallo al publicar: ${String(e).split("\n")[0]})`;
  }
  // Y ese enlace tiene que ABRIR en este puerto, no sólo parecerlo.
  const publica = await pagina.request.get(enlace.startsWith("http") ? enlace : `${base}/i/${demo.publicToken}`);

  await pagina.screenshot({ path: path.join(destino, `editor-${puerto}.png`), fullPage: false });
  await contexto.close();

  return {
    puerto,
    hayIframe,
    framesCanvas,
    pintado,
    frameAncestors,
    violacionesConsola: violaciones,
    violacionesLienzo,
    enlacePublico: enlace,
    enlaceVerComoInvitado: enlaceInvitado,
    enlaceWhatsapp: enlaceWhatsapp,
    enlacePublicoStatus: publica.status(),
    erroresConsola: consola.filter((t) => /error/i.test(t)).slice(0, 5),
  };
}

async function principal() {
  const destino = path.join(AQUI, "capturas");
  mkdirSync(destino, { recursive: true });

  log("===============================================================================");
  log(" N-02 · A/B sobre EL MISMO build en dos puertos");
  log(` build horneado con NEXT_PUBLIC_EDITOR_ORIGIN=${ORIGEN_HORNEADO}`);
  log(`                    NEXT_PUBLIC_SITE_URL=${ORIGEN_HORNEADO}`);
  log(` servido en :${PUERTO_A} (coincide) y en :${PUERTO_B} (NO coincide)`);
  log(` ${new Date().toISOString()}`);
  log("===============================================================================");

  if (process.env.SALTAR_BUILD !== "1") {
    log("\n-- 1. build ÚNICO -------------------------------------------------------------");
    execFileSync("pnpm", ["run", "build"], {
      cwd: WEB,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: API,
        NEXT_PUBLIC_EDITOR_ORIGIN: ORIGEN_HORNEADO,
        NEXT_PUBLIC_SITE_URL: ORIGEN_HORNEADO,
        NEXT_PUBLIC_CDN_ORIGIN: API,
      },
    });
  } else {
    log("\n-- 1. build ÚNICO ------------------------------------------------- (SALTADO)");
  }

  const demo = await descubrirDemo();
  log(`\ninvitación de demostración: id=${demo.invitationId} publicToken=${demo.publicToken}`);

  // ── 2. La aserción de arranque, ANTES de nada: el servidor de :3000 debe NEGARSE a arrancar ──
  log("\n-- 2. la aserción de arranque de N-02 ------------------------------------------");
  log(`   se intenta servir el build de :${PUERTO_A} en :${PUERTO_B} SIN la puerta de escape`);
  const fallido = arrancar(PUERTO_B, {
    NEXT_PUBLIC_EDITOR_ORIGIN: ORIGEN_HORNEADO,
    NEXT_PUBLIC_SITE_URL: ORIGEN_HORNEADO,
  });
  const codigo = await new Promise((r) => {
    // Un colchón tras el `exit`: los `data` de stdout/stderr pueden entregarse DESPUÉS del evento
    // de salida, y sin él el mensaje del aborto se leería vacío por carrera, no por ausencia.
    fallido.hijo.on("exit", (c) => setTimeout(() => r(c), 1500));
    setTimeout(() => r("(sigue vivo)"), 40_000);
  });
  const motivo =
    /ARRANQUE ABORTADO[\s\S]{0,900}?(?=\n\u2550{10})/.exec(fallido.texto())?.[0]?.replace(/\n\s*/g, " ") ??
    "(sin mensaje de arranque)";
  log(`   salida del proceso: ${codigo}`);
  log(`   ${motivo}`);
  if (codigo === "(sigue vivo)") {
    fallido.hijo.kill("SIGKILL");
    log("   AVISO: el proceso NO murió. La aserción de arranque no está haciendo su trabajo.");
    await new Promise((r) => setTimeout(r, 2000));
  } else {
    log("   el proceso murió: la aserción de arranque SÍ impide servir un build desalineado.");
  }

  // ── 3. Los dos servidores, con la puerta de escape puesta a propósito ────────────────────────
  log("\n-- 3. el MISMO build servido en los dos puertos --------------------------------");
  const servidores = [];
  for (const puerto of [PUERTO_A, PUERTO_B]) {
    const s = arrancar(puerto, {
      NEXT_PUBLIC_EDITOR_ORIGIN: ORIGEN_HORNEADO,
      NEXT_PUBLIC_SITE_URL: ORIGEN_HORNEADO,
      // Puerta de escape EXPLÍCITA: aquí servimos a propósito un build de otro origen, que es lo
      // que esta medición existe para comprobar. En un despliegue de verdad esto no se pone.
      PERMITIR_ORIGEN_DESALINEADO: "1",
    });
    servidores.push(s);
    const listo = await esperarPuerto(`http://127.0.0.1:${puerto}/editor`);
    log(`   :${puerto} ${listo ? "escuchando" : "NO ARRANCÓ"}`);
    if (!listo) log(s.texto().slice(-1500));
  }

  const navegador = await chromium.launch(executablePath ? { executablePath } : {});
  const resultados = [];
  try {
    for (const puerto of [PUERTO_A, PUERTO_B]) {
      log(`\n-- 4. medición en :${puerto} ${"-".repeat(Math.max(0, 50 - puerto.length))}`);
      const r = await medir(navegador, puerto, demo, destino);
      resultados.push(r);
      log(`   iframe del lienzo presente ........ ${r.hayIframe}`);
      log(`   frames /canvas ................... ${r.framesCanvas}`);
      log(`   lienzo pintado ................... ${r.pintado}`);
      log(`   frame-ancestors servido .......... ${r.frameAncestors}`);
      log(`   violaciones de CSP en consola .... ${r.violacionesConsola.length} ${JSON.stringify(r.violacionesConsola)}`);
      log(`   violaciones dentro del lienzo .... ${r.violacionesLienzo.length} ${JSON.stringify(r.violacionesLienzo)}`);
      log(`   «Copiar enlace» ................... ${r.enlacePublico}`);
      log(`   «Ver como invitado» (href) ....... ${r.enlaceVerComoInvitado}`);
      log(`   texto de WhatsApp (href) ......... ${r.enlaceWhatsapp}`);
      log(`   ese enlace abre en este puerto ... HTTP ${r.enlacePublicoStatus}`);
      log(`   captura .......................... capturas/editor-${puerto}.png`);
    }
  } finally {
    await navegador.close();
    for (const s of servidores) {
      try {
        s.hijo.kill("SIGTERM");
      } catch {
        /* ya muerto */
      }
    }
  }

  log("\n-- 5. veredicto ---------------------------------------------------------------");
  let ok = true;
  for (const r of resultados) {
    const esperado = `http://127.0.0.1:${r.puerto}`;
    const bien =
      r.hayIframe &&
      r.framesCanvas === 1 &&
      r.pintado &&
      r.violacionesConsola.length === 0 &&
      r.violacionesLienzo.length === 0 &&
      r.frameAncestors === esperado &&
      r.enlacePublico.startsWith(`${esperado}/i/`) &&
      r.enlaceVerComoInvitado.startsWith(`${esperado}/i/`) &&
      r.enlaceWhatsapp.includes(encodeURIComponent(`${esperado}/i/`)) &&
      r.enlacePublicoStatus === 200;
    ok = ok && bien;
    log(`   :${r.puerto} ${bien ? "CUMPLE" : "NO CUMPLE"}`);
  }
  log(ok ? "\n   N-02 CERRADA: el mismo artefacto sirve bien en los dos puertos." : "\n   N-02 SIGUE ABIERTA.");
  process.exit(ok ? 0 : 1);
}

principal().catch((e) => {
  console.error(e);
  process.exit(2);
});
