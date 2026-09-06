#!/usr/bin/env node
// packages/icons/scripts/generar.ts — recorre `svg/*.svg`, valida cada fichero y genera
// `src/generated/<Nombre>Icon.tsx`, `src/index.ts` e `inventario.json`.
//
// SIN `@svgr/core`: se probó y su salida usa JSX namespaces / imports que chocan con
// `verbatimModuleSyntax` + `NodeNext` de `tsconfig.base.json` (habría que añadir un paso de
// post-proceso para separar `import type` de `import`, y otro para las extensiones `.ts/.tsx` de
// los imports relativos que exige `allowImportingTsExtensions`). Nuestro dialecto de SVG es
// deliberadamente simple y homogéneo (siempre `svg > (path|circle|rect|g)*`, sin namespaces, sin
// comillas anidadas, sin comentarios): un transformador propio de ~40 líneas (`aAtributosJsx`)
// basta para pasar de kebab-case a camelCase y evita la dependencia nueva. Documentado en
// `bitacora/3c-3a.md` y como parte de ADR-3C-3-01.
//
// Ejecutar: `node --experimental-strip-types scripts/generar.ts` (mismo patrón que
// `packages/sections/scripts/emit-section-variants.ts`, cero dependencias nuevas).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const DIR_SVG = join(AQUI, "../svg");
export const DIR_GENERADO = join(AQUI, "../src/generated");
export const RUTA_INDICE = join(AQUI, "../src/index.ts");
export const RUTA_INVENTARIO = join(AQUI, "../inventario.json");

// ─── Inventario canónico (82 nombres, doc 11 §4.2) ─────────────────────────────────────────────
// Categoría de cada nombre y cuáles de los 15 ya estaban dibujados en el moodboard. Se mantiene
// COMPLETO (no solo la mitad A) para que `inventario.json` salga correcto en cuanto la mitad B
// añada sus SVG a este mismo directorio — el generador no distingue mitades, solo lee `svg/`.
const CATEGORIAS: Record<string, readonly string[]> = {
  navegacion: ["inicio", "atras", "adelante", "menu", "cerrar", "buscar", "ayuda", "ajustes", "externo", "chevron-abajo", "chevron-derecha"],
  edicion: ["editar", "deshacer", "rehacer", "guardar", "arrastrar", "subir", "bajar", "ver", "ocultar", "duplicar", "borrar", "agregar", "quitar", "recortar", "punto-focal", "paleta", "tipografia", "movil", "escritorio", "vista-previa"],
  secciones: ["portada", "celebrantes", "evento-fecha", "itinerario", "galeria", "mesa-de-regalos", "sugerencias", "comodidades", "rsvp-confirmado", "familia", "historia", "vestimenta", "pie", "lugar", "reloj"],
  estados: ["exito", "aviso", "error", "info", "cargando", "candado", "chispa", "imagen-pendiente"],
  rsvp: ["confirmar", "rechazar", "invitados", "mesa", "nota", "alergia", "ninos"],
  compartir: ["compartir", "enlace", "copiar", "chat", "descargar", "qr", "correo", "telefono"],
  cuenta: ["cuenta", "plan", "pago", "salir", "entrar"],
  "tipos-evento": ["boda", "xv-anos", "bautizo", "comunion", "cumpleanos", "graduacion", "corporativo", "invitacion"],
};

const DIBUJADOS_ORIGINALES = new Set([
  "deshacer", "evento-fecha", "galeria", "mesa-de-regalos", "rsvp-confirmado",
  "vestimenta", "lugar", "chispa", "compartir", "enlace",
  "boda", "xv-anos", "cumpleanos", "graduacion", "invitacion",
]);

export function categoriaDe(nombre: string): string | undefined {
  for (const [categoria, nombres] of Object.entries(CATEGORIAS)) {
    if (nombres.includes(nombre)) return categoria;
  }
  return undefined;
}

export const TOTAL_INVENTARIO_CANONICO = Object.values(CATEGORIAS).reduce((n, l) => n + l.length, 0);

// ─── Lectura ────────────────────────────────────────────────────────────────────────────────────
export interface FicheroSvg {
  nombre: string; // kebab-case, sin extensión
  archivo: string; // ruta absoluta
  contenido: string;
}

export function leerIconosSvg(dirSvg: string): FicheroSvg[] {
  return readdirSync(dirSvg, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".svg"))
    .map((e) => e.name.slice(0, -4))
    .sort((a, b) => a.localeCompare(b))
    .map((nombre) => {
      const archivo = join(dirSvg, `${nombre}.svg`);
      return { nombre, archivo, contenido: readFileSync(archivo, "utf8") };
    });
}

