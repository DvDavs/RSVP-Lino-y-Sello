// lib/admin/cliente.test.ts — pruebas del cliente HTTP de `/admin` (mismo estilo que
// `lib/api-client.test.ts`, léelo antes de tocar esto). Cubre lo que pide el encargo: URL y query
// correctas por ruta, `Authorization: Bearer …` cuando hay token, y que TODA respuesta no-2xx se
// LANZA (nunca `null`) clasificada como `ApiError` | `SessionError` | `UnknownApiError`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, haySesionCaducada, setAuthToken } from "../api-client.ts";
import { ApiError, SessionError, UnknownApiError } from "../errors.ts";
import {
  alternarEstadoInvitacion,
  listarClientas,
  listarInvitaciones,
  listarPagos,
  listarPlanes,
  listarPlantillas,
  obtenerMetricas,
} from "./cliente.ts";

function respuestaJson(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const METRICAS_OK = { clientas: 1, invitaciones: 1, publicadas: 0, pagadas: 0, rsvpUltimos7Dias: 0 };
const PAGINA_VACIA = { total: 0, pagina: 0, tamano: 20, elementos: [] };
const TOGGLE_OK = {
  status: "success",
  message: "Invitación deshabilitada correctamente",
  invitation: {
    id: 7,
    status: "paid",
    eventId: 1,
    event: "Boda",
    planId: 1,
    plan: "Fiesta",
    price: 1490,
    currency: "MXN",
    date: "2026-11-14",
    time: "18:00",
  },
};

beforeEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("URL y query por ruta (contrato-admin.md)", () => {
  it("obtenerMetricas pide GET /product/admin/metricas sin query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, METRICAS_OK));
    vi.stubGlobal("fetch", fetchMock);
    await obtenerMetricas();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/product\/admin\/metricas$/);
    expect(init.method).toBe("GET");
  });

  it("listarClientas construye pagina/tamano/buscar y omite los parámetros undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, PAGINA_VACIA));
    vi.stubGlobal("fetch", fetchMock);
    await listarClientas({ pagina: 2, tamano: 10, buscar: undefined });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/product/admin/clientas?");
    expect(url).toContain("pagina=2");
    expect(url).toContain("tamano=10");
    expect(url).not.toContain("buscar");
  });

  it("listarClientas sin argumentos no manda cadena de consulta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, PAGINA_VACIA));
    vi.stubGlobal("fetch", fetchMock);
    await listarClientas();
    const [url] = fetchMock.mock.calls[0];
    expect(url.endsWith("/product/admin/clientas")).toBe(true);
  });

  it("listarInvitaciones manda buscar, estado y pago cuando vienen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, PAGINA_VACIA));
    vi.stubGlobal("fetch", fetchMock);
    await listarInvitaciones({ buscar: "Ana", estado: "publicada", pago: "pagada" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/product/admin/invitaciones?");
    expect(url).toContain("buscar=Ana");
    expect(url).toContain("estado=publicada");
    expect(url).toContain("pago=pagada");
  });

  it("listarPagos manda estado cuando viene y omite tamano/pagina si no vienen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, { ...PAGINA_VACIA, origen: "invitaciones" }));
    vi.stubGlobal("fetch", fetchMock);
    await listarPagos({ estado: "pendiente" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${url.split("?")[0]}?estado=pendiente`);
  });

  it("listarPlanes y listarPlantillas no llevan cadena de consulta (el contrato no la define)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuestaJson(200, { elementos: [] }))
      .mockResolvedValueOnce(respuestaJson(200, { total: 0, elementos: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await listarPlanes();
    await listarPlantillas();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/product\/admin\/planes$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/product\/admin\/plantillas$/);
  });

  it("alternarEstadoInvitacion hace PUT a la ruta HEREDADA /admin/invitations/{id}/toggle-status, no /product/admin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, TOGGLE_OK));
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await alternarEstadoInvitacion(7);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/admin\/invitations\/7\/toggle-status$/);
    expect(url).not.toContain("/product/admin");
    expect(init.method).toBe("PUT");
    expect(resultado.invitation.id).toBe(7);
  });
});

describe("Authorization: Bearer <token> (P8 — el token solo vive en api-client.ts)", () => {
  it("manda Authorization cuando hay sesión activa", async () => {
    setAuthToken("jwt-admin");
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, PAGINA_VACIA));
    vi.stubGlobal("fetch", fetchMock);
    await listarClientas();
    const [, init] = fetchMock.mock.calls[0];
    const cabeceras = init.headers as Headers;
    expect(cabeceras.get("Authorization")).toBe("Bearer jwt-admin");
  });

  it("no manda Authorization sin sesión (nunca inventa un token)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, METRICAS_OK));
    vi.stubGlobal("fetch", fetchMock);
    await obtenerMetricas();
    const [, init] = fetchMock.mock.calls[0];
    const cabeceras = init.headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });

  it("alternarEstadoInvitacion también manda Authorization cuando hay sesión", async () => {
    setAuthToken("jwt-admin-2");
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, TOGGLE_OK));
    vi.stubGlobal("fetch", fetchMock);
    await alternarEstadoInvitacion(7);
    const [, init] = fetchMock.mock.calls[0];
    const cabeceras = init.headers as Headers;
    expect(cabeceras.get("Authorization")).toBe("Bearer jwt-admin-2");
  });
});

describe("clasificación de errores: nunca se devuelve null, siempre se lanza", () => {
  it("400 sin `code` TPL_* (p. ej. filtro `estado` desconocido) se clasifica como UnknownApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(400, { timestamp: "x", statusCode: 400, errors: { estado: "valor desconocido" } }),
      ),
    );
    const error = await listarInvitaciones({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
  });

  it("401 se clasifica como SessionError, nunca ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const error = await obtenerMetricas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(401);
  });

  it("403 (rol USER, o ADMIN sin jerarquía) se clasifica como SessionError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    const error = await listarClientas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(403);
  });

  it("500 se clasifica como UnknownApiError y conserva el cuerpo crudo (P1)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom interno", { status: 500 })));
    const error = await listarPagos().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect((error as UnknownApiError).rawBody).toBe("boom interno");
    expect((error as UnknownApiError).statusCode).toBe(500);
  });

  it("un TplErrorResponse con `code` TPL_* se clasifica como ApiError y conserva el code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(403, { timestamp: "x", statusCode: 403, code: "TPL_FORBIDDEN", message: "sin acceso" }),
      ),
    );
    const error = await listarPlantillas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("TPL_FORBIDDEN");
  });

  it("alternarEstadoInvitacion en 403 por jerarquía (`ErrorMessage` heredado, sin `code`) se clasifica como SessionError, no ApiError", async () => {
    const cuerpoHeredado = {
      timestamp: "04/09/2026 10:00:00",
      statusCode: 403,
      access: "No tienes permisos para modificar esta invitación",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(403, cuerpoHeredado)));
    const error = await alternarEstadoInvitacion(999).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it("alternarEstadoInvitacion en 400 (`IllegalArgumentException`, invitación inexistente) se clasifica como UnknownApiError", async () => {
    const cuerpoHeredado = {
      timestamp: "04/09/2026 10:00:00",
      statusCode: 400,
      error: "La invitación con id 999999 no existe",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(400, cuerpoHeredado)));
    const error = await alternarEstadoInvitacion(999999).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
  });

  it("un 401 marca la sesión como caducada y tira el token muerto (ALTA-1, paridad con peticion())", async () => {
    setAuthToken("jwt-muerto");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    await obtenerMetricas().catch(() => {});
    expect(haySesionCaducada()).toBe(true);
    expect(getAuthToken()).toBeNull();
  });

  it("un 403 (sin jerarquía en la ruta heredada) también marca la sesión como caducada", async () => {
    setAuthToken("jwt-sin-jerarquia");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    await alternarEstadoInvitacion(7).catch(() => {});
    expect(haySesionCaducada()).toBe(true);
    expect(getAuthToken()).toBeNull();
  });
});

describe("cuerpo vacío en 2xx no revienta el parseo (defensivo, aunque el contrato siempre responde JSON)", () => {
  it("un 200 sin cuerpo no lanza al intentar leerlo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(obtenerMetricas()).resolves.toBeUndefined();
  });
});

describe("caminos de fallo que antes salían sin clasificar (5-E5-R1 MEDIA-2)", () => {
  it("un 200 con cuerpo que no es JSON (p. ej. HTML de un proxy) se clasifica como UnknownApiError, nunca SyntaxError crudo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 200 })),
    );
    const error = await obtenerMetricas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect((error as UnknownApiError).rawBody).toContain("502 Bad Gateway");
  });

  it("un `fetch` que rechaza (red caída) se clasifica como UnknownApiError, nunca TypeError crudo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await obtenerMetricas().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect(error).not.toBeInstanceOf(TypeError);
    expect((error as UnknownApiError).rawBody).toContain("Failed to fetch");
  });
});
