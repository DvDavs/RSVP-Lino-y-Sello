import { expect, test } from "@playwright/test";
import { cambiarTema, congelarMovimiento, paginasDeGaleria } from "./util/design-galeria.ts";

// e2e/design-objetivos.spec.ts — dos compuertas de accesibilidad que `axe` NO cubre y que la
// revisión del bloque 2 (fase 3-C) exige medir, no mirar:
//
//   1. WCAG 2.2 AA 2.5.8 «Target Size (Minimum)»: todo objetivo interactivo mide ≥ 24 × 24 px
//      REALES (`getBoundingClientRect`), no "según la clase". axe no tiene regla para esto.
//   2. WCAG 2.2 AA 2.4.11/2.4.13 «Focus Appearance»: al llegar con Tab, el elemento cambia de
//      verdad de aspecto (`outline` u `box-shadow` distintos de los de reposo). axe tampoco lo mide:
//      `:focus-visible` solo existe en un navegador de verdad, con teclado de verdad.
//
// Se recorre la galería en CLARO: ni la geometría de los objetivos ni el hecho de que el foco
// cambie el aspecto dependen del tema (los dos temas comparten las mismas reglas; lo único que
// cambia es el COLOR del anillo, y de su contraste se encarga `design-contraste.spec.ts` en los dos
// temas con la pareja `focus`/`surface`).

/** Todo lo que un usuario puede accionar. `[tabindex]` incluye lo que se hace enfocable a mano. */
const SELECTOR_INTERACTIVO = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
  "[role=button]",
  "[role=link]",
  "[role=tab]",
  "[role=switch]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=combobox]",
  "[role=option]",
  "[role=menuitem]",
].join(",");

const LADO_MINIMO = 24;

for (const { ruta, nombre } of paginasDeGaleria()) {
  test(`${nombre}: objetivos ≥ ${LADO_MINIMO} px y foco visible`, async ({ page }) => {
    await page.goto(ruta);
    await congelarMovimiento(page);
    await cambiarTema(page, "light");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // ── 1. Tamaño de objetivo ────────────────────────────────────────────────────────────────
    const pequenos = await page.evaluate(
      ({ selector, minimo }) => {
        const fallos: Array<{ etiqueta: string; texto: string; ancho: number; alto: number }> = [];
        for (const el of document.querySelectorAll(selector)) {
          if (el.closest('[aria-hidden="true"]')) continue;
          // Centinelas de foco de Radix: `<span tabindex="0">` invisibles que solo existen para
          // devolver el foco al salir de una capa. No son objetivos ni tienen aspecto.
          if (el.hasAttribute("data-radix-focus-guard")) continue;
          if ((el as HTMLElement).offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // no renderizado
          // Excepción de 2.5.8: objetivo "en línea", dentro de una frase (un enlace en un párrafo).
          const padre = el.parentElement;
          const enLinea =
            getComputedStyle(el).display.startsWith("inline") &&
            padre !== null &&
            [...padre.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0);
          if (enLinea) continue;
          if (r.width < minimo || r.height < minimo) {
            fallos.push({
              etiqueta: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`,
              texto: (el.textContent ?? "").trim().slice(0, 40) || (el.getAttribute("aria-label") ?? ""),
              ancho: Math.round(r.width * 10) / 10,
              alto: Math.round(r.height * 10) / 10,
            });
          }
        }
        return fallos;
      },
      { selector: SELECTOR_INTERACTIVO, minimo: LADO_MINIMO },
    );
    expect(pequenos, `objetivos por debajo de ${LADO_MINIMO} px:\n${JSON.stringify(pequenos, null, 2)}`).toEqual([]);

    // ── 2. Foco visible en TODO lo que alcanza el tabulador ───────────────────────────────────
    // Se recorre con Tab de verdad (no `.focus()`): `:focus-visible` distingue teclado de ratón.
    const reposo = await page.evaluate((selector) => {
      const mapa: Record<string, { outline: string; sombra: string }> = {};
      let i = 0;
      for (const el of document.querySelectorAll(selector)) {
        if (el.hasAttribute("data-radix-focus-guard")) continue;
        const estilo = getComputedStyle(el);
        el.setAttribute("data-foco-indice", String(i++));
        mapa[el.getAttribute("data-foco-indice")!] = {
          outline: `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.outlineColor}`,
          sombra: estilo.boxShadow,
        };
      }
      return mapa;
    }, SELECTOR_INTERACTIVO);

    const total = Object.keys(reposo).length;
    const sinFoco: string[] = [];
    const vistos = new Set<string>();
    for (let paso = 0; paso < total + 4; paso++) {
      await page.keyboard.press("Tab");
      const actual = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const estilo = getComputedStyle(el);
        return {
          indice: el.getAttribute("data-foco-indice"),
          etiqueta: `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`,
          texto: (el.textContent ?? "").trim().slice(0, 40) || (el.getAttribute("aria-label") ?? ""),
          outline: `${estilo.outlineStyle} ${estilo.outlineWidth} ${estilo.outlineColor}`,
          sombra: estilo.boxShadow,
        };
      });
      if (!actual || actual.indice === null) continue;
      if (vistos.has(actual.indice)) break; // dio la vuelta entera
      vistos.add(actual.indice);
      const antes = reposo[actual.indice];
      const cambia = antes.outline !== actual.outline || antes.sombra !== actual.sombra;
      if (!cambia) sinFoco.push(`${actual.etiqueta} «${actual.texto}»`);
    }
    expect(sinFoco, `sin indicador de foco al tabular:\n${sinFoco.join("\n")}`).toEqual([]);
    expect(vistos.size, "el tabulador no alcanzó ningún control de la página").toBeGreaterThan(0);
  });
}
