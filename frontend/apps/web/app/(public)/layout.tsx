import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./publico.css";

/**
 * Layout raíz de la superficie PÚBLICA (`/i/[publicToken]`, `/preview/[invitationId]`). Grupo de
 * rutas separado de `(chrome)`: NO importa `globals.css` (Tailwind) — P3 y `04 §19` mecanismo 1
 * ("en la ruta pública el chrome sencillamente no existe"), exigido también para `/preview`, que
 * comparte el mismo `mode="public"` de `packages/sections` (04 §15.5).
 *
 * `publico.css` trae los `--inv-*` de reserva y las tipografías autoalojadas (ADR-1R-F-07). Nada
 * más: ni un color, ni un tamaño, ni una familia propios de `apps/web`.
 *
 * `metadata.title` por defecto (hallazgo E2E-06/E-08 del bloque 3-1: sin él, `not-found.tsx` — que
 * no hereda el `generateMetadata` de `page.tsx` — no tiene `<title>`, y `axe` lo marca "serious",
 * WCAG 2.4.2). `/i/[publicToken]/page.tsx` lo sobrescribe con el título real de la portada.
 *
 * `robots: noindex` TAMBIÉN aquí (04 §15.4, objeción O-15): el `generateMetadata` de la página solo
 * corre cuando la página se renderiza. Un `not-found.tsx`, un `error.tsx` o un `forbidden.tsx`
 * heredan de este layout, y una invitación retirada no debe indexarse tampoco por su URL. La
 * cabecera `X-Robots-Tag` de `next.config.ts` es la tercera capa, y es la que cubre incluso los
 * casos en que no se emite HTML.
 */
/**
 * `metadataBase` — sin él Next resuelve `og:image` contra `http://localhost:3000` y avisa en cada
 * build ("metadataBase property in metadata export is not set", verificado). Una tarjeta de enlace
 * con `localhost` no se ve en ningún cliente de mensajería. Se toma de `NEXT_PUBLIC_SITE_URL`, que
 * es donde el despliegue declara su propio origen; el valor local es solo el de desarrollo.
 * Una URL mal formada NO tumba el render: se cae al origen local y se avisa (P1, nada en silencio).
 */
function baseDeMetadatos(): URL {
  const declarada = process.env.NEXT_PUBLIC_SITE_URL;
  if (declarada) {
    try {
      return new URL(declarada);
    } catch {
      console.warn(`[publico] NEXT_PUBLIC_SITE_URL no es una URL válida: ${declarada}. Se usa el origen local.`);
    }
  }
  return new URL("http://127.0.0.1:3000");
}

export const metadata: Metadata = {
  metadataBase: baseDeMetadatos(),
  title: "Invitación",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * `04 §16.1` (CLS / LCP en móvil): sin `viewport` el navegador móvil dibuja la página a 980 px y la
 * reduce, así que toda la tipografía fluida (`clamp`) se calcula sobre el ancho equivocado.
 * `maximumScale` no se fija: limitar el zoom es una violación de WCAG 1.4.4 (`04 §17`).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
