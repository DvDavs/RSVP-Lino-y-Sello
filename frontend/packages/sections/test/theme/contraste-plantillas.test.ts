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
  // El punto de conversión de la invitación: banda a sangre en `--inv-color-accent`. OJO (I-05):
  // estas dos filas sólo describen el caso SIN fotografía de fondo. Con fotografía, lo que se
  // pinta detrás del texto es el degradado `.veil` sobre esa foto — lo mide el último `describe`.
  { donde: "RsvpSection .section → .heading (título del RSVP)", texto: "accentInk", fondo: "accent", umbral: 4.5 },
  { donde: "RsvpSection .section → .intro (nota del RSVP)", texto: "accentInk", fondo: "accent", umbral: 4.5 },
  // I-05: el fondo REAL del botón es `background: var(--inv-color-surface)`
  // (`RsvpSection.module.css:176`), no `accentInk`. Pasaba por casualidad: en las cinco paletas
  // los dos tokens valen `#FFFFFF`. Es el mismo error de clase que esta issue persigue —
  // afirmar una pareja que no es la que se pinta— sólo que aquí no cambiaba el resultado.
  { donde: "RsvpSection .cta (botón «Confirmar asistencia»)", texto: "accent", fondo: "surface", umbral: 4.5 },
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

/**
 * I-05 — COMBINACIONES RENDERIZADAS, NO PAREJAS DE TOKENS. Aquí entra el degradado.
 *
 * Los tres `describe` de arriba comparan COLORES DE PALETA entre sí. Eso deja fuera la superficie
 * más difícil de la invitación: la banda del RSVP, donde el texto no cae sobre un token sino sobre
 * un DEGRADADO semitransparente (`RsvpSection.module.css .veil`) pintado encima de la fotografía
 * de fondo que suba la clienta. Ahí:
 *   · `axe-core` se rinde: devuelve `incomplete` ("background gradient"), nunca `violation`, así
 *     que la compuerta de `e2e/a11y-publico.spec.ts` puede estar en verde con el producto
 *     incumpliendo — que es exactamente lo que pasó (H-ADV-02).
 *   · la tabla `SUPERFICIES_DE_TEXTO` tampoco lo veía: afirma `accentInk/accent` (4,90 a 8,78:1 en
 *     las cinco paletas), pero `accent` sólo es el fondo real cuando NO hay fotografía. Con
 *     fotografía, el fondo es `ink` al 55 % encima de esa fotografía, que es otro color.
 *
 * Medido [V] con `getComputedStyle` + muestreo de píxeles del fondo bajo cada glifo sobre la
 * invitación PUBLICADA (`bitacora/3b-i05.md` §2), con el velo al 55 %: los cuatro nodos de texto de
 * tamaño normal de esta banda daban 4,03 a 4,30:1 a 1440×900 y a 390×844. Por debajo de 4,5.
 *
 * Este bloque LEE LAS PARADAS DEL DEGRADADO DEL `.module.css` REAL —no una copia— y compone cada
 * una sobre los tres fondos posibles: sin fotografía (el `--inv-color-accent` de la propia
 * `.section`), una fotografía BLANCA (el peor caso para texto claro) y una NEGRA. Si alguien vuelve
 * a aclarar el velo, o cambia `accentInk` en un `theme.json`, esta prueba se pone roja sin que haga
 * falta que nadie se acuerde de volver a medir en el navegador.
 */
const ESTILOS = resolve(here, "../../src/styles");

/** `--inv-color-<esto>` → clave de `PaletteTokens` (`04 §5.4`, los seis tokens de color). */
const TOKEN_CSS: Readonly<Record<string, keyof PaletteTokens>> = {
  bg: "bg",
  surface: "surface",
  ink: "ink",
  accent: "accent",
  "accent-ink": "accentInk",
  muted: "muted",
};

/** El bloque de declaraciones de UNA regla de un `.module.css`, tal cual está en disco. */
function bloqueDeRegla(archivo: string, selector: string): string {
  const css = readFileSync(join(ESTILOS, archivo), "utf8");
  const inicio = css.indexOf(`\n${selector} {`);
  if (inicio < 0) throw new Error(`${archivo}: no existe la regla \`${selector}\``);
  const fin = css.indexOf("\n}", inicio);
  if (fin < 0) throw new Error(`${archivo}: la regla \`${selector}\` no cierra`);
  return css.slice(inicio, fin);
}

