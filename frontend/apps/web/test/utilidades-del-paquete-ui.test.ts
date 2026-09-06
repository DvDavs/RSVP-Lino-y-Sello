// test/utilidades-del-paquete-ui.test.ts — compuerta del descubrimiento de clases de Tailwind 4
// sobre `@invitaciones/ui` (revisión del bloque 2, fase 3-C).
//
// Tailwind 4 descubre las clases recorriendo el árbol del proyecto y SALTÁNDOSE `node_modules`. Los
// paquetes del monorepo entran precisamente por ahí (symlink de pnpm), así que sin un `@source`
// explícito sus clases no se descubren: la utilidad no se emite, el navegador la ignora y el
// componente sale a medio pintar SIN un solo error. Medido en la revisión: 28 de las 51 utilidades
// `*-ui-*` que usa `packages/ui/src` faltaban en el CSS construido (entre ellas `text-ui-on-accent`,
// que dejaba el botón «acento» con la tinta heredada: 2,57 de contraste en claro, 1,75 en oscuro).
//
// Aquí se vigilan las dos mitades del cableado:
//   1. el `@source` existe y apunta a un directorio real;
//   2. cada rol de color/forma que nombra una utilidad del paquete existe de verdad en el preset
//      (`@invitaciones/tokens/generated/tailwind.css`), que es lo que Tailwind acabará resolviendo.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const GLOBALS = path.join(RAIZ, "app/(chrome)/globals.css");
const PAQUETE_UI = path.resolve(RAIZ, "../../packages/ui/src");
const PRESET = path.resolve(RAIZ, "../../packages/tokens/generated/tailwind.css");

/** Prefijos de utilidad que consumen el espacio de nombres de color del preset. */
const PREFIJOS_COLOR = [
  "bg",
  "text",
  "border",
  "ring",
  "fill",
  "stroke",
  "from",
  "to",
  "via",
  "divide",
  "outline",
  "decoration",
  "accent",
  "caret",
  "placeholder",
  "shadow",
] as const;

function ficherosFuente(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      salida.push(...ficherosFuente(completo));
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      salida.push(completo);
    }
  }
  return salida;
}

describe("Tailwind ve las clases de @invitaciones/ui", () => {
  it("globals.css declara un @source que apunta al código del paquete", () => {
    const globals = readFileSync(GLOBALS, "utf8");
    const rutas = [...globals.matchAll(/@source\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(rutas.length, "no hay ningún @source en globals.css").toBeGreaterThan(0);

    const resueltas = rutas.map((r) => path.resolve(path.dirname(GLOBALS), r));
    expect(resueltas, `@source declarados: ${resueltas.join(", ")}`).toContain(PAQUETE_UI);
    expect(existsSync(PAQUETE_UI)).toBe(true);
  });

  it("cada utilidad *-ui-* del paquete nombra un token que el preset define de verdad", () => {
    const preset = readFileSync(PRESET, "utf8");
    const definidos = new Set([...preset.matchAll(/--([a-z]+(?:-[a-z]+)*)-ui-([a-z0-9-]+):/g)].map((m) => `${m[1]}|${m[2]}`));

    const usadas = new Set<string>();
    for (const fichero of ficherosFuente(PAQUETE_UI)) {
      const contenido = readFileSync(fichero, "utf8");
      for (const m of contenido.matchAll(/\b([a-z]+)-ui-([a-z0-9-]+)\b/g)) {
        if ((PREFIJOS_COLOR as readonly string[]).includes(m[1])) usadas.add(`${m[1]}|${m[2]}`);
      }
    }

    // `bg`/`border`/… resuelven contra `--color-ui-*` y `shadow` contra `--shadow-ui-*`; `text-`
    // es ambiguo en Tailwind 4 (tamaño de letra `--text-ui-*` O color `--color-ui-*`), así que vale
    // con que exista en cualquiera de los dos espacios.
    const espaciosDe = (prefijo: string): readonly string[] =>
      prefijo === "shadow" ? ["shadow"] : prefijo === "text" ? ["color", "text"] : ["color"];

    const huerfanas: string[] = [];
    for (const usada of usadas) {
      const [prefijo, rol] = usada.split("|");
      if (!espaciosDe(prefijo).some((espacio) => definidos.has(`${espacio}|${rol}`))) {
        huerfanas.push(`${prefijo}-ui-${rol}`);
      }
    }
    expect(huerfanas.sort(), `utilidades sin token en el preset: ${huerfanas.join(", ")}`).toEqual([]);
  });
});
