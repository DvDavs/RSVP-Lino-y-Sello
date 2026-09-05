// lib/errors.ts — el cuerpo de error del módulo `templates2` (03-api.md §5) y su clasificación.
// `TplErrorResponse` NO vive en `@invitaciones/schema`: es un contrato de transporte HTTP del
// backend (Kotlin), no del documento de dominio, así que no pertenece a la fuente de esquema
// compartida (P1 se satisface tipando el cuerpo aquí, en el único cliente HTTP, no duplicándolo).
import { z } from "zod";

/**
 * Los 36 códigos `TPL_*` de `03-api.md` §5 (`enum TplErrorCode`, fuente única en Kotlin). El
 * prefijo `TPL_AI_*` está reservado y sin listar (X-14): no hay rutas de IA implementadas.
 */
export const TPL_ERROR_CODES = [
  "TPL_FORBIDDEN",
  "TPL_NOT_MIGRATED",
  "TPL_DOCUMENT_NOT_STARTED",
  "TPL_TEMPLATE_VERSION_NOT_FOUND",
  "TPL_PLAN_TIER_INSUFFICIENT",
  "TPL_MIGRATION_PLAN_MISSING",
  "TPL_REVISION_CONFLICT",
  "TPL_OPERATION_INVALID",
  "TPL_BLOCK_UNKNOWN",
  "TPL_BLOCK_NOT_EDITABLE",
  "TPL_TEMP_ID_UNRESOLVED",
  "TPL_TEMP_ID_DUPLICATE",
  "TPL_ASSET_NOT_OWNED",
  "TPL_ASSET_SPEC_MISMATCH",
  "TPL_ASSET_NOT_FOUND",
  "TPL_ASSET_IN_USE",
  "TPL_ASSET_TOO_LARGE",
  "TPL_ASSET_TYPE_UNSUPPORTED",
  "TPL_ASSET_QUOTA_EXCEEDED",
  "TPL_ASSET_STORAGE_UNAVAILABLE",
  "TPL_DOCUMENT_TOO_LARGE",
  "TPL_EVENT_DATE_INVALID",
  "TPL_BODY_TOO_LARGE",
  "TPL_MALFORMED_JSON",
  "TPL_SNAPSHOT_NOT_FOUND",
  "TPL_PUBLISH_BLOCKED_MISSING_REQUIRED",
  "TPL_PUBLISH_BLOCKED_DEFAULT_CONTENT",
  "TPL_PUBLISH_BLOCKED_INVALID_VALUES",
  "TPL_RELEASE_NOT_FOUND",
  "TPL_INVITATION_UNAVAILABLE",
  "TPL_MANIFEST_INVALID",
  "TPL_PACKAGE_ASSET_MISMATCH",
  "TPL_MANIFEST_BREAKING_CHANGE_NOT_MAJOR",
  "TPL_VERSION_HASH_MISMATCH",
  "TPL_VERSION_LAST_PUBLISHED",
  "TPL_INTERNAL",
] as const;

export type TplErrorCode = (typeof TPL_ERROR_CODES)[number];

/** `03-api.md` §5, §10.2: `{timestamp, statusCode, code, message, details?}`; `details` se omite si vacío. */
export const TplErrorResponseSchema = z.object({
  timestamp: z.string(),
  statusCode: z.number().int(),
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
});
export type TplErrorResponse = z.infer<typeof TplErrorResponseSchema>;

/**
 * Error tipado que conserva el `code` del backend. Nunca se traga un error de la API (P1): todo
 * `throw` de `lib/api-client.ts` es una instancia de esta clase o de `SessionError` — nunca un
 * `Error` genérico con el texto perdido.
 */
export class ApiError extends Error {
  readonly kind = "api-error" as const;
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;
  readonly isKnownCode: boolean;

  constructor(response: TplErrorResponse, httpStatus: number) {
    super(response.message);
    this.name = "ApiError";
    this.code = response.code;
    this.statusCode = httpStatus;
    this.details = response.details;
    this.isKnownCode = (TPL_ERROR_CODES as readonly string[]).includes(response.code);
  }
}

/**
 * `401`/`403` que llegan de la cadena de filtros de Spring Security, ANTES de llegar a
 * `templates2` — no llevan `code` (`handoffs/2-5.md`: "no llevan TPL_*"). Se clasifican aparte a
 * propósito: tratarlos como `ApiError` con un `code` inventado sería mentir sobre su origen.
 */
export class SessionError extends Error {
  readonly kind = "session-error" as const;
  readonly statusCode: 401 | 403;
  readonly rawBody: string;

  constructor(statusCode: 401 | 403, rawBody: string) {
    super(statusCode === 401 ? "Sesión inválida o token ausente/expirado." : "Rol insuficiente para esta ruta.");
    this.name = "SessionError";
    this.statusCode = statusCode;
    this.rawBody = rawBody;
  }
}

/**
 * Cualquier respuesta no-2xx cuyo cuerpo no es un `TplErrorResponse` reconocible (HTML de un proxy,
 * texto plano, JSON con otra forma) y que tampoco es un 401/403 de la cadena de filtros. Conserva el
 * cuerpo crudo: "nada se descarta en silencio" (P1) también vale para lo inesperado.
 */
export class UnknownApiError extends Error {
  readonly kind = "unknown-api-error" as const;
  readonly statusCode: number;
  readonly rawBody: string;

  constructor(statusCode: number, rawBody: string) {
    super(`Respuesta no reconocida del servidor (HTTP ${statusCode}).`);
    this.name = "UnknownApiError";
    this.statusCode = statusCode;
    this.rawBody = rawBody;
  }
}

/** Error LOCAL, previo al envío: límite de cuerpo excedido o `clientBatchId`/`baseRevision` ausente. */
export class ApiClientValidationError extends Error {
  readonly kind = "client-validation-error" as const;
  constructor(message: string) {
    super(message);
    this.name = "ApiClientValidationError";
  }
}

export type ApiClientError = ApiError | SessionError | UnknownApiError | ApiClientValidationError;
