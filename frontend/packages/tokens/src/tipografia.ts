// src/tipografia.ts — las tres voces del sistema y la escala modular de `11 §2.2`. Aquí SOLO están
// los tokens (familias con respaldo, tamaños, interlineado, tracking, peso, ejes variables). La
// instalación de las fuentes (`@fontsource-variable/*`, `@font-face`, preload y metric override) es
// de `packages/ui` (agente 3C-2): este paquete no descarga ni declara ninguna fuente.
//
// Regla que no se rompe: la fuente de cuerpo NUNCA titula. `display-*` y `heading-*` van en la voz
// `display`; `text-*` en `text`; `label-*` en `label`, en mayúsculas y con tracking positivo.

export const VOCES = ["display", "text", "label"] as const;
export type Voz = (typeof VOCES)[number];

/**
 * Familias con su pila de respaldo. El primer nombre es el que registra Fontsource para la fuente
 * variable; el segundo, el estático por si algún día se sirve así (es el nombre real que declara
 * `packages/ui/src/fonts/fonts.css`); justo detrás, la familia de RESPALDO con metric override
 * (`ascent-override`/`descent-override`/`line-gap-override`/`size-adjust` calculados en
 * `packages/ui/scripts/metric-override.ts`, `11 §2.4`, `ADR-3C-0-02`) para que el `swap` de
 * `font-display` no salte el layout (CLS) mientras carga la fuente real; por último, respaldo del
 * sistema sin ajustar (por si el navegador tampoco tiene Georgia/Arial/Courier New instalada: solo
 * respaldo, la identidad la ponen Fraunces, Onest y Red Hat Mono, `11 §2.5`).
 */
export const FAMILIAS: Readonly<Record<Voz, string>> = {
  display: '"Fraunces Variable", "Fraunces", "Fraunces Fallback", Georgia, "Times New Roman", serif',
  text: '"Onest Variable", "Onest", "Onest Fallback", system-ui, -apple-system, "Segoe UI", sans-serif',
  label: '"Red Hat Mono Variable", "Red Hat Mono", "Red Hat Mono Fallback", ui-monospace, "SFMono-Regular", monospace',
} as const;

/** Pesos con nombre. El cuerpo va a 450 (no 400): a 400 Onest queda fina sobre hueso (`11 §2.2`). */
export const PESOS = {
  texto: 450,
  textoFuerte: 650,
  etiqueta: 500,
  titulo: 700,
  tituloFuerte: 800,
} as const;
export type PesoNombre = keyof typeof PESOS;

/** Ejes variables de Fraunces por rol (`opsz` óptico, `SOFT` redondeo, `WONK` letras díscolas). */
export interface EjesFraunces {
  readonly opsz: number;
  readonly SOFT: number;
  readonly WONK?: 0 | 1;
}

/** Valor que cambia entre móvil (390 px) y escritorio (1024 px en adelante). */
export interface PorAnchura<T> {
  readonly movil: T;
  readonly escritorio: T;
}

export interface RolTipografico {
  readonly voz: Voz;
  /** Tamaño en px a 390 px de anchura. */
  readonly movil: number;
  /** Tamaño en px a 1024 px de anchura o más. */
  readonly escritorio: number;
  readonly lineHeight: number | PorAnchura<number>;
  readonly tracking: string | PorAnchura<string>;
  readonly peso: number;
  readonly ejes?: EjesFraunces;
  /** `true` en las etiquetas que van en mayúsculas (`label-md` y `label-sm`). */
  readonly mayusculas?: boolean;
  readonly uso: string;
}

export const ROLES_TIPOGRAFICOS = [
  "display-2xl", "display-xl", "display-lg", "display-md", "display-sm",
  "heading-lg", "heading-md", "heading-sm",
  "text-lg", "text-md", "text-sm", "text-xs",
  "label-lg", "label-md", "label-sm",
] as const;
export type RolTipograficoId = (typeof ROLES_TIPOGRAFICOS)[number];

