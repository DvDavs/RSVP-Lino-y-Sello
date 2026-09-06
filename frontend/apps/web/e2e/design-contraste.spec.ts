import { expect, test } from "@playwright/test";
import { medirContraste } from "./util/contraste.ts";
import { cambiarTema, congelarMovimiento, paginasDeGaleria, TEMAS } from "./util/design-galeria.ts";

// e2e/design-contraste.spec.ts — contraste sobre la PILA RENDERIZADA (`10 §4.2`, `11 §8.3`), no
// sobre los datos: para cada elemento con texto de cada página de la galería, `getComputedStyle` del
// color de texto y del fondo compuesto (sube por los ancestros hasta un fondo opaco; degradados por
// sus paradas), y un umbral por TAMAÑO COMPUTADO — 3,0 si ≥ 24 px o ≥ 18,66 px en negrita, 4,5 en
// cualquier otro caso — salvo que el propio elemento declare su umbral con `data-umbral` (las
// parejas "gráficas" de `11 §1.4`, p. ej. `border`/`focus`, y las informativas, que se excluyen del
// todo: `divider`, `primary-bright`, y los pasos crudos de escala de `/design/tokens`, que `11 §1.5`
// regla 2 declara decorativos, nunca texto).
//
// Sabotaje (obligatorio, documentado en `bitacora/3c-b2-f3.md`): con
// `page.addStyleTag({ content: "*{--ui-ink:#fdf9f7 !important}" })` justo antes de medir, esta misma
// prueba cae (12 elementos con ratio ≈ 1 en vez de los 3,0-18,7 reales). Nota de implementación
// medida en ese ejercicio: el sabotaje debe usar el selector universal `*` y NO `:root` — el
// conmutador de tema redeclara los tokens en `[data-theme="light|dark"]`, que apunta al `<div>` de
// `MarcoDeTema`, no a `<html>`; un override en `:root` no gana ahí porque ese `<div>` tiene su propia
// declaración directa del token (la herencia no compite con una regla que ya iguala al elemento).
test.describe.configure({ mode: "parallel" });

for (const { ruta, nombre } of paginasDeGaleria()) {
  for (const tema of TEMAS) {
    test(`${nombre} · ${tema}: 0 parejas por debajo de su umbral`, async ({ page }) => {
      await page.goto(ruta);
      await congelarMovimiento(page);
      await cambiarTema(page, tema);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      // Algoritmo en `./util/contraste.ts` (3C-8 lo extrajo de aquí para reutilizarlo en
      // `a11y-producto.spec.ts` sin duplicarlo): pila renderizada, no tokens (`11 §8.3`).
      const resultado = await page.evaluate(medirContraste);

      const fallos = resultado.filter((fila) => !fila.ok);
      expect(fallos, `${resultado.length} elementos medidos, ${fallos.length} por debajo de su umbral:\n${JSON.stringify(fallos, null, 2)}`).toEqual([]);
    });
  }
}
