// lib/invitados/api.test.ts — pruebas del cliente HTTP de invitados (§1 del contrato). Cubre cada
// ruta, cada código de error documentado, que `Authorization` viaja y que el 401/403 sin `code` se
// clasifica como `SessionError` (nunca como un `ApiError` inventado).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, SessionError, UnknownApiError, clearAuthToken, setAuthToken } from "@/lib/api-client";
import {
  createGuest,
  deleteGuest,
  exportGuestsCsv,
  getGuestLink,
  getGuestsSummary,
  importGuestsPaste,
  listGuests,
  previewGuestsPaste,
  sendGuestEmail,
  updateGuest,
} from "./api";

function respuestaJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function errorDe(code: string, message = "mensaje de prueba"): Record<string, unknown> {
  return { timestamp: "2026-09-09T10:00:00Z", statusCode: 422, code, message };
}

beforeEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("Authorization viaja en cada ruta autenticada", () => {
  it("listGuests manda Authorization: Bearer <token>", async () => {
    setAuthToken("jwt-abc");
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await listGuests(7);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/product/invitations/7/guests");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer jwt-abc");
  });

  it("sin token, no se manda cabecera Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { guests: { total: 0, pending: 0, confirmed: 0, declined: 0 }, seats: { adults: { invited: 0, confirmed: 0 }, children: { invited: 0, confirmed: 0 }, young: { invited: 0, confirmed: 0 }, totalInvited: 0, totalConfirmed: 0 }, rules: { childrenAllowed: true, youngAllowed: false } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await getGuestsSummary(7);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).has("Authorization")).toBe(false);
  });

  it("listGuests envía search/status/page/size en la query", async () => {
    setAuthToken("jwt-abc");
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { content: [], page: 1, size: 10, totalElements: 0, totalPages: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await listGuests(7, { search: "María", status: "CONFIRMED", page: 1, size: 10 });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://127.0.0.1:6003/product/invitations/7/guests?search=Mar%C3%ADa&status=CONFIRMED&page=1&size=10",
    );
  });
});

describe("GET /guests/summary", () => {
  it("devuelve los contadores y las reglas de cupos", async () => {
    setAuthToken("jwt-abc");
    const cuerpo = {
      guests: { total: 49, pending: 12, confirmed: 34, declined: 3 },
      seats: {
        adults: { invited: 60, confirmed: 48 },
        children: { invited: 15, confirmed: 10 },
        young: { invited: 5, confirmed: 3 },
        totalInvited: 80,
        totalConfirmed: 61,
      },
      rules: { childrenAllowed: true, youngAllowed: false },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(200, cuerpo)));
    const resumen = await getGuestsSummary(7);
    expect(resumen).toEqual(cuerpo);
  });
});

describe("POST /guests → 201", () => {
  it("crea el invitado y devuelve el GuestItem", async () => {
    setAuthToken("jwt-abc");
    const item = {
      id: 12,
      fullName: "María Fernanda Cruz",
      email: null,
      phone: null,
      tableNumber: null,
      adults: 2,
      children: 0,
      young: 0,
      adultsConfirmed: 0,
      childrenConfirmed: 0,
      youngConfirmed: 0,
      status: "PENDING",
      message: null,
      updatedAt: "2026-03-01T18:22:10Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(201, item));
    vi.stubGlobal("fetch", fetchMock);
    const creado = await createGuest(7, { fullName: "María Fernanda Cruz", adults: 2 });
    expect(creado).toEqual(item);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ fullName: "María Fernanda Cruz", adults: 2 });
  });

  it("422 GUEST_QUOTA_EXCEEDED se lanza como ApiError con el code intacto", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(422, errorDe("GUEST_QUOTA_EXCEEDED"))));
    const error = await createGuest(7, { fullName: "x", children: 1 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_QUOTA_EXCEEDED");
    expect((error as ApiError).statusCode).toBe(422);
  });

  it("400 GUEST_INVALID se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(400, errorDe("GUEST_INVALID", "Falta el nombre."))));
    const error = await createGuest(7, { fullName: "" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_INVALID");
    expect((error as ApiError).message).toBe("Falta el nombre.");
  });

  it("409 GUEST_DUPLICATE se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(409, errorDe("GUEST_DUPLICATE"))));
    const error = await createGuest(7, { fullName: "x" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_DUPLICATE");
  });
});

