// apps/web/test/fuentes-autoalojadas.test.ts — A4 del bloque 3-9 (objeción ALTA de `3-CV`,
// evidencia `O-02a` y `O-02b`).
//
// EL DEFECTO. `app/(public)/publico.css` es el único sitio donde la superficie pública autoaloja
// tipografías (ADR-1R-F-07: nunca se pide una fuente a un tercero en tiempo de ejecución).
// Importaba SÓLO Cormorant Garamond e Inter, con un comentario que afirmaba que ninguna invitación
// usaba el set «Moderna». `xv-jardin/1.0.0/theme.json` declara `"defaultFontSetId": "moderna"` y no
// tiene ningún otro set, así que esa plantilla ENTERA se pintaba en Georgia + la sans del sistema;
// y «Moderna» es además una de las dos opciones que el editor ofrece en `boda-clasica`.
//
// EL AGUJERO DE PROCESO, que es lo que arregla este archivo: nada ataba la lista de `@import` al
// catálogo de plantillas. Una afirmación en un comentario no es una compuerta. Esta prueba lee los
// `theme.json` REALES de `frontend/templates/**` — los mismos bytes que `build-packages.mjs` cose al
// paquete y que el backend registra — y exige un `@import` de `@fontsource/<familia>/<peso>.css` por
// CADA par familia+peso que cualquier `fontSets[]` declare, en cualquier plantilla. Una plantilla
// nueva con una familia nueva pone esto en rojo antes de que ninguna invitación salga en Georgia.
//
// Falla sin el arreglo [V]: 4 pares sin importar (Playfair Display 400/700, Source Sans 3 400/600).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PUBLICO_CSS = path.join(RAIZ, "app", "(public)", "publico.css");
const TEMPLATES = path.resolve(RAIZ, "../../templates");

interface FontFaceDecl {
  readonly family: string;
  readonly weights: readonly number[];
  readonly source: string;
}
interface ThemeJson {
  readonly fontSets: ReadonlyArray<{
    readonly id: string;
    readonly heading: FontFaceDecl;
    readonly body: FontFaceDecl;
  }>;
}

/** `@fontsource` publica cada familia con su nombre en minúsculas y guiones ("Source Sans 3" ⇒ "source-sans-3"). */
function paqueteFontsource(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Cada `theme.json` bajo `frontend/templates/<slug>/<version>/`. Sin lista escrita a mano. */
function temasDelCatalogo(): Array<{ ruta: string; theme: ThemeJson }> {
  const salida: Array<{ ruta: string; theme: ThemeJson }> = [];
  for (const slug of readdirSync(TEMPLATES, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const dirSlug = path.join(TEMPLATES, slug.name);
    for (const version of readdirSync(dirSlug, { withFileTypes: true })) {
      if (!version.isDirectory()) continue;
      const ruta = path.join(dirSlug, version.name, "theme.json");
      try {
        salida.push({ ruta: `${slug.name}/${version.name}`, theme: JSON.parse(readFileSync(ruta, "utf8")) as ThemeJson });
      } catch {
        // `demo/`, `node_modules/` y demás carpetas sin theme.json: no son plantillas.
      }
    }
  }
  return salida;
}

const CSS = readFileSync(PUBLICO_CSS, "utf8");
const IMPORTS = new Set(
  Array.from(CSS.matchAll(/@import\s+"@fontsource\/([^"/]+)\/(\d+)\.css"/g)).map((m) => `${m[1]}/${m[2]}`),
);

const CATALOGO = temasDelCatalogo();

/** Todos los pares familia+peso que el catálogo declara, con el sitio exacto donde se declaran. */
const REQUERIDOS = CATALOGO.flatMap(({ ruta, theme }) =>
  theme.fontSets.flatMap((fs) =>
    (["heading", "body"] as const).flatMap((rol) =>
      fs[rol].weights.map((peso) => ({
        clave: `${paqueteFontsource(fs[rol].family)}/${peso}`,
        donde: `${ruta} fontSets[${fs.id}].${rol} = "${fs[rol].family}" ${peso}`,
      })),
    ),
  ),
);

describe("A4 (3-9) — toda familia del catálogo de plantillas está autoalojada en publico.css", () => {
  it("el catálogo trae plantillas y sets tipográficos (un `for` vacío pasaría en verde)", () => {
    expect(CATALOGO.length).toBeGreaterThan(0);
    expect(REQUERIDOS.length).toBeGreaterThan(0);
  });

  it("publico.css declara al menos un @import de @fontsource", () => {
    expect(IMPORTS.size).toBeGreaterThan(0);
  });

  for (const { clave, donde } of REQUERIDOS) {
    it(`${donde} → @fontsource/${clave}.css`, () => {
      expect(
        IMPORTS.has(clave),
        `Falta \`@import "@fontsource/${clave}.css"\` en app/(public)/publico.css. ` +
          `Sin él, esa invitación se pinta con la pila de reserva (Georgia / sans del sistema).`,
      ).toBe(true);
    });
  }

  it("cada familia importada es una de la allowlist de @invitaciones/sections (ADR-1R-F-07)", async () => {
    const { GOOGLE_FONT_ALLOWLIST } = await import("@invitaciones/sections");
    const permitidas = new Set(GOOGLE_FONT_ALLOWLIST.map(paqueteFontsource));
    const importadas = new Set(Array.from(IMPORTS).map((k) => k.split("/")[0]!));
    for (const familia of importadas) {
      expect(permitidas.has(familia), `"${familia}" se autoaloja pero no está en GOOGLE_FONT_ALLOWLIST`).toBe(true);
    }
  });

  it("no se importa ninguna familia que el catálogo NO use (bytes en la primera carga de todas)", () => {
    const usadas = new Set(REQUERIDOS.map((r) => r.clave));
    for (const clave of IMPORTS) {
      expect(usadas.has(clave), `@fontsource/${clave}.css se importa pero ningún theme.json lo declara`).toBe(true);
    }
  });
});
