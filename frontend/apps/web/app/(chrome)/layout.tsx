import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/**
 * Layout raíz del CHROME del editor (shadcn/ui + Tailwind). Grupo de rutas separado de `(canvas)` y
 * `(public)` (04 §19, `handoffs/3-0b.md` §1: "dos layouts raíz por grupos de rutas"): el lienzo y la
 * ruta pública no cargan `globals.css` porque no comparten árbol de layout con este archivo.
 *
 * Tipografía: `@fontsource-variable/inter` y `@fontsource-variable/{bricolage-grotesque,outfit}` se
 * autoalojan por **npm** (CSS de `@font-face` embebido en el propio paquete, sin llamada a Google en
 * ningún momento) e importan en `globals.css`, no aquí — `next/font/local` es del LIENZO (`04 §5.5`,
 * `(canvas)/layout.tsx`), que sí exige CSP con nonce y `preload:false`; el chrome no tiene esa
 * restricción y Fontsource es el mecanismo que pidió el dueño para esta capa (memoria/handoffs/3-1.md).
 */
export const metadata: Metadata = {
  title: { default: "Editor de invitaciones", template: "%s · Invitaciones" },
};

export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
