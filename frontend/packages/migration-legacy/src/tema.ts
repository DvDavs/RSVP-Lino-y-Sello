// src/tema.ts — separación de la presentación a `theme.json` (paso 3 de `05 §3`).
//
// UNA paleta y UN `fontSet` por plantilla. El criterio es HUMANO —no hay forma automática de derivar
// un preset razonable de hexadecimales sueltos— y por eso queda ESCRITO: el `theme.json` no admite un
// campo `_comentario` (`ThemeSpec` es `z.strictObject`, `manifest.ts`), así que el criterio va al
// informe de pérdidas, que es donde lo lee quien audita la conversión (ver preguntas-abiertas.md).
//
// WCAG 2.2 AA es requisito duro (`contratos.md §8`). La fórmula de contraste se IMPORTA de
// `@invitaciones/tokens` (`src/contraste.ts`), que es la canónica del repositorio: no se escribe otra.
// Y se corrige EL COLOR, nunca el umbral (ADR-3-2d-04): se conservan matiz y saturación HSL y sólo
// baja la luminosidad, hasta el valor más claro que cumple con margen.

import { contraste } from "@invitaciones/tokens";
import type { ThemeSpec } from "@invitaciones/schema";

/** Las parejas garantizadas de `04 §17.1` más las cuatro de 1.4.3 (ADR-3-3b-03). */
export const PAREJAS_AA: readonly (readonly [string, keyof Tokens, keyof Tokens, number])[] = [
  ["ink/bg", "ink", "bg", 4.5],
  ["ink/surface", "ink", "surface", 4.5],
  ["accentInk/accent", "accentInk", "accent", 4.5],
  ["muted/bg", "muted", "bg", 4.5],
  ["muted/surface", "muted", "surface", 4.5],
  ["accent/bg", "accent", "bg", 4.5],
  ["accent/surface", "accent", "surface", 4.5],
];

export interface Tokens {
  bg: string; surface: string; ink: string; accent: string; accentInk: string; muted: string;
}

const hex2 = (n: number): string => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
export const rgbAHex = (r: number, g: number, b: number): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();

export function hexARgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbAHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

export function hslAHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbAHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Oscurece por la MISMA rampa de tono (matiz y saturación intactos) hasta el valor más claro que
 * alcanza `objetivo` contra todos los fondos. Devuelve `null` si ni el negro puro lo consigue.
 */
export function oscurecerHastaAA(hex: string, fondos: readonly string[], objetivo: number): string | null {
  const [h, s, l0] = rgbAHsl(...hexARgb(hex));
  for (let l = l0; l >= 0; l -= 0.005) {
    const c = hslAHex(h, s, Math.max(0, l));
    if (fondos.every((f) => contraste(c, f) >= objetivo)) return c;
  }
  return null;
}

export class ErrorContraste extends Error {
  constructor(public readonly fallos: readonly string[]) {
    super(`La paleta no cumple WCAG 2.2 AA y el umbral NO se toca (ADR-3-2d-04):\n  ${fallos.join("\n  ")}`);
    this.name = "ErrorContraste";
  }
}

/** Comprueba las parejas. Lanza `ErrorContraste` con la salida medida si alguna baja del umbral. */
export function comprobarAA(t: Tokens): { pareja: string; ratio: number; umbral: number }[] {
  const filas = PAREJAS_AA.map(([nombre, fig, fon, umbral]) => ({
    pareja: nombre, ratio: Math.round(contraste(t[fig], t[fon]) * 100) / 100, umbral,
  }));
  const fallos = filas.filter((f) => f.ratio < f.umbral)
    .map((f) => `FALLA AA: ${f.pareja} ${f.ratio}:1 < ${f.umbral}:1`);
  if (fallos.length > 0) throw new ErrorContraste(fallos);
  return filas;
}

/** Nombre de familia de matiz, para que la paleta tenga un id con sentido y no `paleta1`. */
export function nombreDeMatiz(h: number): { id: string; nombre: string } {
  const tabla: readonly [number, string, string][] = [
    [15, "rojo", "Rojo"], [45, "ambar", "Ámbar"], [70, "oliva", "Oliva"], [160, "verde", "Verde"],
    [200, "turquesa", "Turquesa"], [250, "azul", "Azul"], [290, "violeta", "Violeta"],
    [330, "magenta", "Magenta"], [360, "rojo", "Rojo"],
  ];
  for (const [tope, id, nombre] of tabla) if (h < tope) return { id, nombre };
  return { id: "neutro", nombre: "Neutro" };
}

export interface EntradaTema {
  /** RGBA legado de `settings.primaryColor`. */
  readonly primario: readonly number[] | null;
  readonly secundario: readonly number[] | null;
  /** RGBA de los `backgroundColor` de sección, en orden de aparición. */
  readonly fondos: readonly (readonly number[])[];
  /** `fontFamily` medidos, con cuántas veces aparece cada uno y si es de un título. */
  readonly fuentes: readonly { readonly familia: string; readonly veces: number; readonly enTitulo: number }[];
}

export interface TemaConstruido {
  readonly theme: ThemeSpec;
  /** El criterio humano, escrito. Va al informe de pérdidas porque `theme.json` no admite comentarios. */
  readonly comentario: string;
  readonly contraste: { pareja: string; ratio: number; umbral: number }[];
  readonly correcciones: string[];
}

const GRIS_TINTA = "#2B2B2B";

