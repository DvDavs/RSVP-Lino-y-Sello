// lib/api-client.ts — ÚNICO cliente HTTP tipado contra las 20 rutas de `03-api.md`. El token de
// sesión vive SOLO aquí (P8, contratos §8 C4): ninguna otra parte de `apps/web` lee ni escribe el
// token, y el lienzo (`app/(canvas)/**`) tiene prohibido importar este archivo (ver
// `eslint.config.mjs`, regla sobre `apps/web/app/(canvas)/**`).
//
// Todas las funciones exportadas son una por ruta (o por acción HTTP de una ruta, cuando la ruta
// puede devolver 2xx en dos formas distintas). Ninguna función se traga un error: toda respuesta
// no-2xx se clasifica y se lanza (`ApiError` | `SessionError` | `UnknownApiError`), nunca se
// devuelve `null`/`undefined` en su lugar.
import { OperationBatch } from "@invitaciones/schema";
import {
  ApiClientValidationError,
  ApiError,
  SessionError,
  TplErrorResponseSchema,
  UnknownApiError,
} from "./errors.ts";
import type {
  AssetListQuery,
  AssetListResponse,
  AssetUploadResponse,
  AuthPasswordResetRequest,
  AuthPasswordResetResponse,
  AuthSignupRequest,
  AuthTokenRequest,
  AuthTokenResponse,
  CatalogQuery,
  CatalogResponse,
  ChooseTemplateRequest,
  ChooseTemplateResponse,
  DeprecateTemplateVersionResponse,
  GetDocumentResponse,
  HistoryPageResponse,
  HistoryQuery,
  ListTemplateVersionsQuery,
  ListTemplateVersionsResponse,
  OperationBatchRequest,
  OperationBatchResponse,
  PreflightResponse,
  PublicExistsResponse,
  PublicRenderResult,
  PublishRequest,
  PublishResponse,
  RegisterTemplateResponse,
  ReleaseListQuery,
  ReleaseListResponse,
  RestoreRequest,
  RestoreResponse,
  RotateTokenResponse,
  SetEventRequest,
  SetEventResponse,
} from "./api-types.ts";

// -------------------------------------------------------------------------------------------
// Configuración de base
// -------------------------------------------------------------------------------------------

/**
 * `NEXT_PUBLIC_API_BASE_URL` — pública a propósito: el editor llama al backend desde el navegador
 * (auth por header `Authorization`, no por cookie de mismo origen). El defecto es el puerto de
 * `scripts/dev-backend.sh` (`handoffs/3-0a.md` §1).
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:6003";
}

// Límites de cuerpo de `03-api.md` §8 / `contratos.md` §4 (ADR-032, ADR-1R-B-14).
export const OPERATIONS_BODY_LIMIT_BYTES = 768 * 1024;
export const DEFAULT_JSON_BODY_LIMIT_BYTES = 8 * 1024;
export const ASSET_MAX_BYTES = 15 * 1024 * 1024;

// -------------------------------------------------------------------------------------------
// Token de sesión — ÚNICO lugar del proyecto que lo toca (P8).
// -------------------------------------------------------------------------------------------

const TOKEN_STORAGE_KEY = "invitaciones.auth.token";
let tokenEnMemoria: string | null = null;

/**
 * U-1 — la clienta se atascó porque el editor decía «Inicia sesión de nuevo» y **no había dónde**.
 * Para poder ofrecerle el botón hay que distinguir «nunca entró» de «su sesión caducó», y eso solo
 * lo sabe el único sitio que ve los 401: este archivo. `lib/store.ts` clasifica el `SessionError`
 * como `loadState: "error"` genérico y NO se puede tocar en este bloque (lo está editando otro
 * agente), así que la señal viaja por aquí en vez de por el store.
 */
let sesionCaducada = false;

/** ¿El último 401/403 del backend invalidó la sesión que teníamos? */
export function haySesionCaducada(): boolean {
  return sesionCaducada;
}

/** Se llama desde `peticion()`/`uploadAsset()` al clasificar un 401/403 sin código `TPL_*`. */
export function marcarSesionCaducada(): void {
  // Solo es «caducada» si de verdad había token: sin token es «todavía no ha entrado».
  sesionCaducada = getAuthToken() !== null;
  // El token que ya no vale se tira: dejarlo puesto hace que cada ruta vuelva a fallar igual y que
  // la pantalla de acceso no sepa que hay que volver a entrar.
  if (sesionCaducada) clearAuthToken();
}

