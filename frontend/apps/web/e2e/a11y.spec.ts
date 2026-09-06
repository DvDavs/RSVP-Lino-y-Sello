import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// e2e/a11y.spec.ts — E2E-06 de `06-pruebas-y-calidad.md` §8.1 y E-08/E-09 de `04 §20.2`, recortado
// al alcance de 3-1: cero violaciones `critical`/`serious` en los estados reales del esqueleto que
// no dependen de datos sembrados (ADR-024). El bloque 3-3/3-4 añade aquí los estados con documento
// real (catálogo con resultados, editor con plantilla elegida).
test("página de invitación no disponible: 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.goto(`/i/token-que-no-existe-${Date.now()}`);
  await expect(page.getByRole("heading")).toBeVisible();
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
});

test("`/editor` sin sesión: lleva a la pantalla de acceso, y esa pantalla no tiene violaciones graves", async ({ page }) => {
  // FASE 3-C (3C-6): `/editor` es el asistente de creación. Sin token no hay catálogo ni
  // invitaciones que enseñar, así que en vez de pintar un aviso en una pantalla inútil, redirige a
  // `/acceso` con el retorno puesto (`04 §7.1` paso 1: «401 → redirección a login»). Lo que esta
  // prueba mide sigue siendo lo mismo: que un visitante sin sesión llega a un sitio usable y sin
  // violaciones graves de accesibilidad.
  await page.goto("/editor");
  await expect(page).toHaveURL(/\/acceso\?volver=%2Feditor$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Entra a tu cuenta" })).toBeVisible();
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
});
