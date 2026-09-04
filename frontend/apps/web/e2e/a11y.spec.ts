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

test("catálogo del editor (sin sesión): 0 violaciones axe críticas o serias", async ({ page }) => {
  await page.goto("/editor");
  // Sin token en `sessionStorage`, `getCatalog()` responde 401 y la página pinta el aviso de sesión
  // inválida (`lib/errors.ts` `SessionError`) — es el estado real de un visitante sin iniciar sesión.
  await expect(page.getByRole("heading", { name: "Elige una plantilla" })).toBeVisible();
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
});