/**
 * Paradas `color-mix(in srgb, var(--inv-color-X) N%, transparent)` de una regla real, en orden.
 * Es la forma exacta en la que este paquete escribe una capa semitransparente (04 §19.2 prohíbe
 * hexadecimales sueltos), así que el patrón cubre el 100 % de los velos existentes.
 */
function paradasDeDegradado(archivo: string, selector: string): ReadonlyArray<{
  readonly token: keyof PaletteTokens;
  readonly alfa: number;
  /** El porcentaje TAL CUAL está escrito en el CSS, para que el mensaje de fallo lo cite sin
   *  arrastrar el ruido binario de `55 / 100 * 100 = 55.00000000000001`. */
  readonly porcentaje: string;
}> {
  const patron = /color-mix\(\s*in srgb,\s*var\(--inv-color-([a-z-]+)\)\s*(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/g;
  const paradas: Array<{ token: keyof PaletteTokens; alfa: number; porcentaje: string }> = [];
  for (const m of bloqueDeRegla(archivo, selector).matchAll(patron)) {
    const clave = TOKEN_CSS[m[1]!];
    if (!clave) throw new Error(`${archivo} ${selector}: --inv-color-${m[1]} no es un token de paleta`);
    paradas.push({ token: clave, alfa: Number(m[2]) / 100, porcentaje: `${m[2]} %` });
  }
  return paradas;
}

/** Composición alfa en sRGB: lo que hace el navegador al pintar una capa translúcida sobre otra. */
function componer(colorHex: string, alfa: number, fondoHex: string): string {
  const canal = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mezcla = (i: number) => Math.round(alfa * canal(colorHex, i) + (1 - alfa) * canal(fondoHex, i));
  return `#${[0, 1, 2].map((i) => mezcla(i).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

/**
 * Lo que puede haber DEBAJO del velo del RSVP. `RsvpSection.tsx` monta `.backdrop` con la imagen
 * que traiga la sección; si no hay imagen, se ve el `background: var(--inv-color-accent)` de
 * `.section`. Una fotografía es cualquier color, y como la luminancia relativa es monótona en cada
 * canal, los extremos del cubo sRGB (blanco y negro) acotan TODOS los casos intermedios.
 */
const FONDOS_BAJO_EL_VELO: ReadonlyArray<{ readonly nombre: string; readonly color: (t: PaletteTokens) => string }> = [
  { nombre: "sin fotografía (el --inv-color-accent de .section)", color: (t) => t.accent },
  { nombre: "fotografía BLANCA (peor caso para texto claro)", color: () => "#FFFFFF" },
  { nombre: "fotografía NEGRA (peor caso para texto oscuro)", color: () => "#000000" },
];

describe("I-05 — el velo del RSVP es un DEGRADADO: se compone y se mide, no se supone", () => {
  const paradas = paradasDeDegradado("RsvpSection.module.css", ".veil");

  it("`.veil` declara un degradado de al menos dos paradas translúcidas (si no, no hay nada que medir)", () => {
    expect(paradas.length, "RsvpSection.module.css .veil ya no usa color-mix translúcido").toBeGreaterThanOrEqual(2);
    for (const p of paradas) expect(p.alfa).toBeGreaterThan(0);
  });

  for (const slug of PLANTILLAS) {
    for (const pal of leerTheme(slug).palettes) {
      for (const [i, parada] of paradas.entries()) {
        for (const fondo of FONDOS_BAJO_EL_VELO) {
          it(`${slug}/${pal.id}: parada ${i + 1} del velo (${parada.token} al ${parada.porcentaje}) sobre ${fondo.nombre} — accentInk ≥ 4,5:1`, () => {
            const debajo = fondo.color(pal.tokens);
            const compuesto = componer(pal.tokens[parada.token], parada.alfa, debajo);
            const r = contrastRatio(pal.tokens.accentInk, compuesto);
            expect(
              r,
              `accentInk ${pal.tokens.accentInk} sobre ${pal.tokens[parada.token]} al ${parada.porcentaje} ` +
                `encima de ${debajo} = ${compuesto} → ${r.toFixed(2)}:1. En esta banda hay texto de tamaño ` +
                "NORMAL (.chip 15 px, .note 17 px, .ctaCaption 12 px), así que WCAG 1.4.3 pide 4,5:1. " +
                "`axe` deja este nodo en `incomplete` por el degradado: no lo va a cazar nadie más.",
            ).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
    }
  }
});
