// test/proxy-origen.test.ts — N-02 (`ADR-3C-N02-01`): el origen de la CSP del lienzo se resuelve
// EN CADA PETICIÓN, no al construir.
//
// El defecto que esto vigila está medido en `bitacora/3b-adv.md §6.2`: `proxy.ts` leía
// `NEXT_PUBLIC_EDITOR_ORIGIN`, que Next hornea en el bundle al construir. El mismo artefacto
// compilado para `:3050` y servido en `:3000` emitía `frame-ancestors http://127.0.0.1:3050`, el
// navegador rechazaba el `<iframe>` del lienzo y la vista previa del editor moría en silencio.
//
// Ninguna compuerta del repositorio lo veía: `playwright.config.ts` y `lighthouserc.cjs`
// RECONSTRUYEN con el mismo origen que después sirven. Esta prueba mira el otro lado —qué origen
// nombra la cabecera dado un `Host`— y la A/B del bloque
// (`docs/rediseno-plantillas/evidencia/fase-3c/bloque-menos1/ab-origen.mjs`) lo comprueba sobre el
// producto servido en dos puertos a la vez.
import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import proxy, { origenDeLaAplicacion } from "../proxy.ts";

/** `NextRequest` de mentira con lo único que `origenDeLaAplicacion` mira: cabeceras y `nextUrl`. */
function peticion(url: string, cabeceras: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(cabeceras),
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

describe("origenDeLaAplicacion · el origen que nombra la CSP del lienzo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin nada declarado, usa el `Host` por el que llegó la petición (el caso medido en 3-B)", () => {
    // El artefacto puede haberse construido para :3050; el navegador entró por :3000 y es contra
    // :3000 contra lo que va a comparar `frame-ancestors`.
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    expect(origenDeLaAplicacion(peticion("http://127.0.0.1:3000/editor/1/canvas", { host: "127.0.0.1:3000" }))).toBe(
      "http://127.0.0.1:3000",
    );
    expect(origenDeLaAplicacion(peticion("http://127.0.0.1:3050/editor/1/canvas", { host: "127.0.0.1:3050" }))).toBe(
      "http://127.0.0.1:3050",
    );
  });

  it("`EDITOR_ORIGIN` (variable de SERVIDOR) manda sobre la cabecera y sobre lo horneado", () => {
    vi.stubEnv("EDITOR_ORIGIN", "https://invitaciones.mx");
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    expect(origenDeLaAplicacion(peticion("http://10.0.0.4:3000/editor/1/canvas", { host: "10.0.0.4:3000" }))).toBe(
      "https://invitaciones.mx",
    );
  });

  it("con un proxy inverso delante usa `x-forwarded-host`/`x-forwarded-proto`, que es el origen público", () => {
    expect(
      origenDeLaAplicacion(
        peticion("http://10.0.0.4:3000/editor/1/canvas", {
          host: "10.0.0.4:3000",
          "x-forwarded-host": "invitaciones.mx",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://invitaciones.mx");
  });

  it("de una lista de saltos se queda con el primero, que es el del cliente", () => {
    expect(
      origenDeLaAplicacion(
        peticion("http://10.0.0.4:3000/x", {
          "x-forwarded-host": "invitaciones.mx, interno.local",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://invitaciones.mx");
  });

  // Una cabecera con `;` o con un salto de línea partiría la cabecera CSP y podría inyectar
  // directivas. Se descarta y se sigue al siguiente candidato, nunca se pega tal cual.
  it("un `Host` con basura no se cuela en la cabecera: se descarta y se sigue", () => {
    expect(
      origenDeLaAplicacion(peticion("http://127.0.0.1:3000/x", { host: "malo; script-src 'unsafe-inline'" })),
    ).toBe("http://127.0.0.1:3000");
    expect(
      origenDeLaAplicacion(peticion("http://127.0.0.1:3000/x", { "x-forwarded-host": "invitaciones.mx/algo" })),
    ).toBe("http://127.0.0.1:3000");
    expect(origenDeLaAplicacion(peticion("http://127.0.0.1:3000/x", { "x-forwarded-host": "" }))).toBe(
      "http://127.0.0.1:3000",
    );
    // Un salto de línea ni siquiera llega hasta aquí: `Headers` lo rechaza al construirse, así que
    // la partición de cabecera está cerrada por dos sitios. Comprobado con la plataforma de verdad.
    expect(() => new Headers({ "x-forwarded-host": "a\nb" })).toThrow();
  });
});

describe("proxy · la cabecera servida nombra el origen de la petición y no afloja nada", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("el mismo código sirve una CSP distinta según por dónde entre el navegador", () => {
    vi.stubEnv("NEXT_PUBLIC_EDITOR_ORIGIN", "http://127.0.0.1:3050");
    const en3000 = proxy(peticion("http://127.0.0.1:3000/editor/1/canvas", { host: "127.0.0.1:3000" }));
    const en3050 = proxy(peticion("http://127.0.0.1:3050/editor/1/canvas", { host: "127.0.0.1:3050" }));

    const csp3000 = en3000.headers.get("content-security-policy") ?? "";
    const csp3050 = en3050.headers.get("content-security-policy") ?? "";

    expect(csp3000).toContain("frame-ancestors http://127.0.0.1:3000");
    expect(csp3050).toContain("frame-ancestors http://127.0.0.1:3050");
    expect(csp3000).toContain("script-src http://127.0.0.1:3000 'nonce-");
    expect(csp3000).toContain("style-src http://127.0.0.1:3000 'nonce-");
    expect(csp3000).toContain("font-src http://127.0.0.1:3000 ");
    expect(csp3000).toContain("img-src http://127.0.0.1:3000 ");

    // Lo que la CSP del lienzo NO puede llevar nunca (A4, `contratos.md §12.1`).
    for (const csp of [csp3000, csp3050]) {
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("connect-src 'none'");
      expect(csp).not.toContain("'self'");
      expect(csp).not.toMatch(/unsafe-eval|unsafe-inline/);
    }
  });

  it("el nonce es distinto en cada petición", () => {
    const a = proxy(peticion("http://127.0.0.1:3000/x", { host: "127.0.0.1:3000" })).headers.get("content-security-policy");
    const b = proxy(peticion("http://127.0.0.1:3000/x", { host: "127.0.0.1:3000" })).headers.get("content-security-policy");
    expect(a).not.toBe(b);
  });

  it("`CDN_ORIGIN` de servidor manda sobre el `NEXT_PUBLIC_CDN_ORIGIN` horneado", () => {
    vi.stubEnv("NEXT_PUBLIC_CDN_ORIGIN", "http://127.0.0.1:6003");
    vi.stubEnv("CDN_ORIGIN", "https://cdn.invitaciones.mx");
    const csp =
      proxy(peticion("http://127.0.0.1:3000/x", { host: "127.0.0.1:3000" })).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("img-src http://127.0.0.1:3000 https://cdn.invitaciones.mx data:");
    expect(csp).not.toContain("127.0.0.1:6003");
  });
});
