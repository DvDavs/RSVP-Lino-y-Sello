import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Layout raíz de la superficie PÚBLICA (`/preview/[invitationId]`, `/i/[publicToken]`). Grupo de
 * rutas separado de `(chrome)`: NO importa `globals.css` (Tailwind) — P3 y `04 §19` mecanismo 1
 * ("en la ruta pública el chrome sencillamente no existe") exigido también para `/preview`, que
 * comparte el mismo `mode="public"` de `packages/sections` (04 §15.5). Solo un reset mínimo
 * inline: `packages/sections` trae sus propios `--inv-*` (04 §5.4), nada aquí los toca.
 *
 * `metadata.title` por defecto (hallazgo E2E-06/E-08: sin él, `not-found.tsx` — que no hereda el
 * `generateMetadata` de `page.tsx` — no tiene `<title>`, y `axe` lo marca "serious", WCAG 2.4.2).
 * Cada página puede sobrescribirlo (`/i/[publicToken]/page.tsx` ya lo hace con `generateMetadata`).
 */
export const metadata: Metadata = { title: "Invitación" };

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
