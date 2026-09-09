// lib/invitados/api.ts — cliente HTTP tipado del §1 del contrato de invitados
// (`handoffs/5-2-contrato-invitados.md`), una función por ruta. Base:
// `/product/invitations/{invitationId}/guests`.
//
// Reutiliza `getApiBaseUrl()`/`getAuthToken()` y las clases de error de `lib/api-client.ts` (P8: el
// token vive en un solo sitio) — NO se toca `lib/api-client.ts` (territorio compartido con otras tres
// sesiones) ni se duplica su lógica de token. `peticion()` de ese archivo no está exportada y sus
// errores solo reconocen el prefijo `TPL_*`, así que este módulo trae su PROPIO fetch interno para
// los códigos `GUEST_*`/`INVITATION_*`/`RSVP_*` del contrato — misma disciplina, mismas clases de
// error (P1: toda respuesta no-2xx se clasifica y se lanza, nunca se devuelve `null`).
import {
  ApiError,
  SessionError,
  UnknownApiError,
  getApiBaseUrl,
  getAuthToken,
  marcarSesionCaducada,
} from "@/lib/api-client";
import type {
  GuestExportFile,
  GuestImportResponse,
  GuestItem,
  GuestLink,
  GuestListQuery,
  GuestPage,
  GuestPreviewResponse,
  GuestSummary,
  GuestUpsertInput,
} from "./types";

function base(invitationId: number): string {
  return `/product/invitations/${invitationId}/guests`;
}

function construirQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const buscador = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    buscador.set(clave, String(valor));
  }
  const cadena = buscador.toString();
  return cadena ? `?${cadena}` : "";
}

/** Cuerpo de error del §0.6 del contrato: `{timestamp, statusCode, code, message, details?}`. */
interface CuerpoDeError {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly timestamp?: unknown;
  readonly statusCode?: unknown;
  readonly details?: unknown;
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
        timestamp: typeof cuerpo.timestamp === "string" ? cuerpo.timestamp : new Date().toISOString(),
        statusCode: typeof cuerpo.statusCode === "number" ? cuerpo.statusCode : status,
        code: cuerpo.code as string,
        message: typeof cuerpo.message === "string" ? cuerpo.message : "",
        details: cuerpo.details,
      },
      status,
    );
  }

  // 401/403 de la cadena de filtros de Spring Security, sin `code` reconocible (mismo criterio que
  // `lib/api-client.ts`: la sesión terminó o el rol no alcanza, y esa distinción solo la sabe aquí).
  if (status === 401 || status === 403) {
    // El olvido de la sesión va AQUÍ y no antes de leer el cuerpo: un 401/403 CON `code` del módulo
    // es un fallo de la ruta, no de la sesión, y tirar el token en ese caso echaría a la clienta de
    // la aplicación por un error de permisos de un recurso concreto. Es el mismo criterio que
    // `lib/api-client.ts` (`marcarSesionCaducada` solo corre cuando no hay código reconocible).
    marcarSesionCaducada();
    throw new SessionError(status, textoCrudo);
  }

  throw new UnknownApiError(status, textoCrudo);
}

/**
 * Toda ruta del §1 que promete un cuerpo 2xx tiene que traerlo. Si llega vacío (proxy que se comió
 * la respuesta, 200 sin cuerpo), devolver `undefined` disfrazado con un `as T` sería exactamente lo
 * que la cabecera de `lib/api-client.ts` prohíbe: «nunca se devuelve `null`/`undefined` en su
 * lugar». Se lanza `UnknownApiError`, que es la clase para «respuesta no reconocida».
 */
function exigirCuerpo<T>(datos: T | undefined, ruta: string): T {
  if (datos === undefined) {
    throw new UnknownApiError(200, `${ruta} respondió 2xx sin cuerpo y esta ruta siempre trae uno.`);
  }
  return datos;
}

interface OpcionesPeticion {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly path: string;
  readonly query?: Record<string, string | number | undefined>;
  readonly jsonBody?: unknown;
}

async function peticionInvitados<T>(opciones: OpcionesPeticion): Promise<T | undefined> {
  const url = `${getApiBaseUrl()}${opciones.path}${construirQuery(opciones.query)}`;
  const headers = new Headers({ Accept: "application/json" });
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (opciones.jsonBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(opciones.jsonBody);
  }

  const respuesta = await fetch(url, { method: opciones.method, headers, body, cache: "no-store" });

  if (respuesta.status === 204) return undefined;

  const textoCrudo = await respuesta.text();

  if (!respuesta.ok) clasificarYLanzar(respuesta.status, textoCrudo);

  if (textoCrudo.length === 0) return undefined;

  try {
    return JSON.parse(textoCrudo) as T;
  } catch {
    // Un 2xx cuyo cuerpo NO es JSON (una página de error de un proxy, un HTML de mantenimiento) se
    // escapaba de aquí como un `SyntaxError` pelado: ninguna de las tres clases de error del
    // proyecto, así que `error instanceof ApiError|SessionError` fallaba y la pantalla enseñaba el
    // mensaje genérico sin saber siquiera qué ruta se rompió. Se clasifica como lo que es: una
    // respuesta que no reconocemos.
    throw new UnknownApiError(respuesta.status, textoCrudo);
  }
}