/** Solo en el navegador: RSC no debe leer `sessionStorage`, y no lo necesita (rutas públicas). */
function sessionStorageSiDisponible(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    // Ventana privada / almacenamiento bloqueado: se degrada a memoria de la pestaña actual.
    return null;
  }
}

export function setAuthToken(token: string): void {
  tokenEnMemoria = token;
  sesionCaducada = false;
  try {
    sessionStorageSiDisponible()?.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Cuota excedida u otro fallo de almacenamiento: el token sigue vivo en memoria para esta pestaña.
  }
}

export function getAuthToken(): string | null {
  if (tokenEnMemoria) return tokenEnMemoria;
  try {
    const guardado = sessionStorageSiDisponible()?.getItem(TOKEN_STORAGE_KEY) ?? null;
    tokenEnMemoria = guardado;
    return guardado;
  } catch {
    return null;
  }
}

export function clearAuthToken(): void {
  tokenEnMemoria = null;
  try {
    sessionStorageSiDisponible()?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // nada que limpiar si el almacenamiento no está disponible
  }
}

// -------------------------------------------------------------------------------------------
// Utilidades internas
// -------------------------------------------------------------------------------------------

/**
 * Un campo `null` cuenta como ausente en el backend (`handoffs/3-0a.md` §4) y los esquemas son
 * `strictObject` (clave desconocida ⇒ rechazo). Nunca hay que enviar un opcional como `null`:
 * se elimina la clave entera antes de serializar, recursivamente.
 */
function quitarNulos<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => quitarNulos(v)) as unknown as T;
  }
  if (valor !== null && typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === null || v === undefined) continue;
      salida[clave] = quitarNulos(v);
    }
    return salida as T;
  }
  return valor;
}

