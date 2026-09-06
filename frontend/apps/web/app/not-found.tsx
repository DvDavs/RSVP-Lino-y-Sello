// app/not-found.tsx — el 404 REAL de las URL que no casan con ninguna ruta.
//
// POR QUÉ HAY DOS `not-found.tsx`. `app/(chrome)/not-found.tsx` solo atiende a un `notFound()`
// lanzado DENTRO de ese grupo. Una URL que no casa con ninguna ruta del árbol no pertenece a ningún
// grupo, así que Next busca el `not-found` de la RAÍZ; sin este fichero servía su pantalla de
// fábrica —«404 · This page could not be found.», en inglés, con la tipografía del sistema—, que es
// exactamente el defecto que `11 §7` manda corregir («ningún callejón sin salida»). Medido en la
// captura `evidencia/fase-3c/bloque-3/3c-5-404-1440.png` de la primera pasada.
//
// Este fichero pinta su PROPIO `<html>` y `<body>`: con varios layouts raíz por grupos de rutas
// (`04 §19`, `handoffs/3-0b.md` §1) y sin `app/layout.tsx`, Next no envuelve esta pantalla en
// ninguno de ellos — tiene que traerse el documento y la hoja del chrome por su cuenta. Es la única
// excepción, y es de Next, no una decisión de diseño.
//
// 3C-8b: este fichero es el LÍMITE DE ÁRBOL de TODAS las rutas (`04 §19`) — Next lo cuelga del
// grafo de módulos de cualquier página, incluida `/i/[publicToken]`, que no importa nada del
// sistema de diseño. La versión anterior montaba `MarcoSitio` → `CabeceraSitio` → `Button` de
// `@invitaciones/ui` (cliente, con `tailwind-merge` + `@radix-ui/react-slot` detrás), y eso metía
// ~17,8 KB gz de JS ajeno en CADA ruta del sitio — medido con `check-budget.mjs`:
// `/i/[publicToken]` 156,2 KB gz (límite 150) y `/` 153,4 KB (límite 150), cifras en
// `evidencia/fase-3c/bloque-3/3c-8/check-budget.txt`. Esta versión es un Server Component puro: sin
// `"use client"`, sin `components/sitio/**`, sin `Button`. El marcado reutiliza las MISMAS clases
// CSS que `EmptyState` (`.ui-estado-vacio*`, `packages/ui/src/componentes/componentes.css`, ya
// cargadas por `estilos.css` vía `./(chrome)/globals.css`) para verse igual sin traerse ni el
// componente ni el registro `Ilustracion` — que sí arrastra las TRES ilustraciones del catálogo al
// bundle (mismo motivo documentado en `components/sitio/PantallaError.tsx`, que por eso importa
// `ErrorGenerico` directo). La versión rica —con cabecera y pie del sitio— sigue intacta en
// `app/(chrome)/not-found.tsx`, para el `notFound()` lanzado DENTRO del chrome (p. ej. `/editor`).
import type { Metadata } from "next";
import { RUTAS_PRECARGA } from "@invitaciones/ui/fonts/preload.ts";
import { ErrorGenerico } from "@invitaciones/ui/ilustraciones/ErrorGenerico.tsx";
import { es_MX } from "@/lib/i18n";
import "./(chrome)/globals.css";

export const metadata: Metadata = {
  title: `${es_MX.errores.noExiste.titulo} · ${es_MX.comun.marca}`,
  robots: { index: false, follow: true },
};

export default function NoEncontrado() {
  return (
    <html lang="es-MX" data-theme="light">
      <head>
        {RUTAS_PRECARGA.map((ruta) => (
          <link key={ruta} rel="preload" as="font" type="font/woff2" href={ruta} crossOrigin="anonymous" />
        ))}
      </head>
      <body className="bg-ui-surface">
        {/* Mismo envoltorio que `EstadoDePagina.tsx` (`mx-auto w-full max-w-ui-page px-5 py-16
            sm:px-8`): sin cabecera ni pie que lo empujen, pero con la misma composición visual. */}
        <main className="mx-auto w-full max-w-ui-page px-5 py-16 sm:px-8">
          <div className="ui-estado-vacio">
            <ErrorGenerico size={120} className="ui-estado-vacio__ilustracion" />
            <h1 className="ui-estado-vacio__titulo">{es_MX.errores.noExiste.titulo}</h1>
            <p className="ui-estado-vacio__texto">{es_MX.errores.noExiste.cuerpo}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {/* `!mt-0`: `.ui-estado-vacio__accion` trae su propio `margin-top` pensado para UNA
                  acción sola (`EmptyState.tsx`); aquí el espacio ya lo da este contenedor, para que
                  el botón y el enlace secundario queden centrados en la misma fila. */}
              <a className="ui-estado-vacio__accion !mt-0" href="/">
                {es_MX.comun.irAlInicio}
              </a>
              {/* Secundaria, nunca un segundo botón primario (`11 §5`): mismo patrón de enlace que
                  `PantallaError.tsx` para la salida de vuelta a la portada. */}
              <a
                href="/ayuda"
                className="rounded-ui-control px-2 py-2 text-sm font-semibold text-ui-link hover:underline"
              >
                {es_MX.errores.noExiste.verAyuda}
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
