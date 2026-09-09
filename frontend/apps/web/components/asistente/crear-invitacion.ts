// components/asistente/crear-invitacion.ts — alta y borrado de una invitación desde el asistente
// (fase 5, E3; `docs/rediseno-plantillas/memoria/handoffs/5-1b-contrato-alta.md §4`). Funciones
// PURAS, sin JSX: traducen el `code` de las dos rutas de `product/invitations` a una frase es-MX.
//
// Por qué no vive esto en `components/sitio/traducir-errores.ts` (que ya hace justo esto para las
// rutas de cuenta): ese archivo está fuera del territorio de este agente (5-E3-B3). El criterio es
// el MISMO que allí — el contrato lo dice explícito: "ordena por `code`, nunca por `message`" — y
// por eso este archivo repite el patrón (`UnknownApiError.rawBody` → `{code, message, details}`,
// `peticion()` clasifica `PRD_*` como `UnknownApiError` porque no empieza por `TPL_`) en vez de
// reutilizar uno prohibido.
import { ApiClientValidationError, SessionError, UnknownApiError } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";

/** `{code, message, details}` de una respuesta `PRD_*` — mismo cuerpo que `TplErrorResponse`. */
function cuerpoAlta(rawBody: string): { code: string | null; details: unknown } {
  try {
    const json: unknown = JSON.parse(rawBody);
    if (typeof json !== "object" || json === null) return { code: null, details: undefined };
    const code = (json as { code?: unknown }).code;
    const details = (json as { details?: unknown }).details;
    return { code: typeof code === "string" && code.length > 0 ? code : null, details };
  } catch {
    return { code: null, details: undefined };
  }
}

/** `code` de una de las dos rutas de `product/invitations`. `null` si el cuerpo no tiene esa forma. */
export function codigoAlta(rawBody: string): string | null {
  return cuerpoAlta(rawBody).code;
}

/** `details` del `409 PRD_DRAFT_LIMIT_REACHED` (contrato §4): `{limit: 3, current: 3}`. */
export interface DetallesTope {
  readonly limit: number;
  readonly current: number;
}

function detallesTope(rawBody: string): DetallesTope | null {
  const { details } = cuerpoAlta(rawBody);
  if (typeof details !== "object" || details === null) return null;
  const limit = (details as { limit?: unknown }).limit;
  const current = (details as { current?: unknown }).current;
  return typeof limit === "number" && typeof current === "number" ? { limit, current } : null;
}

export interface ErrorDeAlta {
  readonly mensaje: string;
  /** Solo cuando el `code` es `PRD_DRAFT_LIMIT_REACHED`: los números del tope, para la frase. */
  readonly tope: DetallesTope | null;
}

/**
 * `POST /product/invitations` (contrato §4). El orden de las ramas sigue el `code`, nunca el
 * `message` del backend (puede cambiar de redacción sin avisar).
 */
export function traducirErrorAlta(error: unknown): ErrorDeAlta {
  if (error instanceof SessionError) return { mensaje: es_MX.errores.sesionInvalida, tope: null };
  if (error instanceof TypeError) return { mensaje: es_MX.errores.sinRed, tope: null };
  if (error instanceof ApiClientValidationError) return { mensaje: es_MX.errores.generico, tope: null };
  if (!(error instanceof UnknownApiError)) return { mensaje: es_MX.errores.generico, tope: null };

  const code = codigoAlta(error.rawBody);
  switch (code) {
    case "PRD_FIELD_REQUIRED":
      return { mensaje: es_MX.asistente.crear.errorCampoFalta, tope: null };
    case "PRD_EVENT_KIND_INVALID":
      return { mensaje: es_MX.asistente.crear.errorTipoInvalido, tope: null };
    case "PRD_DATE_INVALID":
      return { mensaje: es_MX.asistente.crear.errorFechaInvalida, tope: null };
    case "PRD_DATE_IN_PAST":
      return { mensaje: es_MX.asistente.crear.errorFechaPasada, tope: null };
    case "PRD_DATE_TOO_FAR":
      return { mensaje: es_MX.asistente.crear.errorFechaLejana, tope: null };
    case "PRD_TIME_INVALID":
      return { mensaje: es_MX.asistente.crear.errorHoraInvalida, tope: null };
    case "PRD_HASHTAG_TOO_LONG":
      return { mensaje: es_MX.asistente.crear.errorHashtagLargo, tope: null };
    case "PRD_DRAFT_LIMIT_REACHED": {
      const tope = detallesTope(error.rawBody);
      return {
        mensaje: tope ? es_MX.asistente.crear.errorTope(tope.limit) : es_MX.asistente.crear.errorTopeGenerico,
        tope,
      };
    }
    case "PRD_TOO_MANY_REQUESTS":
      return { mensaje: es_MX.asistente.crear.errorCaudal, tope: null };
    case "PRD_MALFORMED_JSON":
    case "PRD_TEMPLATE_BRIDGE_MISSING":
    case "PRD_INTERNAL":
    default:
      return { mensaje: es_MX.errores.generico, tope: null };
  }
}

/** `DELETE /product/invitations/{id}` (contrato §4, solo esta ruta). */
export function traducirErrorBorrado(error: unknown): string {
  if (error instanceof SessionError) return es_MX.errores.sesionInvalida;
  if (error instanceof TypeError) return es_MX.errores.sinRed;
  if (!(error instanceof UnknownApiError)) return es_MX.errores.generico;

  const code = codigoAlta(error.rawBody);
  switch (code) {
    case "PRD_PATH_PARAM_INVALID":
    case "PRD_INVITATION_NOT_FOUND":
      return es_MX.asistente.crear.errorBorradoNoEncontrada;
    case "PRD_INVITATION_NOT_DELETABLE": {
      const { details } = cuerpoAlta(error.rawBody);
      const razon = (details as { reason?: unknown } | undefined)?.reason;
      if (razon === "paid") return es_MX.asistente.crear.errorBorradoPagada;
      if (razon === "published") return es_MX.asistente.crear.errorBorradoPublicada;
      return es_MX.asistente.crear.errorBorradoNoBorrable;
    }
    case "PRD_TOO_MANY_REQUESTS":
      return es_MX.asistente.crear.errorCaudal;
    default:
      return es_MX.errores.generico;
  }
}
