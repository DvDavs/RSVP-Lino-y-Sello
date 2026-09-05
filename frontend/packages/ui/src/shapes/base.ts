// packages/ui/src/shapes/base.ts — vocabulario común de la biblioteca de formas: tonos (SIEMPRE
// tokens `--ui-*`, nunca un hex), accesibilidad (decorativa por defecto) y clases de movimiento.
//
// Reglas que este archivo hace cumplir por construcción (`11 §3.1`, `10 §1.3`):
//  - el color de una forma solo puede salir de `Tono`, y `Tono` solo produce `var(--ui-…)`;
//  - una forma es decorativa (`aria-hidden`) salvo que se declare `decorative={false}`, y entonces
//    el tipo EXIGE un `title` (no hay forma de dibujar algo anunciable sin nombre);
//  - `breathe`/`drift` solo añaden una clase; el interruptor de `prefers-reduced-motion` vive en
//    `shapes.css`, en un solo sitio (`11 §6.2`).

import type { CSSProperties } from "react";

/**
 * Tonos admitidos: roles semánticos y pasos de escala que `@invitaciones/tokens` publica como
 * `--ui-*` (`11 §8.2`). No existe un `Tono` que no sea un token: es imposible pasar un hex.
 *
 * `primary-bright` es el 500 y `11 §3.4` regla 6 lo declara DECORATIVO: solo formas grandes.
 */
export type Tono =
  | "primary"
  | "primary-soft"
  | "primary-bright"
  | "primary-hover"
  | "support-1"
  | "support-1-soft"
  | "support-1-deep"
  | "support-2"
  | "support-2-soft"
  | "support-2-deep"
  | "accent"
  | "accent-soft"
  | "surface"
  | "surface-raised"
  | "surface-alt"
  | "divider"
  | "ink";

/** `"support-2-soft"` → `"var(--ui-support-2-soft)"`. Único camino de un tono a un color. */
export function color(tono: Tono): string {
  return `var(--ui-${tono})`;
}

/**
 * Accesibilidad de una forma. Las formas son decorativas: no aportan información y el lector de
 * pantalla no debe anunciarlas (`11 §3.1`). Si una forma SÍ comunica algo (un sello de estado, por
 * ejemplo) se declara `decorative={false}` y el tipo obliga a nombrarla.
 */
export type PropsAccesibilidad =
  | { readonly decorative?: true; readonly title?: never }
  | { readonly decorative: false; readonly title: string };

/** Props comunes a todas las formas SVG. */
export interface PropsFormaBase {
  /** Color de la forma. Solo tokens: ver `Tono`. */
  readonly tone?: Tono;
  /** Giro en grados. `11 §3.1`. */
  readonly rotate?: number;
  /** Escala multiplicativa alrededor del centro del `viewBox`. */
  readonly scale?: number;
  readonly className?: string;
  /**
   * `11 §3.2`: «todas aceptan `style` solo para `--tone`» — es decir, para posicionar y para
   * variables, nunca para escribir un color literal. La compuerta de revisión es el `grep` de
   * `fill="#` de ADR-3C-0-03.
   */
  readonly style?: CSSProperties;
  /** Respiración de 12 s (`11 §6.2` regla 2). Apagada por `prefers-reduced-motion`. */
  readonly breathe?: boolean;
  /** Deriva lentísima de fondo (18 s). Apagada por `prefers-reduced-motion`. */
  readonly drift?: boolean;
}

export const CLASE_FORMA = "ui-forma";
export const CLASE_RESPIRA = "ui-forma--respira";
export const CLASE_DERIVA = "ui-forma--deriva";

/** Une clases sin dependencias (el `cn()` general del paquete es de otro bloque). */
export function clases(...partes: readonly (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}

/** Clase raíz de una forma, con las de movimiento si se piden. */
export function claseDeForma(
  { breathe, drift, className }: Pick<PropsFormaBase, "breathe" | "drift" | "className">,
  extra?: string,
): string {
  return clases(CLASE_FORMA, extra, breathe && CLASE_RESPIRA, drift && CLASE_DERIVA, className);
}

/** Atributos ARIA de una forma más, si la forma es anunciable, el texto de su `<title>`. */
export interface Accesibilidad {
  readonly atributos: {
    readonly "aria-hidden"?: true;
    readonly role?: "img";
    readonly "aria-label"?: string;
  };
  readonly titulo?: string;
}

/**
 * Decide la accesibilidad de una forma. Recibe la unión SIN mezclar para que TypeScript pueda
 * estrechar por el discriminante `decorative` (en el componente, `props` es una intersección y el
 * estrechamiento no está garantizado).
 */
export function accesibilidad(props: PropsAccesibilidad): Accesibilidad {
  if (props.decorative === false) {
    return { atributos: { role: "img", "aria-label": props.title }, titulo: props.title };
  }
  return { atributos: { "aria-hidden": true } };
}

/**
 * Identificador SVG (`<pattern>`, `<clipPath>`, `<linearGradient>`) DERIVADO de los parámetros que
 * definen el dibujo, no de un contador ni de `useId()`.
 *
 * Por qué (ADR-3C-4-01): `useId()` es un hook y obligaría a marcar `Stripes`, `Image` y
 * `Placeholder` como `"use client"`; una forma decorativa no puede costar una frontera de cliente
 * en la portada. Un hash FNV-1a de los parámetros es estable entre servidor y cliente (sin
 * discrepancia de hidratación), y dos instancias solo comparten `id` cuando su `<defs>` es
 * BYTE A BYTE el mismo, en cuyo caso reutilizar la primera definición da exactamente el mismo
 * dibujo. Quien necesite unicidad estricta pasa `id` a mano.
 */
export function idEstable(prefijo: string, ...partes: readonly (string | number | boolean | undefined)[]): string {
  const texto = partes.join("|");
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ui-${prefijo}-${(h >>> 0).toString(36)}`;
}

/** `transform` de `rotate`/`scale` alrededor del centro, o `undefined` si no hay ninguno. */
export function transformacion(rotate = 0, scale = 1, cx = 50, cy = 50): string | undefined {
  const partes: string[] = [];
  if (rotate !== 0) partes.push(`rotate(${rotate} ${cx} ${cy})`);
  if (scale !== 1) partes.push(`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`);
  return partes.length > 0 ? partes.join(" ") : undefined;
}
