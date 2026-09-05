// packages/sections/test/theme/contraste-plantillas.test.ts — D3 del bloque 3-3b.
//
// `04 §17.1` pide tres puntos de comprobación de contraste. El segundo —"CI del frontend:
// `packages/sections/test/contrast.test.ts` sobre TODOS los `theme.json`"— no existía: `u08-
// contrast.test.ts` prueba la FÓRMULA contra tres paletas COPIADAS a mano en el propio archivo, y
// esas copias llevan los valores de antes de la corrección de 3-2d. Es decir: ninguna prueba leía
// los `theme.json` que se registran de verdad, y por eso una paleta pudo salir a producción con un
// `muted` que `axe` marcó `serious` sobre la invitación publicada.
//
// Este archivo lee los `theme.json` REALES de `frontend/templates/**` — los mismos bytes que
// `build-packages.mjs` cose al paquete y que el backend registra— y afirma dos cosas:
//
//   1. Las cinco parejas de `04 §17.1`, tal cual están escritas.
//   2. `muted` Y `accent` a 4,5:1 contra `bg` Y contra `surface`, que es lo que WCAG 1.4.3 exige y
//      lo que `04 §17.1` NO cubre. Sus umbrales de 3,0 están escritos para otra cosa: el de `muted`
//      para "texto secundario GRANDE" (≥ 18,66 px en negrita o ≥ 24 px) y el de `accent` para
//      "componentes de interfaz" (1.4.11). Este paquete no cumple ninguna de las dos premisas:
//      pinta los dos tokens como COLOR DE TEXTO de tamaño normal, en los sitios enumerados abajo.
//      Medido [V] antes de la corrección, sobre la invitación publicada real:
//        · `blush.muted  #9A8A86` — 3,12:1 sobre bg · 3,31:1 sobre surface → 4 nodos `serious`
//        · `blush.accent #B35B5B` — 4,33:1 sobre bg (13 a 20 px)          → 9 nodos `serious`
//      Los 13 nodos son la MISMA violación `color-contrast` de impacto `serious`, que rompe
//      ADR-024 ("cero violaciones críticas o serias en el render público").
//
// El punto 2 falla contra el árbol anterior a 3-3b en las CINCO paletas de las dos plantillas
// (`muted` 3,09 · 3,09 · 3,11 · 3,12 · 3,31; `accent` 4,22 · 4,31 · 4,34 · 4,35 y `navy` a 8,11,
// la única que ya cumplía) — no sólo en los cuatro nodos que el informe de 3-3 alcanzó a enseñar.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio, evaluatePaletteContrast, type PaletteTokens } from "../../src/theme/contrast.ts";

const here = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(here, "../../../../templates");

/**
 * Los sitios donde `packages/sections` pinta `--inv-color-muted` o `--inv-color-accent` como TEXTO,
 * sin garantizar tamaño grande. Si alguna de las dos listas se vacía algún día (porque el token
 * deje de usarse en texto normal), el umbral de 4,5 para ese token se puede revisar — antes no.
 */
const USOS_EN_TEXTO_NORMAL = {
  muted: [
    "blocks/blocks.module.css .muted",
    "blocks/blocks.module.css .personNote",
    "blocks/blocks.module.css .locationAddress",
    "blocks/blocks.module.css .boolean",
    "styles/CelebrantSection.module.css .kicker",
    "styles/CelebrantSection.module.css .dateRow",
    "styles/CoverSection.module.css .dateRow",
  ],
  accent: [
    "blocks/blocks.module.css .link",
    "styles/EventSection.module.css .groupWrap li > span:nth-of-type(2)",
    "styles/GallerySection.module.css .hashtag",
  ],
} as const;

interface ThemeJson {
  readonly palettes: ReadonlyArray<{ readonly id: string; readonly tokens: PaletteTokens }>;
}

const PLANTILLAS = ["boda-clasica", "xv-jardin"] as const;

function leerTheme(slug: string): ThemeJson {
  return JSON.parse(readFileSync(join(TEMPLATES_DIR, slug, "1.0.0", "theme.json"), "utf8")) as ThemeJson;
}

describe("04 §17.1 — las cinco parejas, sobre los theme.json REALES de frontend/templates", () => {
  for (const slug of PLANTILLAS) {
    const theme = leerTheme(slug);
    // Que la plantilla traiga paletas es parte de lo que se afirma: un theme.json vacío haría
    // pasar en verde un `for` sin iteraciones.
    it(`${slug}: declara al menos una paleta`, () => {
      expect(theme.palettes.length).toBeGreaterThan(0);
    });

    for (const pal of theme.palettes) {
      it(`${slug}/${pal.id}: las cinco parejas de 04 §17.1 cumplen su umbral`, () => {
        for (const r of evaluatePaletteContrast(pal.tokens)) {
          expect(r.passes, `${r.pair}: ${r.ratio.toFixed(2)}:1 < ${r.threshold}`).toBe(true);
        }
      });
    }
  }
});

