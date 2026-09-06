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
  // `forbidden()` de `next/navigation` (bloque 3-3): el render público necesita distinguir el
  // `403 TPL_INVITATION_UNAVAILABLE` —la invitación existe, el anfitrión no está disponible— del
  // `404 TPL_RELEASE_NOT_FOUND`, y devolver el estado HTTP correcto en cada caso. Sin esta bandera,
  // `forbidden()` lanza en tiempo de ejecución y la convención `forbidden.tsx` se ignora.
  // Es aditiva: habilita `forbidden()`/`unauthorized()` y sus dos archivos de convención, y no
  // cambia el comportamiento de ninguna ruta que no los use. ADR-3-3-01.
  experimental: {
    authInterrupts: true,
    // Fase 3-C (3C-5), MEDIDO: `@invitaciones/ui` es un barril que reexporta 25 componentes y 11
    // formas, y la mitad de esos componentes son módulos "use client" (Radix). Importar UN `Button`
    // desde la raíz del barril metía en la PORTADA todo el lado cliente del paquete: 93,0 KB gz de
    // JS propio de la ruta para una página cuyo único JavaScript son dos botones. Con el barril
    // reescrito a importaciones directas por Next, la cifra baja a lo que de verdad usa (ver
    // `bitacora/3c-5.md`). No cambia ninguna API: es una reescritura de importaciones en build.
    optimizePackageImports: ["@invitaciones/ui", "@invitaciones/icons"],
  },
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

/**
 * `04 §16.2`: "Complemento de diagnóstico (no compuerta): `ANALYZE=1 pnpm --filter web build` con
 * `@next/bundle-analyzer` para ver QUÉ creció". El paquete ya estaba instalado desde 3-1 pero no
 * enganchado, así que la orden documentada no hacía nada. Sin `ANALYZE=1` el envoltorio es la
 * identidad: no cambia ni un byte del build normal ni del de CI.
 */
const conAnalizador =
  process.env.ANALYZE === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@next/bundle-analyzer") as (o: { enabled: boolean }) => (c: NextConfig) => NextConfig)({
        enabled: true,
      })
    : (c: NextConfig) => c;

export default conAnalizador(nextConfig);
