// app/(chrome)/editor/[invitationId]/invitados/page.tsx — la lista de invitados de la clienta
// (wireframe `12-producto-completo.md` §B3.2). Sesión E2. Server Component delgado a propósito: el
// `invitationId` numérico ya lo valida el `layout.tsx` del padre (`notFound()` si no es dígitos), y
// toda la interacción real (contadores en vivo, búsqueda, pegado de lista…) vive en
// `PantallaInvitados`, que SÍ necesita estado de cliente y por eso es "use client".
import type { Metadata } from "next";
import { PantallaInvitados } from "@/components/invitados/PantallaInvitados";
import { es_MX } from "@/lib/i18n";

export const metadata: Metadata = {
  title: es_MX.panel.secciones.invitados.titulo,
  // Detrás de sesión: nadie debe llegar aquí desde un buscador.
  robots: { index: false, follow: false },
};

export default async function PaginaInvitados({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  return <PantallaInvitados invitationId={Number(invitationId)} />;
}