function bytesUtf8(texto: string): number {
  return new TextEncoder().encode(texto).length;
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

interface OpcionesPeticion {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | undefined>;
  /** Se limpia de nulos y se serializa a JSON; se comprueba contra `bodyLimitBytes` antes de enviar. */
  jsonBody?: unknown;
  bodyLimitBytes?: number;
  /** Cuerpo binario crudo (§3.7): nunca `multipart/form-data`. */
  rawBody?: { data: BodyInit; contentType: string };
  /** `POST /master/templates2/versions` es la única ruta multipart (§3.17). */
  formBody?: FormData;
  auth?: boolean; // por defecto true; false en las dos rutas públicas
  ifNoneMatch?: string;
  /** Extensión de caché de datos de Next.js (§15.1): solo tiene efecto en fetch del lado servidor. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

interface RespuestaCruda<T> {
  status: number;
  etag: string | null;
  data: T | undefined;
}

async function peticion<T>(opciones: OpcionesPeticion): Promise<RespuestaCruda<T>> {
  const url = `${getApiBaseUrl()}${opciones.path}${construirQuery(opciones.query)}`;
  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (opciones.auth !== false) {
    const token = getAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (opciones.ifNoneMatch) headers.set("If-None-Match", opciones.ifNoneMatch);

  let body: BodyInit | undefined;
  if (opciones.jsonBody !== undefined) {
    const limpio = quitarNulos(opciones.jsonBody);
    const serializado = JSON.stringify(limpio);
    const limite = opciones.bodyLimitBytes ?? DEFAULT_JSON_BODY_LIMIT_BYTES;
    const tamano = bytesUtf8(serializado);
    if (tamano > limite) {
      throw new ApiClientValidationError(
        `El cuerpo de ${opciones.method} ${opciones.path} pesa ${tamano} bytes y el límite de la ruta es ${limite} bytes (03-api.md §8). No se envió la petición.`,
      );
    }
    headers.set("Content-Type", "application/json");
    body = serializado;
  } else if (opciones.rawBody) {
    headers.set("Content-Type", opciones.rawBody.contentType);
    body = opciones.rawBody.data;
  } else if (opciones.formBody) {
    // NO se fija Content-Type: el navegador añade el boundary de multipart automáticamente.
    body = opciones.formBody;
  }

  const respuesta = await fetch(url, {
    method: opciones.method,
    headers,
    body,
    cache: opciones.cache ?? "no-store",
    ...(opciones.next ? { next: opciones.next } : {}),
  });

  const etag = respuesta.headers.get("ETag");

  if (respuesta.status === 304) {
    return { status: 304, etag, data: undefined };
  }

  if (respuesta.status === 204) {
    return { status: 204, etag, data: undefined };
  }

  const textoCrudo = await respuesta.text();

  if (respuesta.ok) {
    const data = textoCrudo.length > 0 ? (JSON.parse(textoCrudo) as T) : undefined;
    return { status: respuesta.status, etag, data };
  }

  // No-2xx: se clasifica SIEMPRE por su `code` (P1). Nunca se descarta el cuerpo en silencio.
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

  // `handoffs/2-5.md`: 401/403 de la cadena de filtros de Spring Security no llevan `code` TPL_*.
  if (respuesta.status === 401 || respuesta.status === 403) {
    marcarSesionCaducada();
    throw new SessionError(respuesta.status, textoCrudo);
  }

  throw new UnknownApiError(respuesta.status, textoCrudo);
}

// =============================================================================================
// 1. GET /editor/templates2/catalog
// =============================================================================================
export async function getCatalog(query?: CatalogQuery): Promise<CatalogResponse> {
  const r = await peticion<CatalogResponse>({
    method: "GET",
    path: "/editor/templates2/catalog",
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return r.data as CatalogResponse;
}

// =============================================================================================
// 2. POST /editor/invitations/{invitationId}/document:choose-template
// =============================================================================================
export async function chooseTemplate(
  invitationId: number,
  body: ChooseTemplateRequest,
): Promise<ChooseTemplateResponse> {
  const r = await peticion<ChooseTemplateResponse>({
    method: "POST",
    path: `/editor/invitations/${invitationId}/document:choose-template`,
    jsonBody: body,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
  });
  return r.data as ChooseTemplateResponse;
}

// =============================================================================================
// 3. GET /editor/invitations/{invitationId}/document
// =============================================================================================
export async function getDocument(invitationId: number): Promise<GetDocumentResponse> {
  const r = await peticion<GetDocumentResponse>({
    method: "GET",
    path: `/editor/invitations/${invitationId}/document`,
  });
  return r.data as GetDocumentResponse;
}

// =============================================================================================
// 4. POST /editor/invitations/{invitationId}/document/operations
// =============================================================================================
/**
 * `clientBatchId` y `baseRevision` son obligatorios (contratos.md §4). Se valida el lote completo
 * contra `OperationBatch` de `@invitaciones/schema` ANTES de enviar: mismo esquema que usa el
 * reductor del servidor, así que un lote malformado falla aquí con un mensaje claro en vez de
 * viajar y volver como `400 TPL_MALFORMED_JSON`.
 */
export async function postOperations(
  invitationId: number,
  body: OperationBatchRequest,
): Promise<OperationBatchResponse> {
  const validado = OperationBatch.safeParse(body);
  if (!validado.success) {
    throw new ApiClientValidationError(
      `OperationBatch inválido antes de enviar: ${validado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const r = await peticion<OperationBatchResponse>({
    method: "POST",
    path: `/editor/invitations/${invitationId}/document/operations`,
    jsonBody: body,
    bodyLimitBytes: OPERATIONS_BODY_LIMIT_BYTES,
  });
  return r.data as OperationBatchResponse;
}

// =============================================================================================
// 5. GET /editor/invitations/{invitationId}/document/history
// =============================================================================================
export async function getHistory(invitationId: number, query?: HistoryQuery): Promise<HistoryPageResponse> {
  const r = await peticion<HistoryPageResponse>({
    method: "GET",
    path: `/editor/invitations/${invitationId}/document/history`,
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return r.data as HistoryPageResponse;
}

// =============================================================================================
// 6. POST /editor/invitations/{invitationId}/document/restore
// =============================================================================================
export async function restoreRevision(invitationId: number, body: RestoreRequest): Promise<RestoreResponse> {
  const r = await peticion<RestoreResponse>({
    method: "POST",
    path: `/editor/invitations/${invitationId}/document/restore`,
    jsonBody: body,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
  });
  return r.data as RestoreResponse;
}

// =============================================================================================
// 7. POST /editor/invitations/{invitationId}/assets — cuerpo binario crudo (§3.7, ADR-1R-B-12)
// =============================================================================================
export interface SubirAssetInput {
  data: BodyInit;
  contentType: string;
  /** Bytes exactos del cuerpo, si se conocen: activa la comprobación local de 15 MiB (§8). */
  bytes?: number;
  /** Opcional, solo para derivar la extensión (`X-Asset-Filename`, §3.7). */
  filename?: string;
}
export async function uploadAsset(invitationId: number, input: SubirAssetInput): Promise<AssetUploadResponse> {
  if (input.bytes !== undefined && input.bytes > ASSET_MAX_BYTES) {
    throw new ApiClientValidationError(
      `El archivo pesa ${input.bytes} bytes; el límite es ${ASSET_MAX_BYTES} bytes (03-api.md §3.7). No se envió la petición.`,
    );
  }
  const path = `/editor/invitations/${invitationId}/assets`;
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers({ "Content-Type": input.contentType, Accept: "application/json" });
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (input.filename) headers.set("X-Asset-Filename", input.filename);

  const respuesta = await fetch(url, { method: "POST", headers, body: input.data, cache: "no-store" });
  const texto = await respuesta.text();
  if (respuesta.ok) {
    return JSON.parse(texto) as AssetUploadResponse;
  }
  let cuerpo: unknown;
  try {
    cuerpo = texto.length > 0 ? JSON.parse(texto) : undefined;
  } catch {
    cuerpo = undefined;
  }
  const comoErrorTpl = TplErrorResponseSchema.safeParse(cuerpo);
  if (comoErrorTpl.success && comoErrorTpl.data.code.startsWith("TPL_")) {
    throw new ApiError(comoErrorTpl.data, respuesta.status);
  }
  if (respuesta.status === 401 || respuesta.status === 403) {
    marcarSesionCaducada();
    throw new SessionError(respuesta.status, texto);
  }
  throw new UnknownApiError(respuesta.status, texto);
}

// =============================================================================================
// 8. GET /editor/invitations/{invitationId}/assets
// =============================================================================================
export async function listAssets(invitationId: number, query?: AssetListQuery): Promise<AssetListResponse> {
  const r = await peticion<AssetListResponse>({
    method: "GET",
    path: `/editor/invitations/${invitationId}/assets`,
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return r.data as AssetListResponse;
}

// =============================================================================================
// 9. DELETE /editor/invitations/{invitationId}/assets/{assetId}
// =============================================================================================
export async function deleteAsset(invitationId: number, assetId: string): Promise<void> {
  await peticion<void>({ method: "DELETE", path: `/editor/invitations/${invitationId}/assets/${assetId}` });
}

// =============================================================================================
// 10. GET /editor/invitations/{invitationId}/release/preflight
// =============================================================================================
export async function getPreflight(invitationId: number): Promise<PreflightResponse> {
  const r = await peticion<PreflightResponse>({
    method: "GET",
    path: `/editor/invitations/${invitationId}/release/preflight`,
  });
  return r.data as PreflightResponse;
}

// =============================================================================================
// 11. POST /editor/invitations/{invitationId}/release
// =============================================================================================
export async function publishRelease(invitationId: number, body: PublishRequest): Promise<PublishResponse> {
  const r = await peticion<PublishResponse>({
    method: "POST",
    path: `/editor/invitations/${invitationId}/release`,
    jsonBody: body,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
  });
  return r.data as PublishResponse;
}

// =============================================================================================
// 12. DELETE /editor/invitations/{invitationId}/release
// =============================================================================================
export async function unpublishRelease(invitationId: number): Promise<void> {
  await peticion<void>({ method: "DELETE", path: `/editor/invitations/${invitationId}/release` });
}

// =============================================================================================
// 13. GET /editor/invitations/{invitationId}/releases
// =============================================================================================
export async function getReleases(invitationId: number, query?: ReleaseListQuery): Promise<ReleaseListResponse> {
  const r = await peticion<ReleaseListResponse>({
    method: "GET",
    path: `/editor/invitations/${invitationId}/releases`,
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return r.data as ReleaseListResponse;
}

// =============================================================================================
// 14. POST /editor/invitations/{invitationId}/public-token:rotate
// =============================================================================================
export async function rotatePublicToken(invitationId: number): Promise<RotateTokenResponse> {
  const r = await peticion<RotateTokenResponse>({
    method: "POST",
    path: `/editor/invitations/${invitationId}/public-token:rotate`,
  });
  return r.data as RotateTokenResponse;
}

// =============================================================================================
// 15. GET /public/i/{publicToken}/render — SIN auth. Soporta ETag/If-None-Match → 304 (§7).
// =============================================================================================
export interface OpcionesRenderPublico {
  ifNoneMatch?: string;
  /** Solo tiene efecto en un fetch del lado servidor (RSC), p. ej. `/i/[publicToken]` (§15.1). */
  next?: { revalidate?: number | false; tags?: string[] };
}
export async function getPublicRender(
  publicToken: string,
  opciones: OpcionesRenderPublico = {},
): Promise<PublicRenderResult> {
  const r = await peticion<import("./api-types.ts").PublicRenderResponse>({
    method: "GET",
    path: `/public/i/${publicToken}/render`,
    auth: false,
    ifNoneMatch: opciones.ifNoneMatch,
    next: opciones.next,
    // CORRECCIÓN del bloque 3-3 (medida, `bitacora/3-3.md` §4). Dejar `cache` sin fijar NO era
    // neutro: `peticion()` lo rellena con `cache: "no-store"` por defecto (línea 213), y en Next 16
    // `no-store` GANA sobre `next.revalidate`. Efecto real: el fetch no entraba en el Data Cache,
    // la petición marcaba el render como dinámico y `/i/[publicToken]` respondía
    // `500 DYNAMIC_SERVER_USAGE` en cuanto la ruta se generaba de forma estática — el `revalidate:
    // 300` y el `revalidateTag` de `04 §15.1/§15.2` no llegaban a ejercerse nunca.
    // Con `next` presente se pide explícitamente el Data Cache; sin él se conserva el `no-store`
    // (ese camino lo usa quien quiera la respuesta fresca con el `Cache-Control` del backend).
    cache: opciones.next ? ("force-cache" as RequestCache) : ("no-store" as RequestCache),
  });
  if (r.status === 304) return { status: "not-modified", etag: r.etag };
  return { status: "ok", data: r.data as import("./api-types.ts").PublicRenderResponse, etag: r.etag };
}

// =============================================================================================
// 16. GET /public/i/{publicToken}/exists — SIN auth, `no-store` (§3.16)
// =============================================================================================
export async function getPublicExists(publicToken: string): Promise<PublicExistsResponse> {
  const r = await peticion<PublicExistsResponse>({
    method: "GET",
    path: `/public/i/${publicToken}/exists`,
    auth: false,
    cache: "no-store",
  });
  return r.data as PublicExistsResponse;
}

// =============================================================================================
// 17. POST /master/templates2/versions — rol MASTER, multipart (única ruta multipart, §3.17)
// =============================================================================================
export async function registerTemplateVersion(formData: FormData): Promise<RegisterTemplateResponse> {
  const r = await peticion<RegisterTemplateResponse>({
    method: "POST",
    path: "/master/templates2/versions",
    formBody: formData,
  });
  return r.data as RegisterTemplateResponse;
}

// =============================================================================================
// 18. GET /master/templates2/versions — rol MASTER
// =============================================================================================
export async function listTemplateVersions(
  query?: ListTemplateVersionsQuery,
): Promise<ListTemplateVersionsResponse> {
  const r = await peticion<ListTemplateVersionsResponse>({
    method: "GET",
    path: "/master/templates2/versions",
    query: query as Record<string, string | number | undefined> | undefined,
  });
  return r.data as ListTemplateVersionsResponse;
}

// =============================================================================================
// 19. POST /master/templates2/versions/{templateVersionId}:deprecate — rol MASTER
// =============================================================================================
export async function deprecateTemplateVersion(
  templateVersionId: number,
): Promise<DeprecateTemplateVersionResponse> {
  const r = await peticion<DeprecateTemplateVersionResponse>({
    method: "POST",
    path: `/master/templates2/versions/${templateVersionId}:deprecate`,
  });
  return r.data as DeprecateTemplateVersionResponse;
}

// =============================================================================================
// 20. PUT /editor/invitations/{invitationId}/event — la fecha del evento (§3.20, I-06)
// =============================================================================================
/**
 * La ÚNICA ruta de cliente que escribe `invitation.date`. Hasta la fase 3-B sólo existía la de
 * administración (`PUT /admin/invitations/{id}`, rol ADMIN), así que la clienta no podía cambiar la
 * fecha de su propio evento por ninguna vía y el editor la enseñaba con candado (U-3).
 *
 * El backend valida el formato y responde `422 TPL_EVENT_DATE_INVALID` con `details.field`; aquí no
 * se duplica esa validación (sería H-27 otra vez, dos validadores que divergen). Lo único que se
 * hace en el cliente es no enviar `time` cuando no hay hora que cambiar (`quitarNulos`).
 */
export async function setEvent(invitationId: number, body: SetEventRequest): Promise<SetEventResponse> {
  const r = await peticion<SetEventResponse>({
    method: "PUT",
    path: `/editor/invitations/${invitationId}/event`,
    jsonBody: body,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
  });
  return r.data as SetEventResponse;
}

// =============================================================================================
// Auth (modules/auth, reusado — no es parte de templates2, pero el JWT sale de aquí, 03 preámbulo
// y handoffs/2-5.md). `authLogin` es la única función que ESCRIBE el token (vía `setAuthToken`).
// =============================================================================================
export async function authLogin(credenciales: AuthTokenRequest): Promise<AuthTokenResponse> {
  const r = await peticion<AuthTokenResponse>({
    method: "POST",
    path: "/auth/token",
    jsonBody: credenciales,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
    auth: false,
  });
  const data = r.data as AuthTokenResponse;
  if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
    setAuthToken(data.accessToken);
  }
  return data;
}

/**
 * `POST /auth/signup` — la otra puerta de `/acceso` (pestaña «Crear cuenta», 11 §7). Añadida en la
 * fase 3-C sin tocar `authLogin` ni el almacenamiento del token: escribe el token por el MISMO
 * `setAuthToken` y por ninguna otra vía, así que P8 (contratos §8 C4, «el token vive solo en este
 * archivo») sigue siendo cierto con dos funciones que lo escriben en lugar de una.
 *
 * El backend responde `TokenResponse` idéntico al de `/auth/token`: quien se registra queda dentro,
 * sin un segundo formulario de acceso que rellenar.
 */
export async function authSignup(datos: AuthSignupRequest): Promise<AuthTokenResponse> {
  const r = await peticion<AuthTokenResponse>({
    method: "POST",
    path: "/auth/signup",
    jsonBody: datos,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
    auth: false,
  });
  const data = r.data as AuthTokenResponse;
  if (typeof data.accessToken === "string" && data.accessToken.length > 0) {
    setAuthToken(data.accessToken);
  }
  return data;
}

/**
 * `POST /auth/request-password-reset` — recuperación de contraseña. NO escribe token ni sesión.
 *
 * La interfaz que la llama enseña SIEMPRE la misma frase pase lo que pase («Si el correo
 * corresponde a una cuenta…»): el backend ya no devuelve el token de recuperación
 * (`ADR-3C-N01-01`), y distinguir en pantalla un 200 de un 404 volvería a convertir este extremo
 * `permitAll` en un enumerador de correos registrados.
 */
export async function authRequestPasswordReset(
  datos: AuthPasswordResetRequest,
): Promise<AuthPasswordResetResponse> {
  const r = await peticion<AuthPasswordResetResponse>({
    method: "POST",
    path: "/auth/request-password-reset",
    jsonBody: datos,
    bodyLimitBytes: DEFAULT_JSON_BODY_LIMIT_BYTES,
    auth: false,
  });
  return (r.data ?? { message: "" }) as AuthPasswordResetResponse;
}

/**
 * `GET /user/invitations/all` — las invitaciones que YA tiene el cliente (módulo `user`, antiguo;
 * no es una de las 19 rutas de `03-api.md`, igual que `/auth/token` de arriba).
 *
 * Por qué entra aquí (U-2, U-19): en el producto real **una invitación nace de una compra**, no del
 * catálogo — `templates2` no crea invitaciones (ADR-2-4-02, `handoffs/3-0a.md` §3) y ninguna de sus
 * 19 rutas lo hace. Sin esta lista, `/editor` no puede saber a QUÉ invitación aplicar la plantilla
 * que la clienta elige, y el botón «Elegir esta plantilla» no puede dejar de ser un botón muerto.
 *
 * Forma verificada contra `InvitationResponse.kt:3` (`InvitationResponseItem`). Se tipa solo lo que
 * la interfaz usa; el resto de campos del DTO viajan y se ignoran.
 */
export interface InvitacionDelCliente {
  id: number;
  status: string;
  event: string;
  plan: string;
  /** `YYYY-MM-DD` tal cual lo guarda `invitation.date`; puede venir vacía. */
  date: string;
  time: string;
}
export async function listarInvitaciones(): Promise<InvitacionDelCliente[]> {
  const r = await peticion<InvitacionDelCliente[]>({ method: "GET", path: "/user/invitations/all" });
  return (r.data ?? []) as InvitacionDelCliente[];
}

export { ApiError, ApiClientValidationError, SessionError, UnknownApiError } from "./errors.ts";
export type { ApiClientError, TplErrorCode, TplErrorResponse } from "./errors.ts";
