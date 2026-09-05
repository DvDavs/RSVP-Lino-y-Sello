// src/espacio.ts — espacio, radios, sombras, contenedor, z-index y puntos de corte
// (`11 §8.1` y `handoffs/3c-0.md` §4). Base 4 px.

/** Escala de espacio: 4·8·12·16·24·32·48·64·96. Fuera de ella no hay medidas «a ojo». */
export const ESPACIO = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, 9: 96 } as const;
export type PasoEspacio = keyof typeof ESPACIO;

/** Radios crudos. `pill` es 999 px, no 9999: el sistema no tiene controles de más de 999 px de alto. */
export const RADIOS = { sm: 8, md: 14, lg: 24, xl: 36, pill: 999 } as const;
export type RadioNombre = keyof typeof RADIOS;

/**
 * Radios con nombre de uso — lo que consume el preset de Tailwind (`11 §5`):
 * control 8 (botón, campo), card 14 (tarjeta), media 24 (foto: nunca menos, `11 §3.4`),
 * hero 36 (bandas y bloques grandes), pill (acciones y chips).
 */
export const RADIOS_SEMANTICOS = {
  control: RADIOS.sm,
  card: RADIOS.md,
  media: RADIOS.lg,
  hero: RADIOS.xl,
  pill: RADIOS.pill,
} as const;
export type RadioSemantico = keyof typeof RADIOS_SEMANTICOS;

/**
 * Sombras. Las difusas van TINTADAS de cacao (nunca negro puro); la de color es plana y desplazada
 * y siempre sale de un token de apoyo — una por vista y nunca mezclada con una difusa (`11 §3.4`).
 */
export const SOMBRAS = {
  "1": "0 1px 2px rgb(41 32 24 / 0.06), 0 4px 12px -4px rgb(41 32 24 / 0.10)",
  "2": "0 2px 6px rgb(41 32 24 / 0.06), 0 16px 32px -12px rgb(41 32 24 / 0.16)",
  color: "8px 8px 0 0 var(--ui-support-2)",
} as const;
export type SombraNombre = keyof typeof SOMBRAS;

/**
 * Contenedor de página y canaleta (`11 §8.1`: 1200 px y `clamp(16px, 4vw, 48px)`).
 *
 * Salen como `--ui-container-max` / `--ui-container-gutter`, NO como `--ui-content-max`: ese nombre
 * ya lo ocupa el chrome provisional de la fase 3 con otro valor (1330 px, medido de la referencia)
 * y tres pantallas lo usan hoy (`max-w-(--ui-content-max)`). Mientras el bloque 3 no migre el
 * chrome, los dos nombres conviven sin pisarse; después, el viejo desaparece.
 */
export const CONTENEDOR = { max: "1200px", canaleta: "clamp(16px, 4vw, 48px)" } as const;

/**
 * Capas. El chrome no tiene más de seis: si hace falta una séptima, es que algo se está apilando
 * mal. `dialogo` y `toast` conviven (un toast se ve sobre un diálogo abierto).
 */
export const Z_INDEX = { base: 0, elevado: 10, pegajoso: 20, hoja: 30, dialogo: 40, toast: 50 } as const;
export type CapaNombre = keyof typeof Z_INDEX;

/**
 * Puntos de corte de MARCA, en px. No se exponen como variantes de Tailwind a propósito: el chrome
 * ya usa la escala por defecto de Tailwind más `ed:` (900 px, punto de corte del EDITOR medido en
 * ADR-3-8-01, que no es un breakpoint de marca). Aquí están como dato para media queries escritas a
 * mano y para la escala tipográfica (`lg` = 1024 es la anchura de referencia de `11 §2.2`).
 */
export const BREAKPOINTS = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;
export type BreakpointNombre = keyof typeof BREAKPOINTS;
