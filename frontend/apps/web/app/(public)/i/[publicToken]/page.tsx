import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComposedPreviewStub } from "@/components/public/ComposedPreviewStub";
import { ApiError, getPublicRender } from "@/lib/api-client";

// app/(public)/i/[publicToken]/page.tsx — render público (04 §15, 03 §3.15). RSC + ISR: `revalidate`
// es el suelo (300 s, igual que `Cache-Control` del backend) y `next.tags` es el gancho que
// `/api/revalidate` invalida con `revalidateTag("invitation:<publicToken>")` (04 §15.2).
//
// ESQUELETO (3-1): esta ruta la implementa de verdad el bloque 3-3. Aquí solo están el fetch tipado
// (ruta 15, ya con `ETag`/`304`), los tres estados reales (cargando → `loading.tsx`, sin release →
// `not-found.tsx`, error inesperado → `error.tsx`) y el punto de extensión: sustituir
// `ComposedPreviewStub` por `SectionsRoot` de `@invitaciones/sections` en cuanto ese paquete exista.
export const dynamicParams = true;
export const revalidate = 300;

type ParametrosRuta = { params: Promise<{ publicToken: string }> };

async function obtenerRelease(publicToken: string) {
  const resultado = await getPublicRender(publicToken, {
    next: { revalidate: 300, tags: [`invitation:${publicToken}`] },
  });
  // Sin `If-None-Match` de nuestra parte nunca debería llegar un 304, pero se cubre igual (P1: no
  // se descarta ningún caso en silencio).
  if (resultado.status === "not-modified") notFound();
  return resultado.data;
}

export async function generateMetadata({ params }: ParametrosRuta): Promise<Metadata> {
  const { publicToken } = await params;
  try {
    const release = await obtenerRelease(publicToken);
    const tituloSeccion = release.composed.sections.find((s) => s.type === "cover");
    return {
      title: tituloSeccion?.title ?? "Invitación",
      robots: { index: false, follow: false }, // 04 §15.4: una invitación es privada, nunca se indexa
      other: { "theme-color": release.composed.theme.tokens.bg },
    };
  } catch {
    // Un error aquí no debe tumbar la petición de metadatos; el cuerpo de la página ya lo maneja.
    return { robots: { index: false, follow: false } };
  }
}

export default async function PaginaInvitacionPublica({ params }: ParametrosRuta) {
  const { publicToken } = await params;
  let release: Awaited<ReturnType<typeof obtenerRelease>>;
  try {
    release = await obtenerRelease(publicToken);
  } catch (err) {
    if (err instanceof ApiError && (err.code === "TPL_RELEASE_NOT_FOUND" || err.code === "TPL_INVITATION_UNAVAILABLE")) {
      notFound();
    }
    throw err; // cualquier otra cosa la captura app/(public)/i/[publicToken]/error.tsx
  }
  return <ComposedPreviewStub composed={release.composed} />;
}
