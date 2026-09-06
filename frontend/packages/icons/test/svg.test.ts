// test/svg.test.ts — compuerta del sistema de iconos (brief 3C-3, «Entregables» §3):
// 1) cada `svg/*.svg` cumple la retícula/trazo/dos-tonos del sistema (11 §4.1, ADR-3C-0-04);
// 2) lo generado (`src/generated/*.tsx`, `src/index.ts`, `inventario.json`) COINCIDE con lo que
//    produce `scripts/generar.ts` ahora mismo — si alguien edita un `.tsx` generado a mano o
//    añade un SVG sin regenerar, esta prueba lo detecta;
// 3) el componente cumple accesibilidad: con `title` es `role="img"` con nombre accesible; sin
//    `title`, `aria-hidden="true"`.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DIR_GENERADO,
  DIR_SVG,
  RUTA_INDICE,
  RUTA_INVENTARIO,
  TOTAL_INVENTARIO_CANONICO,
  aPascalCase,
  generarComponente,
  generarIndice,
  generarInventario,
  leerIconosSvg,
  validarSvg,
} from "../scripts/generar.ts";
import { Icon, iconNames } from "../src/index.ts";

const ficheros = leerIconosSvg(DIR_SVG);

describe("svg/*.svg — reglas del sistema de iconos (11 §4.1)", () => {
  it("hay al menos 20 SVG en la mitad A y el inventario canónico tiene 82 nombres", () => {
    expect(ficheros.length).toBeGreaterThanOrEqual(20);
    expect(TOTAL_INVENTARIO_CANONICO).toBe(82);
  });

  it.each(ficheros.map((f) => [f.nombre, f] as const))("%s.svg pasa validarSvg sin problemas", (_nombre, fichero) => {
    const problemas = validarSvg(fichero.nombre, fichero.contenido);
    expect(problemas, problemas.join("\n")).toEqual([]);
  });

  it("ningún nombre se repite y todos son kebab-case", () => {
    const nombres = ficheros.map((f) => f.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    for (const n of nombres) expect(n).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });
});

describe("lo generado coincide con lo commiteado (regenera y compara)", () => {
  it.each(ficheros.map((f) => [f.nombre, f] as const))(
    "src/generated/%sIcon.tsx (PascalCase) == generarComponente(...)",
    (_nombre, fichero) => {
      const esperado = generarComponente(fichero.nombre, fichero.contenido);
      const ruta = `${DIR_GENERADO}/${aPascalCase(fichero.nombre)}Icon.tsx`;
      const real = readFileSync(ruta, "utf8");
      expect(real).toBe(esperado);
    },
  );

  it("src/index.ts == generarIndice(nombres)", () => {
    const esperado = generarIndice(ficheros.map((f) => f.nombre));
    const real = readFileSync(RUTA_INDICE, "utf8");
    expect(real).toBe(esperado);
  });

  it("inventario.json == generarInventario(nombres)", () => {
    const esperado = generarInventario(ficheros.map((f) => f.nombre));
    const real = readFileSync(RUTA_INVENTARIO, "utf8");
    expect(real).toBe(esperado);
  });
});

describe("componente <Icon /> — accesibilidad (11 §4.1)", () => {
  it("iconNames incluye los nombres presentes en svg/ (mitad A)", () => {
    for (const f of ficheros) expect(iconNames).toContain(f.nombre);
  });

  it("con title: role=img y nombre accesible", () => {
    render(createElement(Icon, { name: "inicio", title: "Ir al inicio" }));
    const icono = screen.getByRole("img", { name: "Ir al inicio" });
    expect(icono.tagName.toLowerCase()).toBe("svg");
  });

  it("sin title: aria-hidden=true y no expone rol de imagen", () => {
    const { container } = render(createElement(Icon, { name: "inicio" }));
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("tone=duo (por defecto) fija --tono a var(--ui-primary-soft); tone=mono a transparent", () => {
    const { container: conDuo } = render(createElement(Icon, { name: "inicio" }));
    const { container: conMono } = render(createElement(Icon, { name: "inicio", tone: "mono" }));
    expect(conDuo.querySelector("svg")?.style.getPropertyValue("--tono")).toBe("var(--ui-primary-soft)");
    expect(conMono.querySelector("svg")?.style.getPropertyValue("--tono")).toBe("transparent");
  });

  it("size controla width/height (24 por defecto)", () => {
    const { container: porDefecto } = render(createElement(Icon, { name: "inicio" }));
    const { container: a48 } = render(createElement(Icon, { name: "inicio", size: 48 }));
    expect(porDefecto.querySelector("svg")?.getAttribute("width")).toBe("24");
    expect(a48.querySelector("svg")?.getAttribute("width")).toBe("48");
  });
});