// =============================================================================================
// GET …/guests
// =============================================================================================
export async function listGuests(invitationId: number, query?: GuestListQuery): Promise<GuestPage> {
  const datos = await peticionInvitados<GuestPage>({
    method: "GET",
    path: base(invitationId),
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return exigirCuerpo(datos, `GET ${base(invitationId)}`);
}

// =============================================================================================
// GET …/guests/summary
// =============================================================================================
export async function getGuestsSummary(invitationId: number): Promise<GuestSummary> {
  const datos = await peticionInvitados<GuestSummary>({ method: "GET", path: `${base(invitationId)}/summary` });
  return exigirCuerpo(datos, `GET ${base(invitationId)}/summary`);
}

// =============================================================================================
// POST …/guests → 201 GuestItem
// =============================================================================================
export async function createGuest(invitationId: number, body: GuestUpsertInput): Promise<GuestItem> {
  const datos = await peticionInvitados<GuestItem>({ method: "POST", path: base(invitationId), jsonBody: body });
  return exigirCuerpo(datos, `POST ${base(invitationId)}`);
}

// =============================================================================================
// PUT …/guests/{guestId} → 200 GuestItem
// =============================================================================================
export async function updateGuest(invitationId: number, guestId: number, body: GuestUpsertInput): Promise<GuestItem> {
  const datos = await peticionInvitados<GuestItem>({
    method: "PUT",
    path: `${base(invitationId)}/${guestId}`,
    jsonBody: body,
  });
  return exigirCuerpo(datos, `PUT ${base(invitationId)}/${guestId}`);
}

// =============================================================================================
// DELETE …/guests/{guestId} → 204
// =============================================================================================
export async function deleteGuest(invitationId: number, guestId: number): Promise<void> {
  await peticionInvitados<void>({ method: "DELETE", path: `${base(invitationId)}/${guestId}` });
}

// =============================================================================================
// POST …/guests:preview → 200, no escribe nada
// =============================================================================================
export async function previewGuestsPaste(invitationId: number, text: string): Promise<GuestPreviewResponse> {
  const datos = await peticionInvitados<GuestPreviewResponse>({
    method: "POST",
    path: `${base(invitationId)}:preview`,
    jsonBody: { text },
  });
  return exigirCuerpo(datos, `POST ${base(invitationId)}:preview`);
}

// =============================================================================================
// POST …/guests:import → 200, da de alta los renglones válidos
// =============================================================================================
export async function importGuestsPaste(invitationId: number, text: string): Promise<GuestImportResponse> {
  const datos = await peticionInvitados<GuestImportResponse>({
    method: "POST",
    path: `${base(invitationId)}:import`,
    jsonBody: { text },
  });
  return exigirCuerpo(datos, `POST ${base(invitationId)}:import`);
}

// =============================================================================================
// GET …/guests/{guestId}/link → 200 — la única ruta que revela un token, ya montado en la URL.
// Se pide EN EL MOMENTO de compartir, nunca al cargar la lista (contrato §0.3).
// =============================================================================================
export async function getGuestLink(invitationId: number, guestId: number): Promise<GuestLink> {
  const datos = await peticionInvitados<GuestLink>({ method: "GET", path: `${base(invitationId)}/${guestId}/link` });
  return exigirCuerpo(datos, `GET ${base(invitationId)}/${guestId}/link`);
}

// =============================================================================================
// POST …/guests/{guestId}:send-email → 202
// =============================================================================================
export async function sendGuestEmail(invitationId: number, guestId: number): Promise<void> {
  await peticionInvitados<void>({ method: "POST", path: `${base(invitationId)}/${guestId}:send-email` });
}

// =============================================================================================
// GET …/guests/export.csv → 200 text/csv — necesita el header Authorization, así que NO puede ser
// un <a href> pelado (S-13 lo evita también para el resto de esta superficie: nada de tokens en la
// URL). Se descarga con fetch + blob y quien la llama libera el object URL cuando termina.
// =============================================================================================
export async function exportGuestsCsv(invitationId: number): Promise<GuestExportFile> {
  const url = `${getApiBaseUrl()}${base(invitationId)}/export.csv`;
  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const respuesta = await fetch(url, { method: "GET", headers, cache: "no-store" });

  if (!respuesta.ok) {
    const textoCrudo = await respuesta.text();
    clasificarYLanzar(respuesta.status, textoCrudo);
  }

  const blob = await respuesta.blob();
  const disposicion = respuesta.headers.get("Content-Disposition") ?? "";
  const coincidencia = /filename="?([^";]+)"?/i.exec(disposicion);
  const filename = coincidencia?.[1] ?? "invitados.csv";
  return { blob, filename };
}

export type {
  EventRules,
  GuestCounts,
  GuestDraft,
  GuestExportFile,
  GuestImportResponse,
  GuestItem,
  GuestLink,
  GuestListQuery,
  GuestPage,
  GuestPreviewResponse,
  GuestProblem,
  GuestStatus,
  GuestSummary,
  GuestUpsertInput,
  SeatCounts,
  SeatPair,
} from "./types";
