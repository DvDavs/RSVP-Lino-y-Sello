import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { cambiarTema, congelarMovimiento, paginasDeGaleria, TEMAS } from "./util/design-galeria.ts";

// e2e/design-axe.spec.ts — `@axe-core/playwright` sobre cada página de la galería, en claro y
// oscuro: 0 violaciones (brief 3c-b2-f3 §4). Se desactiva la regla `color-contrast` de axe a
// propósito: el contraste sobre la pila renderizada lo cubre `design-contraste.spec.ts` con el
// umbral correcto por tamaño computado (`11 §8.3`); axe la deja en `incomplete` cuando no puede
// resolver el fondo con certeza (gradientes, texto sobre SVG…) y eso NO cuenta como aprobado
// (`10 §4.2`) — mantenerla aquí solo escondería el estado real detrás de un "no sé" en vez de
// medirlo de verdad.
for (const { ruta, nombre } of paginasDeGaleria()) {
  for (const tema of TEMAS) {
    test(`${nombre} · ${tema}: 0 violaciones axe`, async ({ page }) => {
      await page.goto(ruta);
      await congelarMovimiento(page);
      await cambiarTema(page, tema);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const resultados = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
      expect(resultados.violations, JSON.stringify(resultados.violations, null, 2)).toEqual([]);
    });
  }
}
