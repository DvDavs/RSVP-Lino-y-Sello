// src/css.ts — emisión de los dos ficheros CSS del paquete a partir de la fuente TS. Funciones
// PURAS (devuelven cadenas): `scripts/emit-css.ts` las escribe en `generated/` y
// `test/css-generado.test.ts` compara lo escrito con lo que sale de aquí, igual que
// `packages/schema` hace con su JSON Schema. Ningún valor se teclea en el CSS.
import { MATICES, PASOS, PASOS_NEUTROS, paletaActiva } from "./paletas.ts";
import { ROLES_COLOR, semantica, type Tema } from "./semantica.ts";
import {
  BREAKPOINTS, CONTENEDOR, ESPACIO, RADIOS, RADIOS_SEMANTICOS, SOMBRAS, Z_INDEX,
} from "./espacio.ts";
import { CURVAS, DURACIONES } from "./movimiento.ts";
import {
  ANCHURA_MAXIMA, ESCALA, FAMILIAS, PESOS, ROLES_TIPOGRAFICOS, VOCES,
  clampTipografico, enEscritorio, enMovil, varia, variacionesDe,
} from "./tipografia.ts";

const AVISO = "/* GENERADO por `pnpm run emit:css` (scripts/emit-css.ts) desde src/*.ts — NO EDITAR A MANO.";

const kebab = (n: string): string => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function bloqueEscalas(): string[] {
  const p = paletaActiva();
  const lineas: string[] = [
    `  /* Escalas de la paleta activa (${p.id} · ${p.nombre}). Existen como VARIABLE para las formas y la`,
    "     galería; nunca como utilidad de Tailwind: ningún componente elige un paso a mano (11 §8.2). */",
  ];
  for (const matiz of MATICES) {
    const e = p.escalas[matiz];
    for (const paso of PASOS) lineas.push(`  --ui-${kebab(matiz)}-${paso}: ${e.pasos[paso]};`);
  }
  for (const paso of PASOS_NEUTROS) lineas.push(`  --ui-neutral-${paso}: ${p.neutral.pasos[paso]};`);
  return lineas;
}

function bloqueTipografia(): string[] {
  const lineas: string[] = ["  /* Tipografía: tres voces y escala modular (11 §2.2). Las fuentes las instala packages/ui. */"];
  for (const voz of VOCES) lineas.push(`  --ui-font-${voz}: ${FAMILIAS[voz]};`);
  for (const [nombre, valor] of Object.entries(PESOS)) lineas.push(`  --ui-weight-${kebab(nombre)}: ${valor};`);
  for (const rol of ROLES_TIPOGRAFICOS) {
    const r = ESCALA[rol];
    lineas.push(`  --ui-text-${rol}: ${clampTipografico(r.movil, r.escritorio)};`);
    lineas.push(`  --ui-leading-${rol}: ${enMovil(r.lineHeight)};`);
    lineas.push(`  --ui-tracking-${rol}: ${enMovil(r.tracking)};`);
    lineas.push(`  --ui-weight-${rol}: ${r.peso};`);
    const variacion = variacionesDe(r);
    if (variacion) lineas.push(`  --ui-variacion-${rol}: ${variacion};`);
  }
  return lineas;
}

/** Los pocos tokens tipográficos que cambian de valor (no de tamaño) a partir de 1024 px. */
function bloqueTipografiaEscritorio(): string[] {
  const lineas: string[] = [];
  for (const rol of ROLES_TIPOGRAFICOS) {
    const r = ESCALA[rol];
    if (varia(r.lineHeight)) lineas.push(`    --ui-leading-${rol}: ${enEscritorio(r.lineHeight)};`);
    if (varia(r.tracking)) lineas.push(`    --ui-tracking-${rol}: ${enEscritorio(r.tracking)};`);
  }
  return lineas;
}

function bloqueEspacio(): string[] {
  const lineas: string[] = ["  /* Espacio (base 4), radios, sombras, contenedor, capas y puntos de corte (11 §8.1). */"];
  for (const [paso, valor] of Object.entries(ESPACIO)) lineas.push(`  --ui-space-${paso}: ${valor}px;`);
  for (const [nombre, valor] of Object.entries(RADIOS)) lineas.push(`  --ui-radius-${nombre}: ${valor}px;`);
  for (const [nombre, valor] of Object.entries(RADIOS_SEMANTICOS)) lineas.push(`  --ui-radius-${nombre}: ${valor}px;`);
  for (const [nombre, valor] of Object.entries(SOMBRAS)) lineas.push(`  --ui-shadow-${nombre}: ${valor};`);
  lineas.push(`  --ui-container-max: ${CONTENEDOR.max};`);
  lineas.push(`  --ui-container-gutter: ${CONTENEDOR.canaleta};`);
  for (const [nombre, valor] of Object.entries(Z_INDEX)) lineas.push(`  --ui-z-${nombre}: ${valor};`);
  for (const [nombre, valor] of Object.entries(BREAKPOINTS)) lineas.push(`  --ui-bp-${nombre}: ${valor}px;`);
  return lineas;
}

function bloqueMovimiento(): string[] {
  const lineas: string[] = ["  /* Movimiento (11 §6.1). Toda animación se emite bajo prefers-reduced-motion: no-preference. */"];
  for (const [nombre, valor] of Object.entries(DURACIONES)) lineas.push(`  --ui-dur-${nombre}: ${valor}ms;`);
  for (const [nombre, valor] of Object.entries(CURVAS)) lineas.push(`  --ui-ease-${nombre}: ${valor};`);
  return lineas;
}

