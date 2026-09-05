// test/css-generado.test.ts — el CSS de `generated/` es GENERADO, nunca escrito a mano: esta prueba
// compara byte a byte lo commiteado con lo que sale de `src/*.ts` (el mismo patrón con el que
// `packages/schema` vigila su JSON Schema). Si alguien edita el CSS, esto se pone rojo.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FICHEROS_GENERADOS, generarTailwindCss, generarTokensCss } from "../src/css.ts";
import { MATICES, PASOS, paletaActiva } from "../src/paletas.ts";
import { ROLES_COLOR, semantica } from "../src/semantica.ts";
import { ROLES_TIPOGRAFICOS } from "../src/tipografia.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const leer = (ruta: string): string => readFileSync(resolve(RAIZ, ruta), "utf8");

describe("generated/*.css", () => {
  it("lo commiteado es exactamente lo que emite la fuente", () => {
    for (const fichero of FICHEROS_GENERADOS) {
      expect(leer(fichero.ruta), `${fichero.ruta} está desincronizado: ejecuta \`pnpm run emit:css\``).toBe(
        fichero.contenido(),
      );
    }
  });

  it("tokens.css declara los 46 roles en `:root`, en `[data-theme=\"light\"]` y en `[data-theme=\"dark\"]`", () => {
    const css = generarTokensCss();
    const bloques = css.split(/\n(?=:root \{|\[data-theme="(?:light|dark)"\] \{)/);
    const claro = semantica(paletaActiva(), "light");
    const oscuro = semantica(paletaActiva(), "dark");
    for (const rol of ROLES_COLOR) {
      expect(css, rol).toContain(`  --ui-${rol}: ${claro[rol]};`);
      expect(css, rol).toContain(`  --ui-${rol}: ${oscuro[rol]};`);
    }
    const bloqueOscuro = bloques.find((b) => b.startsWith('[data-theme="dark"]')) ?? "";
    for (const rol of ROLES_COLOR) expect(bloqueOscuro, `el tema oscuro no redefine ${rol}`).toContain(`--ui-${rol}:`);
    expect(bloqueOscuro).toContain("color-scheme: dark;");
    expect(css).toContain(":root {\n  color-scheme: light;");
  });

  it("tokens.css trae las escalas crudas de la paleta activa (para las formas, no para utilidades)", () => {
    const css = generarTokensCss();
    const p = paletaActiva();
    for (const matiz of MATICES) for (const paso of PASOS) expect(css).toContain(`--ui-${matiz}-${paso}: ${p.escalas[matiz].pasos[paso]};`);
    expect(css).toContain("--ui-neutral-950:");
  });

  it("tokens.css trae tipografía, espacio, forma y movimiento", () => {
    const css = generarTokensCss();
    expect(css).toContain('--ui-font-display: "Fraunces Variable"');
    expect(css).toContain("--ui-text-display-2xl: clamp(40px,");
    expect(css).toContain('--ui-variacion-display-2xl: "opsz" 96, "SOFT" 70, "WONK" 1;');
    expect(css).toContain("--ui-space-1: 4px;");
    expect(css).toContain("--ui-radius-control: 8px;");
    expect(css).toContain("--ui-shadow-color: 8px 8px 0 0 var(--ui-support-2);");
    expect(css).toContain("--ui-container-max: 1200px;");
    expect(css).toContain("--ui-dur-respira: 12000ms;");
    expect(css).toContain("--ui-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);");
    // Lo que cambia a partir de 1024 px es interlineado y tracking, nunca el tamaño (eso es clamp).
    expect(css).toMatch(/@media \(min-width: 1024px\) \{\n {2}:root \{\n(?: {4}--ui-(?:leading|tracking)-[a-z0-9-]+: [^\n]+\n)+ {2}\}\n\}/);
  });

  it("el preset solo expone tokens semánticos: ni un paso de escala", () => {
    const preset = generarTailwindCss();
    expect(preset).toContain("@theme inline {");
    for (const rol of ROLES_COLOR) expect(preset).toContain(`  --color-ui-${rol}: var(--ui-${rol});`);
    for (const paso of PASOS) expect(preset).not.toContain(`-${paso}: var(`);
    expect(preset).not.toMatch(/--color-ui-[a-z0-9-]*-(?:50|100|200|300|400|500|600|700|800|900):/);
  });

  it("el preset expone las tres voces y los 15 roles tipográficos con sus modificadores", () => {
    const preset = generarTailwindCss();
    for (const voz of ["display", "text", "label"]) expect(preset).toContain(`--font-ui-${voz}: var(--ui-font-${voz});`);
    for (const rol of ROLES_TIPOGRAFICOS) {
      expect(preset).toContain(`--text-ui-${rol}: var(--ui-text-${rol});`);
      expect(preset).toContain(`--text-ui-${rol}--line-height: var(--ui-leading-${rol});`);
      expect(preset).toContain(`--text-ui-${rol}--letter-spacing: var(--ui-tracking-${rol});`);
      expect(preset).toContain(`--text-ui-${rol}--font-weight: var(--ui-weight-${rol});`);
    }
  });

  it("el preset expone forma, contenedor y curvas, y NO duraciones (Tailwind 4 no tiene ese espacio de nombres)", () => {
    const preset = generarTailwindCss();
    for (const n of ["control", "card", "media", "hero", "pill"]) expect(preset).toContain(`--radius-ui-${n}: var(--ui-radius-${n});`);
    expect(preset).toContain("--shadow-ui-color: var(--ui-shadow-color);");
    expect(preset).toContain("--container-ui-page: var(--ui-container-max);");
    expect(preset).toContain("--ease-ui-out: var(--ui-ease-out);");
    expect(preset).not.toContain("--duration-ui-");
  });

  it("la emisión es determinista (dos llamadas, el mismo byte)", () => {
    expect(generarTokensCss()).toBe(generarTokensCss());
    expect(generarTailwindCss()).toBe(generarTailwindCss());
  });
});
