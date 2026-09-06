// e2e/a11y-pantallas-nuevas.spec.ts — la compuerta que no puede bajar: `axe-core` AA da **0
// violaciones** en el editor, el catálogo y la página del invitado (medido en la revisión de uso).
// El bloque 3-8 añade dos pantallas (`/acceso`, `/ayuda`) y una disposición nueva (el editor en el
// teléfono, ADR-3-8-01): las tres entran en la misma compuerta, no en una excepción.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

async function sinViolacionesGraves(page: Page): Promise<void> {
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
}

test("pantalla de acceso: 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.goto("/acceso");
  await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
  await sinViolacionesGraves(page);
});

// El `h1` de `/ayuda` dejó de ser «Ayuda» en la fase 3-C: `11 §7` fija «¿En qué te ayudamos?» para
// esta pantalla (3C-5). Es el ÚNICO selector de este archivo que cambia; el resto sigue igual.
test("página de ayuda: 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.goto("/ayuda");
  await expect(page.getByRole("heading", { name: "¿En qué te ayudamos?", level: 1 })).toBeVisible();
  await sinViolacionesGraves(page);
});

test("portada: 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await sinViolacionesGraves(page);
});

test("editor en el teléfono (390×844, con pestañas): 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sesionDemo(page, await jwtDemo());
  await page.goto(`/editor/${invitacionSembrada()}`);
  await expect(page.getByRole("tablist", { name: "Qué quieres ver" })).toBeVisible({ timeout: 30_000 });
  await sinViolacionesGraves(page);

  // También con la pestaña de vista previa abierta: es una disposición distinta, no la misma.
  await page.getByRole("tab", { name: "Vista previa" }).click();
  await sinViolacionesGraves(page);
});

test("catálogo con sesión (Mis invitaciones + plantillas): 0 violaciones axe críticas o serias", async ({ page }) => {
  await sesionDemo(page, await jwtDemo());
  await page.goto("/editor");
  await expect(page.getByRole("heading", { name: "Mis invitaciones" })).toBeVisible({ timeout: 30_000 });
  await sinViolacionesGraves(page);
});
