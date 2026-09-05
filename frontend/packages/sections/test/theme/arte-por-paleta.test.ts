// packages/sections/test/theme/arte-por-paleta.test.ts — A6 del bloque 3-9 (objeción ALTA de
// `3-CV`, evidencia `O-07`).
//
// EL DEFECTO. `templates/scripts/build-art.mjs` leía sólo `theme.defaultPaletteId`, así que
// generaba UN paquete de arte por plantilla. El editor ofrece tres paletas en `boda-clasica` y dos
// en `xv-jardin`, pero las trece imágenes de la invitación seguían tintadas con la primera: con
// `navy` elegida, trece láminas ROSAS sobre un fondo azul frío. El sistema prometía tres paletas y
// servía una.
//
// POR QUÉ ESTA PRUEBA VIVE AQUÍ. `frontend/templates/` no está en el workspace de pnpm (su
// `package.json` lo dice: aislado a propósito, ADR-3-2d-01), así que no tiene corredor de pruebas
// propio. `packages/sections` ya lee los `template.json` reales de ese árbol en
// `test/registry.contract.test.ts`; este archivo sigue el mismo patrón con los `theme.json` y con
// las carpetas de arte. La comprobación de que el arte NO ha derivado la hace
// `node frontend/templates/scripts/build-art.mjs --check`, que es la compuerta de bytes.
//
// Falla sin el arreglo [V]: `demo/` tenía las imágenes sueltas, sin carpeta por paleta, así que
// faltaban las cinco carpetas.
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(here, "../../../../templates");

interface ThemeJson {
  readonly defaultPaletteId: string;
  readonly palettes: ReadonlyArray<{ readonly id: string }>;
}

const PLANTILLAS = ["boda-clasica", "xv-jardin"] as const;

function leerTheme(slug: string): ThemeJson {
  return JSON.parse(readFileSync(join(TEMPLATES_DIR, slug, "1.0.0", "theme.json"), "utf8")) as ThemeJson;
}

function imagenesDe(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".webp"))
    .sort();
}

describe("A6 (3-9) — cada paleta del catálogo tiene su propio juego de arte de demostración", () => {
  for (const slug of PLANTILLAS) {
    const theme = leerTheme(slug);

    it(`${slug}: declara paletas y una por defecto que existe`, () => {
      expect(theme.palettes.length).toBeGreaterThan(0);
      expect(theme.palettes.map((p) => p.id)).toContain(theme.defaultPaletteId);
    });

    it(`${slug}: la carpeta demo/ no guarda imágenes sueltas — sólo una subcarpeta por paleta`, () => {
      const demo = join(TEMPLATES_DIR, slug, "demo");
      expect(existsSync(demo), `falta ${demo}`).toBe(true);
      const sueltas = readdirSync(demo).filter((f) => !statSync(join(demo, f)).isDirectory());
      expect(sueltas, "quedan imágenes sin paleta: el sembrador no sabría con cuál casan").toEqual([]);
    });

    for (const pal of theme.palettes) {
      it(`${slug}/${pal.id}: existe demo/${pal.id}/ con las mismas piezas que la paleta por defecto`, () => {
        const dir = join(TEMPLATES_DIR, slug, "demo", pal.id);
        expect(
          existsSync(dir),
          `falta ${slug}/demo/${pal.id}/ — esa paleta se serviría con el arte de otra ` +
            "(ejecuta `node frontend/templates/scripts/build-art.mjs`)",
        ).toBe(true);
        const porDefecto = imagenesDe(join(TEMPLATES_DIR, slug, "demo", theme.defaultPaletteId));
        expect(porDefecto.length).toBeGreaterThan(0);
        expect(imagenesDe(dir)).toEqual(porDefecto);
      });
    }
  }
});
