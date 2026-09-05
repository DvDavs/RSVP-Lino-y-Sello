// lib/enlace-publico.test.ts — U-6: «el enlace que se comparte es http://localhost/i/…».
// Cada `it` de este archivo falla con el código anterior al bloque 3-8 (que entregaba
// `resultado.publicUrl` tal cual, sin mirar el origen del sitio y sin comprobar nada al arrancar).
import { afterEach, describe, expect, it, vi } from "vitest";
import { enlacePublico, esOrigenLocal, motivoDeArranqueInvalido, origenPublico } from "./enlace-publico.ts";

const TOKEN = "pub_FCTH3DCWGNP954PYK16F0XH5GV";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("esOrigenLocal · qué enlaces no le abren a nadie", () => {
  it.each(["http://localhost", "http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:80", "no-es-una-url"])(
    "%s es local (o inservible) para compartir",
    (origen) => {
      expect(esOrigenLocal(origen)).toBe(true);
    },
  );

  it("un origen público de verdad no lo es", () => {
    expect(esOrigenLocal("https://invitaciones.mx")).toBe(false);
  });
});

describe("enlacePublico · lo que se copia y se manda por WhatsApp", () => {
  it("usa el origen declarado del sitio y NO el publicUrl del servidor (el defecto de U-6)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).toBe(`https://invitaciones.mx/i/${TOKEN}`);
  });

  it("sin origen declarado usa el origen por el que la clienta está entrando ahora mismo", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    // jsdom sirve la página en http://localhost:3000 por defecto; lo que importa es que NO se caiga
    // al `publicUrl` del servidor mientras exista un origen de navegador.
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).toBe(`${window.location.origin}/i/${TOKEN}`);
    expect(origenPublico()).toBe(window.location.origin);
  });

  it("normaliza la barra final del origen declarado", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx/");
    expect(enlacePublico(TOKEN)).toBe(`https://invitaciones.mx/i/${TOKEN}`);
  });
});

describe("motivoDeArranqueInvalido · el arranque falla en un despliegue real con origen local", () => {
  const REAL = { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://api.invitaciones.mx" } as NodeJS.ProcessEnv;

  it("falla si NEXT_PUBLIC_SITE_URL no está declarada", () => {
    expect(motivoDeArranqueInvalido({ ...REAL })).toMatch(/NEXT_PUBLIC_SITE_URL no está definida/);
  });

  it("falla si el origen declarado es localhost", () => {
    expect(motivoDeArranqueInvalido({ ...REAL, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toMatch(/solo abre en esta máquina/);
  });

  it("no falla con un origen público real", () => {
    expect(motivoDeArranqueInvalido({ ...REAL, NEXT_PUBLIC_SITE_URL: "https://invitaciones.mx" })).toBeNull();
  });

  it("no rompe los arranques locales del propio repositorio (API en el bucle local)", () => {
    expect(
      motivoDeArranqueInvalido({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:6003",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("respeta la puerta de escape explícita y no se mete en desarrollo ni en el build", () => {
    expect(motivoDeArranqueInvalido({ ...REAL, PERMITIR_ORIGEN_LOCAL: "1" } as NodeJS.ProcessEnv)).toBeNull();
    expect(motivoDeArranqueInvalido({ ...REAL, NEXT_PHASE: "phase-production-build" } as NodeJS.ProcessEnv)).toBeNull();
    expect(motivoDeArranqueInvalido({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBeNull();
  });
});
