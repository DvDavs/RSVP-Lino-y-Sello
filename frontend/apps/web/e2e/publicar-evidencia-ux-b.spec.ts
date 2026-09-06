// e2e/publicar-evidencia-ux-b.spec.ts — CAPTURAS de las tres correcciones graves del cierre de la
// fase 3-C en el editor y la publicación (G-04, G-05, G-06), a 390×844 y a 1440×900, contra el
// backend real y sobre una invitación desechable en el estado en el que la revisora de UX las
// encontró: la fecha del evento puesta y todo lo demás en su contenido de ejemplo.
//
// No es una prueba de regresión visual (no hay `toHaveScreenshot`): son las capturas que el brief
// del cierre pide como evidencia, y por eso viven en `evidencia/fase-3c/cierre/ux-fix/`.
import { expect, test, type Page } from "@playwright/test";
import { borrarInvitacion, jwtDemo, sesionDemo } from "./preparar.ts";
import { crearInvitacionPublicable } from "./preparar-panel.ts";

const DESTINO = "../../../docs/rediseno-plantillas/evidencia/fase-3c/cierre/ux-fix";

const PANTALLAS = [
  { nombre: "390", ancho: 390, alto: 844 },
  { nombre: "1440", ancho: 1440, alto: 900 },
] as const;

for (const pantalla of PANTALLAS) {
  test(`evidencia UX-B · revisión, lista de ejemplos y barra publicada a ${pantalla.nombre}`, async ({ page }) => {
    test.slow();
    const token = await jwtDemo();
    const invitationId = await crearInvitacionPublicable(token);
    await page.setViewportSize({ width: pantalla.ancho, height: pantalla.alto });

    try {
      await sesionDemo(page, token);
      await page.goto(`/editor/${invitationId}`);
      await expect(page.getByTestId("abrir-publicar")).toBeEnabled({ timeout: 20_000 });

      // ── G-04 · la revisión con dos fechas distintas, ya sin «Todo listo para publicar» ────────
      await page.getByTestId("abrir-publicar").click();
      await expect(page.getByTestId("aviso-fechas")).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${DESTINO}/b-${pantalla.nombre}-01-revision-fechas.png`, fullPage: false });

      // ── G-05 · el contenido de ejemplo que verían las invitadas, sección por sección ──────────
      const lista = page.getByTestId("lista-ejemplos");
      await lista.scrollIntoViewIfNeeded();
      await expect(lista).toBeVisible();
      await lista.screenshot({ path: `${DESTINO}/b-${pantalla.nombre}-02-lista-ejemplos.png` });

      // ── G-06 · publicada: el estado y «Compartir» siguen en la barra al cerrar el panel ───────
      await page.getByTestId("confirmar-publicar").click();
      await expect(page.getByTestId("enlace-publicado")).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("publish-dialog")).toBeHidden();
      await expect(page.getByTestId("abrir-compartir")).toBeVisible();
      await recortarCabecera(page, `${DESTINO}/b-${pantalla.nombre}-03-barra-publicada.png`, pantalla.ancho);
      await page.getByTestId("abrir-compartir").click();
      await expect(page.getByTestId("enlace-publicado")).toBeVisible();
      await page.screenshot({ path: `${DESTINO}/b-${pantalla.nombre}-04-compartir.png`, fullPage: false });

      // Cero desbordamiento horizontal con la barra en su estado más cargado (`11 §3`, WCAG 1.4.10).
      await page.keyboard.press("Escape");
      const medida = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }));
      expect(medida.scrollW, `sin desborde horizontal a ${pantalla.ancho} px`).toBeLessThanOrEqual(medida.innerW);
    } finally {
      borrarInvitacion(invitationId);
    }
  });
}

/** La cabecera del editor entera (dos filas en el teléfono), que es donde vive el estado. */
async function recortarCabecera(page: Page, ruta: string, ancho: number): Promise<void> {
  const cabecera = page.locator("header").first();
  const caja = await cabecera.boundingBox();
  await page.screenshot({ path: ruta, clip: { x: 0, y: 0, width: ancho, height: Math.ceil((caja?.height ?? 64) + 8) } });
}
