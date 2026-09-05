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
 *
 * ─── N-02 (`ADR-3C-N02-01`): el origen se resuelve EN CADA PETICIÓN, no al construir ───────────
 * Hasta la fase 3-C este archivo leía `process.env.NEXT_PUBLIC_EDITOR_ORIGIN`, y las variables
 * `NEXT_PUBLIC_*` las **hornea Next en el bundle al construir**. Medido en `bitacora/3b-adv.md §6.2`:
 * el mismo artefacto construido para `:3050` y servido en `:3000` emitía
 * `frame-ancestors http://127.0.0.1:3050`, el navegador rechazaba el `<iframe>`
 * («Refused to frame … because an ancestor violates …») y la vista previa del editor moría EN
 * SILENCIO. Un artefacto sólo servible en el puerto con el que se compiló no es un artefacto.
 *
 * La CSP la compone el servidor en cada petición, así que puede mirar la petición. Orden de
 * resolución, de más fiable a menos, y por qué:
 *   1. `EDITOR_ORIGIN` — variable **de servidor** (sin `NEXT_PUBLIC_`), leída al atender, no al
 *      compilar. Es lo que debe declarar un despliegue en producción: es el único valor que no
 *      depende de una cabecera que pone el cliente.
 *   2. `x-forwarded-proto` + `x-forwarded-host` — el origen PÚBLICO cuando hay un proxy inverso
 *      delante. Sin esto, detrás de un proxy la CSP nombraría el host interno y el navegador
 *      —que sólo conoce el público— rechazaría todo.
 *   3. `Host` + el protocolo de la petición — sin proxy, es exactamente el origen que el navegador
 *      usó para pedir la página, que es contra lo que él va a comparar la CSP.
 *   4. `request.nextUrl.origin` como último recurso.
 *
 * Riesgo asumido y acotado: (2) y (3) son cabeceras que el cliente controla. Falsificarlas sólo
 * cambia la CSP de **su propia** respuesta —la ruta es dinámica, lleva un nonce por petición y no se
 * cachea—, así que no alcanza a nadie más; y no afloja ninguna directiva, sólo cambia qué host se
 * nombra. Aun así, en producción se declara `EDITOR_ORIGIN` y se acaba la discusión. Lo verifica al
 * arrancar `motivoDeOrigenDesalineado` (`lib/enlace-publico.ts`).
 */

/** Hosts admisibles en una cabecera: letras, dígitos, `.`, `-`, `:` del puerto y `[]` de IPv6. */
const HOST_VALIDO = /^[A-Za-z0-9._:\-[\]]{1,255}$/;

/**
 * Normaliza un origen para meterlo en la cabecera CSP. Devuelve `null` si no es utilizable.
 *
 * No es adorno: un valor con `;`, un salto de línea o un espacio partiría la cabecera y podría
 * inyectar directivas. `new URL` más la comprobación de esquema deja fuera todo eso.
 */
function origenValido(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!HOST_VALIDO.test(url.host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Primer salto de una cabecera que puede venir como lista (`a.example, b.interno`), ya validado
 * como host. Se comprueba el valor CRUDO, no sólo el que sobrevive a `new URL`: `invitaciones.mx/x`
 * daría un `URL` perfectamente válido con `host` limpio, y aceptar una cabecera que trae ruta es
 * aceptar una cabecera que no es un host.
 */
function hostDeCabecera(valor: string | null): string | null {
  const primero = valor?.split(",")[0]?.trim();
  if (!primero || !HOST_VALIDO.test(primero)) return null;
  return primero;
}

/** El origen por el que el NAVEGADOR llegó a esta petición. Ver el orden de resolución de arriba. */
export function origenDeLaAplicacion(request: NextRequest): string {
  const declarado = origenValido(process.env.EDITOR_ORIGIN);
  if (declarado) return declarado;

  const hostReenviado = hostDeCabecera(request.headers.get("x-forwarded-host"));
  if (hostReenviado) {
    const protoReenviado = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const esquema = protoReenviado === "http" || protoReenviado === "https" ? protoReenviado : "https";
    const conProxy = origenValido(`${esquema}://${hostReenviado}`);
    if (conProxy) return conProxy;
  }

  const host = hostDeCabecera(request.headers.get("host"));
  if (host) {
    const directo = origenValido(`${request.nextUrl.protocol}//${host}`);
    if (directo) return directo;
  }

  return request.nextUrl.origin;
}

/**
 * Origen del CDN de assets. Misma regla: variable de servidor primero (`CDN_ORIGIN`), y sólo si no
 * está se usa la horneada de siempre, para no romper ningún arranque existente.
 */
function origenDelCdn(): string {
  return (
    origenValido(process.env.CDN_ORIGIN) ??
    origenValido(process.env.NEXT_PUBLIC_CDN_ORIGIN) ??
    "http://127.0.0.1:6003"
  );
}

export default function proxy(request: NextRequest) {
  const APP_ORIGIN = origenDeLaAplicacion(request);
  const CDN_ORIGIN = origenDelCdn();
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
