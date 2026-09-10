// lib/admin/cliente.ts — una función por ruta del contrato `/product/admin/**`
// (`scratchpad/contrato-admin.md`), más `alternarEstadoInvitacion` para la ruta heredada que
// reutiliza la §4. Sigue el mismo patrón que `lib/api-client.ts` (léelo antes de tocar esto).
//
// EL TOKEN DE SESIÓN VIVE SOLO EN `lib/api-client.ts` (P8, `contratos.md §8 C4`). Este fichero NO
// lee ni escribe `sessionStorage` ni memoria propia: importa el accesor ya exportado
// `getAuthToken()` y la base `getApiBaseUrl()` de `./api-client.ts` y los usa tal cual. Es el
// mismo trato que ya tiene el resto de `apps/web` — un solo sitio toca el token para que un 401
// clasificado aquí y uno clasificado en el editor cuenten la misma historia (`haySesionCaducada`
// de `api-client.ts` sigue siendo la única fuente de verdad de «la sesión caducó»).
//
// Ninguna función de aquí se traga un error: toda respuesta no-2xx se clasifica y se lanza, nunca
// se devuelve `null`/`undefined` en su lugar — se reutilizan `ApiError`, `SessionError` y
// `UnknownApiError` de `./errors.ts`, exactamente como hace `peticion()` en `api-client.ts`. Un
// 401/403 se clasifica como `SessionError` tanto si el cuerpo es el `TplErrorResponse` de
// `templates2` como si es el `ErrorMessage` heredado (`core/error/model/ErrorMessage.kt`) que usa
// la ruta de alternar estado: los dos carecen de forma reconocible en el otro esquema, así que
// caen al mismo camino de «401/403 sin `code` TPL_*» que ya usa `peticion()`.
//
// Cero agregados en el frontend: cada función devuelve la respuesta del backend tal cual la
// tipa `./tipos.ts`, sin sumar, promediar ni derivar nada en TypeScript — las métricas y los
// contadores ya vienen calculados del servidor (encargo de E5-B, regla dura).
import { ApiError, SessionError, TplErrorResponseSchema, UnknownApiError } from "../errors.ts";
import { getApiBaseUrl, getAuthToken } from "../api-client.ts";
import type {
  AlternarEstadoInvitacionResponse,
  ClientasQuery,
  InvitacionesQuery,
  ListaPlanes,
  ListaPlantillas,
  MetricasAdmin,
  PaginaClientas,
  PaginaInvitaciones,
  PaginaPagos,
  PagosQuery,
} from "./tipos.ts";

// -------------------------------------------------------------------------------------------
// Construcción de la cadena de consulta — mismo comportamiento que `construirQuery` en
// `api-client.ts`: `URLSearchParams`, omitiendo los parámetros `undefined` (un valor vacío `""`
// SÍ se manda: es la forma en que el backend recibe «buscar= sin filtro», contrato §2).
// -------------------------------------------------------------------------------------------
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

/**
 * El mismo pipeline de clasificación de `peticion()` en `api-client.ts`, reducido a lo que esta
 * carpeta necesita: todas las rutas de `/product/admin/**` son `GET` sin cuerpo, salvo
 * `alternarEstadoInvitacion`, que es un `PUT` sin cuerpo tampoco. Ninguna manda JSON de entrada,
 * así que no hace falta `quitarNulos` ni límite de bytes aquí.
 */
