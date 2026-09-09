// lib/invitados/rsvp.test.ts — pruebas del cliente del §2 del contrato de invitados
// (`handoffs/5-2-contrato-invitados.md`). Mismo patrón que `lib/api-client.test.ts`: `fetch`
// simulado con `vi.stubGlobal`, sin mockear el módulo — se prueba el fetch de verdad.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, SessionError, UnknownApiError, enviarRsvp, obtenerRsvp } from "./rsvp";

function respuestaJson(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ESTADO_PENDIENTE = {
  guest: {
    fullName: "María Fernanda Cruz",
    adults: 2,
    children: 1,
    young: 0,
    adultsConfirmed: 0,
    childrenConfirmed: 0,
    youngConfirmed: 0,
    status: "PENDING",
    hasEmail: true,
  },
  event: { publicToken: "pub_01J5ZQK8N4T2R7VWXY3ABCDEFG", childrenAllowed: true, youngAllowed: false, closed: false },
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("obtenerRsvp — GET /public/r/{token}", () => {
  it("devuelve el invitado y las reglas del evento, forma exacta del contrato", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, ESTADO_PENDIENTE));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await obtenerRsvp("token-de-prueba");

    expect(resultado).toEqual(ESTADO_PENDIENTE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/public/r/token-de-prueba");
    expect(init.method).toBe("GET");
  });

  it("nunca manda Authorization: esta superficie no tiene sesión", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, ESTADO_PENDIENTE));
    vi.stubGlobal("fetch", fetchMock);

    await obtenerRsvp("token-de-prueba");

    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });

  it("codifica el token en la URL (defensa ante un token con caracteres especiales)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, ESTADO_PENDIENTE));
    vi.stubGlobal("fetch", fetchMock);

    await obtenerRsvp("a/b?c=d");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://127.0.0.1:6003/public/r/a%2Fb%3Fc%3Dd");
  });

  it.each([
    ["token inexistente, caducado, rotado o de invitación despublicada", "RSVP_LINK_NOT_FOUND"],
    ["invitado no encontrado", "GUEST_NOT_FOUND"],
    ["invitación no encontrada", "INVITATION_NOT_FOUND"],
    ["convocatoria cerrada", "RSVP_CLOSED"],
    ["demasiados intentos", "RSVP_TOO_MANY_ATTEMPTS"],
    ["error interno del módulo RSVP", "RSVP_INTERNAL"],
  ])("%s → ApiError con code %s, nunca null", async (_descripcion, code) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaJson(code === "RSVP_TOO_MANY_ATTEMPTS" ? 429 : 404, {
        code,
        message: "Este enlace ya no funciona",
      })),
    );

    const error = await obtenerRsvp("token-cualquiera").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
  });

  it("el 404 RSVP_LINK_NOT_FOUND es BYTE A BYTE igual para un token inventado que para uno con formato inválido — no hay forma de distinguirlos desde el cliente", async () => {
    const cuerpo = { code: "RSVP_LINK_NOT_FOUND", message: "Este enlace ya no funciona" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, cuerpo)));
    const errorInventado = await obtenerRsvp("token-inventado").catch((e: unknown) => e);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, cuerpo)));
    const errorMalFormado = await obtenerRsvp("!!!").catch((e: unknown) => e);

    expect((errorInventado as ApiError).code).toBe((errorMalFormado as ApiError).code);
    expect((errorInventado as ApiError).message).toBe((errorMalFormado as ApiError).message);
  });

  it("un cuerpo no reconocible se clasifica como UnknownApiError, sin perder el texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 })));
    const error = await obtenerRsvp("token-de-prueba").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect((error as UnknownApiError).rawBody).toContain("502 Bad Gateway");
  });

  it("un 401/403 sin code se clasifica como SessionError (defensivo: esta ruta no debería producirlo nunca)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const error = await obtenerRsvp("token-de-prueba").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
  });
});

