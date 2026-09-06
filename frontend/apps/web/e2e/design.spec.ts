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

          // Nada se sale de su ficha (hallazgo de la revisión del bloque 2: la variante «Tamaños»
          // de Button desbordaba el recuadro por los dos lados a 1440, con el primer botón fuera de
          // la tarjeta y el último recortado). Una ficha desbordada es un fallo de maquetación que
          // una captura sola no delata: hay que MEDIRLO.
          const desbordes = await page.evaluate(() => {
            const fallos: string[] = [];
            const recortaAlgunAncestro = (desde: Element, hasta: Element): boolean => {
              for (let n: Element | null = desde.parentElement; n && n !== hasta.parentElement; n = n.parentElement) {
                if (getComputedStyle(n).overflow !== "visible") return true;
              }
              return false;
            };
            for (const ficha of document.querySelectorAll("article")) {
              const caja = ficha.getBoundingClientRect();
              for (const hijo of ficha.querySelectorAll("*")) {
                if (hijo.getClientRects().length === 0) continue;
                // La geometría DENTRO de un `<svg>` no es maquetación: `preserveAspectRatio="slice"`
                // desborda su viewBox a propósito y el `<svg>` lo recorta (formas de `11 §4`).
                if ((hijo as SVGElement).ownerSVGElement) continue;
                const estilo = getComputedStyle(hijo);
                if (estilo.position === "fixed" || estilo.position === "absolute") continue;
                // Desbordar DENTRO de un contenedor que scrollea o recorta es la solución, no el
                // fallo: lo que no puede pasar es salirse de la tarjeta.
                if (recortaAlgunAncestro(hijo, ficha)) continue;
                const r = hijo.getBoundingClientRect();
                if (r.width === 0 && r.height === 0) continue;
                if (r.left < caja.left - 1 || r.right > caja.right + 1) {
                  fallos.push(`${hijo.tagName.toLowerCase()}.${String(hijo.className).split(" ")[0]}`);
                }
              }
            }
            return [...new Set(fallos)];
          });
          expect(desbordes, `elementos que se salen de su ficha: ${desbordes.join(", ")}`).toEqual([]);

          // Las vitrinas de superposición (`EscaparateSuperposicion`) recortan por `contain: paint`:
          // si el panel no cabe, se corta en silencio y la ficha miente. Se mide, no se mira.
          const recortados = await page.evaluate(() => {
            const fallos: string[] = [];
            for (const vitrina of document.querySelectorAll('article [role="group"][aria-label]')) {
              const caja = vitrina.getBoundingClientRect();
              for (const panel of vitrina.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
                const r = panel.getBoundingClientRect();
                if (r.top < caja.top - 1 || r.bottom > caja.bottom + 1 || r.left < caja.left - 1 || r.right > caja.right + 1) {
                  fallos.push(`${vitrina.getAttribute("aria-label")}: panel ${Math.round(r.height)} px en vitrina de ${Math.round(caja.height)} px`);
                }
              }
            }
            return fallos;
          });
          expect(recortados, `paneles recortados por su vitrina:\n${recortados.join("\n")}`).toEqual([]);

          await expect(page).toHaveScreenshot([ancho.nombre, `${nombre}-${tema}.png`], { fullPage: true });
        });
      }
    }
  });
}
