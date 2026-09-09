// lib/invitados/rsvp.ts — cliente HTTP del §2 del contrato
// (`docs/rediseno-plantillas/memoria/handoffs/5-2-contrato-invitados.md`): la superficie pública de
// `/public/r/{token}`, sin sesión. Se llama SOLO desde el navegador (§3 del contrato): el estado
// personal del invitado (su nombre, sus cupos, su respuesta) nunca puede resolverse en el servidor,
// porque `/r/[token]` no puede compartir entrada de caché con nadie — a diferencia de
// `/i/[publicToken]`, que sí es ISR compartido.
//
// Reutiliza `getApiBaseUrl()` y las clases de error de `lib/api-client.ts` (mismo criterio que
// `lib/invitados/api.ts`, que ya sigue este patrón para el §1 del contrato): P1 — toda respuesta
// no-2xx se clasifica por su `code` y se lanza, nunca se devuelve `null`/`undefined` en su lugar.
//
// NO usa `getAuthToken()`, y nunca manda `Authorization`: esta superficie no tiene sesión. Un
// invitado no inicia sesión para confirmar su asistencia; el `token` de la ruta ES la credencial
// completa (`diseno/12-producto-completo.md` §B3.1: 1024 bits de entropía).
//
// Verificado contra el backend vivo (`http://127.0.0.1:6003`) antes de tipar nada: el cuerpo de
// éxito de `GET`/`PUT` es exactamente el del contrato, y el cuerpo de error es `{code, message}` —
// SIN `timestamp` ni `statusCode` (a diferencia de `TplErrorResponse`, que sí los lleva). `ApiError`
// exige esos dos campos por tipo; se rellenan aquí con el estado HTTP real y la hora de recepción,
// nunca inventando el `code`/`message`, que son los únicos que importan para clasificar.
import { ApiError, SessionError, UnknownApiError, getApiBaseUrl } from "@/lib/api-client";

// -------------------------------------------------------------------------------------------
// Formas — verificadas contra el backend vivo (ver bitácora del handoff 5-2-D), no supuestas del
// ejemplo del contrato.
// -------------------------------------------------------------------------------------------

export type RsvpGuestStatus = "PENDING" | "CONFIRMED" | "DECLINED";

/** `guest` de la respuesta — nada más que lo que el propio invitado necesita ver (contrato §2). */
export interface RsvpGuest {
  readonly fullName: string;
  readonly adults: number;
  readonly children: number;
  readonly young: number;
  readonly adultsConfirmed: number;
  readonly childrenConfirmed: number;
  readonly youngConfirmed: number;
  readonly status: RsvpGuestStatus;
  /** Booleano, nunca la dirección: "te mandamos el detalle a tu correo" sin volcarlo (contrato §2). */
  readonly hasEmail: boolean;
}

/** `event` de la respuesta. `publicToken` es el que pinta la invitación completa (`getPublicRender`). */
export interface RsvpEvent {
  readonly publicToken: string;
  readonly childrenAllowed: boolean;
  readonly youngAllowed: boolean;
  /** `true` cuando la fecha del evento ya pasó: la pantalla lo dice antes de enseñar el formulario. */
  readonly closed: boolean;
}

export interface RsvpEstado {
  readonly guest: RsvpGuest;
  readonly event: RsvpEvent;
}

/** Cuerpo de `PUT /public/r/{token}` (contrato §2). `email` NO existe en este tipo a propósito: si
 *  se manda, el backend lo ignora sin error (S-07), y aquí no se le da ni la oportunidad de mandarse. */
export interface RsvpRespuestaInput {
  readonly attending: boolean;
  readonly adults: number;
  readonly children: number;
  readonly young: number;
  readonly message?: string;
}

const RSVP_ERROR_CODES = [
  "GUEST_NOT_FOUND",
  "GUEST_INVALID",
  "GUEST_DUPLICATE",
  "GUEST_QUOTA_EXCEEDED",
  "INVITATION_NOT_FOUND",
  "RSVP_LINK_NOT_FOUND",
  "RSVP_CLOSED",
  "RSVP_TOO_MANY_ATTEMPTS",
  "RSVP_INTERNAL",
] as const;
export type RsvpErrorCode = (typeof RSVP_ERROR_CODES)[number];

