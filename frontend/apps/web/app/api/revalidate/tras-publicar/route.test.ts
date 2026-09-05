// app/api/revalidate/tras-publicar/route.test.ts — U-5: «publicas y el invitado ve la versión
// anterior ~5 min». Este handler es el que hace que la invalidación OCURRA de verdad; sin él,
// `revalidateTag` no se llamaba nunca (cero peticiones medidas en todo el registro del servidor).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));

const { POST } = await import("./route.ts");

const TOKEN = "pub_FCTH3DCWGNP954PYK16F0XH5GV";

function peticion(body: unknown): Request {
  return new Request("http://localhost/api/revalidate/tras-publicar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** El backend REAL responde `{published: boolean}` en `GET /public/i/{token}/exists` (03 §3.16). */
function backendDice(published: boolean, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ published }), { status: ok ? 200 : 500, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  revalidateTagMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("purga la caché del enlace público cuando el estado real lo respalda", () => {
  it("published + la invitación está publicada ⇒ revalida la etiqueta de ESE token", async () => {
    backendDice(true);
    const r = await POST(peticion({ publicToken: TOKEN, motivo: "published" }));
    expect(r.status).toBe(200);
    await expect(r.json()).resolves.toMatchObject({ revalidated: true, tag: `invitation:${TOKEN}` });
    expect(revalidateTagMock).toHaveBeenCalledWith(`invitation:${TOKEN}`, { expire: 0 });
  });

  it("unpublished + la invitación ya no está publicada ⇒ también revalida", async () => {
    backendDice(false);
    const r = await POST(peticion({ publicToken: TOKEN, motivo: "unpublished" }));
    expect(r.status).toBe(200);
    expect(revalidateTagMock).toHaveBeenCalledTimes(1);
  });
});

describe("no purga nada sin prueba de estado (es la autorización de este handler)", () => {
  it("dice «publicado» pero el backend dice que no ⇒ 409 y CERO revalidaciones", async () => {
    backendDice(false);
    const r = await POST(peticion({ publicToken: TOKEN, motivo: "published" }));
    expect(r.status).toBe(409);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("el backend no contesta ⇒ 502 y CERO revalidaciones (nunca un éxito silencioso)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const r = await POST(peticion({ publicToken: TOKEN, motivo: "published" }));
    expect(r.status).toBe(502);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("un token con forma de ruta no llega ni a consultarse", async () => {
    const espia = vi.fn();
    vi.stubGlobal("fetch", espia);
    const r = await POST(peticion({ publicToken: "../../etc/passwd", motivo: "published" }));
    expect(r.status).toBe(400);
    expect(espia).not.toHaveBeenCalled();
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("un motivo inventado se rechaza", async () => {
    backendDice(true);
    const r = await POST(peticion({ publicToken: TOKEN, motivo: "lo-que-sea" }));
    expect(r.status).toBe(400);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("un cuerpo que no es JSON se rechaza", async () => {
    backendDice(true);
    const r = await POST(peticion("{esto no es json"));
    expect(r.status).toBe(400);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