/**
 * Construye la paleta y el juego tipográfico. El criterio, en una frase por token:
 * `accent` ← `settings.primaryColor`; `ink` ← `settings.secondaryColor` si es distinto del primario,
 * y si no un gris de tinta; `surface` ← blanco; `bg` ← el `backgroundColor` de sección más repetido
 * cuando es claro; `muted` ← el matiz del acento con la saturación bajada al 45 %; `accentInk` ←
 * blanco (que cumple porque `accent` ya se corrigió contra `surface`).
 */
export function construirTema(entrada: EntradaTema, nombrePlantilla: string): TemaConstruido {
  const correcciones: string[] = [];
  const rgb = (v: readonly number[] | null): string | null =>
    v && v.length >= 3 ? rgbAHex(v[0]!, v[1]!, v[2]!) : null;

  const surface = "#FFFFFF";
  const fondoMasRepetido = masRepetido(entrada.fondos.map((f) => rgb(f)).filter((x): x is string => x !== null));
  const bg = fondoMasRepetido && esClaro(fondoMasRepetido) ? fondoMasRepetido : "#FAFAFA";
  const acento0 = rgb(entrada.primario) ?? "#4A4A4A";
  const [hAcento, sAcento] = rgbAHsl(...hexARgb(acento0));

  // `secondaryColor` sólo sirve de tinta si YA es un color de texto: en 4 de las 9 plantillas vale
  // blanco puro [V], y oscurecerlo daría un gris medio sin relación con el diseño. En ese caso se usa
  // el gris de tinta del sistema, y el motivo queda escrito en el informe.
  const tinta0 = rgb(entrada.secundario);
  const tintaUtil = tinta0 !== null && tinta0 !== acento0 && contraste(tinta0, surface) >= 3;
  const ink0 = tintaUtil ? tinta0! : GRIS_TINTA;

  const fondos = [bg, surface];
  const accent = corregir(acento0, fondos, 4.58, "accent", correcciones);
  const ink = corregir(ink0, fondos, 4.58, "ink", correcciones);
  const muted = corregir(hslAHex(hAcento, sAcento * 0.45, 0.5), fondos, 4.58, "muted", correcciones);
  const tokens: Tokens = { bg, surface, ink, accent, accentInk: "#FFFFFF", muted };
  const filas = comprobarAA(tokens);

  const { id: idPaleta, nombre: nombrePaleta } = nombreDeMatiz(hAcento);
  const titular = entrada.fuentes.filter((f) => f.enTitulo > 0).sort((a, b) => b.enTitulo - a.enTitulo)[0]?.familia;
  const cuerpo = entrada.fuentes.filter((f) => f.familia !== titular).sort((a, b) => b.veces - a.veces)[0]?.familia
    ?? titular ?? "Inter";
  const heading = titular ?? cuerpo;
  const idFuentes = kebab(`${heading}-${cuerpo}`);

  const theme: ThemeSpec = {
    palettes: [{ id: idPaleta, name: { "es-MX": nombrePaleta }, tokens }],
    fontSets: [{
      id: idFuentes, name: { "es-MX": `${heading} y ${cuerpo}` },
      heading: { family: heading, weights: [400, 700], source: "google" },
      body: { family: cuerpo, weights: [400, 600], source: "google" },
    }],
    defaultPaletteId: idPaleta,
    defaultFontSetId: idFuentes,
  };

  const comentario = [
    `Paleta y tipografías de «${nombrePlantilla}», derivadas de F1 y nombradas a mano (05 §3 paso 3).`,
    `accent ← settings.primaryColor ${acento0}${accent !== acento0 ? ` corregido a ${accent} por WCAG 2.2 AA` : ""}.`,
    `ink ← ${tintaUtil ? `settings.secondaryColor ${tinta0!}` : `gris de tinta ${GRIS_TINTA} (settings.secondaryColor legado es ${tinta0 ?? "inexistente"} y no sirve de color de texto)`}${ink !== ink0 ? `, corregido a ${ink}` : ""}.`,
    `surface ← blanco. bg ← ${fondoMasRepetido ? `el backgroundColor de sección más repetido (${fondoMasRepetido})` : "gris muy claro"}.`,
    `muted ← el matiz del acento (${Math.round(hAcento)}°) con la saturación al 45 %, oscurecido a ${muted} para cumplir 1.4.3 sobre bg y surface.`,
    `accentInk ← blanco: cumple por construcción, porque accent ya se corrigió contra surface (que es blanco).`,
    `Tipografías: titular «${heading}» (la que usan los campos de título/encabezado en F1), texto «${cuerpo}» (la más repetida en el resto).`,
    `La corrección conserva matiz y saturación HSL y sólo baja la luminosidad (ADR-3-2d-04): se corrige el color, nunca el umbral.`,
  ].join(" ");

  return { theme, comentario, contraste: filas, correcciones };
}

function corregir(hex: string, fondos: readonly string[], objetivo: number, token: string, log: string[]): string {
  if (fondos.every((f) => contraste(hex, f) >= objetivo)) return hex;
  const c = oscurecerHastaAA(hex, fondos, objetivo);
  if (c === null) throw new ErrorContraste([`FALLA AA: ${token} ${hex} no alcanza ${objetivo}:1 ni oscureciéndolo hasta el negro`]);
  log.push(`${token}: ${hex} → ${c} (matiz y saturación intactos, sólo luminosidad; ADR-3-2d-04)`);
  return c;
}

const esClaro = (hex: string): boolean => contraste("#000000", hex) >= 12;

function masRepetido(xs: readonly string[]): string | null {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function kebab(s: string): string {
  const k = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return k.slice(0, 40).replace(/-+$/g, "");
}
