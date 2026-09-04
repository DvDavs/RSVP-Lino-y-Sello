import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { obtenerDemo, revalidar } from "./util/demo";

// e2e/a11y-publico.spec.ts — ADR-024: CERO violaciones `critical` o `serious` de axe sobre el render
// público REAL (la invitación publicada, no un estado vacío). Complementa `e2e/a11y.spec.ts`, que
// cubre los estados sin datos y es de otro bloque (no se toca).
//
// Se analiza el documento entero, no un fragmento: `04 §17.1` exige que el contraste se compruebe
// "ya pintado", y eso solo pasa con las 12 secciones montadas con el tema real.

// Misma purga que en `render-publico.spec.ts`: la ruta es ISR y axe debe medir la invitación
// publicada AHORA, no una versión cacheada de hasta cinco minutos antes.
test.beforeAll(async ({ browserName }, testInfo) => {
  void browserName; // Playwright exige el primer parámetro de fixtures; no se usa ninguno aquí.
  const demo = await obtenerDemo();
  const base = (testInfo.project.use.baseURL as string | undefined) ?? "http://127.0.0.1:3000";
  await revalidar(base, demo.publicToken);
});

async function violacionesGraves(page: import("@playwright/test").Page) {
  const resultados = await new AxeBuilder({ page }).analyze();
  return resultados.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodos: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
    }));
}

test("invitación publicada: 0 violaciones axe críticas o serias", async ({ page }) => {
  const demo = await obtenerDemo();
  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("h1")).toHaveCount(1);

  // Las imágenes perezosas se fuerzan a cargar: una imagen sin pintar no participa en las reglas de
  // contraste ni de `image-alt`, y la prueba estaría midiendo menos de lo que ve el invitado.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll("img")) img.loading = "eager";
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("img")].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30_000 },
  );

  const graves = await violacionesGraves(page);
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
});

test("invitación publicada en móvil (390x844): 0 violaciones axe críticas o serias", async ({ page }) => {
  // El contraste y los objetivos táctiles (2.5.8) dependen del ancho: la escala tipográfica es
  // `clamp()` y varias secciones cambian de disposición. Se mide donde de verdad se abre.
  const demo = await obtenerDemo();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/i/${demo.publicToken}`);
  await expect(page.locator("h1")).toHaveCount(1);
  const graves = await violacionesGraves(page);
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
});