/** La tabla de `11 §2.2`, literal. */
export const ESCALA: Readonly<Record<RolTipograficoId, RolTipografico>> = {
  "display-2xl": { voz: "display", movil: 40, escritorio: 64, lineHeight: { movil: 1.05, escritorio: 1.02 }, tracking: { movil: "-0.035em", escritorio: "-0.04em" }, peso: PESOS.tituloFuerte, ejes: { opsz: 96, SOFT: 70, WONK: 1 }, uso: "titular de portada; uno por vista" },
  "display-xl": { voz: "display", movil: 32, escritorio: 48, lineHeight: 1.05, tracking: { movil: "-0.03em", escritorio: "-0.035em" }, peso: PESOS.tituloFuerte, ejes: { opsz: 72, SOFT: 60, WONK: 1 }, uso: "apertura de pantalla" },
  "display-lg": { voz: "display", movil: 28, escritorio: 36, lineHeight: { movil: 1.1, escritorio: 1.08 }, tracking: "-0.025em", peso: PESOS.titulo, ejes: { opsz: 48, SOFT: 50 }, uso: "apertura de sección" },
  "display-md": { voz: "display", movil: 24, escritorio: 28, lineHeight: { movil: 1.15, escritorio: 1.12 }, tracking: "-0.02em", peso: PESOS.titulo, ejes: { opsz: 32, SOFT: 40 }, uso: "titulo de dialogo u hoja" },
  "display-sm": { voz: "display", movil: 20, escritorio: 22, lineHeight: 1.2, tracking: "-0.02em", peso: PESOS.titulo, ejes: { opsz: 20, SOFT: 30 }, uso: "estado vacio, tarjeta destacada" },
  "heading-lg": { voz: "display", movil: 24, escritorio: 28, lineHeight: 1.15, tracking: "-0.02em", peso: PESOS.titulo, ejes: { opsz: 32, SOFT: 40 }, uso: "titulo de bloque" },
  "heading-md": { voz: "display", movil: 20, escritorio: 22, lineHeight: 1.2, tracking: "-0.02em", peso: PESOS.titulo, ejes: { opsz: 20, SOFT: 30 }, uso: "titulo de tarjeta" },
  "heading-sm": { voz: "display", movil: 17, escritorio: 18, lineHeight: 1.3, tracking: "-0.01em", peso: PESOS.titulo, ejes: { opsz: 14, SOFT: 20 }, uso: "titulo de fila o de campo agrupado" },
  "text-lg": { voz: "text", movil: 18, escritorio: 18, lineHeight: 1.5, tracking: "0", peso: PESOS.texto, uso: "entradilla" },
  "text-md": { voz: "text", movil: 16, escritorio: 16, lineHeight: 1.5, tracking: "0", peso: PESOS.texto, uso: "cuerpo (negrita 650)" },
  "text-sm": { voz: "text", movil: 14, escritorio: 14, lineHeight: 1.5, tracking: "0", peso: PESOS.texto, uso: "texto auxiliar, ayuda de campo" },
  "text-xs": { voz: "text", movil: 13, escritorio: 13, lineHeight: 1.45, tracking: "0", peso: PESOS.texto, uso: "minimo del texto de interfaz" },
  "label-lg": { voz: "label", movil: 14, escritorio: 14, lineHeight: 1.3, tracking: "0.06em", peso: PESOS.etiqueta, uso: "metadatos, contadores" },
  "label-md": { voz: "label", movil: 12, escritorio: 12, lineHeight: 1.3, tracking: "0.12em", peso: PESOS.etiqueta, mayusculas: true, uso: "eyebrow, paso, insignia" },
  "label-sm": { voz: "label", movil: 11, escritorio: 11, lineHeight: 1.3, tracking: "0.14em", peso: PESOS.etiqueta, mayusculas: true, uso: "insignia pequena, pie" },
} as const;

/** Anchuras entre las que interpola `clamp()`: la tabla de `11 §2.2` está medida a 390 y a 1024. */
export const ANCHURA_MINIMA = 390;
export const ANCHURA_MAXIMA = 1024;

const redondear = (n: number): string => String(Number(n.toFixed(3)));

/**
 * `clamp()` lineal entre el tamaño de 390 px y el de 1024 px. Si los dos son iguales, devuelve el
 * px suelto (nada de `clamp()` decorativos que no interpolan).
 */
export function clampTipografico(movil: number, escritorio: number): string {
  if (movil === escritorio) return `${movil}px`;
  const pendiente = (escritorio - movil) / (ANCHURA_MAXIMA - ANCHURA_MINIMA);
  const vw = pendiente * 100;
  const base = movil - pendiente * ANCHURA_MINIMA;
  return `clamp(${movil}px, ${redondear(base)}px + ${redondear(vw)}vw, ${escritorio}px)`;
}

/** `font-variation-settings` de un rol, o `undefined` si la voz no es la display. */
export function variacionesDe(rol: RolTipografico): string | undefined {
  if (!rol.ejes) return undefined;
  const partes = [`"opsz" ${rol.ejes.opsz}`, `"SOFT" ${rol.ejes.SOFT}`];
  if (rol.ejes.WONK !== undefined) partes.push(`"WONK" ${rol.ejes.WONK}`);
  return partes.join(", ");
}

/** Valor a 390 px de un token que puede cambiar con la anchura. */
export const enMovil = <T>(v: T | PorAnchura<T>): T => (typeof v === "object" && v !== null && "movil" in v ? (v as PorAnchura<T>).movil : (v as T));
/** Valor a 1024 px o más. */
export const enEscritorio = <T>(v: T | PorAnchura<T>): T => (typeof v === "object" && v !== null && "escritorio" in v ? (v as PorAnchura<T>).escritorio : (v as T));
/** ¿Cambia este valor entre móvil y escritorio? */
export const varia = <T>(v: T | PorAnchura<T>): boolean => enMovil(v) !== enEscritorio(v);