// ─── Validación (test/svg.test.ts la ejecuta sobre cada fichero) ──────────────────────────────
const RE_KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RE_ETIQUETA_RAIZ = /^<svg\s+([^>]*)>/;

export function validarSvg(nombre: string, contenido: string): string[] {
  const problemas: string[] = [];

  if (!RE_KEBAB.test(nombre)) problemas.push(`nombre "${nombre}" no es kebab-case (sin acentos, minúsculas)`);

  const raiz = contenido.match(RE_ETIQUETA_RAIZ);
  if (!raiz) {
    problemas.push("no empieza por una etiqueta <svg ...> de apertura (con atributos)");
    return problemas; // el resto de comprobaciones de la raíz no aplican sin ella
  }
  const atributosRaiz = raiz[1];

  const requeridos: [RegExp, string][] = [
    [/viewBox="0 0 24 24"/, 'viewBox="0 0 24 24"'],
    [/fill="none"/, 'fill="none"'],
    [/stroke="currentColor"/, 'stroke="currentColor"'],
    [/stroke-width="1\.75"/, 'stroke-width="1.75"'],
    [/stroke-linecap="round"/, 'stroke-linecap="round"'],
    [/stroke-linejoin="round"/, 'stroke-linejoin="round"'],
  ];
  for (const [re, etiqueta] of requeridos) {
    if (!re.test(atributosRaiz)) problemas.push(`falta ${etiqueta} en la raíz <svg>`);
  }
  if (/(?<!-)width="/.test(atributosRaiz) || /(?<!-)height="/.test(atributosRaiz)) {
    problemas.push("la raíz <svg> lleva width/height fijos (prohibido: el tamaño lo da el componente)");
  }
  if (/\bstyle="/.test(atributosRaiz)) problemas.push("la raíz <svg> lleva style= (prohibido)");

  if (/\bstyle="/.test(contenido)) problemas.push('contiene style= en algún elemento (prohibido)');
  if (/fill="#/i.test(contenido) || /stroke="#/i.test(contenido)) problemas.push("contiene un color hex suelto (fill/stroke=\"#…\"); usa currentColor o var(--tono)/var(--ui-*)");
  if (/<image[\s/>]/.test(contenido)) problemas.push("contiene <image> (prohibido)");
  if (/fill-opacity/.test(contenido)) problemas.push('usa fill-opacity para el segundo tono; ADR-3C-0-04 exige fill="var(--tono)"');

  return problemas;
}

// ─── kebab-case → PascalCase ────────────────────────────────────────────────────────────────────
export function aPascalCase(nombreKebab: string): string {
  return nombreKebab
    .split("-")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join("");
}

// ─── SVG fuente → JSX ───────────────────────────────────────────────────────────────────────────
// Atributos de presentación SVG en kebab-case que React exige en camelCase (todo lo demás que
// pueda aparecer en nuestro dialecto ya es válido tal cual: cx, cy, r, d, x, y, rx, ry, width,
// height, transform, points, fill, stroke). `aria-*`/`data-*` NO se tocan: React los acepta
// kebab-case sin más.
const MAPA_ATRIBUTOS: Record<string, string> = {
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-miterlimit": "strokeMiterlimit",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "vector-effect": "vectorEffect",
};
const RE_ATRIBUTO = /([a-zA-Z-]+)="([^"]*)"/g;

export function aAtributosJsx(xml: string): string {
  return xml.replace(RE_ATRIBUTO, (coincidencia, nombreAtr: string, valor: string) => {
    if (nombreAtr.startsWith("aria-") || nombreAtr.startsWith("data-")) return coincidencia;
    const camel = MAPA_ATRIBUTOS[nombreAtr] ?? nombreAtr;
    return `${camel}="${valor}"`;
  });
}

/** Extrae el contenido interior (hijos) de la raíz `<svg ...>…</svg>` del fichero fuente. */
export function extraerHijos(contenidoSvg: string): string {
  const inicio = contenidoSvg.indexOf(">") + 1;
  const fin = contenidoSvg.lastIndexOf("</svg>");
  return contenidoSvg.slice(inicio, fin).trim();
}

// ─── Generación del componente ──────────────────────────────────────────────────────────────────
// El `--tono` calculado se escribe ANTES que el `style` recibido por props para que un consumidor
// pueda sobrescribirlo (`style={{ "--tono": "var(--ui-accent-soft)" }}`), que es la vía soportada por
// ADR-3C-3-01 para el «un color por categoría» de 11 §4.1. Revisión de coherencia 3c-rev-3: el
// generador integrado tenía el orden invertido y anulaba esa vía.
export function generarComponente(nombreKebab: string, contenidoSvg: string): string {
  const pascal = aPascalCase(nombreKebab);
  const hijos = aAtributosJsx(extraerHijos(contenidoSvg));
  return `// GENERADO por scripts/generar.ts a partir de svg/${nombreKebab}.svg — no editar a mano.
// Regenerar: \`node --experimental-strip-types scripts/generar.ts\` desde packages/icons/.
import { forwardRef } from "react";
import type { CSSProperties } from "react";
import type { IconProps } from "../tipos.ts";

export const Icono${pascal} = forwardRef<SVGSVGElement, IconProps>(function Icono${pascal}(
  { size = 24, title, tone = "duo", className, style, ...resto },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{ "--tono": tone === "duo" ? "var(--ui-primary-soft)" : "transparent", ...(style ?? {}) } as CSSProperties}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      ${hijos}
    </svg>
  );
});
`;
}

// ─── Generación de src/index.ts ─────────────────────────────────────────────────────────────────
export function generarIndice(nombres: string[]): string {
  const ordenados = [...nombres].sort((a, b) => a.localeCompare(b));
  const imports = ordenados
    .map((n) => `import { Icono${aPascalCase(n)} } from "./generated/${aPascalCase(n)}Icon.tsx";`)
    .join("\n");
  const reexports = ordenados.map((n) => `  Icono${aPascalCase(n)},`).join("\n");
  const registro = ordenados.map((n) => `  "${n}": Icono${aPascalCase(n)},`).join("\n");
  const listaNombres = ordenados.map((n) => `  "${n}",`).join("\n");

  return `// GENERADO por scripts/generar.ts a partir de svg/*.svg — no editar a mano.
// Regenerar: \`node --experimental-strip-types scripts/generar.ts\` desde packages/icons/.
//
// Fichero \`.ts\` (no \`.tsx\`, sin JSX): usa \`createElement\` para poder reexportar todo desde un
// único índice sin depender de que el bundler trate \`.ts\` como JSX (oxc/esbuild no lo hacen).
import { createElement, forwardRef } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { IconProps, IconTone } from "./tipos.ts";
${imports}

export type { IconProps, IconTone };

/** Nombre del paquete (compatibilidad con el esqueleto de la fase 3-C). */
export const PAQUETE = "@invitaciones/icons" as const;

export {
${reexports}
};

export const iconNames = [
${listaNombres}
] as const;

export type IconName = (typeof iconNames)[number];

type IconoComponente = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const REGISTRO: Record<IconName, IconoComponente> = {
${registro}
};

/** Icono genérico por nombre: \`createElement(Icon, { name: "inicio" })\` o \`<Icon name="inicio" />\` en un \`.tsx\`. */
export const Icon = forwardRef<SVGSVGElement, IconProps & { name: IconName }>(function Icon(
  { name, ...resto },
  ref,
) {
  return createElement(REGISTRO[name], { ref, ...resto });
});
`;
}

// ─── Generación de inventario.json ──────────────────────────────────────────────────────────────
export function generarInventario(nombres: string[]): string {
  const entradas = [...nombres]
    .sort((a, b) => a.localeCompare(b))
    .map((nombre) => ({
      nombre,
      categoria: categoriaDe(nombre) ?? null,
      dibujadoOriginal: DIBUJADOS_ORIGINALES.has(nombre),
      archivo: `svg/${nombre}.svg`,
    }));
  return `${JSON.stringify(entradas, null, 2)}\n`;
}

// ─── CLI ────────────────────────────────────────────────────────────────────────────────────────
function main(): void {
  const ficheros = leerIconosSvg(DIR_SVG);
  const errores: string[] = [];
  for (const { nombre, contenido } of ficheros) {
    const problemas = validarSvg(nombre, contenido);
    if (problemas.length > 0) errores.push(`${nombre}.svg: ${problemas.join("; ")}`);
  }
  if (errores.length > 0) {
    console.error(`${errores.length} fichero(s) SVG inválido(s):\n${errores.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(DIR_GENERADO, { recursive: true });
  const nombres = ficheros.map((f) => f.nombre);
  for (const { nombre, contenido } of ficheros) {
    const salida = generarComponente(nombre, contenido);
    writeFileSync(join(DIR_GENERADO, `${aPascalCase(nombre)}Icon.tsx`), salida, "utf8");
  }
  writeFileSync(RUTA_INDICE, generarIndice(nombres), "utf8");
  writeFileSync(RUTA_INVENTARIO, generarInventario(nombres), "utf8");
  console.log(`${ficheros.length} icono(s) generado(s) en ${DIR_GENERADO}; src/index.ts e inventario.json actualizados.`);
}

// Solo ejecuta el CLI si se invoca directamente (el test importa las funciones de arriba).
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
