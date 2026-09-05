import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RUTAS_PRECARGA } from "@invitaciones/ui";
import "./globals.css";

/**
 * Layout raíz del CHROME del editor (shadcn/ui + Tailwind). Grupo de rutas separado de `(canvas)` y
 * `(public)` (04 §19, `handoffs/3-0b.md` §1: "dos layouts raíz por grupos de rutas"): el lienzo y la
 * ruta pública no cargan `globals.css` porque no comparten árbol de layout con este archivo.
 *
 * Tipografía (chrome viejo, `arte-chrome.md`): `@fontsource-variable/inter` y
 * `@fontsource-variable/{bricolage-grotesque,outfit}` se autoalojan por **npm** e importan en
 * `globals.css`, no aquí — `next/font/local` es del LIENZO (`04 §5.5`, `(canvas)/layout.tsx`), que
 * sí exige CSP con nonce y `preload:false`; el chrome no tiene esa restricción.
 *
 * Tipografía (sistema nuevo, fase 3-C/3C-2, `11 §2.4`): mismo mecanismo — autoalojado por npm,
 * nunca `next/font` (ver el porqué en `@invitaciones/ui/fonts/preload.ts`) —, con la ÚNICA adición
 * de un `<link rel="preload">` para la voz `display` (Fraunces): es la que pinta el LCP de los
 * titulares del chrome. `RUTAS_PRECARGA` es la fuente de verdad de qué precargar; hoy trae un solo
 * fichero (subconjunto latino). `crossOrigin="anonymous"` es obligatorio en el preload de una
 * fuente aunque sea del mismo origen — los navegadores siempre piden `@font-face` en modo CORS
 * anónimo, y sin el atributo aquí el preload no coincide con esa petición y la descarga se duplica.
 */
export const metadata: Metadata = {
  title: { default: "Editor de invitaciones", template: "%s · Invitaciones" },
};

export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        {RUTAS_PRECARGA.map((ruta) => (
          <link key={ruta} rel="preload" as="font" type="font/woff2" href={ruta} crossOrigin="anonymous" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