describe("PUT / DELETE /guests/{guestId}", () => {
  it("updateGuest manda PUT con el cuerpo dado", async () => {
    setAuthToken("jwt-abc");
    const item = { id: 12, fullName: "Rocío", email: null, phone: null, tableNumber: null, adults: 1, children: 0, young: 0, adultsConfirmed: 0, childrenConfirmed: 0, youngConfirmed: 0, status: "PENDING", message: null, updatedAt: null };
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, item));
    vi.stubGlobal("fetch", fetchMock);
    const actualizado = await updateGuest(7, 12, { fullName: "Rocío", adults: 1 });
    expect(actualizado.fullName).toBe("Rocío");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/product/invitations/7/guests/12");
    expect(init.method).toBe("PUT");
  });

  it("404 GUEST_NOT_FOUND en PUT se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, errorDe("GUEST_NOT_FOUND"))));
    const error = await updateGuest(7, 999, { fullName: "x" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("GUEST_NOT_FOUND");
  });

  it("deleteGuest manda DELETE y no falla con 204 sin cuerpo", async () => {
    setAuthToken("jwt-abc");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteGuest(7, 12)).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/product/invitations/7/guests/12");
    expect(init.method).toBe("DELETE");
  });

  it("404 GUEST_NOT_FOUND en DELETE se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, errorDe("GUEST_NOT_FOUND"))));
    await expect(deleteGuest(7, 999)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("POST /guests:preview — nunca escribe", () => {
  it("devuelve ready y problems, con line/hint por renglón", async () => {
    setAuthToken("jwt-abc");
    const cuerpo = {
      ready: [{ fullName: "María Fernanda Cruz", email: null, phone: "9511234567", tableNumber: null, adults: 2, children: 1, young: 0 }],
      problems: [{ line: 3, raw: ", 3", code: "GUEST_INVALID", message: "Falta el nombre.", hint: "Escríbelo antes de la primera coma." }],
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, cuerpo));
    vi.stubGlobal("fetch", fetchMock);
    const vista = await previewGuestsPaste(7, "María Fernanda Cruz, 2, 1, 0, 9511234567\n, 3");
    expect(vista.ready).toHaveLength(1);
    expect(vista.problems[0]?.hint).toBe("Escríbelo antes de la primera coma.");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/product/invitations/7/guests:preview");
    expect(JSON.parse(init.body as string)).toEqual({ text: "María Fernanda Cruz, 2, 1, 0, 9511234567\n, 3" });
  });
});

describe("POST /guests:import — solo los renglones válidos", () => {
  it("devuelve los creados como GuestItem y conserva los problemas", async () => {
    setAuthToken("jwt-abc");
    const cuerpo = {
      ready: [{ id: 1, fullName: "María Fernanda Cruz", email: null, phone: null, tableNumber: null, adults: 2, children: 0, young: 0, adultsConfirmed: 0, childrenConfirmed: 0, youngConfirmed: 0, status: "PENDING", message: null, updatedAt: null }],
      problems: [{ line: 2, raw: ", 3", code: "GUEST_INVALID", message: "Falta el nombre.", hint: "Escríbelo antes de la primera coma." }],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(200, cuerpo)));
    const resultado = await importGuestsPaste(7, "texto");
    expect(resultado.ready[0]?.id).toBe(1);
    expect(resultado.problems).toHaveLength(1);
  });
});

describe("GET /guests/{guestId}/link — el único lugar que revela un token", () => {
  it("devuelve url, whatsappUrl y shareText", async () => {
    setAuthToken("jwt-abc");
    const cuerpo = {
      url: "https://lino.example/r/abc123",
      whatsappUrl: "https://wa.me/5215512345678?text=hola",
      shareText: "María Fernanda, te esperamos en la boda de Ana y Luis…",
    };
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, cuerpo));
    vi.stubGlobal("fetch", fetchMock);
    const enlace = await getGuestLink(7, 12);
    expect(enlace).toEqual(cuerpo);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:6003/product/invitations/7/guests/12/link");
  });

  it("404 GUEST_NOT_FOUND se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, errorDe("GUEST_NOT_FOUND"))));
    await expect(getGuestLink(7, 999)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("POST /guests/{guestId}:send-email → 202", () => {
  it("no falla con 202 sin cuerpo", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
    await expect(sendGuestEmail(7, 12)).resolves.toBeUndefined();
  });

  it("409 RSVP_CLOSED (sin release activo) se lanza como ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(409, errorDe("RSVP_CLOSED", "Esta invitación todavía no está publicada."))));
    const error = await sendGuestEmail(7, 12).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("RSVP_CLOSED");
  });
});

describe("GET /guests/export.csv — descarga con Authorization, nunca <a href>", () => {
  it("devuelve el blob y el nombre de archivo del Content-Disposition", async () => {
    setAuthToken("jwt-abc");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Nombre,Correo\nMaría,x@y.mx", {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="invitados-boda.csv"' },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const archivo = await exportGuestsCsv(7);
    expect(archivo.filename).toBe("invitados-boda.csv");
    expect(await archivo.blob.text()).toContain("María");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer jwt-abc");
  });

  it("sin Content-Disposition, usa un nombre por defecto", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("a,b", { status: 200 })));
    const archivo = await exportGuestsCsv(7);
    expect(archivo.filename).toBe("invitados.csv");
  });

  it("un fallo de la exportación se clasifica igual que el resto (ApiError)", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, errorDe("INVITATION_NOT_FOUND"))));
    await expect(exportGuestsCsv(999)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("clasificación de errores (P1: nada se descarta en silencio)", () => {
  it("401 sin code reconocible se clasifica como SessionError, no ApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const error = await listGuests(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(401);
  });

  it("403 sin code reconocible se clasifica como SessionError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    const error = await listGuests(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
  });

  it("404 INVITATION_NOT_FOUND se lanza como ApiError, no SessionError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(404, errorDe("INVITATION_NOT_FOUND"))));
    const error = await listGuests(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionError);
    expect((error as ApiError).code).toBe("INVITATION_NOT_FOUND");
  });

  it("un cuerpo no reconocible (HTML de un proxy) se clasifica como UnknownApiError", async () => {
    setAuthToken("jwt-abc");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 })));
    const error = await listGuests(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect((error as UnknownApiError).rawBody).toContain("502 Bad Gateway");
  });
});
