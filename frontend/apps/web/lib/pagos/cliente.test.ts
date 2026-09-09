// lib/pagos/cliente.test.ts — clasificación de errores del cliente de pagos, una rama por caso
// (mismo patrón que `lib/api-client.test.ts`: `vi.stubGlobal("fetch", …)`, sin red real).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, setAuthToken } from "@/lib/api-client";
import { SessionError } from "@/lib/errors";
import { crearCheckout, obtenerCatalogo, obtenerMisPagos, obtenerPlanDeInvitacion } from "./cliente.ts";
import { ErrorDePago } from "./tipos.ts";

function respuestaJson(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const CATALOGO_EJEMPLO = {
  moneda: "MXN",
  pagoEnLinea: true,
  planes: [
    {
      codigo: "fiesta",
      nombre: "Fiesta",
      descripcion: "Para hasta 150 invitados",
      precioCentavos: 89900,
      moneda: "MXN",
      invitadosMax: 150,
      incluye: ["Hasta 150 invitados", "Confirmaciones ilimitadas"],
      recomendado: true,
      orden: 20,
    },
  ],
};

beforeEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("obtenerCatalogo (GET /public/plans, sin auth)", () => {
  it("con 2xx devuelve el catálogo tal cual", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, CATALOGO_EJEMPLO));
    vi.stubGlobal("fetch", fetchMock);
    const catalogo = await obtenerCatalogo();
    expect(catalogo).toEqual(CATALOGO_EJEMPLO);
    expect(fetchMock.mock.calls[0][0]).toContain("/public/plans");
  });

  it("nunca manda Authorization aunque haya token (ruta pública)", async () => {
    setAuthToken("jwt-de-prueba");
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, CATALOGO_EJEMPLO));
    vi.stubGlobal("fetch", fetchMock);
    await obtenerCatalogo();
    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });

  it("pide sin caché (`cache: no-store`)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, CATALOGO_EJEMPLO));
    vi.stubGlobal("fetch", fetchMock);
    await obtenerCatalogo();
    expect(fetchMock.mock.calls[0][1].cache).toBe("no-store");
  });
});

describe("clasificación de errores no-2xx (nunca se descarta el cuerpo en silencio)", () => {
  it("un cuerpo {code: 'PAY_...'} se lanza como ErrorDePago con code/status/message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(409, { code: "PAY_ALREADY_PAID", message: "la invitación ya está pagada" }),
      ),
    );
    const error = await crearCheckout(12, "fiesta").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDePago);
    expect((error as ErrorDePago).code).toBe("PAY_ALREADY_PAID");
    expect((error as ErrorDePago).status).toBe(409);
    expect((error as ErrorDePago).message).toBe("la invitación ya está pagada");
  });

  it("cada código PAY_* del contrato se clasifica con su propio code", async () => {
    const casos: ReadonlyArray<[number, string]> = [
      [503, "PAY_NOT_CONFIGURED"],
      [404, "PAY_PLAN_NOT_FOUND"],
      [404, "PAY_INVITATION_NOT_FOUND"],
      [409, "PAY_ALREADY_PAID"],
      [502, "PAY_STRIPE_UNAVAILABLE"],
      [400, "PAY_MALFORMED_JSON"],
    ];
    for (const [status, code] of casos) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(status, { code, message: code })));
      const error = await obtenerPlanDeInvitacion(1).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ErrorDePago);
      expect((error as ErrorDePago).code).toBe(code);
      expect((error as ErrorDePago).isKnownCode).toBe(true);
    }
  });

  it("un 401 sin code se clasifica como SessionError, no ErrorDePago", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const error = await obtenerMisPagos().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(401);
  });

  it("un 403 sin code se clasifica como SessionError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    const error = await obtenerMisPagos().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
  });

  it("un 401 CON code ajeno a `PAY_` (cadena de filtros) sigue siendo SessionError, no ErrorDePago", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaJson(401, { code: "ACCESS_DENIED", message: "Full authentication is required" })),
    );
    const error = await obtenerPlanDeInvitacion(12).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(401);
  });

  it("un 500 con un code que no es `PAY_*` no se disfraza de error de pago conocido", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(500, { code: "TPL_INTERNAL", message: "boom" })));
    const error = await obtenerCatalogo().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDePago);
    expect((error as ErrorDePago).code).toBe("PAY_DESCONOCIDO");
  });

  it("un cuerpo ilegible (HTML de un proxy, 502) se clasifica como ErrorDePago PAY_DESCONOCIDO", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 })));
    const error = await obtenerCatalogo().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDePago);
    expect((error as ErrorDePago).code).toBe("PAY_DESCONOCIDO");
    // isKnownCode=true: PAY_DESCONOCIDO es un código reconocido por el frontend (su catch-all),
    // no uno inventado por el backend — ese caso lo cubre tipos.test.ts.
    expect((error as ErrorDePago).isKnownCode).toBe(true);
  });

  it("nunca devuelve null en vez de lanzar: una promesa resuelta o un throw, nunca los dos a medias", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(500, undefined)));
    await expect(obtenerCatalogo()).rejects.toBeInstanceOf(ErrorDePago);
  });
});

describe("crearCheckout (POST /product/payments/checkout)", () => {
  it("manda invitationId y planCodigo, nunca un importe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(201, { checkoutUrl: "https://checkout.stripe.com/cs_test_1", sessionId: "cs_test_1", paymentId: 7 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await crearCheckout(12, "fiesta");
    expect(resultado.paymentId).toBe(7);
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(cuerpo).toEqual({ invitationId: 12, planCodigo: "fiesta" });
    expect(cuerpo.importeCentavos).toBeUndefined();
  });

  it("manda Authorization cuando hay sesión (ruta autenticada)", async () => {
    setAuthToken("jwt-xyz");
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(201, { checkoutUrl: "https://checkout.stripe.com/cs_2", sessionId: "cs_2", paymentId: 8 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await crearCheckout(1, "sencillo");
    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.get("Authorization")).toBe("Bearer jwt-xyz");
  });
});

describe("obtenerMisPagos (GET /product/payments/pagos)", () => {
  it("devuelve el arreglo `pagos`, no el sobre completo", async () => {
    const pagos = [
      {
        id: 7,
        estado: "PAGADO",
        planCodigo: "fiesta",
        planNombre: "Fiesta",
        importeCentavos: 89900,
        moneda: "MXN",
        creadoEn: "2026-03-03T18:00:00Z",
        pagadoEn: "2026-03-03T18:22:10Z",
        comprobanteUrl: null,
        invitationId: 12,
        nombreEvento: "Boda de Ana y Luis",
      },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(200, { pagos })));
    const resultado = await obtenerMisPagos();
    expect(resultado).toEqual(pagos);
  });
});
