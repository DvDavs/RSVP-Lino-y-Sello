// app/api/revalidate/route.test.ts — el webhook de publicación (contratos.md §8, ADR-2-6-01).
// Cubre exactamente lo que pide el brief: los tres `reason`, token incorrecto, cuerpo malformado, y
// el caso "sin REVALIDATE_SECRET configurado ⇒ rechaza TODO" (nunca "acepta porque no hay token").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidateTag: revalidateTagMock }));

// Import dinámico DESPUÉS del mock (misma técnica que exige `vi.mock` con hoisting).
const { POST } = await import("./route.ts");

const SECRETO = "el-secreto-de-pruebas-suficientemente-largo";

function peticion(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  revalidateTagMock.mockReset();
  process.env.REVALIDATE_SECRET = SECRETO;
});

afterEach(() => {
  delete process.env.REVALIDATE_SECRET;
});

describe("sin REVALIDATE_SECRET configurado: rechaza TODO", () => {
  it("401 aunque el cuerpo y la cabecera serían válidos con un secreto puesto", async () => {
    delete process.env.REVALIDATE_SECRET;
    const respuesta = await POST(
      peticion(
        { tag: "invitation:pub_x", publicToken: "pub_x", reason: "published" },
        { "x-revalidate-token": "cualquier-cosa" },
      ),
    );
    expect(respuesta.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});

describe("token incorrecto", () => {
  it("401 invalid_token cuando la cabecera no coincide (comparación en tiempo constante)", async () => {
    const respuesta = await POST(
      peticion(
        { tag: "invitation:pub_x", publicToken: "pub_x", reason: "published" },
        { "x-revalidate-token": "esto-no-es-el-secreto" },
      ),
    );
    expect(respuesta.status).toBe(401);
    const cuerpo = await respuesta.json();
    expect(cuerpo.error).toBe("invalid_token");
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("401 también sin cabecera x-revalidate-token en absoluto", async () => {
    const respuesta = await POST(peticion({ tag: "invitation:pub_x", publicToken: "pub_x", reason: "published" }));
    expect(respuesta.status).toBe(401);
  });

  it("401 con un token de longitud distinta (no revela nada por timing)", async () => {
    const respuesta = await POST(
      peticion(
        { tag: "invitation:pub_x", publicToken: "pub_x", reason: "published" },
        { "x-revalidate-token": "corto" },
      ),
    );
    expect(respuesta.status).toBe(401);
  });
});

describe("cuerpo malformado", () => {
  it("400 malformed_json con un cuerpo que no es JSON", async () => {
    const respuesta = await POST(peticion("esto no es json{{{", { "x-revalidate-token": SECRETO }));
    expect(respuesta.status).toBe(400);
    const cuerpo = await respuesta.json();
    expect(cuerpo.error).toBe("malformed_json");
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("400 invalid_body con un reason fuera del enum cerrado", async () => {
    const respuesta = await POST(
      peticion(
        { tag: "invitation:pub_x", publicToken: "pub_x", reason: "algo-inventado" },
        { "x-revalidate-token": SECRETO },
      ),
    );
    expect(respuesta.status).toBe(400);
    const cuerpo = await respuesta.json();
    expect(cuerpo.error).toBe("invalid_body");
  });

  it("400 invalid_body si falta publicToken", async () => {
    const respuesta = await POST(
      peticion({ tag: "invitation:pub_x", reason: "published" }, { "x-revalidate-token": SECRETO }),
    );
    expect(respuesta.status).toBe(400);
  });
});

describe.each(["published", "unpublished", "token-rotated"] as const)("reason=%s", (reason) => {
  it(`200 y revalidateTag("invitation:<publicToken>") con reason=${reason}`, async () => {
    const respuesta = await POST(
      peticion(
        { tag: "invitation:pub_ABC123", publicToken: "pub_ABC123", reason },
        { "x-revalidate-token": SECRETO },
      ),
    );
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.json();
    expect(cuerpo.revalidated).toBe(true);
    expect(cuerpo.reason).toBe(reason);
    expect(revalidateTagMock).toHaveBeenCalledWith("invitation:pub_ABC123", { expire: 0 });
  });
});

describe("coherencia tag/publicToken (ADR-2-6-01: el backend siempre manda tag === invitation:<publicToken>)", () => {
  it("si algún día discreparan, se revalida la etiqueta que corresponde al publicToken, no la suelta", async () => {
    const respuesta = await POST(
      peticion(
        { tag: "invitation:otro-token", publicToken: "pub_real", reason: "published" },
        { "x-revalidate-token": SECRETO },
      ),
    );
    expect(respuesta.status).toBe(200);
    expect(revalidateTagMock).toHaveBeenCalledWith("invitation:pub_real", { expire: 0 });
  });
});
