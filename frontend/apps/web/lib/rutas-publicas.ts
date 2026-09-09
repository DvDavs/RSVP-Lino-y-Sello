// lib/rutas-publicas.ts — el mapa de rutas de venta y el bloqueo de las privadas, como función PURA
// sobre un origen YA RESUELTO. Nunca sobre `process.env` ni `window` aquí: `app/robots.ts` y
// `app/sitemap.ts` corren solo en el servidor de Next (nunca hay un navegador de verdad detrás), y
// probar contra `window` fingido de jsdom mediría un caso que estos dos ficheros nunca tienen. El
// mismo motivo por el que `lib/contacto.ts` y `lib/env.ts` son funciones puras sobre un mapa: se
// prueban caso por caso sin depender de cómo esté montado el entorno de prueba.
import type { MetadataRoute } from "next";

/** Las dos hijas de `/legal` (sin `/legal/cookies`: ver el porqué en `legal/page.tsx`). */
export const RUTAS_LEGALES = ["/legal", "/legal/privacidad", "/legal/terminos"] as const;

/**
 * Rutas públicas de venta que SÍ se ofrecen a un buscador. `/precios` queda fuera a propósito: su
 * `metadata` (ajeno, E4) todavía declara `robots: { index: false }` como marcador — ver `app/sitemap.ts`.
 */
export const RUTAS_DE_VENTA = ["/", "/ayuda", "/contacto", ...RUTAS_LEGALES] as const;

/**
 * Prefijos que un rastreador nunca debe entrar a leer (razón completa en `app/robots.ts`): rutas
 * privadas del producto y las que llevan datos personales de un invitado (`/i/`, `/r/`). `/editor`
 * sin barra final: por prefijo cubre también `/editor/[id]/canvas` del grupo `(canvas)`, mismo
 * prefijo de URL aunque sea otro grupo de rutas de Next.
 */
export const RUTAS_PRIVADAS = ["/editor", "/perfil", "/admin", "/design", "/preview", "/i/", "/r/", "/api"] as const;

export function reglasRobots(base: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...RUTAS_PRIVADAS] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

export function mapaDeSitio(base: string, ahora: Date = new Date()): MetadataRoute.Sitemap {
  return RUTAS_DE_VENTA.map((ruta) => ({
    url: `${base}${ruta}`,
    lastModified: ahora,
    changeFrequency: ruta === "/" ? "weekly" : "monthly",
    priority: ruta === "/" ? 1 : 0.6,
  }));
}
