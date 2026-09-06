// e2e/editor-3c-evidencia.spec.ts — compuerta y evidencia del chrome del editor rediseñado
// (fase 3-C, bloque 3, tarea 3C-7).
//
// Dos cosas, en la misma pasada porque necesitan el mismo estado sembrado:
//   1. `axe` AA sin violaciones críticas ni serias en las TRES vistas del editor de escritorio
//      —lista de secciones, panel de un bloque y diálogo de publicación—, que es donde vive todo lo
//      que esta tarea rehízo. El editor a 390 ya lo cubre `a11y-pantallas-nuevas.spec.ts`.
//   2. Capturas a 390 y a 1440 en `docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/`
//      (`3c-b3-comun.md`, regla 8).
import { existsSync, mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3c/bloque-3/3c-7/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

/**
 * `exclude("iframe")` deja fuera el LIENZO: dentro va la invitación de la clienta, que la pinta
 * `packages/sections` (zona prohibida de esta tarea y de este bloque). Lo que se mide aquí es el
 * CHROME. Medido: con el lienzo dentro, `axe` reporta una violación `serious` `aria-hidden-focus`
 * en `.RsvpSection-module__…__backdrop` de la plantilla — anotada en `preguntas-abiertas.md` para
 * quien mantenga `packages/sections`, no arreglable desde aquí.
 */
async function sinViolacionesGraves(page: Page, donde: string): Promise<void> {
  const resultados = await new AxeBuilder({ page }).exclude("iframe").analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, `${donde}\n${JSON.stringify(graves, null, 2)}`).toEqual([]);
}

async function abrirEditor(page: Page): Promise<void> {
  await sesionDemo(page, await jwtDemo());
  await page.goto(`/editor/${invitacionSembrada()}`);
  await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible({ timeout: 30_000 });
}

test("editor de escritorio · axe AA sin violaciones graves en lista, panel de bloque y publicación", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirEditor(page);
  await sinViolacionesGraves(page, "lista de secciones + apariencia");

  // Panel de un bloque: campos, variante de sección y bloque de solo lectura.
  await page.getByTestId("section-row-cover").click();
  await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();
  await sinViolacionesGraves(page, "panel de bloque (portada)");

  // Diálogo de publicación con su lista de revisión.
  await page.getByRole("button", { name: "Volver a secciones" }).click();
  await page.getByTestId("abrir-publicar").click();
  await expect(page.getByRole("dialog", { name: "Publicar invitación" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("confirmar-publicar")).toBeVisible();
  await sinViolacionesGraves(page, "diálogo de publicación");
  await page.keyboard.press("Escape");
});

test("capturas del editor a 1440 y a 390 (evidencia del bloque 3)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await abrirEditor(page);
  await expect(page.frameLocator('iframe[title="Vista previa de la invitación"]').locator(".lienzo-raiz")).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: `${EVIDENCIA}editor-1440.png` });

  await page.getByTestId("section-row-cover").click();
  await expect(page.getByRole("heading", { name: /portada/i })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}panel-de-bloque-1440.png` });

  await page.getByRole("button", { name: "Volver a secciones" }).click();
  await page.getByTestId("abrir-publicar").click();
  await expect(page.getByRole("dialog", { name: "Publicar invitación" })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${EVIDENCIA}publicar-1440.png` });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tablist", { name: "Qué quieres ver" })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${EVIDENCIA}editor-390.png` });
  await page.getByRole("tab", { name: "Vista previa" }).click();
  await page.screenshot({ path: `${EVIDENCIA}vista-previa-390.png` });
});
