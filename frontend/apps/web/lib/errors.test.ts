import { describe, expect, it } from "vitest";
import { ApiError, SessionError, TPL_ERROR_CODES, TplErrorResponseSchema, UnknownApiError } from "./errors.ts";

describe("TplErrorResponseSchema (03-api.md §5/§10.2)", () => {
  it("acepta el cuerpo mínimo sin details", () => {
    const r = TplErrorResponseSchema.safeParse({
      timestamp: "04/09/2026 10:00:00",
      statusCode: 404,
      code: "TPL_DOCUMENT_NOT_STARTED",
      message: "no hay documento",
    });
    expect(r.success).toBe(true);
  });

  it("acepta details cuando viene presente", () => {
    const r = TplErrorResponseSchema.safeParse({
      timestamp: "04/09/2026 10:00:00",
      statusCode: 422,
      code: "TPL_OPERATION_INVALID",
      message: "lote inválido",
      details: { operations: [{ index: 0, code: "X", path: "value" }] },
    });
    expect(r.success).toBe(true);
  });

  it("rechaza un cuerpo sin code", () => {
    const r = TplErrorResponseSchema.safeParse({ timestamp: "x", statusCode: 500, message: "boom" });
    expect(r.success).toBe(false);
  });
});

describe("catálogo de códigos TPL_* (03-api.md §5)", () => {
  it("tiene exactamente 35 códigos, sin duplicados", () => {
    expect(TPL_ERROR_CODES.length).toBe(35);
    expect(new Set(TPL_ERROR_CODES).size).toBe(35);
  });

  it("todos empiezan por TPL_ y ninguno por TPL_AI_ (prefijo reservado, X-14)", () => {
    for (const codigo of TPL_ERROR_CODES) {
      expect(codigo.startsWith("TPL_")).toBe(true);
      expect(codigo.startsWith("TPL_AI_")).toBe(false);
    }
  });
});

describe("ApiError / SessionError / UnknownApiError", () => {
  it("ApiError.isKnownCode distingue un code del catálogo de uno inventado", () => {
    const conocido = new ApiError(
      { timestamp: "x", statusCode: 404, code: "TPL_RELEASE_NOT_FOUND", message: "m" },
      404,
    );
    expect(conocido.isKnownCode).toBe(true);

    const desconocido = new ApiError({ timestamp: "x", statusCode: 400, code: "TPL_NO_EXISTE_TODAVIA", message: "m" }, 400);
    expect(desconocido.isKnownCode).toBe(false);
  });

  it("SessionError distingue 401 de 403 en su mensaje", () => {
    const noAutenticado = new SessionError(401, "");
    const sinRol = new SessionError(403, "");
    expect(noAutenticado.message).not.toBe(sinRol.message);
  });

  it("UnknownApiError conserva el cuerpo crudo (P1: nada se descarta en silencio)", () => {
    const error = new UnknownApiError(502, "<html>Bad Gateway</html>");
    expect(error.rawBody).toBe("<html>Bad Gateway</html>");
    expect(error.statusCode).toBe(502);
  });
});
