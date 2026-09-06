// e2e/landing.spec.ts — la PORTADA (`/`), la pantalla que antes era un 404 en inglés.
//
// Qué vigila, en este orden de importancia:
//  1. Que exista y diga lo que tiene que decir (`11 §7`), a 390 y a 1440.
//  2. Que NINGÚN enlace lleve a un callejón: cada destino interno responde de verdad, no se
//     comprueba solo que el `href` no sea «#» (ese era el defecto U-1 y la comprobación floja).
//  3. `axe` AA sin violaciones críticas ni serias, en los dos anchos.
//  4. El presupuesto de JS de primera carga de la ruta (`contratos §8`), medido sobre el `.next`
//     que acaba de construir el `webServer`, con la MISMA compuerta que usa CI.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_WEB = path.resolve(AQUI, "..");

const MOVIL = { width: 390, height: 844 };
const ESCRITORIO = { width: 1440, height: 900 };

async function sinViolacionesGraves(page: Page): Promise<void> {
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
}

test("la portada existe y explica el producto en la primera pantalla", async ({ page }) => {
  await page.setViewportSize(MOVIL);
  const respuesta = await page.goto("/");
  expect(respuesta?.status(), "`/` era un 404: ahora es la portada").toBe(200);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tu invitación, lista en una tarde.");
  await expect(page.getByText("Invitaciones digitales con RSVP").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Empezar mi invitación" }).first()).toBeVisible();

  // Un solo `h1` en toda la página, y los `h2` de las secciones bajo él.
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
  await expect(page.getByRole("heading", { level: 2, name: "Tres pasos y a repartir." })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Para cada celebración" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Elige tu plan" })).toBeVisible();
});

test("los siete tipos de evento llevan su tipo al asistente", async ({ page }) => {
  await page.setViewportSize(ESCRITORIO);
  await page.goto("/");
  const tipos: readonly (readonly [string, string])[] = [
    ["boda", "Boda"],
    ["xv-anos", "XV años"],
    ["bautizo", "Bautizo"],
    ["comunion", "Primera comunión"],
    ["cumpleanos", "Cumpleaños"],
    ["graduacion", "Graduación"],
    ["corporativo", "Corporativo"],
  ];
  for (const [tipo, nombre] of tipos) {
    const enlace = page.getByRole("link", { name: `Empezar una invitación de ${nombre}` });
    await expect(enlace).toHaveAttribute("href", `/editor?tipo=${tipo}`);
  }
});

test("ni un enlace de la portada es un callejón: todos los destinos responden", async ({ page, request }) => {
  await page.goto("/");
  const destinos = new Set<string>();
  for (const enlace of await page.getByRole("link").all()) {
    const href = (await enlace.getAttribute("href")) ?? "";
    expect(href, "un enlace que no lleva a nada es peor que no tenerlo (U-1)").not.toBe("#");
    if (href.startsWith("/")) destinos.add(href);
  }
  expect(destinos.size).toBeGreaterThan(3);
  for (const destino of destinos) {
    const r = await request.get(destino);
    expect(r.status(), `${destino} no responde`).toBeLessThan(400);
  }
});

test("los testimonios van marcados como ejemplo (no son clientas reales todavía)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ejemplo")).toHaveCount(3);
  await expect(page.getByText("Textos de muestra mientras reunimos testimonios reales de clientas.")).toBeVisible();
});

test("axe AA: 0 violaciones críticas o serias, en teléfono y en escritorio", async ({ page }) => {
  await page.setViewportSize(MOVIL);
  await page.goto("/");
  await sinViolacionesGraves(page);

  await page.setViewportSize(ESCRITORIO);
  await page.goto("/");
  await sinViolacionesGraves(page);
});

