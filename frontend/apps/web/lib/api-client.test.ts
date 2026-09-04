// lib/api-client.test.ts — pruebas del cliente HTTP tipado (el entregable más importante del
// bloque 3-1). Cubre los requisitos duros del brief: clasificación de errores por `code`, 401/403
// sin `TPL_*` como `SessionError`, `clientBatchId`/`baseRevision` obligatorios, límites de cuerpo,
// assets con cuerpo binario crudo (nunca multipart), y el token en un solo lugar (P8).
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientValidationError,
  ApiError,
  SessionError,
  UnknownApiError,
  authLogin,
  chooseTemplate,
  clearAuthToken,
  deleteAsset,
  getAuthToken,
  getCatalog,
  getPublicExists,
  getPublicRender,
  postOperations,
  restoreRevision,
  setAuthToken,
  uploadAsset,
} from "./api-client.ts";

function respuestaJson(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const ERROR_TPL_FORBIDDEN = {
  timestamp: "04/09/2026 10:00:00",
  statusCode: 403,
  code: "TPL_FORBIDDEN",
  message: "no tienes acceso a esta invitación",
};

beforeEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("token de sesión (P8, un solo lugar)", () => {
  it("setAuthToken/getAuthToken/clearAuthToken funcionan sin red", () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken("token-de-prueba");
    expect(getAuthToken()).toBe("token-de-prueba");
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });

  it("authLogin guarda el accessToken que devuelve POST /auth/token (verificado: NO es 'token')", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { accessToken: "jwt-abc", refreshToken: "r-abc", role: "USER", isSurveyAnswered: false }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await authLogin({ email: "a@b.com", password: "x" });
    expect(resultado.accessToken).toBe("jwt-abc");
    expect(getAuthToken()).toBe("jwt-abc");
    // auth:false — /auth/token no lleva Authorization (no hay token todavía)
    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });

  it("las rutas autenticadas mandan Authorization: Bearer <token>", async () => {
    setAuthToken("jwt-xyz");
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, { items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    await getCatalog();
    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.get("Authorization")).toBe("Bearer jwt-xyz");
  });

  it("getPublicRender NO manda Authorization aunque haya token (ruta pública, auth:false)", async () => {
    setAuthToken("jwt-xyz");
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { composed: {}, publishedAt: "2026-01-01T00:00:00Z", contentHash: "sha256:abc" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await getPublicRender("pub_abc");
    const cabeceras = fetchMock.mock.calls[0][1].headers as Headers;
    expect(cabeceras.has("Authorization")).toBe(false);
  });
});

describe("clasificación de errores (P1: nada se descarta en silencio)", () => {
  it("un TplErrorResponse con code TPL_* se lanza como ApiError y conserva el code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(403, ERROR_TPL_FORBIDDEN)));
    const error = await getCatalog().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("TPL_FORBIDDEN");
    expect((error as ApiError).statusCode).toBe(403);
  });

  it("un 401 SIN code TPL_* (cadena de filtros de Spring) se clasifica como SessionError, no ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const error = await getCatalog().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).statusCode).toBe(401);
  });

  it("un 403 SIN code TPL_* (rol insuficiente de Spring) se clasifica como SessionError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    const error = await getCatalog().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
  });

  it("un 403 CON code TPL_FORBIDDEN se clasifica como ApiError, no SessionError (no se confunden)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(403, ERROR_TPL_FORBIDDEN)));
    const error = await getCatalog().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SessionError);
  });

  it("un cuerpo no reconocible (HTML de un proxy, etc.) se clasifica como UnknownApiError, sin perder el texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 })));
    const error = await getCatalog().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownApiError);
    expect((error as UnknownApiError).rawBody).toContain("502 Bad Gateway");
  });
});

describe("operations: clientBatchId y baseRevision obligatorios (contratos.md §4)", () => {
  it("un clientBatchId corto (< 8 chars) se rechaza EN EL CLIENTE, antes de enviar la petición", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      postOperations(1, {
        baseRevision: 0,
        clientBatchId: "corto",
        operations: [{ op: "setBlock", blockId: "cover.title", value: { kind: "text", value: "Hola" } }],
      }),
    ).rejects.toBeInstanceOf(ApiClientValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un lote válido se envía con baseRevision y clientBatchId intactos", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(200, { revision: 1, applied: true, idMap: {}, composed: {}, report: {} }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const resultado = await postOperations(1, {
      baseRevision: 0,
      clientBatchId: "batch-suficientemente-largo",
      operations: [{ op: "setSectionVisible", sectionKey: "story", visible: false }],
    });
    expect(resultado.applied).toBe(true);
    const cuerpoEnviado = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(cuerpoEnviado.baseRevision).toBe(0);
    expect(cuerpoEnviado.clientBatchId).toBe("batch-suficientemente-largo");
  });

  it("restore exige baseRevision (TypeScript ya lo obliga; se comprueba que viaja en el cuerpo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaJson(200, { revision: 5, composed: {}, report: {}, movedToAttic: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await restoreRevision(1, { revision: 3, baseRevision: 4 });
    const cuerpoEnviado = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(cuerpoEnviado.baseRevision).toBe(4);
  });

  it("choose-template puede omitir baseRevision (primera creación, 03 §3.2) sin mandar null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(201, {
        revision: 0,
        created: true,
        document: {},
        composed: {},
        report: {},
        movedToAttic: [],
        publicToken: "pub_x",
        publicUrl: "http://x",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await chooseTemplate(1, { templateSlug: "boda-clasica", templateVersion: "1.0.0" });
    const cuerpoEnviado = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect("baseRevision" in cuerpoEnviado).toBe(false); // nunca se manda `null` (03: null cuenta como ausente)
  });
});

