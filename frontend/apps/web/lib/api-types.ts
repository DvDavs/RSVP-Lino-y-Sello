// lib/api-types.ts — envolturas de petición/respuesta de las 19 rutas (03-api.md §3). Reutiliza los
// tipos de `@invitaciones/schema` para todo lo que es dominio (documento, compuesto, informe,
// operaciones); define localmente SOLO la forma HTTP de cada ruta, que no es esquema compartido con
// Kotlin (P1: el dominio no se retipa dos veces; el transporte sí puede vivir aquí).
import type {
  ComposedDocument,
  CompositionReport,
  EventKind,
  InvitationDocument,
  Operation,
} from "@invitaciones/schema";

export type LocalizedText = { "es-MX": string; "es-ES"?: string; "en-US"?: string };

// ---------------------------------------------------------------------------------------------
// 1. GET /editor/templates2/catalog
// ---------------------------------------------------------------------------------------------
export interface CatalogQuery {
  eventKind?: EventKind;
  planTier?: 1 | 2 | 3;
  limit?: number;
  cursor?: string;
}
export interface CatalogItem {
  slug: string;
  version: string;
  name: LocalizedText;
  eventKinds: EventKind[];
  minPlanTier: 1 | 2 | 3;
  previewUrl: string;
  capabilities: string[];
  status: "published" | "deprecated";
}
export interface CatalogResponse {
  items: CatalogItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------
// 2. POST .../document:choose-template
// ---------------------------------------------------------------------------------------------
export interface ChooseTemplateRequest {
  templateSlug: string;
  templateVersion: string;
  /** Obligatoria si el documento ya existe; se omite en la primera creación (03 §3.2). */
  baseRevision?: number;
}
export interface DocumentEnvelope {
  document: InvitationDocument;
  composed: ComposedDocument;
  report: CompositionReport;
}
export interface ChooseTemplateResponse extends DocumentEnvelope {
  revision: number;
  created: boolean;
  movedToAttic: string[];
  publicToken: string;
  publicUrl: string;
}

// ---------------------------------------------------------------------------------------------
// 3. GET .../document
// ---------------------------------------------------------------------------------------------
export interface ActiveReleaseSummary {
  releaseId: number;
  publishedAt: string;
  /** Revisión del documento con la que se publicó (verificado contra el backend real en 3C-UX-B). */
  documentRevision: number;
  contentHash: string;
  stale: boolean;
  staleReason: string[];
}
export interface GetDocumentResponse extends DocumentEnvelope {
  revision: number;
  templateVersion: { slug: string; version: string; status: "published" | "deprecated" };
  publicToken: string;
  publicUrl: string;
  activeRelease: ActiveReleaseSummary | null;
}

// ---------------------------------------------------------------------------------------------
// 4. POST .../document/operations
// ---------------------------------------------------------------------------------------------
export interface OperationBatchRequest {
  baseRevision: number;
  clientBatchId: string;
  operations: Operation[];
}
export interface OperationBatchResponse {
  revision: number;
  applied: boolean;
  idMap: Record<string, string>;
  composed: ComposedDocument;
  report: CompositionReport;
}
/** 409 TPL_REVISION_CONFLICT trae este cuerpo en `details`/en el propio 409 (03 §3.4 punto 5). */
export interface RevisionConflictBody {
  currentRevision: number;
  document: InvitationDocument;
  composed: ComposedDocument;
  report: CompositionReport;
}

// ---------------------------------------------------------------------------------------------
// 5. GET .../document/history
// ---------------------------------------------------------------------------------------------
export interface HistoryQuery {
  limit?: number;
  cursor?: string;
  clientBatchId?: string;
}
export interface HistoryItem {
  revision: number;
  createdAt: string;
  clientBatchId: string;
  origin: "operations" | "choose_template" | "restore" | "import" | "ai";
  createdBy: number;
}
export interface HistoryPageResponse {
  items: HistoryItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------
// 6. POST .../document/restore
// ---------------------------------------------------------------------------------------------
export interface RestoreRequest {
  revision: number;
  baseRevision: number;
}
export interface RestoreResponse {
  revision: number;
  composed: ComposedDocument;
  report: CompositionReport;
  movedToAttic: string[];
}

// ---------------------------------------------------------------------------------------------
// 7. POST .../assets (cuerpo binario crudo)
// ---------------------------------------------------------------------------------------------
export interface AssetUploadResponse {
  assetId: string;
  bytes: number;
  contentType: string;
  sha256: string;
  width?: number;
  height?: number;
  previewUrl: string;
  reused: boolean;
}

// ---------------------------------------------------------------------------------------------
// 8. GET .../assets
// ---------------------------------------------------------------------------------------------
export interface AssetListQuery {
  limit?: number;
  cursor?: string;
}
export interface AssetListItem {
  assetId: string;
  bytes: number;
  contentType: string;
  width?: number;
  height?: number;
  createdAt: string;
  referenced: boolean;
  previewUrl: string;
}
export interface AssetListResponse {
  items: AssetListItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------
// 10. GET .../release/preflight
// ---------------------------------------------------------------------------------------------
export interface PreflightBlocker {
  code: string;
  blockIds?: string[];
  sectionKeys?: string[];
}
export interface PreflightResponse {
  canPublish: boolean;
  blockers: PreflightBlocker[];
  warnings: PreflightBlocker[];
  report: CompositionReport;
  contentHash: string;
  sameAsActiveRelease: boolean;
}

// ---------------------------------------------------------------------------------------------
// 11. POST .../release
// ---------------------------------------------------------------------------------------------
export interface PublishRequest {
  baseRevision: number;
}
export interface PublishResponse {
  releaseId: number;
  contentHash: string;
  documentRevision: number;
  publishedAt: string;
  publicToken: string;
  publicUrl: string;
  reusedActiveRelease: boolean;
}

// ---------------------------------------------------------------------------------------------
// 13. GET .../releases
// ---------------------------------------------------------------------------------------------
export interface ReleaseListQuery {
  limit?: number;
  cursor?: string;
}
export interface ReleaseListItem {
  releaseId: number;
  publishedAt: string;
  unpublishedAt: string | null;
  contentHash: string;
  documentRevision: number;
  templateVersion: { slug: string; version: string };
  isActive: boolean;
  publishedBy: number;
}
export interface ReleaseListResponse {
  items: ReleaseListItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------------------------
// 14. POST .../public-token:rotate
// ---------------------------------------------------------------------------------------------
export interface RotateTokenResponse {
  publicToken: string;
  publicUrl: string;
  rotatedAt: string;
}

// ---------------------------------------------------------------------------------------------
// 15. GET /public/i/{publicToken}/render
// ---------------------------------------------------------------------------------------------
export interface PublicRenderResponse {
  composed: ComposedDocument;
  publishedAt: string;
  contentHash: string;
}
export type PublicRenderResult =
  | { status: "ok"; data: PublicRenderResponse; etag: string | null }
  | { status: "not-modified"; etag: string | null };

// ---------------------------------------------------------------------------------------------
// 16. GET /public/i/{publicToken}/exists
// ---------------------------------------------------------------------------------------------
export interface PublicExistsResponse {
  published: boolean;
}

// ---------------------------------------------------------------------------------------------
// 17-19. /master/templates2/versions (rol MASTER)
// ---------------------------------------------------------------------------------------------
export interface RegisterTemplateResponse {
  result: "created" | "noop_same_hash";
  templateVersionId: number;
  slug?: string;
  version?: string;
  packageHash: string;
  assetsRegistered?: number;
  structuralDiff?: Record<string, unknown>;
}
export interface ListTemplateVersionsQuery {
  slug?: string;
  status?: "published" | "deprecated";
  limit?: number;
  cursor?: string;
}
export interface TemplateVersionListItem {
  templateVersionId: number;
  slug: string;
  version: string;
  status: "published" | "deprecated";
  packageHash: string;
  publishedAt: string;
  documentsUsing: number;
}
export interface RecentRegistration {
  slug: string;
  version: string;
  result: "created" | "noop_same_hash" | "rejected";
  errorCode?: string;
  createdAt: string;
}
export interface ListTemplateVersionsResponse {
  items: TemplateVersionListItem[];
  recentRegistrations: RecentRegistration[];
  nextCursor: string | null;
}
export interface DeprecateTemplateVersionResponse {
  templateVersionId: number;
  status: "deprecated";
}

// ---------------------------------------------------------------------------------------------
// 20. PUT .../event — la fecha del evento (03 §3.20, I-06)
// ---------------------------------------------------------------------------------------------
/**
 * `time` es opcional y su ausencia significa «no toques la hora», nunca «bórrala»: la plantilla
 * puede no declarar ningún bloque con `businessField: "invitation.time"`, y entonces el editor no
 * tiene ninguna hora que conservar ni que mostrar.
 */
export interface SetEventRequest {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  time?: string;
}
export interface SetEventResponse {
  invitationId: number;
  date: string | null;
  time: string | null;
  /** ¿La invitación ya publicada quedó desactualizada por este cambio? No se invalida sola. */
  releaseStale: boolean;
  staleReason: string[];
}

// ---------------------------------------------------------------------------------------------
// Auth (modules/auth, reusado — no es parte de templates2 pero el JWT sale de ahí, 03 preámbulo)
// ---------------------------------------------------------------------------------------------
export interface AuthTokenRequest {
  email: string;
  password: string;
}
/** Forma real verificada contra `POST /auth/token` (`handoffs/2-5.md`, `AuthController.kt:36`):
 * el campo del JWT es `accessToken`, NUNCA `token`. */
export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  role: "USER" | "ADMIN" | "MASTER";
  isSurveyAnswered: boolean;
  [key: string]: unknown;
}

/**
 * `POST /auth/signup` (`AuthController.kt:56`, DTO `UserRequest.kt`). Solo se tipan los campos que
 * el registro de `/acceso` manda: el DTO acepta además `birthdate`, `address`, `city`,
 * `postalCode`, `state` y `howKnow`, todos opcionales, y ninguno se pide en tres pasos (11 §7).
 */
export interface AuthSignupRequest {
  name: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

/**
 * `POST /auth/request-password-reset` (`AuthController.kt:62`). La respuesta es un mensaje y NADA
 * más: `RecoveryPasswordSentResponse` ya no lleva el token de recuperación (`ADR-3C-N01-01`), y la
 * interfaz tampoco lo enseña — muestra siempre la misma frase, exista o no la cuenta.
 */
export interface AuthPasswordResetRequest {
  email: string;
}
export interface AuthPasswordResetResponse {
  message: string;
}

// ---------------------------------------------------------------------------------------------
// Cuenta (fase 5, E3) — `modules/product/account` y `modules/product/account` (verificación).
// Contrato: `handoffs/5-E3-A2-contrato-cuenta.md`. Las cinco rutas nuevas responden
// `GeneralMessageResponse` (`{message: string}`) salvo `GET`/`PUT /user/profile`, que devuelven
// `Profile`. Ninguna de las cinco lleva su cuerpo de error aquí: los errores viajan como
// `UnknownApiError` (no son `TPL_*`) y se leen con `codigoCuenta()` en `traducir-errores.ts`.
// ---------------------------------------------------------------------------------------------

/** Cuerpo de respuesta común a las rutas de cuenta que no devuelven un recurso (`AccountRequests.kt`). */
export interface MessageResponse {
  message: string;
}

/** `POST /auth/verify-email` (`EmailVerificationController.kt:35`, público). */
export interface AuthVerifyEmailRequest {
  token: string;
}

/** `POST /auth/verify-email:resend` (`EmailVerificationController.kt:48`, público, respuesta siempre igual). */
export interface AuthResendVerificationRequest {
  email: string;
}

/**
 * `GET /user/profile` y `PUT /user/profile` (`Profile.kt`). `emailVerified` es nuevo en la fase 5:
 * `false` solo en cuentas recién creadas o con un cambio de correo a medias — no bloquea nada hoy.
 */
export interface Profile {
  name: string;
  lastName: string;
  email: string;
  phone?: string;
  birthdate?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  photo?: string;
  isSurveyAnswered: boolean;
  emailVerified: boolean;
}

/**
 * `PUT /user/profile` (`UpdateProfileRequest.kt`). El correo **no** va aquí (R1-09/`ADR-5-E3-06`):
 * el DTO del backend lo ignora si se manda, así que ni se tipa ni se envía.
 */
export interface UpdateProfileRequest {
  name: string;
  lastName: string;
  phone?: string;
  birthdate?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  state?: string;
}

/** `PUT /user/account/password` (`AccountRequests.kt`). Cierra todas las sesiones al terminar. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * `POST /user/account/email` (`AccountRequests.kt`). No cambia el correo de acceso hasta que se
 * confirma el enlace con `POST /auth/verify-email`; la respuesta es genérica siempre.
 */
export interface ChangeEmailRequest {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------------------------
// `POST /product/invitations` y `DELETE /product/invitations/{id}` (fase 5, E3;
// `docs/rediseno-plantillas/memoria/handoffs/5-1b-contrato-alta.md §2-§3`). El alta que faltaba
// para el rol USER: hasta ahora una invitación solo la daba de alta un ADMIN (agujero G-01).
// ---------------------------------------------------------------------------------------------

/** §2 del contrato. Los dos `*Allowed` nacen en `true` si se omiten; `hashtag` en `""`. */
export interface CreateInvitationRequest {
  eventKind: EventKind;
  /** `YYYY-MM-DD`, no anterior a hoy (`America/Mexico_City`) y ≤ 10 años. */
  eventDate: string;
  /** `HH:MM`, 24 h. */
  eventTime: string;
  childrenAllowed?: boolean;
  youngAllowed?: boolean;
  /** ≤ 100 caracteres; el backend lo recorta si se pasa. */
  hashtag?: string;
}

/**
 * §3 del contrato. `201` en un alta nueva; `200` en el reenvío exacto del mismo dueño dentro de la
 * ventana de 60 s (mismo cuerpo entero) — la forma de la respuesta es idéntica en los dos casos: la
 * fila tal como quedó en la base, nunca un eco de lo enviado.
 */
export interface CreateInvitationResponse {
  invitationId: number;
  eventKind: EventKind;
  eventDate: string;
  eventTime: string;
  childrenAllowed: boolean;
  youngAllowed: boolean;
  hashtag: string;
  isPaid: boolean;
  isEnabled: boolean;
  isFinished: boolean;
  usesTemplates2: boolean;
  createdAt: string;
}
