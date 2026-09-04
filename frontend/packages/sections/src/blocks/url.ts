// packages/sections/src/blocks/url.ts — validación de esquema para cualquier `href` que se
// renderiza (LinkBlock, LocationBlock, RichTextBlock — 04 §17.6). Defensa en profundidad: en
// teoría `HttpUrl` (packages/schema/src/common.ts:60) ya garantiza `^https?://…` antes de llegar
// aquí (content → compose → ResolvedValue), pero un bloque de render NUNCA debe confiar
// ciegamente en que la validación de arriba se ejecutó — máxime siendo contenido de cliente.
const SAFE_HTTP_URL = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/** True si `href` es una URL http(s) absoluta y segura de poner en un atributo `href`/`src`. */
export function isSafeHttpUrl(href: string): boolean {
  return SAFE_HTTP_URL.test(href);
}

/** Host legible para el texto de un enlace sin `label` (04 §17.3: "si falta, cae al host del href"). */
export function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return href;
  }
}
