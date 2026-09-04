import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import type { ComposedDocument } from "@invitaciones/schema";
import { RenderInvitacion } from "../../_componentes/RenderInvitacion";
import { fechaDe, fondoSeguroDe, subtituloDe, tituloDe } from "../../_componentes/composed-lectura";
import { ApiError, getPublicRender } from "@/lib/api-client";
import { textosPublicos } from "./textos";
import estilos from "./pagina.module.css";

// app/(public)/i/[publicToken]/page.tsx — EL RENDER PÚBLICO (04 §15, 03 §3.15).
//
// SSG/ISR (04 §15.1): `revalidate = 300` es el SUELO —coincide con el `max-age` del backend
// (`handoffs/2-5.md`, "Cache-Control: public, max-age=300, stale-while-revalidate=3600")— y
// `next.tags: ["invitation:<token>"]` es el gancho que `/api/revalidate` purga en cuanto el backend
// confirma un `POST/DELETE .../release` o un `:rotate` (ADR-1R-F-09, ADR-2-6-01). `generateStaticParams`
// devuelve la lista VACÍA —ni un token se enumera en build— por el motivo medido que se explica más
// abajo.
//
// Estados, y son solo tres (04 §15.1 + `handoffs/2-5.md`):
//   · `404 TPL_RELEASE_NOT_FOUND` → `notFound()`. UN SOLO CÓDIGO cubre token inexistente, rotado,
//     sin release, despublicado y `uses_templates2=false`: el backend NO los distingue a propósito
//     (evita el oráculo de enumeración de tokens), y esta página tampoco lo intenta.
//   · `403 TPL_INVITATION_UNAVAILABLE` → `forbidden()`, su propia página (`forbidden.tsx`), NO un
//     404: la invitación existe, es el anfitrión quien no está disponible (cuenta deshabilitada o
//     bloqueada). Mezclarlo con el 404 le diría al invitado "ese enlace no existe" cuando sí existe.
//   · cualquier otra cosa → se propaga a `error.tsx`.
export const dynamicParams = true;
export const revalidate = 300;

/**
 * HALLAZGO medido, corrige la letra de `04 §15.1` ("No se usa `generateStaticParams`").
 *
 * En `next@16.3.4`, una ruta dinámica que NO exporta `generateStaticParams` no entra en
 * `prerender-manifest.json` → `dynamicRoutes` (verificado: el objeto sale vacío), y sus respuestas
 * salen con `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Es decir: el
 * HTML no se cachea NUNCA, ni en el servidor ni en el CDN, y cada invitado paga un render entero —
 * justo lo contrario de lo que `04 §15.1`/§16.1 dan por hecho ("HTML servido desde caché ISR").
 *
 * Devolver la lista VACÍA conserva íntegro el motivo por el que el diseño no la quería: no se
 * enumera ni un `publicToken` en tiempo de build (no hay catálogo público de ellos, y enumerarlos
 * sería justo lo que `TPL_RELEASE_NOT_FOUND` evita). Con `dynamicParams = true`, cada token se
 * genera en su primera visita y se cachea con el `revalidate` de arriba. ADR-3-3-04.
 */
export async function generateStaticParams(): Promise<Array<{ publicToken: string }>> {
  return [];
}

type ParametrosRuta = { params: Promise<{ publicToken: string }> };

type Resultado =
  | { estado: "ok"; composed: ComposedDocument }
  | { estado: "no-encontrado" }
  | { estado: "no-disponible" };

/**
 * Una sola función de carga para `generateMetadata` y para el cuerpo. Next deduplica el `fetch` de
 * los dos por su clave de caché, así que el backend recibe UNA petición por render, no dos
 * (verificado en `evidencia/fase-3/render-publico/`).
 *
 * No lanza para los dos estados esperados: un `throw` en `generateMetadata` tumbaría la respuesta
 * entera antes de que el cuerpo pudiera decidir. P1: ningún caso se descarta en silencio.
 */
async function cargarRelease(publicToken: string): Promise<Resultado> {
  try {
    const resultado = await getPublicRender(publicToken, {
      next: { revalidate: 300, tags: [`invitation:${publicToken}`] },
    });
    // Nunca mandamos `If-None-Match`, así que un 304 no debería llegar; si llegara, no hay cuerpo
    // que pintar y el enlace se trata como no encontrado en vez de reventar (P1).
    if (resultado.status === "not-modified") return { estado: "no-encontrado" };
    return { estado: "ok", composed: resultado.data.composed };
  } catch (err) {
    if (err instanceof ApiError && err.code === "TPL_RELEASE_NOT_FOUND") return { estado: "no-encontrado" };
    if (err instanceof ApiError && err.code === "TPL_INVITATION_UNAVAILABLE") return { estado: "no-disponible" };
    throw err;
  }
}

