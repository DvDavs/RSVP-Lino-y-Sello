// lib/invitados/types.ts — formas del §1 del contrato
// (`docs/rediseno-plantillas/memoria/handoffs/5-2-contrato-invitados.md`), verificadas contra
// `GuestPanelDtos.kt` del backend (mismo nombre de campo, mismo tipo). Sesión E2.
//
// `fullName` sale NULEABLE del backend (`GuestPanelDtos.kt`: `val fullName: String?`) aunque el
// ejemplo del contrato lo muestre siempre presente — se tipa como puede llegar de verdad, no como
// el ejemplo lo dibuja, y la interfaz se defiende con un texto de respaldo (`textos.ts`).
export type GuestStatus = "PENDING" | "CONFIRMED" | "DECLINED";

export interface GuestItem {
  readonly id: number;
  readonly fullName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly tableNumber: number | null;
  readonly adults: number;
  readonly children: number;
  readonly young: number;
  readonly adultsConfirmed: number;
  readonly childrenConfirmed: number;
  readonly youngConfirmed: number;
  readonly status: GuestStatus;
  readonly message: string | null;
  readonly updatedAt: string | null;
}

export interface GuestPage {
  readonly content: readonly GuestItem[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

export interface GuestListQuery {
  readonly search?: string;
  readonly status?: GuestStatus;
  readonly page?: number;
  readonly size?: number;
}

export interface SeatPair {
  readonly invited: number;
  readonly confirmed: number;
}

export interface SeatCounts {
  readonly adults: SeatPair;
  readonly children: SeatPair;
  readonly young: SeatPair;
  readonly totalInvited: number;
  readonly totalConfirmed: number;
}

export interface GuestCounts {
  readonly total: number;
  readonly pending: number;
  readonly confirmed: number;
  readonly declined: number;
}

export interface EventRules {
  readonly childrenAllowed: boolean;
  readonly youngAllowed: boolean;
}

export interface GuestSummary {
  readonly guests: GuestCounts;
  readonly seats: SeatCounts;
  readonly rules: EventRules;
}

/** Cuerpo de alta/edición (`POST`/`PUT …/guests`). Solo `fullName` es obligatorio. */
export interface GuestUpsertInput {
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly tableNumber?: number;
  readonly adults?: number;
  readonly children?: number;
  readonly young?: number;
}

/** `GuestItem` sin `id`, `status` ni `updatedAt` (contrato §1). */
export interface GuestDraft {
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly tableNumber: number | null;
  readonly adults: number;
  readonly children: number;
  readonly young: number;
}

export interface GuestProblem {
  readonly line: number;
  readonly raw: string;
  readonly code: string;
  readonly message: string;
  readonly hint: string;
}

/** Respuesta de `:preview` (no escribe nada). */
export interface GuestPreviewResponse {
  readonly ready: readonly GuestDraft[];
  readonly problems: readonly GuestProblem[];
}

/** Respuesta de `:import` — misma forma, con `ready` ya creado como `GuestItem[]`. */
export interface GuestImportResponse {
  readonly ready: readonly GuestItem[];
  readonly problems: readonly GuestProblem[];
}

/**
 * `GET …/guests/{guestId}/link` — la única ruta que revela un token, ya montado en la URL.
 *
 * `whatsappUrl` es OPCIONAL, no `string | null`: el DTO Kotlin lleva
 * `@JsonInclude(JsonInclude.Include.NON_NULL)` (`GuestPanelDtos.kt`, [GuestLinkResponse]), así que
 * cuando el invitado no tiene teléfono la clave **no viene en el JSON** y aquí llega `undefined`,
 * nunca `null`. Tiparlo `string | null` invitaba a escribir `whatsappUrl !== null`, que es `true`
 * para `undefined` y abriría `window.open(undefined)`.
 */
export interface GuestLink {
  readonly url: string;
  readonly whatsappUrl?: string | null;
  readonly shareText: string;
}

/** Descarga de `GET …/guests/export.csv`: el blob y el nombre de archivo sugerido. */
export interface GuestExportFile {
  readonly blob: Blob;
  readonly filename: string;
}
