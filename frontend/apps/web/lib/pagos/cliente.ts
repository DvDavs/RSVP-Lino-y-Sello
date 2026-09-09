// lib/pagos/cliente.ts — el único cliente HTTP del módulo de pagos (fase 5, sesión E4).
//
// Mismo criterio que `lib/api-client.ts` (que NO se toca ni se importa por dentro: es de otro
// módulo, `templates2`, con su propio prefijo de error `TPL_*`), imitado aquí para `PAY_*`:
//  - `getApiBaseUrl()` y `getAuthToken()` de `lib/api-client.ts` (los únicos dos que este módulo
//    reutiliza: base URL y token de sesión viven en un solo sitio, P8).
//  - `cache: "no-store"` siempre: precios y estado de pago nunca se sirven de una caché vieja.
//  - Ninguna función devuelve `null` en vez de lanzar: toda respuesta no-2xx se clasifica y se
//    lanza como `ErrorDePago` o `SessionError` (nunca un `Error` genérico con el texto perdido).
import { getApiBaseUrl, getAuthToken } from "@/lib/api-client";
import { SessionError } from "@/lib/errors";
import { ErrorDePago } from "./tipos.ts";
import type { CatalogoDePlanes, CheckoutCreado, Pago, PlanDeInvitacion } from "./tipos.ts";

interface OpcionesPeticion {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly jsonBody?: unknown;
  /** `false` en la única ruta pública (`GET /public/plans`). Por defecto `true`. */
  readonly auth?: boolean;
}

/**
 * `true` cuando `valor` tiene la forma `{code: "PAY_…", message?: string, ...}` de un error del
 * módulo de pagos. El prefijo es OBLIGATORIO, igual que `code.startsWith("TPL_")` en
 * `lib/api-client.ts`: sin él, un `401` de la cadena de filtros de Spring Security que trajera
 * cualquier `code` (`ACCESS_DENIED`, `invalid_token`…) se clasificaría como error de pago y la
 * pantalla nunca mandaría a `/acceso`.
 */
function esCuerpoDeErrorDePago(valor: unknown): valor is { code: string; message?: string; details?: unknown } {
  if (typeof valor !== "object" || valor === null || !("code" in valor)) return false;
  const code = (valor as Record<string, unknown>).code;
  return typeof code === "string" && code.startsWith("PAY_");
}

async function peticion<T>(opciones: OpcionesPeticion): Promise<T> {
  const url = `${getApiBaseUrl()}${opciones.path}`;
  const headers = new Headers({ Accept: "application/json" });

  if (opciones.auth !== false) {
    const token = getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (opciones.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opciones.jsonBody);
  }

  const respuesta = await fetch(url, {
    method: opciones.method,
    headers,
    body,
    cache: "no-store",
  });

  const textoCrudo = await respuesta.text();

  if (respuesta.ok) {
    return (textoCrudo.length > 0 ? (JSON.parse(textoCrudo) as T) : (undefined as T));
  }

  // No-2xx: SIEMPRE se clasifica (mismo criterio que `lib/api-client.ts`), nunca se descarta el
  // cuerpo en silencio.
  let cuerpoParseado: unknown;
  try {
    cuerpoParseado = textoCrudo.length > 0 ? JSON.parse(textoCrudo) : undefined;
  } catch {
    cuerpoParseado = undefined;
  }

  if (esCuerpoDeErrorDePago(cuerpoParseado)) {
    throw new ErrorDePago(
      cuerpoParseado.code,
      respuesta.status,
      cuerpoParseado.message ?? `Error de pago (${cuerpoParseado.code}).`,
      cuerpoParseado.details,
    );
  }

  // 401/403 sin `code`: la cadena de filtros de Spring Security, igual que en `lib/api-client.ts`
  // (`handoffs/2-5.md`). NO se marca sesión caducada aquí: eso lo decide `api-client.ts`, el único
  // sitio que puede tocar el token (P8) — este módulo solo clasifica el error para quien lo llame.
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new SessionError(respuesta.status, textoCrudo);
  }

  throw new ErrorDePago(
    "PAY_DESCONOCIDO",
    respuesta.status,
    `Respuesta no reconocida del servidor de pagos (HTTP ${respuesta.status}).`,
  );
}

// =============================================================================================
// GET /public/plans (§2.1) — catálogo público, sin sesión.
// =============================================================================================
export async function obtenerCatalogo(): Promise<CatalogoDePlanes> {
  return peticion<CatalogoDePlanes>({ method: "GET", path: "/public/plans", auth: false });
}

// =============================================================================================
// GET /product/payments/invitations/{invitationId} (§2.2) — plan de una invitación, con sesión.
// =============================================================================================
export async function obtenerPlanDeInvitacion(invitationId: number): Promise<PlanDeInvitacion> {
  return peticion<PlanDeInvitacion>({
    method: "GET",
    path: `/product/payments/invitations/${invitationId}`,
  });
}

// =============================================================================================
// GET /product/payments/pagos (§2.3) — historial de pagos de la clienta.
// =============================================================================================
export async function obtenerMisPagos(): Promise<readonly Pago[]> {
  const respuesta = await peticion<{ pagos: readonly Pago[] }>({
    method: "GET",
    path: "/product/payments/pagos",
  });
  return respuesta.pagos;
}

// =============================================================================================
// POST /product/payments/checkout (§2.4) — abre una sesión de Stripe Checkout.
// =============================================================================================
export async function crearCheckout(invitationId: number, planCodigo: string): Promise<CheckoutCreado> {
  return peticion<CheckoutCreado>({
    method: "POST",
    path: "/product/payments/checkout",
    jsonBody: { invitationId, planCodigo },
  });
}
