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
import type { Metadata } from "next";
import { RUTAS_PRECARGA } from "@invitaciones/ui/fonts/preload.ts";
import { EstadoDePagina } from "@/components/sitio/EstadoDePagina";
import { MarcoSitio } from "@/components/sitio/MarcoSitio";
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
      <body>
        <MarcoSitio>
          <EstadoDePagina
            titulo={es_MX.errores.noExiste.titulo}
            texto={es_MX.errores.noExiste.cuerpo}
            accion={{ etiqueta: es_MX.comun.irAlInicio, href: "/" }}
          />
        </MarcoSitio>
      </body>
    </html>
  );
}