interface CuerpoDeError {
  readonly code?: unknown;
  readonly message?: unknown;
}

function esCuerpoDeError(valor: unknown): valor is CuerpoDeError {
  return typeof valor === "object" && valor !== null && typeof (valor as CuerpoDeError).code === "string";
}

/** Clasifica una respuesta no-2xx y la lanza. Nunca se descarta un error en silencio (P1). */
function clasificarYLanzar(status: number, textoCrudo: string): never {
  let cuerpo: unknown;
  try {
    cuerpo = textoCrudo.length > 0 ? JSON.parse(textoCrudo) : undefined;
  } catch {
    cuerpo = undefined;
  }

  if (esCuerpoDeError(cuerpo)) {
    throw new ApiError(
      {
        timestamp: new Date().toISOString(),
        statusCode: status,
        code: cuerpo.code as string,
        message: typeof cuerpo.message === "string" ? cuerpo.message : "",
        details: undefined,
      },
      status,
    );
  }

  // Esta superficie no tiene sesión (`permitAll`, sin `@PreAuthorize`): un 401/403 no debería
  // llegar nunca, pero si lo hiciera (un proxy intermedio, p. ej.) se clasifica con el mismo
  // criterio que el resto del cliente en vez de colarse como `UnknownApiError`.
  if (status === 401 || status === 403) {
    throw new SessionError(status, textoCrudo);
  }

  throw new UnknownApiError(status, textoCrudo);
}

interface OpcionesPeticion {
  readonly method: "GET" | "PUT";
  readonly jsonBody?: unknown;
}

async function peticionRsvp<T>(token: string, opciones: OpcionesPeticion): Promise<T> {
  const url = `${getApiBaseUrl()}/public/r/${encodeURIComponent(token)}`;
  const headers = new Headers({ Accept: "application/json" });

  let body: BodyInit | undefined;
  if (opciones.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opciones.jsonBody);
  }

  // `cache: "no-store"`: esta petición SOLO ocurre en el navegador (nunca en RSC), pero se fija
  // explícito para que ningún cambio futuro la deje entrar sin querer en el Data Cache de Next.
  const respuesta = await fetch(url, { method: opciones.method, headers, body, cache: "no-store" });
  const textoCrudo = await respuesta.text();

  if (!respuesta.ok) clasificarYLanzar(respuesta.status, textoCrudo);

  return JSON.parse(textoCrudo) as T;
}

/**
 * `GET /public/r/{token}` — el invitado, sus cupos y las reglas del evento. Un token que no
 * resuelve (inexistente, caducado, rotado, invitación despublicada o anfitrión deshabilitado) lanza
 * `ApiError` con `code: "RSVP_LINK_NOT_FOUND"`, idéntico para los seis casos (contrato §0.5):
 * quien llama nunca puede distinguirlos, ni siquiera para un `console`.
 */
export async function obtenerRsvp(token: string): Promise<RsvpEstado> {
  return peticionRsvp<RsvpEstado>(token, { method: "GET" });
}

/**
 * `PUT /public/r/{token}` — confirma o declina. Cambiar de opinión (confirmar → declinar →
 * confirmar) es la MISMA llamada, cuantas veces haga falta: no hay un endpoint distinto para
 * "cancelar" (el `cancellationToken` heredado no se usa en esta superficie, contrato §0.4).
 */
export async function enviarRsvp(token: string, input: RsvpRespuestaInput): Promise<RsvpEstado> {
  // Cuerpo reconstruido campo a campo (nunca `input` reenviado tal cual): defensa en profundidad de
  // S-07 también en el cliente — aunque el backend ya ignora un `email` colado (contrato §2), este
  // cliente no le da ni la oportunidad de viajar si algún llamador futuro lo agrega al objeto de
  // entrada. `message` se omite entero cuando no viene (`JSON.stringify` descarta `undefined`).
  const cuerpo: RsvpRespuestaInput = {
    attending: input.attending,
    adults: input.adults,
    children: input.children,
    young: input.young,
    ...(input.message !== undefined ? { message: input.message } : {}),
  };
  return peticionRsvp<RsvpEstado>(token, { method: "PUT", jsonBody: cuerpo });
}

export { ApiError, SessionError, UnknownApiError } from "@/lib/api-client";
