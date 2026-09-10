// lib/admin/cliente.ts — una función por ruta del contrato `/product/admin/**`
// (`scratchpad/contrato-admin.md`), más `alternarEstadoInvitacion` para la ruta heredada que
// reutiliza la §4. Sigue el mismo patrón que `lib/api-client.ts` (léelo antes de tocar esto).
//
// EL TOKEN DE SESIÓN VIVE SOLO EN `lib/api-client.ts` (P8, `contratos.md §8 C4`). Este fichero NO
// lee ni escribe `sessionStorage` ni memoria propia: importa el accesor ya exportado
// `getAuthToken()` y la base `getApiBaseUrl()` de `./api-client.ts` y los usa tal cual. Un 401/403
// clasificado aquí llama a `marcarSesionCaducada()` (exportada de `./api-client.ts` para esto),
// igual que hace `peticion()` en la línea equivalente — es el mismo sitio, por eso un 401
// clasificado aquí y uno clasificado en el editor cuentan la misma historia: `haySesionCaducada()`
// de `api-client.ts` es la única fuente de verdad de «la sesión caducó», y `clearAuthToken()` tira
// el token muerto para que la pantalla de acceso sepa que hay que volver a entrar (ADR-5-E5-02).
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
import { getApiBaseUrl, getAuthToken, marcarSesionCaducada } from "../api-client.ts";
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

  let respuesta: Response;
  try {
    respuesta = await fetch(url, { method, headers, cache: "no-store" });
  } catch (error) {
    // `fetch` rechaza (red caída, DNS, CORS…): `TypeError` crudo ("Failed to fetch"), ninguno de
    // los tres tipos de `./errors.ts`. Se reclasifica para que un `catch (e) { if (e instanceof
    // SessionError) … }` no se quede sin pintar nada (5-E5-R1 MEDIA-2; mismo hueco sin cerrar en
    // `peticion()` de `api-client.ts:259`, aquí sí hay margen para cerrarlo). Sin `statusCode` HTTP
    // real que conservar: se usa `0` como marca de "no hubo respuesta".
    throw new UnknownApiError(0, error instanceof Error ? error.message : String(error));
  }
  const textoCrudo = await respuesta.text();

  if (respuesta.ok) {
    if (textoCrudo.length === 0) return undefined as T;
    try {
      return JSON.parse(textoCrudo) as T;
    } catch {
      // 2xx con cuerpo que no es JSON (p. ej. HTML de un proxy delante del backend): `SyntaxError`
      // crudo de `JSON.parse`, ninguno de los tres tipos de `./errors.ts`. Las siete rutas del
      // contrato siempre responden JSON en 2xx, así que esto es una anomalía de transporte, no un
      // caso normal (5-E5-R1 MEDIA-2).
      throw new UnknownApiError(respuesta.status, textoCrudo);
    }
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
  // TPL_* (p. ej. `UnauthorizedAccessException` en `toggleInvitationStatus`): los dos se lanzan como
  // `SessionError`, pero NO cuentan la misma historia y no se tratan igual (arreglo de seguimiento,
  // hallazgo MEDIA-1 de la revisión de autorización, `lib/admin/cliente.ts:113-116` de la versión
  // anterior).
  //
  // 401 → la sesión de verdad no vale (sin token, o el backend ya no lo reconoce): se marca caducada
  // ANTES de lanzar (misma línea que `peticion()` en `api-client.ts`), para que `haySesionCaducada()`
  // — la única fuente de verdad de P8 — se encienda y `clearAuthToken()` tire el token muerto; si no
  // se hace esto aquí, `/acceso` cree que sigue habiendo sesión válida (ADR-5-E5-02).
  //
  // 403 → la sesión SIGUE SIENDO VÁLIDA; lo que falta es permiso para ESTA operación concreta — un
  // rol insuficiente para `/product/admin/**` entero, o (`alternarEstadoInvitacion`) un ADMIN que
  // toca una invitación fuera de su jerarquía (`hierarchyValidationService.validateInvitationAccess`,
  // `InvitationAdminService.kt:479-481` — no `:461`, cita corregida). Tirar el token aquí expulsaba
  // a una cuenta con sesión perfectamente buena solo porque una acción puntual le estaba prohibida.
  // Se lanza el mismo `SessionError` (quien llama ya distingue por `statusCode`), pero SIN marcar la
  // sesión como caducada ni tocar el token.
  if (respuesta.status === 401) {
    marcarSesionCaducada();
    throw new SessionError(401, textoCrudo);
  }
  if (respuesta.status === 403) {
    throw new SessionError(403, textoCrudo);
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
// 3. GET /product/admin/invitaciones?pagina=&tamano=&buscar=&estado=&pago=&plan=
//    `plan` es el id del plan (no el nombre), añadido por el backend en el commit `de79915`
//    mientras se montaba esta pantalla (`bitacora/5-E5-A.md §1.1.bis`) — ver el comentario de
//    `InvitacionesQuery.plan` en `./tipos.ts`.
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
//    - Comprueba jerarquía SÍ: `InvitationAdminService.kt:479-481` llama
//      `hierarchyValidationService.validateInvitationAccess(loggedInUserId, invitationId)` y lanza
//      `UnauthorizedAccessException` (→ 403) si no pasa. No es un hallazgo: la comprobación existe.
//      (Cita corregida — la cabecera de esta función decía `:461`, arreglo de seguimiento.)
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
