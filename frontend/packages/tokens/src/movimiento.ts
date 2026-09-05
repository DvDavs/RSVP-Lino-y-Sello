// src/movimiento.ts — duraciones y curvas con nombre (`11 §6.1`).
//
// Las REGLAS de movimiento (`11 §6.2`) no son tokens y no viven aquí: entradas escalonadas de 40 ms
// hasta 8 elementos, hover con elevación de 1 px, nada que bloquee la interacción y, sobre todo,
// que TODA animación se emita dentro de `@media (prefers-reduced-motion: no-preference)`. Eso lo
// implementa `packages/ui`; este paquete solo da los valores.

/** Duraciones en ms. `respira` es la respiración de las formas de fondo (12 s, `11 §6.2`). */
export const DURACIONES = { 1: 120, 2: 200, 3: 320, 4: 600, respira: 12_000 } as const;
export type DuracionNombre = keyof typeof DURACIONES;

/** Curvas: salida, traslado, rebote suave y lineal. */
export const CURVAS = {
  out: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  "in-out": "cubic-bezier(0.6, 0, 0.2, 1)",
  spring: "cubic-bezier(0.34, 1.4, 0.64, 1)",
  linear: "linear",
} as const;
export type CurvaNombre = keyof typeof CURVAS;

/** Para qué sirve cada duración (lo muestra la galería; no se emite a CSS). */
export const USO_DURACION: Readonly<Record<DuracionNombre, string>> = {
  1: "color de hover, foco, cambio de icono",
  2: "boton, chip, switch, pestana",
  3: "entrada de tarjetas, hoja, dialogo, aviso",
  4: "cambio de pantalla del asistente, progreso anular",
  respira: "respiracion de formas de fondo (una por vista)",
} as const;

export const USO_CURVA: Readonly<Record<CurvaNombre, string>> = {
  out: "entradas y hover",
  "in-out": "cambios de estado y respiracion",
  spring: "switch, check, chip seleccionado",
  linear: "spinner y esqueleto",
} as const;
