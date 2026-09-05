// lib/enlace-publico.test.ts — U-6: «el enlace que se comparte es http://localhost/i/…».
// Cada `it` de este archivo falla con el código anterior al bloque 3-8 (que entregaba
// `resultado.publicUrl` tal cual, sin mirar el origen del sitio y sin comprobar nada al arrancar).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enlacePublico,
  esOrigenLocal,
  motivoDeArranqueInvalido,
  motivoDeOrigenDesalineado,
  origenPublico,
} from "./enlace-publico.ts";

const TOKEN = "pub_FCTH3DCWGNP954PYK16F0XH5GV";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
  it("NO usa el publicUrl del servidor (el defecto original de U-6)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).not.toMatch(/localhost\/i\//);
  });

  // N-02 (`ADR-3C-N02-01`): el orden se INVIRTIÓ. `NEXT_PUBLIC_SITE_URL` se hornea en el build, así
  // que el mismo artefacto servido en otro origen repartía enlaces al origen de compilación
  // (medido en `bitacora/3b-adv.md §6.2`). Manda el origen por el que la clienta navega de verdad.
  it("en el navegador manda `window.location.origin`, aunque haya una variable horneada distinta", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx");
    expect(origenPublico()).toBe(window.location.origin);
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).toBe(`${window.location.origin}/i/${TOKEN}`);
  });

  it("sin origen declarado usa el origen por el que la clienta está entrando ahora mismo", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    // jsdom sirve la página en http://localhost:3000 por defecto; lo que importa es que NO se caiga
    // al `publicUrl` del servidor mientras exista un origen de navegador.
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).toBe(`${window.location.origin}/i/${TOKEN}`);
    expect(origenPublico()).toBe(window.location.origin);
  });

  // Sin `window` —SSR, metadatos, cualquier código de servidor— la variable declarada sigue siendo
  // la única fuente posible, y ahí sí manda. Es exactamente el reparto que fija `ADR-3C-N02-01`.
  it("en el servidor (sin window) manda la variable declarada, normalizando la barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://invitaciones.mx/");
    vi.stubGlobal("window", undefined);
    expect(origenPublico()).toBe("https://invitaciones.mx");
    expect(enlacePublico(TOKEN)).toBe(`https://invitaciones.mx/i/${TOKEN}`);
    vi.unstubAllGlobals();
  });

  it("sin window y sin variable declarada cae al publicUrl del servidor, que es el último recurso", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubGlobal("window", undefined);
    expect(origenPublico()).toBeNull();
    expect(enlacePublico(TOKEN, `http://localhost/i/${TOKEN}`)).toBe(`http://localhost/i/${TOKEN}`);
    vi.unstubAllGlobals();
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// N-02 · la aserción de arranque que compara el origen HORNEADO con el que se va a SERVIR
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe("motivoDeOrigenDesalineado · el build para un puerto, el servidor en otro", () => {
  // El caso EXACTO que midió la revisión adversarial de la fase 3-B: build horneado para `:3050`,
  // servido con `PORT=3000`. Antes nadie lo veía; ahora el proceso se niega a arrancar.
  it("detecta el desajuste medido en 3-B: horneado en :3050, servido en :3000", () => {
    const motivo = motivoDeOrigenDesalineado({
      NODE_ENV: "production",
      NEXT_PUBLIC_EDITOR_ORIGIN: "http://127.0.0.1:3050",
      PORT: "3000",
    } as NodeJS.ProcessEnv);
    expect(motivo).toMatch(/NEXT_PUBLIC_EDITOR_ORIGIN/);
    expect(motivo).toMatch(/3050/);
    expect(motivo).toMatch(/3000/);
  });

  it("también mira NEXT_PUBLIC_SITE_URL, que es la que reparte los enlaces a las invitadas", () => {
    expect(
      motivoDeOrigenDesalineado({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3050",
        PORT: "3000",
      } as NodeJS.ProcessEnv),
    ).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("no dice nada cuando el puerto horneado y el servido coinciden", () => {
    expect(
      motivoDeOrigenDesalineado({
        NODE_ENV: "production",
        NEXT_PUBLIC_EDITOR_ORIGIN: "http://127.0.0.1:3000",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
        PORT: "3000",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("sin PORT usa el 3000 por defecto de `next start`", () => {
    expect(
      motivoDeOrigenDesalineado({ NODE_ENV: "production", NEXT_PUBLIC_EDITOR_ORIGIN: "http://127.0.0.1:3000" } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      motivoDeOrigenDesalineado({ NODE_ENV: "production", NEXT_PUBLIC_EDITOR_ORIGIN: "http://127.0.0.1:3050" } as NodeJS.ProcessEnv),
    ).toMatch(/3050/);
  });

  it("con EDITOR_ORIGIN declarado se compara contra ÉL, no contra el puerto", () => {
    expect(
      motivoDeOrigenDesalineado({
        NODE_ENV: "production",
        EDITOR_ORIGIN: "https://invitaciones.mx",
        NEXT_PUBLIC_SITE_URL: "https://otra-cosa.mx",
        PORT: "3000",
      } as NodeJS.ProcessEnv),
    ).toMatch(/EDITOR_ORIGIN=https:\/\/invitaciones\.mx/);
    expect(
      motivoDeOrigenDesalineado({
        NODE_ENV: "production",
        EDITOR_ORIGIN: "https://invitaciones.mx",
        NEXT_PUBLIC_SITE_URL: "https://invitaciones.mx",
        PORT: "3000",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  // Detrás de un proxy inverso el puerto interno (3000) no tiene por qué parecerse al público (443):
  // afirmar ahí sería un falso positivo que tumbaría un despliegue correcto. Con un origen horneado
  // público y sin `EDITOR_ORIGIN` no se puede saber nada, y no se afirma nada.
  it("no inventa un desajuste cuando el origen horneado es público y no hay EDITOR_ORIGIN", () => {
    expect(
      motivoDeOrigenDesalineado({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://invitaciones.mx",
        PORT: "3000",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("no se mete en desarrollo, ni durante el build, y respeta su puerta de escape", () => {
    const roto = { NEXT_PUBLIC_EDITOR_ORIGIN: "http://127.0.0.1:3050", PORT: "3000" };
    expect(motivoDeOrigenDesalineado({ ...roto, NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBeNull();
    expect(
      motivoDeOrigenDesalineado({ ...roto, NODE_ENV: "production", NEXT_PHASE: "phase-production-build" } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      motivoDeOrigenDesalineado({ ...roto, NODE_ENV: "production", PERMITIR_ORIGEN_DESALINEADO: "1" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("sin nada horneado no hay nada que comparar", () => {
    expect(motivoDeOrigenDesalineado({ NODE_ENV: "production", PORT: "3050" } as NodeJS.ProcessEnv)).toBeNull();
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
