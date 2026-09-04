import type { NextConfig } from "next";

/**
 * Configuración del spike de la compuerta A1-A8 (`04 §8.4`).
 *
 * C1 — CORS para las fuentes: `/_next/static/media/:path*` (next/font autoalojado) y `/fonts/:path*`.
 *      Sin esta cabecera el lienzo, que es un origen OPACO, manda `Origin: null` en la petición de
 *      fuente (siempre en modo CORS) y el navegador descarta la respuesta: la invitación se pinta con
 *      la fuente de reserva y MIENTE sobre lo que verá el invitado.
 * C3 — **sin `crossOrigin`**: si Next marcara sus propios `<script>` como CORS, también necesitarían
 *      cabecera y el lienzo dejaría de arrancar. No se declara la opción, a propósito.
 *
 * La CSP del lienzo NO va aquí: necesita un `nonce` por petición y vive en `middleware.ts` (C2).
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/_next/static/media/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      // `/control-fonts/*` NO lleva `Access-Control-Allow-Origin`: es el CONTROL NEGATIVO de C1.
      // Sirve exactamente el mismo woff2 y debe fallar dentro del lienzo. Si algún día pasara,
      // la medición de A2 no probaría nada.
    ];
  },
  transpilePackages: ["@invitaciones/schema"],
  // El spike vive fuera del workspace pnpm y consume `packages/schema` por symlink (`file:`).
  outputFileTracingRoot: new URL("../../..", import.meta.url).pathname,
};

export default nextConfig;