/**
 * `04 §15.4` — metadatos y PRIVACIDAD.
 *
 * `robots: noindex, nofollow` es obligatorio: sin él, el nombre, la dirección y la fecha del evento
 * de un cliente acaban en un buscador (objeción O-15, alta). Van tres capas independientes, porque
 * una sola falla en silencio: esta etiqueta, el `metadata` del layout (que cubre 404/403/error) y la
 * cabecera `X-Robots-Tag` de `next.config.ts` sobre `/i/:path*`.
 *
 * Qué se comparte y qué NO (decisión de este bloque, ADR-3-3-03): al enlace se le pone el título de
 * portada y su subtítulo, que es lo que el anfitrión quiere que se lea en WhatsApp. **No** viajan a
 * los metadatos la dirección del lugar, ni los nombres de los padrinos, ni el teléfono de contacto:
 * una tarjeta de enlace se previsualiza en servidores de terceros y se reenvía sin control.
 */
export async function generateMetadata({ params }: ParametrosRuta): Promise<Metadata> {
  const { publicToken } = await params;
  const noIndexado = { index: false, follow: false, nocache: true } as const;

  let resultado: Resultado;
  try {
    resultado = await cargarRelease(publicToken);
  } catch {
    // Un error de red al pedir metadatos no debe tumbar la petición: el cuerpo ya lo maneja.
    return { title: textosPublicos.tituloGenerico, robots: noIndexado };
  }
  if (resultado.estado !== "ok") {
    return { title: textosPublicos.tituloGenerico, robots: noIndexado };
  }

  const { composed } = resultado;
  const titulo = tituloDe(composed) ?? textosPublicos.tituloGenerico;
  const subtitulo = subtituloDe(composed);
  const fondo = fondoSeguroDe(composed);

  return {
    title: titulo,
    ...(subtitulo ? { description: subtitulo } : {}),
    robots: noIndexado,
    openGraph: {
      type: "website",
      locale: composed.locale.replace("-", "_"),
      title: titulo,
      ...(subtitulo ? { description: subtitulo } : {}),
      // `images` lo aporta `opengraph-image.tsx` por convención de archivo; no se lista aquí para
      // no duplicar la etiqueta.
    },
    twitter: { card: "summary_large_image", title: titulo, ...(subtitulo ? { description: subtitulo } : {}) },
    ...(fondo ? { other: { "theme-color": fondo } } : {}),
  };
}

export default async function PaginaInvitacionPublica({ params }: ParametrosRuta) {
  const { publicToken } = await params;
  const resultado = await cargarRelease(publicToken);
  if (resultado.estado === "no-encontrado") notFound();
  if (resultado.estado === "no-disponible") forbidden();

  const { composed } = resultado;
  const titulo = tituloDe(composed);
  const subtitulo = subtituloDe(composed);
  const fecha = fechaDe(composed);
  const fondo = fondoSeguroDe(composed);

  return (
    <>
      {/* El fondo del DOCUMENTO llega a `html`/`body` para que el rebote de scroll en móvil y la
       * barra del navegador sean del color de la invitación, no blancos. Es el token de la
       * plantilla (`theme.tokens.bg`), revalidado como `#rrggbb` antes de interpolarse
       * (`composed-lectura.ts`), nunca un color propio de `apps/web` (P3). */}
      {fondo ? <style>{`html,body{background:${fondo}}`}</style> : null}

      {/* `04 §17.3`: "un solo `<h1>` (el título de portada, rol `coverTitle`)". `CoverSection` no lo
       * emite a propósito (su comentario de cabecera lo deja dicho: "el `<h1>` vive, si acaso, a
       * nivel de página en `apps/web`"), así que lo pone la página. Va oculto a la vista y presente
       * en el árbol de accesibilidad: el título ya se VE, en grande, dentro de la portada; repetirlo
       * visible sería duplicarlo. Sin él, la página empieza en `<h2>` y no tiene encabezado de
       * nivel 1. NUNCA `dangerouslySetInnerHTML`: es texto del cliente y React lo escapa. */}
      <h1 className={estilos.soloLectores}>
        {[titulo, subtitulo, fecha].filter((t): t is string => t !== null).join(" · ") ||
          textosPublicos.tituloGenerico}
      </h1>

      <RenderInvitacion composed={composed} />
    </>
  );
}
