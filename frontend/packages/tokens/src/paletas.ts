// src/paletas.ts — FUENTE ÚNICA de color: las tres paletas de `11 §1.2` como DEFINICIÓN OKLCH
// (matiz + croma máximo) y sus escalas derivadas por `oklch.ts`. Los hex NO se escriben a mano en
// ninguna parte del sistema: se calculan aquí y salen a `generated/tokens.css` por
// `scripts/emit-css.ts`. Es el único fichero del paquete donde puede aparecer un literal hex
// (`test/frontera.test.ts` lo vigila con grep).
import { oklchAHex } from "./oklch.ts";

/** Pasos de las escalas cromáticas (10 por matiz). */
export const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type Paso = (typeof PASOS)[number];

/** Pasos de la escala neutra (11: llega al 950, la tinta más oscura y el fondo del tema oscuro). */
export const PASOS_NEUTROS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type PasoNeutro = (typeof PASOS_NEUTROS)[number];

/**
 * Luminosidad OKLCH por paso, IGUAL para todos los matices (`11 §1.1`): así el 600 de cualquier
 * matiz pesa lo mismo y contrasta lo mismo con el blanco.
 */
export const L_PASO: Readonly<Record<Paso, number>> = {
  50: 0.975, 100: 0.945, 200: 0.895, 300: 0.82, 400: 0.72, 500: 0.62, 600: 0.52, 700: 0.44, 800: 0.36, 900: 0.29,
} as const;

/** Curva de croma (fracción del croma máximo): máximo en 500-600, menos en los extremos. */
export const F_CROMA: Readonly<Record<Paso, number>> = {
  50: 0.14, 100: 0.28, 200: 0.5, 300: 0.72, 400: 0.9, 500: 1.0, 600: 1.0, 700: 0.9, 800: 0.75, 900: 0.6,
} as const;

/** Neutros cálidos: luminosidad y croma por paso (croma pequeño pero NUNCA cero: nada de gris puro). */
export const L_NEUTRO: Readonly<Record<PasoNeutro, number>> = {
  50: 0.985, 100: 0.962, 200: 0.925, 300: 0.86, 400: 0.74, 500: 0.65, 600: 0.5, 700: 0.42, 800: 0.33, 900: 0.25, 950: 0.17,
} as const;
export const C_NEUTRO: Readonly<Record<PasoNeutro, number>> = {
  50: 0.006, 100: 0.009, 200: 0.012, 300: 0.014, 400: 0.016, 500: 0.018, 600: 0.02, 700: 0.02, 800: 0.02, 900: 0.02, 950: 0.018,
} as const;

/** Los ocho matices de cada paleta. `support1`/`support2` rotan por tipo de evento (`11 §1.1`). */
export const MATICES = ["primary", "support1", "support2", "accent", "success", "danger", "warning", "info"] as const;
export type MatizId = (typeof MATICES)[number];

export type PaletaId = "a" | "b" | "c";

export interface DefinicionMatiz {
  /** Nombre en es-MX del matiz (bugambilia, anil, jade…). */
  readonly nombre: string;
  /** Matiz OKLCH en grados. */
  readonly h: number;
  /** Croma máximo (el del paso 500-600). */
  readonly c: number;
}

export interface DefinicionPaleta {
  readonly id: PaletaId;
  readonly nombre: string;
  readonly lema: string;
  readonly matices: Readonly<Record<MatizId, DefinicionMatiz>>;
  /** Matiz OKLCH de los neutros cálidos. */
  readonly neutroH: number;
  /**
   * Matiz del que sale el anillo de foco. NUNCA el principal: el aro tiene que verse sobre el
   * botón primario (`11 §1.3`).
   */
  readonly matizFoco: MatizId;
}