describe("límites de cuerpo (03-api.md §8: 768 KiB operations, 8 KiB el resto)", () => {
  it("un lote de 50 operaciones con textos largos supera 768 KiB y se rechaza sin llegar a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // 50 operaciones × 2000 caracteres (el máximo de TextValue.value) ronda 100 KB de texto puro,
    // así que se fuerza el límite acolchando cada valor con el máximo permitido por el esquema y
    // repitiendo variantes de operación con más carga (`richText`, que admite hasta 40 párrafos).
    const operacionesGrandes = Array.from({ length: 50 }, (_, i) => ({
      op: "setBlock" as const,
      blockId: `cover.b${i}`,
      value: {
        kind: "richText" as const,
        doc: {
          type: "doc" as const,
          content: Array.from({ length: 40 }, () => ({
            type: "paragraph" as const,
            content: [{ type: "text" as const, text: "y".repeat(2000) }],
          })),
        },
      },
    }));
    await expect(
      postOperations(1, { baseRevision: 0, clientBatchId: "batch-suficientemente-largo", operations: operacionesGrandes }),
    ).rejects.toBeInstanceOf(ApiClientValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("una petición JSON de 8 KiB (choose-template) que supera el límite se rechaza en el cliente", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      chooseTemplate(1, {
        templateSlug: "boda-clasica",
        templateVersion: "1.0.0",
        baseRevision: 0,
        // @ts-expect-error -- campo deliberadamente enorme para forzar el límite de 8 KiB en la prueba
        relleno: "z".repeat(9 * 1024),
      }),
    ).rejects.toBeInstanceOf(ApiClientValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("cuerpos estrictos: un campo null cuenta como ausente, nunca se envía (03-api.md §8)", () => {
  it("choose-template con baseRevision: null llega al backend SIN esa clave, no con null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(201, {
        revision: 0,
        created: true,
        document: {},
        composed: {},
        report: {},
        movedToAttic: [],
        publicToken: "pub_x",
        publicUrl: "http://x",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    // Un formulario o un caller externo puede construir el objeto con `baseRevision: null` (p. ej.
    // JSON.parse de algo que nunca tuvo el campo). `esquema/operations.ts` y sus pares son
    // `strictObject`: una clave `null` NO se interpreta como "ausente" del lado del servidor, así
    // que el cliente debe quitarla él mismo antes de serializar.
    await chooseTemplate(1, {
      templateSlug: "boda-clasica",
      templateVersion: "1.0.0",
      baseRevision: null as unknown as number | undefined,
    });
    const cuerpoEnviado = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect("baseRevision" in cuerpoEnviado).toBe(false);
    expect(cuerpoEnviado).toEqual({ templateSlug: "boda-clasica", templateVersion: "1.0.0" });
  });
});

describe("render público: ETag / If-None-Match → 304 (03 §7)", () => {
  it("devuelve status 'ok' con el ETag cuando el backend responde 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(
          200,
          { composed: { sections: [] }, publishedAt: "2026-01-01T00:00:00Z", contentHash: "sha256:abc" },
          { ETag: '"sha256:abc"' },
        ),
      ),
    );
    const resultado = await getPublicRender("pub_abc");
    expect(resultado.status).toBe("ok");
    if (resultado.status === "ok") {
      expect(resultado.etag).toBe('"sha256:abc"');
      expect(resultado.data.contentHash).toBe("sha256:abc");
    }
  });

  it("devuelve status 'not-modified' ante un 304 sin cuerpo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 304 })));
    const resultado = await getPublicRender("pub_abc", { ifNoneMatch: '"sha256:abc"' });
    expect(resultado.status).toBe("not-modified");
  });
});

describe("assets: cuerpo binario crudo, NUNCA multipart/form-data (03 §3.7)", () => {
  it("uploadAsset manda el Content-Type del archivo y el cuerpo tal cual (sin boundary de multipart)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuestaJson(201, {
        assetId: "as_x",
        bytes: 3,
        contentType: "image/webp",
        sha256: "a".repeat(64),
        previewUrl: "http://x",
        reused: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const bytes = new Uint8Array([1, 2, 3]);
    await uploadAsset(1, { data: bytes, contentType: "image/webp", bytes: bytes.byteLength });
    const [, init] = fetchMock.mock.calls[0];
    const cabeceras = init.headers as Headers;
    expect(cabeceras.get("Content-Type")).toBe("image/webp");
    expect(init.body).toBe(bytes);
  });

  it("rechaza en el cliente un archivo por encima de 15 MiB sin llegar a fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      uploadAsset(1, { data: new Uint8Array(1), contentType: "image/webp", bytes: 16 * 1024 * 1024 }),
    ).rejects.toBeInstanceOf(ApiClientValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("204 sin cuerpo (unpublish, deleteAsset)", () => {
  it("deleteAsset no intenta parsear JSON de una respuesta 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(deleteAsset(1, "as_x")).resolves.toBeUndefined();
  });

  it("un DELETE de asset ajeno da 404 TPL_ASSET_NOT_FOUND, nunca 403 (03 §3.9)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuestaJson(404, {
          timestamp: "04/09/2026 10:00:00",
          statusCode: 404,
          code: "TPL_ASSET_NOT_FOUND",
          message: "asset no encontrado",
        }),
      ),
    );
    const error = await deleteAsset(1, "as_ajeno").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("TPL_ASSET_NOT_FOUND");
  });
});

describe("getPublicExists (03 §3.16)", () => {
  it("responde {published:false} para un token inexistente, no 404 (no es un oráculo)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuestaJson(200, { published: false })));
    const resultado = await getPublicExists("token-que-no-existe");
    expect(resultado.published).toBe(false);
  });
});