function bloqueRoles(tema: Tema, sangria = "  "): string[] {
  const mapa = semantica(paletaActiva(), tema);
  return ROLES_COLOR.map((rol) => `${sangria}--ui-${rol}: ${mapa[rol]};`);
}

/** `generated/tokens.css`: todas las variables `--ui-*` de la paleta activa, claro y oscuro. */
export function generarTokensCss(): string {
  const p = paletaActiva();
  const lineas: string[] = [
    AVISO,
    "",
    `   Paleta activa: ${p.id} · ${p.nombre} — ${p.lema}`,
    "   Tema: `data-theme=\"light|dark\"` en <html> (claro por defecto). El tema oscuro es un MAPA de",
    "   roles, no una excepción: ningún componente sabe en qué tema está (11 §1.5).",
    "   Contrastes verificados por `pnpm run verify-contrast` (rompe el build si una pareja baja). */",
    "",
    ":root {",
    "  color-scheme: light;",
    "",
    ...bloqueEscalas(),
    "",
    ...bloqueTipografia(),
    "",
    ...bloqueEspacio(),
    "",
    ...bloqueMovimiento(),
    "",
    "  /* Roles semánticos — tema claro (11 §1.3). */",
    ...bloqueRoles("light"),
    "}",
    "",
    `@media (min-width: ${ANCHURA_MAXIMA}px) {`,
    "  :root {",
    ...bloqueTipografiaEscritorio(),
    "  }",
    "}",
    "",
    "/* Los dos temas explícitos permiten anidar (una tarjeta en oscuro dentro de una página clara,",
    "   que es como la galería /design enseña los dos a la vez). Misma especificidad que `:root`, así",
    "   que el orden manda: claro, y después oscuro. */",
    '[data-theme="light"] {',
    "  color-scheme: light;",
    ...bloqueRoles("light"),
    "}",
    "",
    '[data-theme="dark"] {',
    "  color-scheme: dark;",
    ...bloqueRoles("dark"),
    "}",
    "",
  ];
  return lineas.join("\n");
}

/**
 * `generated/tailwind.css`: el preset. Tailwind 4 es CSS-first, así que el «preset» es un bloque
 * `@theme inline` — `inline` es lo que hace que la utilidad emita `var(--ui-primary)` en vez de
 * copiar el valor, y por eso `data-theme` cambia el color sin recompilar nada.
 *
 * SOLO tokens semánticos: `bg-ui-primary`, `text-ui-on-primary`, `ring-ui-focus`,
 * `font-ui-display`, `text-ui-display-xl`… Nunca `bg-primary-600`.
 */
export function generarTailwindCss(): string {
  const lineas: string[] = [
    AVISO,
    "",
    "   Preset de Tailwind 4 (CSS-first). Se importa DESPUÉS de `@import \"tailwindcss\"` y de",
    "   `@invitaciones/tokens/tokens.css`:",
    "",
    '     @import "tailwindcss";',
    '     @import "@invitaciones/tokens/tokens.css";',
    '     @import "@invitaciones/tokens/tailwind.css";',
    "",
    "   SOLO tokens semánticos. Los pasos de escala (--ui-primary-600) NO son utilidades a propósito",
    "   (11 §8.2): existen como variable para las formas y la galería, y así ningún componente elige",
    "   un paso a mano. Las duraciones tampoco: Tailwind 4 no tiene espacio de nombres `--duration-*`,",
    "   se usan como `duration-[var(--ui-dur-2)]` o desde CSS. */",
    "",
    "@theme inline {",
    "  /* Color: los 46 roles de 11 §1.3. */",
    ...ROLES_COLOR.map((rol) => `  --color-ui-${rol}: var(--ui-${rol});`),
    "",
    "  /* Forma. */",
    ...Object.keys(RADIOS_SEMANTICOS).map((n) => `  --radius-ui-${n}: var(--ui-radius-${n});`),
    ...Object.keys(SOMBRAS).map((n) => `  --shadow-ui-${n}: var(--ui-shadow-${n});`),
    "  --container-ui-page: var(--ui-container-max);",
    "",
    "  /* Tipografía: familia por voz y escala con su interlineado, tracking y peso. */",
    ...VOCES.map((v) => `  --font-ui-${v}: var(--ui-font-${v});`),
  ];
  for (const rol of ROLES_TIPOGRAFICOS) {
    lineas.push(`  --text-ui-${rol}: var(--ui-text-${rol});`);
    lineas.push(`  --text-ui-${rol}--line-height: var(--ui-leading-${rol});`);
    lineas.push(`  --text-ui-${rol}--letter-spacing: var(--ui-tracking-${rol});`);
    lineas.push(`  --text-ui-${rol}--font-weight: var(--ui-weight-${rol});`);
  }
  lineas.push(
    "",
    "  /* Movimiento: curvas con nombre. */",
    ...Object.keys(CURVAS).map((n) => `  --ease-ui-${n}: var(--ui-ease-${n});`),
    "}",
    "",
  );
  return lineas.join("\n");
}

/** Los dos ficheros que escribe `scripts/emit-css.ts`, con su ruta relativa al paquete. */
export const FICHEROS_GENERADOS = [
  { ruta: "generated/tokens.css", contenido: generarTokensCss },
  { ruta: "generated/tailwind.css", contenido: generarTailwindCss },
] as const;