/** Definiciones de `11 §1.2`. Ninguna tiene púrpura/violeta como principal. */
export const DEFINICIONES: readonly DefinicionPaleta[] = [
  {
    id: "a",
    nombre: "Bugambilia",
    lema: "Rosa mexicano, tinta de cacao, jade y mango. Fiesta y elegancia a la manera de Barragán.",
    matices: {
      primary: { nombre: "bugambilia", h: 352, c: 0.235 },
      support1: { nombre: "anil", h: 264, c: 0.2 },
      support2: { nombre: "jade", h: 168, c: 0.15 },
      accent: { nombre: "mango", h: 78, c: 0.18 },
      success: { nombre: "hierba", h: 148, c: 0.17 },
      danger: { nombre: "chile", h: 27, c: 0.21 },
      warning: { nombre: "ambar", h: 58, c: 0.18 },
      info: { nombre: "cielo", h: 236, c: 0.16 },
    },
    neutroH: 62,
    matizFoco: "support1",
  },
  {
    id: "b",
    nombre: "Talavera",
    lema: "Cobalto de Puebla, terracota, olivo y sol. Artesanal, confiable, sin ser otro azul corporativo.",
    matices: {
      primary: { nombre: "cobalto", h: 262, c: 0.21 },
      support1: { nombre: "terracota", h: 42, c: 0.17 },
      support2: { nombre: "olivo", h: 126, c: 0.13 },
      accent: { nombre: "sol", h: 90, c: 0.18 },
      success: { nombre: "hierba", h: 150, c: 0.17 },
      danger: { nombre: "chile", h: 25, c: 0.21 },
      warning: { nombre: "ambar", h: 62, c: 0.18 },
      info: { nombre: "agua", h: 205, c: 0.14 },
    },
    neutroH: 70,
    matizFoco: "support1",
  },
  {
    id: "c",
    nombre: "Jade",
    lema: "Verde jade profundo, coral, ocre y cempasúchil. Fresco, natural, con el calor de la fiesta en los acentos.",
    matices: {
      primary: { nombre: "jade", h: 178, c: 0.14 },
      support1: { nombre: "coral", h: 24, c: 0.19 },
      support2: { nombre: "ocre", h: 86, c: 0.14 },
      accent: { nombre: "cempasuchil", h: 52, c: 0.2 },
      success: { nombre: "hierba", h: 145, c: 0.17 },
      danger: { nombre: "chile", h: 16, c: 0.22 },
      warning: { nombre: "ambar", h: 70, c: 0.18 },
      info: { nombre: "anil", h: 258, c: 0.17 },
    },
    neutroH: 58,
    matizFoco: "info",
  },
] as const;

export interface Escala {
  readonly nombre: string;
  readonly h: number;
  readonly pasos: Readonly<Record<Paso, string>>;
}

export interface EscalaNeutra {
  readonly nombre: string;
  readonly h: number;
  readonly pasos: Readonly<Record<PasoNeutro, string>>;
}

export interface Paleta {
  readonly id: PaletaId;
  readonly nombre: string;
  readonly lema: string;
  readonly escalas: Readonly<Record<MatizId, Escala>>;
  readonly neutral: EscalaNeutra;
  readonly matizFoco: MatizId;
}

/** Escala cromática de 10 pasos a partir del matiz y su croma máximo. */
export function escala(h: number, cmax: number): Record<Paso, string> {
  const salida = {} as Record<Paso, string>;
  for (const p of PASOS) salida[p] = oklchAHex(L_PASO[p], cmax * F_CROMA[p], h);
  return salida;
}

/** Escala neutra cálida de 11 pasos. */
export function neutros(h: number): Record<PasoNeutro, string> {
  const salida = {} as Record<PasoNeutro, string>;
  for (const p of PASOS_NEUTROS) salida[p] = oklchAHex(L_NEUTRO[p], C_NEUTRO[p], h);
  return salida;
}

function construir(def: DefinicionPaleta): Paleta {
  const escalas = {} as Record<MatizId, Escala>;
  for (const matiz of MATICES) {
    const m = def.matices[matiz];
    escalas[matiz] = Object.freeze({ nombre: m.nombre, h: m.h, pasos: Object.freeze(escala(m.h, m.c)) });
  }
  return Object.freeze({
    id: def.id,
    nombre: def.nombre,
    lema: def.lema,
    escalas: Object.freeze(escalas),
    neutral: Object.freeze({ nombre: "hueso", h: def.neutroH, pasos: Object.freeze(neutros(def.neutroH)) }),
    matizFoco: def.matizFoco,
  });
}

/** Las tres paletas con sus escalas ya derivadas, indexadas por id. */
export const PALETAS: Readonly<Record<PaletaId, Paleta>> = Object.freeze(
  Object.fromEntries(DEFINICIONES.map((d) => [d.id, construir(d)])) as Record<PaletaId, Paleta>,
);

/**
 * Paleta activa del producto: A «Bugambilia» (`11 §1.7`, ADR-3C-0-01, propuesta). B y C se
 * conservan como datos y como comprobación del método: `verify-contrast` verifica las tres.
 */
export const PALETA_ACTIVA: PaletaId = "a";

/** La paleta con la que se emite `generated/tokens.css`. */
export const paletaActiva = (): Paleta => PALETAS[PALETA_ACTIVA];

/** Blanco puro: la única superficie del sistema que no sale de una escala (`surface-raised` claro). */
export const BLANCO = "#ffffff";
