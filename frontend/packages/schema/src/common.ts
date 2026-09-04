// packages/schema/src/common.ts — primitivas compartidas (Zod 4). Fuente única del esquema (P1).
// REGLA DURA: ningún esquema de este paquete usa .refine()/.superRefine(): z.toJSONSchema los descarta
// en silencio (verificado con zod@4.5.4, ver 01-dominio-y-esquema.md §8). Las invariantes entre campos
// viven en invariants.ts y se implementan también en Kotlin (templates2/schema/Invariants.kt).
import { z } from "zod";

/** Identificador de bloque: segmentos camelCase separados por punto, ≤ 4 segmentos, ≤ 80 chars. */
export const BLOCK_ID_PATTERN = /^[a-z][a-zA-Z0-9]{0,29}(\.[a-z][a-zA-Z0-9]{0,29}){0,3}$/;
export const BlockId = z.string().min(1).max(80).regex(BLOCK_ID_PATTERN);

/** Clave de sección: un solo segmento camelCase. */
export const SECTION_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,39}$/;
export const SectionKey = z.string().min(1).max(40).regex(SECTION_KEY_PATTERN);

/** slug de plantilla: kebab-case. */
export const TemplateSlug = z.string().regex(/^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/);

/** semver estricto (sin prerelease ni build: una versión publicada es final). */
export const Semver = z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);

/** ULID en mayúsculas (Crockford base32), generado por el servidor. */
export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const Ulid = z.string().regex(ULID_PATTERN);

/** Id de asset: prefijo + ULID. Nunca una URL dentro del documento (ADR-021). */
export const AssetId = z.string().regex(/^as_[0-9A-HJKMNP-TV-Z]{26}$/);

/** Id temporal que el cliente usa antes de que el servidor asigne el ULID definitivo (§ operaciones). */
export const TempId = z.string().regex(/^tmp:[A-Za-z0-9_-]{8,64}$/);

/** Id de ítem de grupo: ULID definitivo o temporal (solo en operaciones entrantes, nunca persistido). */
export const ItemId = Ulid;

/** Identificador de variante, paleta, fuente, opción, formato: kebab-case corto. */
export const Ident = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);

/** BCP-47 restringido a los que soportamos. Ampliar por ADR. */
export const Locale = z.enum(["es-MX", "es-ES", "en-US"]);

/** Texto localizado: al menos es-MX. */
export const LocalizedText = z.object({
  "es-MX": z.string().min(1).max(200),
  "es-ES": z.string().min(1).max(200).optional(),
  "en-US": z.string().min(1).max(200).optional(),
});

/** Tipos de evento (catálogo cerrado; sustituye a eventTypeId == 1L, H-20). */
export const EventKind = z.enum([
  "wedding", "quince", "baptism", "communion", "confirmation", "birthday", "graduation", "generic",
]);

/** Fecha local sin zona. */
export const IsoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
/** Hora local 24 h. */
export const IsoTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** Fecha y hora local sin zona (la zona la aporta el negocio: invitation.timezone, o es-MX por defecto). */
export const IsoLocalDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/);

/** URL http(s) absoluta, ≤ 2048. Rechaza javascript:, data:, etc. por construcción del patrón. */
export const HttpUrl = z.string().max(2048).regex(/^https?:\/\/[^\s/$.?#].[^\s]*$/i);

/** Color hex solo en theme.json (capa 1, del autor). Nunca en el documento. */
export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export type BlockId = z.infer<typeof BlockId>;
export type SectionKey = z.infer<typeof SectionKey>;
export type Locale = z.infer<typeof Locale>;
export type EventKind = z.infer<typeof EventKind>;
