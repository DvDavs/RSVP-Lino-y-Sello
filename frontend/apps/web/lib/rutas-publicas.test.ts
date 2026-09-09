// lib/rutas-publicas.test.ts — `robots.ts`/`sitemap.ts` como funciones puras sobre un origen ya
// resuelto (nunca `process.env` ni `window`, ver la cabecera de `rutas-publicas.ts`).
import { describe, expect, it } from "vitest";
import { RUTAS_DE_VENTA, RUTAS_LEGALES, RUTAS_PRIVADAS, mapaDeSitio, reglasRobots } from "./rutas-publicas.ts";

const BASE = "https://linoysello.com";

describe("reglasRobots", () => {
  it("permite todo por defecto y bloquea las rutas privadas y las de invitación", () => {
    const reglas = reglasRobots(BASE);
    expect(reglas.rules).toEqual({ userAgent: "*", allow: "/", disallow: [...RUTAS_PRIVADAS] });
  });

  it("bloquea /editor, /perfil, /admin, /design, /preview, /i/, /r/ y /api — ninguno menos", () => {
    const reglas = reglasRobots(BASE);
    const disallow = Array.isArray(reglas.rules) ? reglas.rules[0]?.disallow : reglas.rules.disallow;
    for (const ruta of ["/editor", "/perfil", "/admin", "/design", "/preview", "/i/", "/r/", "/api"]) {
      expect(disallow).toContain(ruta);
    }
    expect(disallow).toHaveLength(8);
  });

  it("apunta al sitemap y al host del origen que se le pasa, sin fijarlo a un valor de prueba", () => {
    const reglas = reglasRobots(BASE);
    expect(reglas.sitemap).toBe(`${BASE}/sitemap.xml`);
    expect(reglas.host).toBe(BASE);

    const otraBase = "https://otro-origen.mx";
    const otrasReglas = reglasRobots(otraBase);
    expect(otrasReglas.sitemap).toBe(`${otraBase}/sitemap.xml`);
    expect(otrasReglas.host).toBe(otraBase);
  });
});

describe("mapaDeSitio", () => {
  const ahora = new Date("2026-09-09T00:00:00.000Z");

  it("son exactamente las rutas de venta: portada, ayuda, contacto y las dos hijas de legal", () => {
    const mapa = mapaDeSitio(BASE, ahora);
    expect(mapa.map((entrada) => entrada.url)).toEqual(RUTAS_DE_VENTA.map((ruta) => `${BASE}${ruta}`));
    expect(RUTAS_DE_VENTA).toContain("/legal");
    for (const hija of RUTAS_LEGALES) expect(RUTAS_DE_VENTA).toContain(hija);
  });

  it("NUNCA una ruta privada ni de invitación, aunque cambie el catálogo de venta", () => {
    const mapa = mapaDeSitio(BASE, ahora);
    for (const entrada of mapa) {
      for (const privada of RUTAS_PRIVADAS) {
        expect(entrada.url.startsWith(`${BASE}${privada}`)).toBe(false);
      }
    }
  });

  it("NO incluye /precios: su propio marcador todavía declara `robots: { index: false }`", () => {
    const mapa = mapaDeSitio(BASE, ahora);
    expect(mapa.some((entrada) => entrada.url === `${BASE}/precios`)).toBe(false);
  });

  it("la portada es semanal y prioridad 1; el resto, mensual y menor prioridad", () => {
    const mapa = mapaDeSitio(BASE, ahora);
    const portada = mapa.find((entrada) => entrada.url === `${BASE}/`);
    expect(portada?.changeFrequency).toBe("weekly");
    expect(portada?.priority).toBe(1);
    const contacto = mapa.find((entrada) => entrada.url === `${BASE}/contacto`);
    expect(contacto?.changeFrequency).toBe("monthly");
    expect(contacto?.priority).toBeLessThan(1);
  });

  it("respeta el origen que se le pasa, nunca uno fijo", () => {
    const mapa = mapaDeSitio("https://otro-origen.mx", ahora);
    expect(mapa[0]?.url.startsWith("https://otro-origen.mx")).toBe(true);
  });
});
