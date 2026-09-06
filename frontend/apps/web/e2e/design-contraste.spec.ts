import { expect, test } from "@playwright/test";
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

      const resultado = await page.evaluate(() => {
        function parseColor(str: string | null): [number, number, number, number] | null {
          if (!str) return null;
          const m = str.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          if (!m) return null;
          return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
        }
        function componer(fg: readonly number[], bg: readonly number[]): [number, number, number] {
          const a = fg[3] ?? 1;
          return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
        }
        function luminancia([r, g, b]: readonly number[]): number {
          const canal = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
        }
        function ratio(rgb1: readonly number[], rgb2: readonly number[]): number {
          const l1 = luminancia(rgb1) + 0.05;
          const l2 = luminancia(rgb2) + 0.05;
          return l1 > l2 ? l1 / l2 : l2 / l1;
        }
        // Sube por los ancestros (empezando por el propio elemento) hasta un fondo opaco; un
        // degradado cuenta como opaco y se evalúa parada por parada (11 §8.3).
        function fondosDetras(el: Element): number[][] {
          type Capa = { gradiente?: number[][]; solido?: [number, number, number, number] };
          const pila: Capa[] = [];
          let nodo: Element | null = el;
          while (nodo) {
            const estilo = getComputedStyle(nodo);
            const bgImagen = estilo.backgroundImage;
            if (bgImagen && bgImagen !== "none" && /gradient/.test(bgImagen)) {
              const paradas = [...bgImagen.matchAll(/rgba?\([^)]+\)/g)]
                .map((m) => parseColor(m[0]))
                .filter((c): c is [number, number, number, number] => c !== null);
              if (paradas.length > 0) {
                pila.push({ gradiente: paradas });
                break;
              }
            }
            const fondo = parseColor(estilo.backgroundColor);
            if (fondo && fondo[3] > 0) {
              pila.push({ solido: fondo });
              if (fondo[3] >= 0.999) break;
            }
            nodo = nodo.parentElement;
          }
          let base: number[] = [255, 255, 255]; // papel por defecto si nada de la pila es opaco.
          for (let i = pila.length - 1; i >= 0; i--) {
            const capa = pila[i];
            if (capa.gradiente) return capa.gradiente.map((parada) => componer(parada, base));
            base = componer(capa.solido!, base);
          }
          return [base];
        }

        const filas: Array<{
          texto: string;
          etiqueta: string;
          tamano: number;
          negrita: boolean;
          umbral: number;
          peor: number;
          ok: boolean;
        }> = [];

        for (const el of document.body.querySelectorAll("*")) {
          if (el.closest('[aria-hidden="true"]')) continue;
          // Parejas informativas/gráficas con su propio umbral declarado (11 §1.4/§1.5): "Aa" de
          // `/design/tokens` y los pasos crudos de escala. `informativa` se excluye del todo.
          if (el.closest('[data-umbral="informativa"]')) continue;
          if (["SCRIPT", "STYLE", "SVG", "TITLE"].includes(el.tagName)) continue;
          const tieneTextoPropio = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
          );
          if (!tieneTextoPropio) continue;
          if (el.getClientRects().length === 0) continue; // oculto (display:none, colapsado…)

          const estilo = getComputedStyle(el);
          const colorTexto = parseColor(estilo.color);
          if (!colorTexto) continue;

          const fondos = fondosDetras(el);
          const colorSobreFondo = componer(colorTexto, fondos[0]);
          const peor = Math.min(...fondos.map((f) => ratio(colorSobreFondo, f)));

          const tamano = parseFloat(estilo.fontSize);
          const peso = parseInt(estilo.fontWeight, 10) || 400;
          const negrita = peso >= 700;
          const declarado = el.closest("[data-umbral]")?.getAttribute("data-umbral");
          const umbral = declarado ? parseFloat(declarado) : tamano >= 24 || (tamano >= 18.66 && negrita) ? 3.0 : 4.5;

          filas.push({
            texto: (el.textContent ?? "").trim().slice(0, 60),
            etiqueta: `${el.tagName.toLowerCase()}.${typeof el.className === "string" ? el.className.split(" ")[0] : ""}`,
            tamano,
            negrita,
            umbral,
            peor: Number(peor.toFixed(2)),
            ok: peor >= umbral,
          });
        }
        return filas;
      });

      const fallos = resultado.filter((fila) => !fila.ok);
      expect(fallos, `${resultado.length} elementos medidos, ${fallos.length} por debajo de su umbral:\n${JSON.stringify(fallos, null, 2)}`).toEqual([]);
    });
  }
}
