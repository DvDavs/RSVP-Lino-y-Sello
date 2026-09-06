import { expect, test } from "@playwright/test";
import { cambiarTema, congelarMovimiento, paginasDeGaleria, TEMAS } from "./util/design-galeria.ts";

// e2e/design.spec.ts — regresión visual de la galería `/design` (fase 3-C, bloque 2, brief 3c-b2-f3
// §4). Cada página, a 390 y 1440, en claro y oscuro: `toHaveScreenshot` con `maxDiffPixelRatio:
// 0.001` (config), `animations: "disabled"` (config) y `reducedMotion: "reduce"` (config) — ver
// `playwright.design.config.ts`. Corre SOLO contra `pnpm run build && pnpm run start` en el puerto
// 3133, sin backend ni siembra.
//
// Las referencias se generan con `--update-snapshots` (comando exacto en `handoffs/3c-b2-f3.md`) y
// se commitean en `e2e/design.spec.ts-snapshots/`.
const ANCHOS = [
  { nombre: "390", width: 390, height: 844 },
  { nombre: "1440", width: 1440, height: 900 },
] as const;

for (const ancho of ANCHOS) {
  test.describe(`ancho ${ancho.nombre}`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } });

    for (const { ruta, nombre } of paginasDeGaleria()) {
      for (const tema of TEMAS) {
        test(`${nombre} · ${tema}`, async ({ page }) => {
          await page.goto(ruta);
          await congelarMovimiento(page);
          await cambiarTema(page, tema);
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          await expect(page).toHaveScreenshot([ancho.nombre, `${nombre}-${tema}.png`], { fullPage: true });
        });
      }
    }
  });
}
