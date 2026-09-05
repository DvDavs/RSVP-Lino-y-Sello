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
