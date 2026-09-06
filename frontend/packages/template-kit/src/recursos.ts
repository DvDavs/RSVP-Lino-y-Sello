// packages/template-kit/src/recursos.ts — lo que el previsualizador SIRVE y que no es el documento:
// el marcador de posición de las imágenes que faltan y la hoja de tipografías autoalojadas.
//
// Los dos son funciones puras que devuelven texto: se prueban sin navegador y sin servidor.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Marcador de posición de una imagen que el paquete todavía no tiene (identidad visual: «sin imagen
 * real, usa el placeholder del sistema»). Es un SVG, no un PNG: pesa 700 bytes, escala a cualquier
 * hueco y no necesita ningún banco de imágenes (el proxy del entorno los bloquea, `CLAUDE.md`).
 *
 * Los colores llegan por parámetro desde `ComposedDocument.theme.tokens`, porque un SVG servido
 * suelto no puede leer las custom properties `--inv-*` del documento que lo incrusta. Sin emojis y
 * sin tipografía de sistema en el rótulo: se hereda la del documento por `font-family: inherit`, y
 * si no hay ninguna se ve la de reserva del navegador — un rótulo de diagnóstico, no interfaz.
 */
export function marcadorSvg(opts: {
  readonly etiqueta: string;
  readonly tinta?: string;
  readonly papel?: string;
}): string {
  const tinta = normalizarHex(opts.tinta) ?? "#6B655C";
  const papel = normalizarHex(opts.papel) ?? "#EFEDE9";
  const etiqueta = opts.etiqueta.replace(/[<>&"']/g, "").slice(0, 48);
  // Lienzo grande (1200x900) y elementos pequeños DENTRO de él: el marcador acaba dentro de un
  // `<img>` con `object-fit: cover` (`ImageBlock.module.css`), que lo escala al hueco. Con un
  // lienzo de 320 px el rótulo salía del tamaño de un titular en la portada — medido. El rayado
  // diagonal es lo que hace de textura a cualquier escala, no el icono.
  const id = `kit-ph-${Math.abs(hashCorto(etiqueta))}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Imagen pendiente: ${etiqueta}">
  <defs>
    <pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="22" stroke="${tinta}" stroke-opacity="0.10" stroke-width="6"/>
    </pattern>
  </defs>
  <rect width="1200" height="900" fill="${papel}"/>
  <rect width="1200" height="900" fill="url(#${id})"/>
  <g fill="none" stroke="${tinta}" stroke-opacity="0.35" stroke-width="3">
    <rect x="18" y="18" width="1164" height="864" rx="28" stroke-dasharray="14 12"/>
  </g>
  <g transform="translate(600 402)">
    <g fill="none" stroke="${tinta}" stroke-opacity="0.55" stroke-width="4">
      <rect x="-78" y="-58" width="156" height="116" rx="14"/>
      <path d="M-62 34l40-44 30 33 24-25 44 48z"/>
      <circle cx="-30" cy="-22" r="13"/>
    </g>
  </g>
  <text x="600" y="524" text-anchor="middle" font-family="inherit" font-size="30"
        fill="${tinta}" fill-opacity="0.8">imagen pendiente</text>
  <text x="600" y="562" text-anchor="middle" font-family="inherit" font-size="22"
        fill="${tinta}" fill-opacity="0.55">${etiqueta}</text>
</svg>
`;
}

/** Hash corto y estable para el `id` del patrón: dos marcadores en la misma página no pueden chocar. */
function hashCorto(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function normalizarHex(v: string | undefined): string | undefined {
  return v !== undefined && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}

/** Una familia de `theme.json` y los pesos que declara. */
export interface FamiliaPedida {
  readonly family: string;
  readonly weights: readonly number[];
}

export interface HojaDeFuentes {
  /** CSS listo para servir: los `@font-face` de `@fontsource`, con las URLs reescritas. */
  readonly css: string;
  /** Familias resueltas contra `node_modules`. */
  readonly resueltas: readonly string[];
  /** Familias que el repositorio NO tiene autoalojadas: se verán con la pila de reserva. */
  readonly faltantes: readonly string[];
}

/** `"Cormorant Garamond"` → `"cormorant-garamond"` (convención de nombre de paquete de Fontsource). */
export function slugDeFamilia(family: string): string {
  return family.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Hoja de tipografías del lienzo. `packages/sections` NO carga archivos de fuente a propósito
 * (`theme/fonts.ts:4-12`): quien monta la página es quien las trae. En el producto eso es
 * `apps/web/app/(public)/publico.css` con `@fontsource/*`; aquí lo hace el previsualizador, con la
 * MISMA estrategia (autoalojadas por npm — el proxy del entorno bloquea Google Fonts) y el mismo
 * criterio de peso: se importan los archivos POR PESO, que sí traen `unicode-range` por subconjunto.
 *
 * Una familia que el repositorio no tenga instalada NO es un error del paquete: es una nota del
 * previsualizador, porque la plantilla puede ser perfectamente válida y estar esperando a que se
 * añada `@fontsource/<familia>` al monorepo.
 */
export function hojaDeFuentes(
  familias: readonly FamiliaPedida[],
  raicesModulos: readonly string[],
  aUrl: (rutaAbsoluta: string) => string,
): HojaDeFuentes {
  const trozos: string[] = [];
  const resueltas: string[] = [];
  const faltantes: string[] = [];
  const vistas = new Set<string>();

  for (const f of familias) {
    if (vistas.has(f.family)) continue;
    vistas.add(f.family);
    const slug = slugDeFamilia(f.family);
    // Varias raíces porque pnpm reparte: las fuentes del CHROME cuelgan de este paquete y las de
    // las plantillas publicadas pueden estar en `apps/web/node_modules` (`publico.css` las importa).
    const dirs = raicesModulos.flatMap(r => [join(r, "@fontsource", slug), join(r, "@fontsource-variable", slug)]);
    const base = dirs.find(d => existsSync(d));
    if (base === undefined) { faltantes.push(f.family); continue; }
    const ficheros = base.includes("@fontsource-variable")
      ? ["index.css"]
      : (f.weights.length > 0 ? f.weights : [400]).map(w => `${w}.css`);
    let alguno = false;
    for (const fichero of ficheros) {
      const ruta = join(base, fichero);
      if (!existsSync(ruta)) continue;
      trozos.push(`/* ${f.family} — ${ruta} */`);
      trozos.push(reescribirUrls(readFileSync(ruta, "utf8"), dirname(ruta), aUrl));
      alguno = true;
    }
    if (alguno) resueltas.push(f.family); else faltantes.push(f.family);
  }
  return { css: trozos.join("\n") + "\n", resueltas, faltantes };
}

/** `url(./files/x.woff2)` → la URL absoluta con la que el servidor sabe entregar ese archivo. */
export function reescribirUrls(css: string, dirDelCss: string, aUrl: (ruta: string) => string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (todo, _c: string, ruta: string) => {
    if (/^(https?:|data:|\/)/.test(ruta)) return todo;
    return `url("${aUrl(resolve(dirDelCss, ruta))}")`;
  });
}
