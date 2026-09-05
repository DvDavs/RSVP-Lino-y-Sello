// packages/sections/test/theme/jerarquia-tipografica.test.tsx — A2 y A3 del bloque 3-9
// (objeciones ALTAS de `3-CV`: `O-03a` vs `O-03b` y `O-04`).
//
// QUÉ AFIRMA, Y POR QUÉ ASÍ.
//
// 3-CV midió sobre la invitación PUBLICADA que 8 de los 12 títulos de sección salían en la
// tipografía de CUERPO: `blocks/blocks.module.css .text` fijaba familia, peso y color en el propio
// `<span>` que pinta `TextBlock`, y una declaración en el elemento gana siempre sobre la herencia,
// así que el `.heading` del hueco no llegaba nunca al texto real. Sólo `celebrant` y `family` —las
// dos secciones cuyo título NO es un bloque editable— conservaban la serif de titular. En `rsvp` el
// mismo defecto además dejaba el título en `#3A2E2B` sobre `#B05555` = 2,66:1, por debajo del 3:1
// que AA exige incluso para texto grande, sin que `axe` lo viera (lo deja en `incomplete` por
// "background gradient", ver `bitacora/3-cv.md §3.3`).
//
// La prueba NO enumera las ocho secciones defectuosas: recorre el REGISTRO entero
// (`sectionRegistry`, la única tabla de despacho, 04 §5.2) y afirma la invariante de contrato —
// **el nodo que el bloque pinta dentro de un hueco resuelve a la MISMA tipografía y al MISMO color
// que el hueco**. Escrita así, la sección número 13 queda cubierta el día que se añada al
// registro, que es exactamente lo que el arreglo por hueco (repetir `> * { font: inherit }` en
// cada `.module.css`) no consigue. Ver ADR-3-9-01.
//
// Falla sin el arreglo [V]: con el `.text` anterior, `fontFamily` del `<span>` resolvía a
// `var(--inv-font-body)` mientras el `<h2>` resolvía a `var(--inv-font-heading)`, y en `rsvp` el
// `color` resolvía a `var(--inv-color-ink)` mientras el `<h2>` resolvía a
// `var(--inv-color-accent-ink)`.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { sectionRegistry } from "../../src/registry.ts";
import type { ComposedSection } from "../../src/schema-types.ts";
import { goldenSection } from "../golden-c.ts";
import type { SectionType } from "@invitaciones/schema";

const TIPOS = Object.keys(sectionRegistry) as SectionType[];

/**
 * Las DOS secciones cuyo `<h2>` no es un titular editorial sino una etiqueta estructural oculta
 * (`shared.visuallyHidden`, 04 §17.3): `cover` —el titular visible es el bloque `coverTitle`— y
 * `footer`, cuya etiqueta interna «Pie» A5 acaba de ocultar. No declaran tipografía de titular
 * porque no se ven; el resto de la prueba sí las cubre por el lado del color.
 */
const TITULO_ESTRUCTURAL: ReadonlySet<string> = new Set(["cover", "footer"]);

function seccionVisible(tipo: SectionType): ComposedSection {
  return { ...goldenSection(tipo), visible: true } as ComposedSection;
}

function pintar(tipo: SectionType) {
  const { component: Component, defaultVariant } = sectionRegistry[tipo];
  return render(
    <Component section={seccionVisible(tipo)} variant={defaultVariant} mode="public" />,
  ).container;
}

describe("A2 (3-9) — el hueco impone su tipografía al bloque, en las 12 secciones del registro", () => {
  it("el registro trae las 12 secciones (un `for` sin iteraciones pasaría en verde)", () => {
    expect(TIPOS.length).toBe(12);
  });

  for (const tipo of TIPOS) {
    it(`${tipo}: todo nodo pintado dentro del <h2> hereda familia, peso y color del <h2>`, () => {
      const container = pintar(tipo);
      const h2 = container.querySelector("h2");
      expect(h2, `${tipo}: no pinta ningún <h2>`).not.toBeNull();
      const cs = getComputedStyle(h2!);

      // Los nodos que los componentes de `blocks/` montan dentro del hueco del título.
      const hijos = Array.from(h2!.querySelectorAll("span, time, p"));
      for (const hijo of hijos) {
        const hs = getComputedStyle(hijo);
        expect(hs.fontFamily, `${tipo}: el texto del título no hereda la familia del <h2>`).toBe(
          cs.fontFamily,
        );
        expect(hs.fontWeight, `${tipo}: el texto del título no hereda el peso del <h2>`).toBe(
          cs.fontWeight,
        );
        expect(hs.color, `${tipo}: el texto del título no hereda el color del <h2>`).toBe(cs.color);
      }
    });
  }

  for (const tipo of TIPOS.filter((t) => !TITULO_ESTRUCTURAL.has(t))) {
    it(`${tipo}: el <h2> visible usa la familia de TITULAR, no la de cuerpo`, () => {
      const h2 = pintar(tipo).querySelector("h2")!;
      expect(getComputedStyle(h2).fontFamily).toBe("var(--inv-font-heading)");
    });
  }
});

describe("A3 (3-9) — el título del RSVP se pinta con la tinta del ACENTO, no con la del fondo", () => {
  it("el <h2> y el texto que hay dentro resuelven a var(--inv-color-accent-ink)", () => {
    const h2 = pintar("rsvp").querySelector("h2")!;
    // `RsvpSection.module.css .section { color: var(--inv-color-accent-ink) }` + `.heading { color: inherit }`.
    expect(getComputedStyle(h2).color).toBe("var(--inv-color-accent-ink)");
    const texto = h2.querySelector("span")!;
    expect(texto.textContent).toBe("Confirma tu asistencia");
    // Antes de A2 esto resolvía a `var(--inv-color-ink)`: tinta sobre acento, 2,66:1.
    expect(getComputedStyle(texto).color).toBe("var(--inv-color-accent-ink)");
  });

  it("el fondo sobre el que se pinta ese título es var(--inv-color-accent)", () => {
    const section = pintar("rsvp").querySelector("section")!;
    expect(getComputedStyle(section).background).toContain("var(--inv-color-accent)");
  });
});