/**
 * A3 del bloque 3-9 — LA COMPUERTA ERA CIEGA AL PEOR CONTRASTE DE LA INVITACIÓN.
 *
 * 3-CV midió el título del RSVP en la invitación publicada: `#3A2E2B` sobre `#B05555` = **2,66:1**,
 * por debajo del 3:1 que AA exige incluso para texto grande. Ni `axe` ni este archivo lo veían:
 *   · `axe-core@4.13.0` deja ese nodo en `incomplete` ("Element's background color could not be
 *     determined due to a background gradient"), así que el «0 reglas critical/serious» de 3-3b es
 *     cierto y a la vez NO cubre ese caso (`bitacora/3-cv.md §3.3`).
 *   · los `describe` de arriba comprueban PAREJAS DE TOKENS, no qué pareja pinta cada superficie.
 *     `accentInk/accent` pasaba a 8,5:1 mientras la sección pintaba de verdad `ink` sobre `accent`.
 *
 * Esta tabla cierra el hueco por el otro lado: enumera las SUPERFICIES DE TEXTO de las secciones —
 * qué token pinta el texto y sobre qué token de fondo cae — y las evalúa contra los `theme.json`
 * REALES. Lo que ninguna aritmética de paletas puede decir (que la hoja de estilo use de verdad ese
 * par) lo afirma `jerarquia-tipografica.test.tsx` con `getComputedStyle` sobre el CSS Module real:
 * las dos pruebas juntas son la compuerta, y ninguna de las dos sirve sola.
 */
const SUPERFICIES_DE_TEXTO: ReadonlyArray<{
  readonly donde: string;
  readonly texto: keyof PaletteTokens;
  readonly fondo: keyof PaletteTokens;
  readonly umbral: number;
}> = [
  // El punto de conversión de la invitación: banda a sangre en `--inv-color-accent`.
  { donde: "RsvpSection .section → .heading (título del RSVP)", texto: "accentInk", fondo: "accent", umbral: 4.5 },
  { donde: "RsvpSection .section → .intro (nota del RSVP)", texto: "accentInk", fondo: "accent", umbral: 4.5 },
  { donde: "RsvpSection .cta (botón «Confirmar asistencia»)", texto: "accent", fondo: "accentInk", umbral: 4.5 },
  // Los títulos de las nueve secciones interiores, sobre el fondo del documento.
  { donde: "{Event,Gallery,Story,DressCode,GiftTable,Suggestions,Amenities,Celebrant,Family}Section .heading", texto: "ink", fondo: "bg", umbral: 4.5 },
  // Tarjetas de giftTable/suggestions/amenities/family.
  { donde: "tarjetas de sección (`--inv-color-surface`)", texto: "ink", fondo: "surface", umbral: 4.5 },
  // A1: la portada pasa a pintar el texto en tinta sobre la lámina, cuyo lavado parte de `bg`.
  { donde: "CoverSection[data-variant=full] .content (A1 de 3-9)", texto: "ink", fondo: "bg", umbral: 4.5 },
];

describe("A3 (3-9) — las superficies de TEXTO de las secciones, sobre los theme.json reales", () => {
  it("la tabla de superficies no está vacía", () => {
    expect(SUPERFICIES_DE_TEXTO.length).toBeGreaterThan(0);
  });

  for (const slug of PLANTILLAS) {
    for (const pal of leerTheme(slug).palettes) {
      for (const s of SUPERFICIES_DE_TEXTO) {
        it(`${slug}/${pal.id}: ${s.donde} — ${s.texto} sobre ${s.fondo} ≥ ${s.umbral}:1`, () => {
          const r = contrastRatio(pal.tokens[s.texto], pal.tokens[s.fondo]);
          expect(
            r,
            `${s.texto} ${pal.tokens[s.texto]} sobre ${s.fondo} ${pal.tokens[s.fondo]}: ${r.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(s.umbral);
        });
      }

      // El defecto EXACTO que 3-CV midió, escrito como caso: si alguna hoja volviera a pintar la
      // tinta del documento sobre la banda de acento, este par es el que se estaría usando. Se deja
      // documentado el ratio real para que nadie lo vuelva a dar por bueno "porque axe pasa".
      it(`${slug}/${pal.id}: ink sobre accent NO llega a 3:1 (el defecto de O-04, para que conste)`, () => {
        const r = contrastRatio(pal.tokens.ink, pal.tokens.accent);
        expect(
          r,
          `ink ${pal.tokens.ink} sobre accent ${pal.tokens.accent} = ${r.toFixed(2)}:1 — ` +
            "si esto supera 3:1 algún día, revisa si sigue haciendo falta prohibir esa combinación",
        ).toBeLessThan(3);
      });
    }
  }
});

describe("WCAG 1.4.3 — `muted` y `accent` son texto de tamaño NORMAL aquí: exigen 4,5:1", () => {
  for (const token of ["muted", "accent"] as const) {
    it(`hay al menos un uso de --inv-color-${token} en texto sin tamaño grande garantizado (${USOS_EN_TEXTO_NORMAL[token].length})`, () => {
      expect(USOS_EN_TEXTO_NORMAL[token].length).toBeGreaterThan(0);
    });

    for (const slug of PLANTILLAS) {
      for (const pal of leerTheme(slug).palettes) {
        it(`${slug}/${pal.id}: ${token}/bg y ${token}/surface ≥ 4,5:1`, () => {
          const color = pal.tokens[token];
          const sobreBg = contrastRatio(color, pal.tokens.bg);
          const sobreSurface = contrastRatio(color, pal.tokens.surface);
          expect(sobreBg, `${token} ${color} sobre bg ${pal.tokens.bg}: ${sobreBg.toFixed(2)}:1`)
            .toBeGreaterThanOrEqual(4.5);
          expect(
            sobreSurface,
            `${token} ${color} sobre surface ${pal.tokens.surface}: ${sobreSurface.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});
