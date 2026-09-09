import type { Metadata } from "next";
import type { ReactNode } from "react";
// Subruta directa y NO el barril `@invitaciones/ui`: este layout envuelve TODAS las rutas del
// chrome, y `@invitaciones/ui/index.ts` reexporta los 25 componentes —la mitad módulos "use
// client" con Radix dentro—. Importar de él una constante de fuentes metía todo ese lado cliente en
// el grafo de cada ruta del grupo: MEDIDO, 92,3 KB gz de JS propio en la portada, que solo usa
// `Button`. Con la subruta, 8,9 KB (`bitacora/3c-5.md` §3).
import { RUTAS_PRECARGA } from "@invitaciones/ui/fonts/preload.ts";
import { es_MX } from "@/lib/i18n";
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
  // D-02: la marca, no el nombre genérico del producto (`lib/marca.ts` vía `es_MX.comun.marca`).
  title: {
    default: `${es_MX.comun.marca} · ${es_MX.sitio.hero.eyebrow}`,
    template: `%s · ${es_MX.comun.marca}`,
  },
  description:
    "Invitaciones digitales con confirmación de asistencia (RSVP): elige un diseño, escribe los datos de tu evento y comparte el enlace por WhatsApp.",
  // La web pública SÍ se indexa. El `noindex` es de `/i`, `/preview` y `/design`, y cada uno lo
  // declara en su propio `metadata`: aquí no puede ir, porque este layout también envuelve la
  // portada, `/acceso` y `/ayuda`.
  robots: { index: true, follow: true },
};

export default function ChromeLayout({ children }: { children: ReactNode }) {
  return (
    // `data-theme="light"` explícito: el tema del producto es una ELECCIÓN, no `prefers-color-scheme`
    // (`11 §10`, supuesto del bloque 0; el conmutador de la galería `/design` anida su propio
    // `data-theme` y sigue mandando dentro de su subárbol).
    <html lang="es-MX" data-theme="light">
      <head>
        {RUTAS_PRECARGA.map((ruta) => (
          <link key={ruta} rel="preload" as="font" type="font/woff2" href={ruta} crossOrigin="anonymous" />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