describe("enviarRsvp — PUT /public/r/{token}", () => {
  it("manda el cuerpo exacto y devuelve el estado actualizado", async () => {
    const actualizado = {
      ...ESTADO_PENDIENTE,
      guest: { ...ESTADO_PENDIENTE.guest, status: "CONFIRMED", adultsConfirmed: 2, childrenConfirmed: 1 },
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, actualizado));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await enviarRsvp("token-de-prueba", { attending: true, adults: 2, children: 1, young: 0 });

    expect(resultado.guest.status).toBe("CONFIRMED");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/public/r/token-de-prueba");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ attending: true, adults: 2, children: 1, young: 0 });
  });

  it("nunca manda Authorization en el PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, ESTADO_PENDIENTE));
    vi.stubGlobal("fetch", fetchMock);

    await enviarRsvp("token-de-prueba", { attending: false, adults: 0, children: 0, young: 0 });

    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });

  it("cambiar de opinión (declinar y volver a confirmar) es la misma llamada dos veces", async () => {
    const declinado = { ...ESTADO_PENDIENTE, guest: { ...ESTADO_PENDIENTE.guest, status: "DECLINED" } };
    const confirmado = { ...ESTADO_PENDIENTE, guest: { ...ESTADO_PENDIENTE.guest, status: "CONFIRMED" } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuestaJson(200, declinado))
      .mockResolvedValueOnce(respuestaJson(200, confirmado));
    vi.stubGlobal("fetch", fetchMock);

    const r1 = await enviarRsvp("token-de-prueba", { attending: false, adults: 0, children: 0, young: 0 });
    const r2 = await enviarRsvp("token-de-prueba", { attending: true, adults: 2, children: 1, young: 0 });

    expect(r1.guest.status).toBe("DECLINED");
    expect(r2.guest.status).toBe("CONFIRMED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("422 GUEST_QUOTA_EXCEEDED se clasifica como ApiError con ese code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(422, { code: "GUEST_QUOTA_EXCEEDED", message: "No puedes confirmar más lugares de los que te asignaron" }),
      ),
    );
    const error = await enviarRsvp("token-de-prueba", { attending: true, adults: 99, children: 0, young: 0 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_QUOTA_EXCEEDED");
  });

  it("422 GUEST_INVALID (los tres cupos en cero con attending:true) se clasifica como ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaJson(422, { code: "GUEST_INVALID", message: "Revisa los datos de tu confirmación" })),
    );
    const error = await enviarRsvp("token-de-prueba", { attending: true, adults: 0, children: 0, young: 0 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_INVALID");
  });

  it("409 RSVP_CLOSED (evento ya pasado) se clasifica como ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaJson(409, { code: "RSVP_CLOSED", message: "Esta convocatoria ya cerró" })),
    );
    const error = await enviarRsvp("token-de-prueba", { attending: true, adults: 1, children: 0, young: 0 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("RSVP_CLOSED");
  });

  it("429 RSVP_TOO_MANY_ATTEMPTS se clasifica como ApiError, sin decir si el token era válido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuestaJson(429, { code: "RSVP_TOO_MANY_ATTEMPTS", message: "Espera un momento" })),
    );
    const error = await enviarRsvp("token-de-prueba", { attending: true, adults: 1, children: 0, young: 0 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("RSVP_TOO_MANY_ATTEMPTS");
    expect((error as ApiError).statusCode).toBe(429);
  });

  it("nunca manda un campo email aunque el llamador intente colarlo (el tipo de entrada no lo admite)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, ESTADO_PENDIENTE));
    vi.stubGlobal("fetch", fetchMock);

    // @ts-expect-error — `email` no es un campo válido de RsvpRespuestaInput (S-07): esto es a
    // propósito, para que un intento de colarlo falle en compilación, no solo en runtime.
    await enviarRsvp("token-de-prueba", { attending: true, adults: 1, children: 0, young: 0, email: "hack@evil.com" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("email");
  });
});
