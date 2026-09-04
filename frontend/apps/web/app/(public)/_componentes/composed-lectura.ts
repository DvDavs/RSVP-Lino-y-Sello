// app/(public)/_componentes/composed-lectura.ts — LECTURA del `ComposedDocument` para la superficie
// pública (`/i/[publicToken]` y `/preview/[invitationId]`). No pinta nada: solo saca de forma tipada
// los pocos datos que la PÁGINA necesita fuera del árbol de secciones — el `<h1>` de `04 §17.3`, los
// metadatos de `04 §15.4` y el color de fondo del documento.
//
// Por qué vive en `apps/web` y no en `packages/sections`: son decisiones de PÁGINA (qué va en
// `<title>`, qué se comparte por WhatsApp), no de sección. `packages/sections` es contrato ya
// integrado y de solo lectura para este bloque.
//
// P1: todo se busca por ROL (`BlockRole`), nunca por posición ni por id literal de plantilla; un rol
// que no está devuelve `null` y quien llama decide — nunca se inventa un valor.
import type { ComposedDocument } from "@invitaciones/schema";

type Seccion = ComposedDocument["sections"][number];
type BloqueOGrupo = Seccion["blocks"][number];
type ValorDe<T> = T extends { value: infer V } ? V : never;
type ValorResuelto = NonNullable<ValorDe<BloqueOGrupo>>;

/** `ComposedGroup` tiene `items`; `ComposedBlock`, `value`. `type === "group"` NO narrowea
 *  (handoffs/3-2a.md: `BlockKind` incluye el literal "group" en los dos miembros de la unión). */
function esGrupo(b: BloqueOGrupo): boolean {
  return "items" in b;
}

function buscarPorRol(composed: ComposedDocument, rol: string): ValorResuelto | null {
  for (const seccion of composed.sections) {
    if (!seccion.visible) continue; // una sección oculta no aporta ni metadatos (P8: no se filtra)
    for (const bloque of seccion.blocks) {
      if (esGrupo(bloque)) continue;
      if (bloque.role !== rol) continue;
      const valor = (bloque as { value?: ValorResuelto | null }).value ?? null;
      if (valor === null) continue;
      return valor;
    }
  }
  return null;
}

/** Texto plano de un valor resuelto, o `null` si ese tipo no tiene una lectura de una sola línea. */
function textoPlano(valor: ValorResuelto | null): string | null {
  if (valor === null) return null;
  switch (valor.kind) {
    case "text":
      return valor.value.trim() || null;
    case "richText": {
      const t = valor.doc.content
        .map((p) => p.content.map((s) => s.text).join(""))
        .join(" ")
        .trim();
      return t || null;
    }
    case "date":
    case "time":
    case "dateTimeRange":
      return valor.formatted.trim() || null;
    case "choice":
      return valor.label.trim() || null;
    case "person":
      return valor.name.trim() || null;
    case "location":
      return valor.name.trim() || null;
    default:
      return null;
  }
}

/** Título de portada (rol `coverTitle`) — el `<h1>` de la página (04 §17.3) y el `<title>`. */
export function tituloDe(composed: ComposedDocument): string | null {
  return textoPlano(buscarPorRol(composed, "coverTitle"));
}

/** Subtítulo de portada (rol `coverSubtitle`). */
export function subtituloDe(composed: ComposedDocument): string | null {
  return textoPlano(buscarPorRol(composed, "coverSubtitle"));
}

/** Fecha de portada, ya formateada por el backend (rol `coverDate`). */
export function fechaDe(composed: ComposedDocument): string | null {
  return textoPlano(buscarPorRol(composed, "coverDate"));
}

/** Imagen de portada (`coverImage`, con `coverBackground` de respaldo — mismo orden que CoverSection). */
export function portadaDe(composed: ComposedDocument): { url: string; alt: string } | null {
  for (const rol of ["coverImage", "coverBackground"] as const) {
    const valor = buscarPorRol(composed, rol);
    if (valor !== null && valor.kind === "image") return { url: valor.url, alt: valor.alt };
  }
  return null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * Fondo del DOCUMENTO, ya validado como `#rrggbb`. Se usa para pintar `html`/`body` (y `theme-color`)
 * de modo que el color del documento llegue también al *overscroll* y a la barra del navegador: sin
 * él se ve una franja blanca al rebotar el scroll en móvil, que es exactamente lo que delata que
 * "esto es una web" en vez de una invitación.
 *
 * Es el token de la PLANTILLA (`composed.theme.tokens.bg`), no un color propio de `apps/web` (P3).
 * Se revalida aquí antes de interpolarlo en un `<style>`: misma defensa en profundidad que
 * `ThemeProvider` (packages/sections/src/theme/ThemeProvider.tsx:37,52).
 */
export function fondoSeguroDe(composed: ComposedDocument): string | null {
  const bg = composed.theme.tokens.bg;
  return typeof bg === "string" && HEX_COLOR.test(bg) ? bg : null;
}
