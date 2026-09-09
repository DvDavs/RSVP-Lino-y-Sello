// app/sitemap.ts — mapa de rutas públicas de venta, fichero NUEVO (`12-producto-completo.md §B6`,
// `5-0-cimientos.md §2`). Envoltura fina: resuelve el origen real y delega el mapa en
// `lib/rutas-publicas.ts` (pura, y por eso la que lleva las pruebas).
//
// Solo las rutas de venta que un buscador debe indexar: la portada, la ayuda pública, el contacto y
// los avisos legales. NUNCA una ruta privada ni el enlace de una invitación o de un invitado — eso
// es lo que `robots.ts` bloquea del todo, y meterlos aquí sería lo contrario de lo que hace ese fichero.
//
// `/precios` NO entra todavía: sigue siendo el marcador de otra sesión (E4, fuera de mi territorio)
// y su propio `metadata` (`app/(chrome)/(sitio)/precios/page.tsx`) declara
// `robots: { index: false, follow: false }` — meterlo en el sitemap contradiría esa página. Se añade
// cuando E4 la publique de verdad (documentado en la bitácora de este bloque).
import { origenPublico } from "@/lib/env";
import { DOMINIO_MARCA } from "@/lib/marca";
import { mapaDeSitio } from "@/lib/rutas-publicas";

export default function sitemap() {
  // El origen sale de `NEXT_PUBLIC_SITE_URL` a través de `lib/env.ts` (que reexporta `origenPublico`
  // de `lib/enlace-publico.ts`) — la MISMA fuente que el enlace que la clienta comparte con sus
  // invitados (`§0.5` del andamio, N-02 / `ADR-3C-N02-01`: no se inventa una segunda variable de
  // origen). `sitemap.ts` corre siempre en el servidor, así que `origenPublico()` cae directo a la
  // variable; sin ella, el dominio real de la marca (`lib/marca.ts`, D-02) como último recurso.
  return mapaDeSitio(origenPublico() ?? `https://${DOMINIO_MARCA}`);
}
