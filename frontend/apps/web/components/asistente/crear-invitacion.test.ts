import { describe, expect, it } from "vitest";
import { SessionError, UnknownApiError } from "@/lib/api-client";
import { es_MX } from "@/lib/i18n";
import { codigoAlta, traducirErrorAlta, traducirErrorBorrado } from "./crear-invitacion.ts";

function errorProducto(codigo: string, detalles?: unknown, mensaje = "mensaje de prueba") {
  return new UnknownApiError(
    409,
    JSON.stringify({
      timestamp: "09/09/2026 10:00:00",
      statusCode: 409,
      code: codigo,
      message: mensaje,
      ...(detalles !== undefined ? { details: detalles } : {}),
    }),
  );
}

describe("codigoAlta", () => {
  it("lee el `code` de un cuerpo bien formado", () => {
    expect(codigoAlta('{"code":"PRD_TOO_MANY_REQUESTS"}')).toBe("PRD_TOO_MANY_REQUESTS");
  });

  it("devuelve `null` si el cuerpo no es JSON, no es un objeto, o no trae `code`", () => {
    expect(codigoAlta("no es json")).toBeNull();
    expect(codigoAlta("[]")).toBeNull();
    expect(codigoAlta("{}")).toBeNull();
    expect(codigoAlta('{"code":123}')).toBeNull();
  });
});

describe("traducirErrorAlta (POST /product/invitations, contrato §4 — ordenado por `code`)", () => {
  it("SessionError → sesión inválida (401 sin `code`, cadena de filtros de Spring)", () => {
    expect(traducirErrorAlta(new SessionError(401, ""))).toEqual({ mensaje: es_MX.errores.sesionInvalida, tope: null });
  });

  it("TypeError (fetch no llega al servidor) → sin conexión", () => {
    expect(traducirErrorAlta(new TypeError("Failed to fetch"))).toEqual({ mensaje: es_MX.errores.sinRed, tope: null });
  });

  it("un error que no es `UnknownApiError` (ni de sesión ni de red) → genérico", () => {
    expect(traducirErrorAlta(new Error("algo"))).toEqual({ mensaje: es_MX.errores.generico, tope: null });
  });

  const CASOS: ReadonlyArray<[string, string]> = [
    ["PRD_FIELD_REQUIRED", es_MX.asistente.crear.errorCampoFalta],
    ["PRD_EVENT_KIND_INVALID", es_MX.asistente.crear.errorTipoInvalido],
    ["PRD_DATE_INVALID", es_MX.asistente.crear.errorFechaInvalida],
    ["PRD_DATE_IN_PAST", es_MX.asistente.crear.errorFechaPasada],
    ["PRD_DATE_TOO_FAR", es_MX.asistente.crear.errorFechaLejana],
    ["PRD_TIME_INVALID", es_MX.asistente.crear.errorHoraInvalida],
    ["PRD_HASHTAG_TOO_LONG", es_MX.asistente.crear.errorHashtagLargo],
    ["PRD_TOO_MANY_REQUESTS", es_MX.asistente.crear.errorCaudal],
    ["PRD_TEMPLATE_BRIDGE_MISSING", es_MX.errores.generico],
    ["PRD_INTERNAL", es_MX.errores.generico],
    ["PRD_MALFORMED_JSON", es_MX.errores.generico],
    ["ALGO_QUE_NO_EXISTE", es_MX.errores.generico],
  ];
  it.each(CASOS)("%s → el mensaje correcto, por `code`", (codigo, mensajeEsperado) => {
    expect(traducirErrorAlta(errorProducto(codigo)).mensaje).toBe(mensajeEsperado);
  });

  it("PRD_DRAFT_LIMIT_REACHED con `details` trae los números en el mensaje y en `tope`", () => {
    const traducido = traducirErrorAlta(errorProducto("PRD_DRAFT_LIMIT_REACHED", { limit: 3, current: 3 }));
    expect(traducido.tope).toEqual({ limit: 3, current: 3 });
    expect(traducido.mensaje).toBe(es_MX.asistente.crear.errorTope(3));
  });

  it("PRD_DRAFT_LIMIT_REACHED SIN `details` reconocibles cae al mensaje genérico del tope", () => {
    const traducido = traducirErrorAlta(errorProducto("PRD_DRAFT_LIMIT_REACHED", { algo: "raro" }));
    expect(traducido.tope).toBeNull();
    expect(traducido.mensaje).toBe(es_MX.asistente.crear.errorTopeGenerico);
  });

  it("nunca se ordena por `message`: dos mensajes distintos con el MISMO `code` dan la MISMA frase", () => {
    const a = traducirErrorAlta(errorProducto("PRD_TOO_MANY_REQUESTS", undefined, "un texto"));
    const b = traducirErrorAlta(errorProducto("PRD_TOO_MANY_REQUESTS", undefined, "un texto completamente distinto"));
    expect(a.mensaje).toBe(b.mensaje);
  });
});

describe("traducirErrorBorrado (DELETE /product/invitations/{id}, contrato §4)", () => {
  it("SessionError y TypeError, igual que el alta", () => {
    expect(traducirErrorBorrado(new SessionError(401, ""))).toBe(es_MX.errores.sesionInvalida);
    expect(traducirErrorBorrado(new TypeError("Failed to fetch"))).toBe(es_MX.errores.sinRed);
  });

  it("PRD_PATH_PARAM_INVALID y PRD_INVITATION_NOT_FOUND dan el mismo mensaje (el contrato dice: mismo cuerpo para los dos)", () => {
    expect(traducirErrorBorrado(errorProducto("PRD_PATH_PARAM_INVALID"))).toBe(es_MX.asistente.crear.errorBorradoNoEncontrada);
    expect(traducirErrorBorrado(errorProducto("PRD_INVITATION_NOT_FOUND"))).toBe(es_MX.asistente.crear.errorBorradoNoEncontrada);
  });

  it("PRD_INVITATION_NOT_DELETABLE distingue el motivo por `details.reason`", () => {
    expect(traducirErrorBorrado(errorProducto("PRD_INVITATION_NOT_DELETABLE", { reason: "paid" }))).toBe(
      es_MX.asistente.crear.errorBorradoPagada,
    );
    expect(traducirErrorBorrado(errorProducto("PRD_INVITATION_NOT_DELETABLE", { reason: "published" }))).toBe(
      es_MX.asistente.crear.errorBorradoPublicada,
    );
    expect(traducirErrorBorrado(errorProducto("PRD_INVITATION_NOT_DELETABLE", { reason: "legacy" }))).toBe(
      es_MX.asistente.crear.errorBorradoNoBorrable,
    );
    expect(traducirErrorBorrado(errorProducto("PRD_INVITATION_NOT_DELETABLE"))).toBe(
      es_MX.asistente.crear.errorBorradoNoBorrable,
    );
  });

  it("PRD_TOO_MANY_REQUESTS y cualquier otro `code` desconocido", () => {
    expect(traducirErrorBorrado(errorProducto("PRD_TOO_MANY_REQUESTS"))).toBe(es_MX.asistente.crear.errorCaudal);
    expect(traducirErrorBorrado(errorProducto("ALGO_RARO"))).toBe(es_MX.errores.generico);
  });
});
