// e2e/editor-movil.spec.ts — U-8: «el editor no se puede usar en un teléfono».
//
// Medido en la revisión de uso, a 390×844: `scrollWidth` 572 con `clientWidth` 390 —**182 px de
// desbordamiento horizontal**—, «Publicar» en `x=481`, fuera de la pantalla, y la vista previa
// invisible. Incumple **WCAG 2.2 AA 1.4.10 Reflow**, que exige no tener que desplazarse en dos ejes
// a 320 px de ancho.
//
// La disposición nueva (una columna, cabecera en dos filas con «Publicar» siempre en la primera,
// lista y vista previa en pestañas) es una decisión de diseño de este bloque: `04 §6` nunca dibujó
// el editor en móvil (hueco D-16). Queda como **ADR-3-8-01**; esta prueba la fija.
import { existsSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/ux-corregido/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

/** Los dos anchos que exige 1.4.10: el teléfono real y el mínimo del criterio. */
const ANCHOS = [
  { nombre: "iPhone 390×844", ancho: 390, alto: 844 },
  { nombre: "mínimo de 1.4.10 · 320×640", ancho: 320, alto: 640 },
];

async function medir(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

for (const { nombre, ancho, alto } of ANCHOS) {
  test(`el editor cabe a lo ancho en ${nombre} y «Publicar» se ve (WCAG 1.4.10)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: alto });
    await sesionDemo(page, await jwtDemo());
    await page.goto(`/editor/${invitacionSembrada()}`);
    await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible({ timeout: 30_000 });

    const { scrollWidth, clientWidth } = await medir(page);
    expect(scrollWidth, `desbordamiento horizontal de ${scrollWidth - clientWidth} px`).toBeLessThanOrEqual(clientWidth);

    // «Publicar» dentro de la pantalla, con su caja entera — no basta con que exista en el DOM.
    const caja = await page.getByRole("button", { name: "Publicar" }).boundingBox();
    expect(caja, "«Publicar» no tiene caja visible").not.toBeNull();
    expect(caja!.x).toBeGreaterThanOrEqual(0);
    expect(caja!.x + caja!.width, "«Publicar» se sale por la derecha, como en la medición original").toBeLessThanOrEqual(ancho);
  });
}

test("en el teléfono, lista y vista previa son dos pestañas y las dos se pueden ver", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await sesionDemo(page, await jwtDemo());
  await page.goto(`/editor/${invitacionSembrada()}`);

  const pestanas = page.getByRole("tablist", { name: "Qué quieres ver" });
  await expect(pestanas).toBeVisible({ timeout: 30_000 });

  const editar = page.getByRole("tab", { name: "Editar" });
  const vista = page.getByRole("tab", { name: "Vista previa" });
  await expect(editar).toHaveAttribute("aria-selected", "true");

  // La lista de secciones se ve; la vista previa, todavía no.
  await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible();
  await expect(page.locator("iframe")).toBeHidden();
  await page.screenshot({ path: `${EVIDENCIA}09-editor-en-el-telefono.png` });

  await vista.click();
  await expect(vista).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("iframe")).toBeVisible();
  // Y «Publicar» sigue ahí, en las dos pestañas: es lo que nunca puede desaparecer.
  await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}10-vista-previa-en-el-telefono.png` });

  const { scrollWidth, clientWidth } = await medir(page);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("en escritorio NO hay pestañas: los dos paneles se ven a la vez (04 §6.2 intacto)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await sesionDemo(page, await jwtDemo());
  await page.goto(`/editor/${invitacionSembrada()}`);
  await expect(page.getByRole("heading", { name: "Secciones" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("iframe")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Qué quieres ver" })).toHaveCount(0);
});
