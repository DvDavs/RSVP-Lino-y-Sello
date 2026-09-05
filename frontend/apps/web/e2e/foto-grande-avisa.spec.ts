// e2e/foto-grande-avisa.spec.ts — U-7: «la foto demasiado grande falla en silencio».
//
// La medición original: con un JPG de 27 MB no ocurría NADA visible; el mensaje —que existía y era
// bueno— se pintaba en `y=928` con la ventana en 900, **28 px por debajo del borde visible**, y
// además lejos del botón que falló. Esta prueba mide exactamente eso: que el aviso queda DENTRO de
// la parte visible del panel, no que exista en el DOM.
import { existsSync, mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { invitacionSembrada, jwtDemo, sesionDemo } from "./preparar.ts";

const EVIDENCIA = new URL("../../../../docs/rediseno-plantillas/evidencia/fase-3/ux-corregido/", import.meta.url).pathname;
if (!existsSync(EVIDENCIA)) mkdirSync(EVIDENCIA, { recursive: true });

// La misma ventana de la medición original (900 px de alto): con una más alta, el defecto no se
// reproduce y la prueba no demostraría nada.
test.use({ viewport: { width: 1440, height: 900 } });

test("una foto de más de 8 MB avisa donde la clienta está mirando (U-7)", async ({ page }) => {
  await sesionDemo(page, await jwtDemo());
  await page.goto(`/editor/${invitacionSembrada()}`);

  await page.getByRole("button", { name: "Portada", exact: true }).click();
  await expect(page.getByRole("button", { name: /Cambiar foto|Elegir foto/ })).toBeVisible({ timeout: 20_000 });

  // El pie con formatos y peso máximo se ve ANTES de fallar (la galería ya lo tenía; esto no).
  await expect(page.getByText("JPG, PNG o WebP · hasta 8 MB").first()).toBeVisible();

  // 9 MB: por encima del límite del `BlockSpec`. El contenido no importa — la comprobación de
  // tamaño ocurre antes de decodificar nada, igual que con el JPG de 27 MB del móvil de la clienta.
  await page.getByLabel(/Elegir archivo para/).setInputFiles({
    name: "IMG_9042.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(9 * 1024 * 1024, 1),
  });

  const aviso = page.getByRole("alert").filter({ hasText: /pesa más de/i });
  await expect(aviso).toBeVisible({ timeout: 10_000 });

  // LA medición de U-7: el mensaje entero cabe dentro de la ventana, no 28 px por debajo del borde.
  const caja = await aviso.boundingBox();
  const alto = page.viewportSize()?.height ?? 0;
  expect(caja, "el aviso no tiene caja visible").not.toBeNull();
  expect(caja!.y).toBeGreaterThanOrEqual(0);
  expect(caja!.y + caja!.height, `el aviso se pinta a ${caja!.y + caja!.height} px con la ventana en ${alto}`).toBeLessThanOrEqual(alto);

  await page.screenshot({ path: `${EVIDENCIA}11-foto-grande-avisa.png` });
});
