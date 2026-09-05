// scripts/generar.ts — recorre `svg/*.svg` (nivel raíz; `svg/ilustraciones/` queda fuera a propósito:
// esas 3 no son iconos de 24, son las ilustraciones de estados vacíos que consume
// `packages/ui/src/ilustraciones/`) y genera `src/generated/<Nombre>Icon.tsx` + `src/index.ts`.
//
// Transformador propio en vez de `@svgr/core`: el conjunto de entrada es un puñado de elementos
// (`path`, `circle`, `rect`, `g`) y atributos SVG conocidos, siempre bien formados a mano por este
// mismo agente — una tabla de conversión kebab-case -> camelCase (los cuatro atributos `stroke-*`
// que de verdad aparecen) resuelve el 100 % de los casos sin fijar una versión de svgr + su plugin
// JSX bajo `verbatimModuleSyntax`. Si el bloque 2 amplía el inventario con SVG más complejos
// (`clip-path`, `<defs>`, `xlink:href`…) y esta tabla se queda corta, ese es el momento de evaluar
// `@svgr/core` de verdad; documentado también en `preguntas-abiertas.md`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const DIR_SVG = join(RAIZ, "svg");
const DIR_GENERADOS = join(RAIZ, "src", "generated");

const ATRIBUTOS_CAMEL: ReadonlyArray<readonly [string, string]> = [
  ["stroke-width", "strokeWidth"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
  ["stroke-dasharray", "strokeDasharray"],
];

export function nombreArchivoAPascal(nombreArchivo: string): string {
  return nombreArchivo
    .split("-")
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join("");
}

/** Contenido entre `<svg ...>` y `</svg>` de un SVG fuente de icono, con los atributos `stroke-*`
 * pasados a camelCase para poder incrustarlo en JSX. Los atributos del `<svg>` raíz se descartan:
 * el componente generado pone los suyos (a partir de `size`/`tone`/`title`/`className`). */
export function contenidoInterno(svg: string): string {
  const inicio = svg.indexOf(">");
  const fin = svg.lastIndexOf("</svg>");
  if (inicio === -1 || fin === -1) throw new Error("SVG sin <svg>...</svg> reconocible.");
  let interior = svg.slice(inicio + 1, fin).trim();
  for (const [kebab, camel] of ATRIBUTOS_CAMEL) interior = interior.split(`${kebab}=`).join(`${camel}=`);
  return interior;
}

export function generarComponente(nombreIcono: string, svg: string): string {
  const pascal = nombreArchivoAPascal(nombreIcono);
  const interior = contenidoInterno(svg);
  return `// Generado por scripts/generar.ts a partir de svg/${nombreIcono}.svg. No editar a mano:
// cambia el SVG fuente y vuelve a generar (\`pnpm --filter @invitaciones/icons run generar\`).
import { forwardRef } from "react";
import type { IconoProps } from "../tipos.ts";

export const ${pascal}Icon = forwardRef<SVGSVGElement, IconoProps>(function ${pascal}Icon(
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
      className={className}
      style={{ ["--tono" as string]: tone === "mono" ? "currentColor" : "var(--ui-primary-soft)", ...style }}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...resto}
    >
      {title ? <title>{title}</title> : null}
      ${interior}
    </svg>
  );
});
${pascal}Icon.displayName = "${pascal}Icon";
`;
}

export function nombresIconos(dirSvg: string = DIR_SVG): string[] {
  return readdirSync(dirSvg, { withFileTypes: true })
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith(".svg"))
    .map((entrada) => entrada.name.replace(/\.svg$/, ""))
    .sort();
}

export function generarIndice(nombres: string[]): string {
  const filas = nombres.map((nombre) => ({ nombre, pascal: nombreArchivoAPascal(nombre) }));
  const imports = filas.map(({ pascal }) => `import { ${pascal}Icon } from "./generated/${pascal}Icon.tsx";`).join("\n");
  const reexports = filas.map(({ pascal }) => `export { ${pascal}Icon } from "./generated/${pascal}Icon.tsx";`).join("\n");
  const listaNombres = filas.map(({ nombre }) => `"${nombre}"`).join(", ");
  const filasRegistro = filas.map(({ nombre, pascal }) => `  "${nombre}": ${pascal}Icon,`).join("\n");
  return `// Generado por scripts/generar.ts a partir de svg/*.svg. No editar a mano.
import { createElement } from "react";
import type { ComponentType } from "react";
${imports}
import type { IconoProps } from "./tipos.ts";

export type { IconoProps, IconoTono } from "./tipos.ts";
${reexports}

export const iconNames = [${listaNombres}] as const;
export type IconName = (typeof iconNames)[number];

const registro: Record<IconName, ComponentType<IconoProps>> = {
${filasRegistro}
};

/** Icono genérico por nombre: \`<Icon name="historia" />\`. Para el uso normal, preferir el
 * componente con nombre propio (\`<HistoriaIcon />\`) — este existe para listas dirigidas por datos
 * (p. ej. el buscador de la galería \`/design/iconos\`). */
export function Icon({ name, ...props }: IconoProps & { name: IconName }) {
  const Componente = registro[name];
  return createElement(Componente, props);
}
`;
}

function principal(): void {
  mkdirSync(DIR_GENERADOS, { recursive: true });
  const nombres = nombresIconos();
  for (const nombre of nombres) {
    const svg = readFileSync(join(DIR_SVG, `${nombre}.svg`), "utf8");
    const pascal = nombreArchivoAPascal(nombre);
    writeFileSync(join(DIR_GENERADOS, `${pascal}Icon.tsx`), generarComponente(nombre, svg), "utf8");
  }
  writeFileSync(join(RAIZ, "src", "index.ts"), generarIndice(nombres), "utf8");
  console.log(`Generados ${nombres.length} iconos en src/generated/ + src/index.ts`);
}

const esEjecutadoDirectamente = process.argv[1] === fileURLToPath(import.meta.url);
if (esEjecutadoDirectamente) principal();