test("el JS de primera carga de la portada cabe en el presupuesto de 150 KB gz", () => {
  // Misma compuerta que `pnpm --filter web run budget` y que `presupuesto.spec.ts`: no vuelve a
  // compilar nada, lee el `.next` que dejó el `webServer` de esta misma ejecución.
  let salida: string;
  let codigo = 0;
  try {
    salida = execFileSync(process.execPath, [path.join(RAIZ_WEB, "scripts", "check-budget.mjs")], {
      cwd: RAIZ_WEB,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    codigo = e.status ?? 1;
    salida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  expect(codigo, `salida literal de check-budget:\n${salida}`).toBe(0);
  // `check-budget.mjs` colorea su salida; se quitan los códigos ANSI antes de leer las cifras.
  // eslint-disable-next-line no-control-regex
  const limpia = salida.replace(/\u001b\[[0-9;]*m/g, "");
  expect(limpia, "la portada tiene que estar EN la compuerta, no fuera de ella").toMatch(
    /^\/: [\d.]+ KB gz de primera carga/m,
  );
});

// ── 3C-ADV · las tres voces del sistema se DESCARGAN de verdad ───────────────────────────────────
// Defecto medido en la revisión adversarial del cierre: `/fonts/*.woff2` respondía **404** en todo
// build hecho con `next build` a secas —es decir, en `pnpm --filter web run build` (el comando que
// prescribe `handoffs/3c-8.md` para medir el LCP), en el `webServer` de las dos configuraciones de
// Playwright (`pnpm run build && pnpm run start`) y en el job `e2e` de CI, que solo hace
// `pnpm install`—. Los ficheros los copia `packages/ui/scripts/copiar-fuentes-publicas.ts`, que
// colgaba EXCLUSIVAMENTE del `build` de `@invitaciones/ui`; ese `build` solo se ejecuta cuando se
// entra por turbo (`pnpm run build` desde `frontend/`, tarea `build` con `dependsOn: ["^build"]`).
// Resultado medido en el navegador: `document.fonts` daba `Fraunces|unloaded`, `Onest|unloaded`,
// `Red Hat Mono|unloaded` y el `<h1>` de la portada se pintaba con «Fraunces Fallback» → Georgia.
// Es decir, el producto servía TIPOGRAFÍA GENÉRICA, que es una de las reglas que no se negocian
// (`10 §1.2`, `brief-comun.md`), y ninguna compuerta lo veía: las pruebas de fuentes
// (`packages/ui/test/fuentes.test.ts`, `apps/web/test/tipografia-chrome.test.ts`) comprueban el
// fichero de ORIGEN en `node_modules`, nunca el que se SIRVE.
// Arreglo: `apps/web`'s `build`/`dev` ejecutan el copiador antes de Next (idempotente, 6 ficheros).
// Esta prueba es la compuerta que impide que vuelva a pasar: mide sobre HTTP, no sobre el disco.
test("las tres voces autoalojadas se sirven y el navegador las carga (nada de tipografía genérica)", async ({
  page,
  request,
}) => {
  const RUTAS = [
    "/fonts/fraunces-latin-full-normal.woff2",
    "/fonts/onest-latin-wght-normal.woff2",
    "/fonts/red-hat-mono-latin-wght-normal.woff2",
  ];
  for (const ruta of RUTAS) {
    const respuesta = await request.get(ruta);
    expect(respuesta.status(), `${ruta} no se sirve: el chrome caería a la fuente de respaldo`).toBe(200);
    expect((await respuesta.body()).byteLength, `${ruta} se sirve vacío`).toBeGreaterThan(10_000);
  }

  await page.setViewportSize(ESCRITORIO);
  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const estado = await page.evaluate(() => {
    const familias = ["Fraunces", "Onest"];
    const cargadas = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family);
    return {
      sinCargar: familias.filter((f) => !cargadas.includes(f)),
      h1: getComputedStyle(document.querySelector("h1") as Element).fontFamily,
    };
  });
  // `Red Hat Mono` (voz etiqueta) puede no llegar a usarse en la portada, así que no se exige
  // cargada aquí; su fichero sí se comprueba arriba por HTTP.
  expect(estado.sinCargar, `familias declaradas que el navegador NO llegó a cargar: ${estado.sinCargar.join(", ")}`).toEqual(
    [],
  );
  expect(estado.h1, "el titular tiene que pedir la voz display del sistema, no un respaldo").toContain("Fraunces");
});
