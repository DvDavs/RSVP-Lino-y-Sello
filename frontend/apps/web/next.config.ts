import type { NextConfig } from "next";

/**
 * `handoffs/3-0b.md` §1 (medido, no supuesto) + `04-frontend-y-editor.md` §8.4/§6.
 *
 * C1 — CORS de fuentes: `/_next/static/media/:path*` (tipografías autoalojadas con `next/font`) y
 *      `/fonts/:path*`. Sin esta cabecera el lienzo aislado (origen OPACO, `Origin: null`) pide las
 *      fuentes en modo CORS y el navegador descarta la respuesta.
 * `X-Robots-Tag` en `/i/:path*` — una invitación es privada; nunca se indexa (04 §15.4, objeción O-15).
 * **Sin `crossOrigin`**: si Next marcara sus propios `<script>` como CORS, el lienzo (que no puede
 *      mandar credenciales) dejaría de arrancar (medido en 3-0b).
 *
 * La CSP del lienzo NO va aquí: necesita un `nonce` por petición y vive en `proxy.ts`.
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
      {
        source: "/i/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  images: {
    // Los assets de las plantillas se sirven desde el backend (S3 en producción, adaptador local en
    // desarrollo — `handoffs/3-0a.md` §1). Sin un remotePattern, `next/image` rechaza la URL.
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "6003", pathname: "/public/templates2-assets/**" },
      { protocol: "https", hostname: "**.amazonaws.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
