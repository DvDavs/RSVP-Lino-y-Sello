// e2e/landing.spec.ts — la PORTADA (`/`), la pantalla que antes era un 404 en inglés.
//
// Qué vigila, en este orden de importancia:
//  1. Que exista y diga lo que tiene que decir (`11 §7`), a 390 y a 1440.
//  2. Que NINGÚN enlace lleve a un callejón: cada destino interno responde de verdad, no se
//     comprueba solo que el `href` no sea «#» (ese era el defecto U-1 y la comprobación floja).
//  3. `axe` AA sin violaciones críticas ni serias, en los dos anchos.
//  4. El presupuesto de JS de primera carga de la ruta (`contratos §8`), medido sobre el `.next`
//     que acaba de construir el `webServer`, con la MISMA compuerta que usa CI.
//  5. Cierre 3-C (G-01): que el camino que EMPIEZA en esta pantalla —«Empezar mi invitación» y
//     «Planes»— tenga salida. El recorrido de uso sin instrucciones midió un anillo de cuatro
//     toques que terminaba en `/ayuda#planes` sin precio y sin contacto, así que las dos puntas del
//     anillo se vigilan aquí aunque una de ellas viva en `/ayuda`: es la misma pregunta de la misma
//     clienta («¿cuánto cuesta y con quién lo contrato?») y romper cualquiera de las dos la deja
//     otra vez sin respuesta.
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

test("la sección de planes ofrece un camino para contratar, y no uno inventado", async ({ page }) => {
  await page.goto("/");
  const planes = page.locator("#planes");
  await expect(planes.getByRole("heading", { level: 3, name: "¿Cómo se contrata?" })).toBeVisible();

  // Este build NO trae `NEXT_PUBLIC_CONTACTO_WHATSAPP` ni `NEXT_PUBLIC_CONTACTO_CORREO`, así que lo
  // correcto es decir la verdad: ni un botón que no lleve a nadie, ni un número inventado.
  await expect(planes.getByText(/el contacto se publicará aquí en cuanto esté configurado/)).toBeVisible();
  await expect(planes.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveCount(0);
  await expect(planes.getByRole("link", { name: "Escribir por correo" })).toHaveCount(0);
});

test("el final del circuito (`/ayuda#planes`) contesta la pregunta que lo abrió: cuánto cuesta", async ({ page }) => {
  // Es a donde manda «Ver planes» del asistente cuando la cuenta no tiene ninguna invitación.
  await page.goto("/ayuda#planes");
  const duda = page.locator("details#planes");
  await expect(duda).toHaveAttribute("open", "");
  await expect(duda.getByRole("heading", { level: 2 })).toHaveText("¿Cuánto cuesta y cómo contrato un plan?");
  await expect(duda).toContainText("Los precios todavía no están publicados");
  // Y la caja de contacto está al final de la misma página, no en «el medio por el que contrataste».
  await expect(page.getByRole("heading", { name: "¿No está tu duda aquí?" })).toBeVisible();
  await expect(page.getByText(/el contacto se publicará aquí en cuanto esté configurado/)).toBeVisible();
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
