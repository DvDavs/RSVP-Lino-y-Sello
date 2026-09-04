import { NextResponse, type NextRequest } from "next/server";

/**
 * C2 de `04 §8.4` — CSP **solo** en la ruta del lienzo, con `nonce` por petición y **hosts
 * explícitos, nunca `'self'`**: dentro de un iframe `sandbox="allow-scripts"` sin
 * `allow-same-origin` el documento tiene origen opaco y `'self'` no casa con NADA, así que una CSP
 * con `'self'` bloquearía los propios chunks de Next.
 *
 * Next 16 renombró el convenio `middleware.ts` a **`proxy.ts`** (el build avisa de la
 * deprecación). `04 §8.4` no lo dice porque se escribió antes; queda registrado en el handoff.
 *
 * El `nonce` se propaga a los `<script>` que genera Next poniendo la CSP también en las **cabeceras
 * de la petición**: Next la lee y añade el `nonce` a sus etiquetas. `x-nonce` se la pasa a la página
 * para el `<style nonce>` del tema.
 */
const APP_ORIGIN = process.env.NEXT_PUBLIC_EDITOR_ORIGIN ?? "http://127.0.0.1:6100";
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

/** Solo el lienzo. El chrome del editor NO lleva esta CSP (tiene otras necesidades). */
export const config = { matcher: ["/canvas"] };