async function peticionAdmin<T>(method: "GET" | "PUT", path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const url = `${getApiBaseUrl()}${path}${construirQuery(query)}`;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const respuesta = await fetch(url, { method, headers, cache: "no-store" });
  const textoCrudo = await respuesta.text();

  if (respuesta.ok) {
    return (textoCrudo.length > 0 ? (JSON.parse(textoCrudo) as T) : (undefined as T));
  }

  let cuerpoParseado: unknown;
  try {
    cuerpoParseado = textoCrudo.length > 0 ? JSON.parse(textoCrudo) : undefined;
  } catch {
    cuerpoParseado = undefined;
  }

  const comoErrorTpl = TplErrorResponseSchema.safeParse(cuerpoParseado);
  if (comoErrorTpl.success && comoErrorTpl.data.code.startsWith("TPL_")) {
    throw new ApiError(comoErrorTpl.data, respuesta.status);
  }

  // 401/403 de la cadena de filtros de Spring Security, o del `ErrorMessage` heredado sin `code`
  // TPL_* (p. ej. `UnauthorizedAccessException` en `toggleInvitationStatus`): SessionError.
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new SessionError(respuesta.status, textoCrudo);
  }

  throw new UnknownApiError(respuesta.status, textoCrudo);
}

// =============================================================================================
// 1. GET /product/admin/metricas
// =============================================================================================
export async function obtenerMetricas(): Promise<MetricasAdmin> {
  return peticionAdmin<MetricasAdmin>("GET", "/product/admin/metricas");
}

// =============================================================================================
// 2. GET /product/admin/clientas?pagina=&tamano=&buscar=
// =============================================================================================
export async function listarClientas(query?: ClientasQuery): Promise<PaginaClientas> {
  return peticionAdmin<PaginaClientas>(
    "GET",
    "/product/admin/clientas",
    query as Record<string, string | number | undefined> | undefined,
  );
}

// =============================================================================================
// 3. GET /product/admin/invitaciones?pagina=&tamano=&buscar=&estado=&pago=
// =============================================================================================
export async function listarInvitaciones(query?: InvitacionesQuery): Promise<PaginaInvitaciones> {
  return peticionAdmin<PaginaInvitaciones>(
    "GET",
    "/product/admin/invitaciones",
    query as Record<string, string | number | undefined> | undefined,
  );
}

// =============================================================================================
// 4. PUT /admin/invitations/{id}/toggle-status — ruta HEREDADA, reutilizada tal cual
//    (`InvitationController.kt:127-141`, decisión REUTILIZAR de `12-producto-completo.md §A2.5`).
//    Verificado leyendo el fuente (sin backend levantado en este entorno para un curl real):
//    - No pide cuerpo: solo `@PathVariable id` y la `Authentication` del token.
//    - Comprueba jerarquía SÍ: `InvitationAdminService.kt:461` llama
//      `hierarchyValidationService.validateInvitationAccess(loggedInUserId, invitationId)` y lanza
//      `UnauthorizedAccessException` (→ 403) si no pasa. No es un hallazgo: la comprobación existe.
//    - Devuelve `InvitationResponse` (`status`, `message`, `invitation`), NO indica en la respuesta
//      si quedó habilitada o deshabilitada más que en el texto de `message` — ver el comentario de
//      `InvitacionHeredada` en `./tipos.ts`.
// =============================================================================================
export async function alternarEstadoInvitacion(invitacionId: number): Promise<AlternarEstadoInvitacionResponse> {
  return peticionAdmin<AlternarEstadoInvitacionResponse>("PUT", `/admin/invitations/${invitacionId}/toggle-status`);
}

// =============================================================================================
// 5. GET /product/admin/pagos?pagina=&tamano=&estado=
// =============================================================================================
export async function listarPagos(query?: PagosQuery): Promise<PaginaPagos> {
  return peticionAdmin<PaginaPagos>(
    "GET",
    "/product/admin/pagos",
    query as Record<string, string | number | undefined> | undefined,
  );
}

// =============================================================================================
// 6. GET /product/admin/planes
// =============================================================================================
export async function listarPlanes(): Promise<ListaPlanes> {
  return peticionAdmin<ListaPlanes>("GET", "/product/admin/planes");
}

// =============================================================================================
// 7. GET /product/admin/plantillas
// =============================================================================================
export async function listarPlantillas(): Promise<ListaPlantillas> {
  return peticionAdmin<ListaPlantillas>("GET", "/product/admin/plantillas");
}
