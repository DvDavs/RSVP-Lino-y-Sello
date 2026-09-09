// app/(public)/r/[token]/page.tsx — el enlace personal del invitado (contrato §3, §0.3 del
// diseño). Sustituye ENTERO el marcador del andamio 5-0d.
//
// REGLA DE SEGURIDAD 1 (la que gobierna todo este archivo): el estado personal del invitado
// (nombre, cupos, respuesta) NUNCA se hornea en el HTML. Por eso esta página, a diferencia de su
// hermana `/i/[publicToken]`, no hace NINGÚN `fetch` — ni de la invitación, ni del invitado. Es un
// Server Component vacío que solo declara la ruta como dinámica y sin caché, y delega el `token` a
// `PantallaInvitado` (`"use client"`), que resuelve TODO en el navegador después de la
// hidratación (contrato §3: "se llama desde el navegador, nunca desde el servidor"). El primer
// render de esa isla (antes de que corra ningún `useEffect`) es siempre "Cargando tu
// invitación…", sin nombre ni cupos — es lo que garantiza que el HTML de servidor esté limpio,
// y `PantallaInvitado.test.tsx` lo comprueba con `renderToString`.
//
// `dynamic = "force-dynamic"` + `revalidate = 0`: esta ruta NUNCA comparte entrada de caché con
// nadie, a diferencia del ISR de 300s de `/i/[publicToken]` (contrato §3, `12-producto-
// completo.md` §B3.1 "Cómo funciona /r/[token] y por qué no se puede enumerar"). Sin ellos, una
// respuesta vacía (esta página no varía por request en el servidor) podría cachearse igual que
// cualquier ruta estática — el riesgo no es HOY (no hay dato que cachear), sino que un cambio
// futuro que añadiera algo server-side lo hiciera sin darse cuenta de que esta ruta no puede
// cachearse jamás.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import { PantallaInvitado } from "./PantallaInvitado";
import { textosInvitado } from "./textos";

/**
 * REGLA DE SEGURIDAD 3: `generateMetadata` no puede filtrar nada personal — el nombre del
 * invitado, el del anfitrión, la fecha del evento — porque un título es lo que previsualizan los
 * servidores de WhatsApp y cualquier intermediario. A diferencia de `/i/[publicToken]`, esta
 * página NO tiene `generateMetadata`: es un `export const metadata` fijo y genérico, precisamente
 * para que sea IMPOSIBLE que un cambio futuro le pase un dato personal por accidente (no hay
 * función que reciba `params` y decida un título con ellos).
 *
 * `robots: noindex` es la SEGUNDA de las tres capas (regla 2): la primera es el `metadata` del
 * layout de `(public)` (`../../layout.tsx`, ya lo declara), y la tercera es la cabecera
 * `X-Robots-Tag` de `next.config.ts` — que hoy cubre `/i/:path*` pero NO `/r/:path*` (hallazgo para
 * el orquestador, ver el reporte de entrega: ese archivo está fuera del territorio de este
 * encargo). Se repite aquí de todos modos: es la capa que sobrevive si alguien cambia el layout.
 */
export const metadata: Metadata = {
  title: textosInvitado.titulo,
  robots: { index: false, follow: false, nocache: true },
};

type ParametrosRuta = { params: Promise<{ token: string }> };

export default async function PaginaInvitado({ params }: ParametrosRuta) {
  const { token } = await params;
  // El `token` viaja como prop de React normal, NUNCA como atributo `data-*` del DOM (regla 4:
  // "cero tokens en el DOM": ya está en la URL, repetirlo en un atributo lo deja también en
  // cualquier volcado del árbol de accesibilidad o extensión del navegador que lo inspeccione).
  return <PantallaInvitado token={token} />;
}
