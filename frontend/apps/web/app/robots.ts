// app/robots.ts — reglas de rastreo, fichero NUEVO (`12-producto-completo.md §B6`, `5-0-cimientos.md
// §2`: «`robots.ts`/`sitemap.ts` (los crea)» → E3). Envoltura fina: resuelve el origen real y delega
// el mapa en `lib/rutas-publicas.ts` (pura, y por eso la que lleva las pruebas).
//
// LA RAZÓN DURA de bloquear lo privado (no es higiene, es privacidad de datos de gente que nunca dio
// de alta nada): un enlace de invitación o de RSVP (`/i/[publicToken]`, `/r/[token]`,
// `/preview/[invitationId]`) lleva el nombre, la fecha y el lugar del evento de una persona real, y
// `/r/[token]` además el nombre del invitado (`A4.1`: `invitation_guest.full_name`). Que un buscador
// lo indexe es una fuga de datos personales. Por eso estas rutas se bloquean aquí, ADEMÁS de su
// propio `<meta name="robots">` (`(public)/layout.tsx:46` y cada página): `robots.txt` bloquea el
// RASTREO, la `<meta>` bloquea la INDEXACIÓN de lo ya rastreado — dos capas porque un enlace
// compartido a mano y encontrado por otra vía no debería ni llegar a que un rastreador lo abra.
//
// CONTRADICCIÓN ENCONTRADA (no es mía de arreglar; documentada también en la bitácora de este
// bloque): `app/(chrome)/editor/[invitationId]/page.tsx` no declara `metadata` propio y hereda
// `robots: { index: true, follow: true }` de `app/(chrome)/layout.tsx`. Es una ruta privada del
// editor y este fichero la bloquea por `Disallow: /editor`, pero su propia `<meta>` sigue diciendo
// lo contrario — un rastreador que ya conociera la URL por otro enlace no vería ese `noindex` porque
// `robots.txt` le impide entrar a leer la página. Fuera de mi territorio (no es `/contacto`,
// `/legal`, `/ayuda`, cabecera, pie ni el `metadata` del layout raíz): se lo dejo al orquestador.
import { origenPublico } from "@/lib/env";
import { DOMINIO_MARCA } from "@/lib/marca";
import { reglasRobots } from "@/lib/rutas-publicas";

export default function robots() {
  // `robots.ts` corre SIEMPRE en el servidor (nunca hay `window`): `origenPublico()` cae directo a
  // `NEXT_PUBLIC_SITE_URL`. Sin ella, el dominio real de la marca (`lib/marca.ts`, D-02) como último
  // recurso — un `robots.txt` con `localhost` en un despliegue real sería peor que uno con el
  // dominio de producción aunque el entorno actual no lo haya declarado (mismo criterio que `sitemap.ts`).
  return reglasRobots(origenPublico() ?? `https://${DOMINIO_MARCA}`);
}
