import { NextResponse, type NextRequest } from "next/server";

/**
 * CSP del lienzo aislado — `handoffs/3-0b.md` §1 (medido, ADR-3-0b-01, 8/8 criterios de `04 §8.5`).
 * Next 16 renombró el convenio `middleware.ts` a **`proxy.ts`** (el build avisa de la deprecación;
 * `04 §8.4` no lo dice porque se escribió antes de esa versión — enmienda registrada en el handoff).
 *
 * Solo la ruta del lienzo (`/editor/[invitationId]/canvas`) lleva esta CSP. Hosts **explícitos,
 * nunca `'self'`**: dentro de un `<iframe sandbox="allow-scripts">` sin `allow-same-origin` el
 * documento tiene origen OPACO y `'self'` no casa con nada — una CSP con `'self'` bloquearía los
 * propios chunks de Next (medido en el spike de la compuerta).
 *
 * El `nonce` se propaga a los `<script>` de Next poniendo la CSP también en las cabeceras de la
 * PETICIÓN (`NextResponse.next({ request: { headers } })`): así Next añade el nonce a sus etiquetas.
 * `x-nonce` se la pasa a la página para el `<style nonce>` del tema (la CSP no habilita `style=`).
 */
const APP_ORIGIN = process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? "http://127.0.0.1:3000";
const CDN_ORIGIN = process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "http://127.0.0.1:6003";

export default function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'none'`,
    `script-src ${APP_ORIGIN} 'nonce-${nonce}'`,
    `style-src ${APP_ORIGIN} 'nonce-${nonce}'`,
    `font-src ${APP_ORIGIN} ${CDN_ORIGIN}`,
    `img-src ${APP_ORIGIN} ${CDN_ORIGIN} data:`,
    `connect-src 'none'`,
    `frame-ancestors ${APP_ORIGIN}`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ].join("; ");

  const cabeceras = new Headers(request.headers);
  cabeceras.set("x-nonce", nonce);
  cabeceras.set("content-security-policy", csp);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });
  respuesta.headers.set("content-security-policy", csp);
  return respuesta;
}

/** Solo el lienzo. El resto de `apps/web` no lleva esta CSP (04 §8.4). Patrón literal de
 *  `handoffs/3-0b.md` §1: `matcher: ["/editor/:id/canvas"]`. */
export const config = { matcher: ["/editor/:id/canvas"] };
